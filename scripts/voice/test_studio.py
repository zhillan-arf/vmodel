"""Contract/security tests use synthetic frames and fake inference, never a device."""
import asyncio
import copy
import json
from pathlib import Path
import struct
import sys
import tempfile
import time
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parent))
import numpy as np
from aiohttp import WSMsgType, WSServerHandshakeError
from aiohttp.test_utils import TestClient, TestServer
from profiles import defaults, fingerprint, update, validate, load_profiles, save_profiles, natural_default,validate_natural,update_natural
from studio_server import ROOT, HEADER, OUTPUT_HEADER, VoiceState, create_app


class ProfileTests(unittest.TestCase):
    def test_natural_profile_never_auto_starts_or_falls_back(self):
        p=natural_default()
        for key,value in [('activeOnStartup',True),('requiresExplicitStart',False),('automaticFallbackAllowed',True),('outputKind','VMOA')]:
            bad=copy.deepcopy(p);bad[key]=value
            with self.assertRaises(ValueError):validate_natural(bad)
        changed=update_natural(p,{'inputDeviceId':'test-natural-device','outputGain':.75})
        self.assertNotEqual(changed['sync']['fingerprint'],p['sync']['fingerprint'])
        self.assertFalse(changed['sync']['verified']);self.assertFalse(changed['backend']['neuralInference'])
    def test_untrusted_profile_fields_rejected(self):
        for key,value in [('pitchSemitones',12),('modelSha256','forged'),('liveAccepted',True),('inputGain',float('nan')),('outputGain',3)]:
            with self.subTest(key=key):
                profile=defaults()['bright'];profile[key]=value
                with self.assertRaises(ValueError):validate(profile)
        with self.assertRaises(ValueError):update(defaults()['bright'],{'contextMs':0})
    def test_device_context_change_invalidates_sync(self):
        profile=defaults()['bright'];old=profile['sync']['fingerprint']
        changed=update(profile,{'contextMs':800,'inputDeviceId':'test-device'})
        self.assertNotEqual(changed['sync']['fingerprint'],old)
        self.assertFalse(changed['sync']['verified']);self.assertIsNone(changed['sync']['videoDelayMs'])
        self.assertEqual(changed['sync']['fingerprint'],fingerprint(changed))
    def test_round_trip_three_profiles_and_selection(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'assets/voice') as directory:
            path=Path(directory)/'profiles.json';profiles=defaults();profiles['soft']=update(profiles['soft'],{'outputGain':.5})
            save_profiles(path,profiles,'soft');saved,selected=load_profiles(path)
            self.assertEqual(selected,'soft');self.assertEqual(saved,profiles)


class FakeEngine:
    delay=0
    fail_load=False
    fail_process=False
    def load(self,profile):
        if self.fail_load:raise RuntimeError('Test load failure')
    def reset(self):pass
    def process(self,pcm):
        time.sleep(self.delay)
        if self.fail_process:raise RuntimeError('Test inference failure')
        return np.full(6400,.125,dtype=np.float32)


class StudioTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=ROOT/'assets/voice')
        self.engine=FakeEngine();app=create_app(Path(self.temp.name),lambda:self.engine)
        self.client=TestClient(TestServer(app));await self.client.start_server()
        self.state=app['voice'];self.origin=str(self.client.make_url('/')).rstrip('/')
        self.headers={'Origin':self.origin};self.sockets=[]
    async def asyncTearDown(self):
        for ws in self.sockets:await ws.close()
        await self.client.close();self.temp.cleanup()
    async def post(self,path,data):
        return await self.client.post(path,json=data,headers=self.headers)
    async def owner(self):
        response=await self.post('/api/claim',{});self.assertEqual(response.status,200)
        self.owner_data=await response.json();self.lease={k:self.owner_data[k] for k in ['sessionId','controlKey']}
        ws=await self.client.ws_connect('/ws/control',headers=self.headers);self.sockets.append(ws)
        await ws.send_json(self.lease);await ws.receive_json();self.control=ws
        async def receive_control():
            async for _ in ws:pass
        self.control_reader=asyncio.create_task(receive_control())
    async def output(self,route=None,natural=False):
        ws=await self.client.ws_connect('/ws/natural-output' if natural else '/ws/output',headers=self.headers);self.sockets.append(ws)
        await ws.send_json(route or self.owner_data['naturalOutputRoute' if natural else 'outputRoute']);return ws
    async def command(self,action,**extra):
        response=await self.post('/api/action',{**self.lease,'action':action,**extra})
        self.assertEqual(response.status,200,await response.text());return await response.json()
    async def wait_for(self,predicate):
        for _ in range(150):
            if predicate():return
            await asyncio.sleep(.01)
        self.fail('State transition timed out')
    def frame(self,sequence=0,natural=False):
        return HEADER.pack(b'VMNI' if natural else b'VMIN',self.state.epoch,sequence,16000)+np.full(2560,.25,dtype='<f4').tobytes()
    async def test_host_origin_and_static_allowlist(self):
        for path in ['/api/claim','/api/action','/api/status','/api/shutdown']:
            for headers in [{},{'Origin':'https://untrusted.example'}]:
                response=await self.client.post(path,json={},headers=headers);self.assertEqual(response.status,403)
        response=await self.client.get('/health',headers={'Host':'attacker.example'});self.assertEqual(response.status,421)
        for path in ['/ws/control','/ws/input','/ws/output','/ws/natural-input','/ws/natural-output']:
            with self.assertRaises(WSServerHandshakeError):await self.client.ws_connect(path,headers={'Origin':'https://untrusted.example'})
        for path in ['/assets/voice/chihaya/V2-AISO-SYAKITTO.pth','/audio/source.wav','/route.json']:
            response=await self.client.get(path);self.assertEqual(response.status,404)
        response=await self.client.get('/obs');self.assertEqual(response.headers['Permissions-Policy'],'camera=(), microphone=()')
        response=await self.client.get('/obs-natural');self.assertEqual(response.headers['Permissions-Policy'],'camera=(), microphone=()')

    async def test_natural_requires_explicit_ack_and_distinct_route_key(self):
        await self.owner()
        response=await self.post('/api/action',{**self.lease,'action':'start-natural'})
        self.assertEqual(response.status,400);self.assertTrue(self.state.muted)
        self.assertNotEqual(self.owner_data['outputRoute']['outputKey'],self.owner_data['naturalOutputRoute']['outputKey'])
        wrong=await self.output(self.owner_data['outputRoute'],natural=True)
        reply=await wrong.receive();self.assertEqual(reply.type,WSMsgType.CLOSE);self.assertEqual(reply.data,1008)
        wrong=await self.output(self.owner_data['naturalOutputRoute'])
        reply=await wrong.receive();self.assertEqual(reply.type,WSMsgType.CLOSE);self.assertEqual(reply.data,1008)

    async def test_natural_pcm_never_enters_converted_route_and_modes_flush(self):
        await self.owner();converted=await self.output();await converted.receive_json()
        natural=await self.output(natural=True);await natural.receive_json()
        await self.command('start-natural',acknowledgeNaturalVoice=True,changes={'inputGain':.5,'outputGain':.75})
        self.assertIsNone(self.state.engine)
        await self.state.input_packet(self.frame(natural=True),self.lease['sessionId'])
        while True:
            message=await natural.receive()
            if message.type==WSMsgType.BINARY:break
        self.assertEqual(OUTPUT_HEADER.unpack_from(message.data)[0],b'VMNA')
        pcm=np.frombuffer(message.data,offset=24,dtype='<f4');self.assertAlmostEqual(float(np.mean(pcm[100:])),.25*.5*.75,places=5)
        self.assertTrue(self.state.snapshot('converted')['muted']);self.assertFalse(self.state.snapshot('natural')['muted'])
        self.assertTrue(all(listener['queue'].qsize()<=2 for listener in self.state.listeners.values()))
        # Converted receiver has received only state frames during natural mode.
        while True:
            try:message=await asyncio.wait_for(converted.receive(),.05)
            except asyncio.TimeoutError:break
            self.assertNotEqual(message.type,WSMsgType.BINARY)
        old=self.state.epoch;await self.command('reference');self.assertGreater(self.state.epoch,old)
        self.assertTrue(self.state.snapshot('natural')['muted'])
        with self.assertRaises(ValueError):await self.state.input_packet(HEADER.pack(b'VMNI',old,1,16000)+np.zeros(2560,dtype='<f4').tobytes(),self.lease['sessionId'])
        await self.command('stop');self.assertTrue(self.state.snapshot('converted')['muted']);self.assertTrue(self.state.snapshot('natural')['muted'])

    async def test_natural_input_kind_failure_and_disconnect_mute(self):
        await self.owner();await self.command('start-natural',acknowledgeNaturalVoice=True)
        ws=await self.client.ws_connect('/ws/natural-input',headers=self.headers);self.sockets.append(ws);await ws.send_json(self.lease)
        await ws.send_bytes(self.frame(natural=False));await ws.receive();await self.wait_for(lambda:self.state.muted)
        await self.command('start-natural',acknowledgeNaturalVoice=True)
        await self.control.close();await self.wait_for(lambda:self.state.muted)
        self.assertEqual(self.state.mode,'idle');self.assertIsNone(self.state.engine)

    async def test_conversion_failure_does_not_select_natural(self):
        await self.owner();self.engine.fail_load=True
        await self.command('start-live');await self.wait_for(lambda:self.state.status=='error')
        self.assertEqual(self.state.mode,'idle');self.assertFalse(self.state.snapshot()['naturalVoiceActive'])
        self.assertTrue(self.state.snapshot('natural')['muted'])
    async def test_other_window_cannot_take_producer_or_output(self):
        await self.owner()
        response=await self.post('/api/claim',{});self.assertEqual(response.status,409)
        response=await self.post('/api/action',{'action':'reference','sessionId':'wrong','controlKey':'wrong'});self.assertEqual(response.status,403)
        ws=await self.output({'routeId':'wrong','outputKey':'wrong'});reply=await ws.receive();self.assertEqual(reply.type,WSMsgType.CLOSE);self.assertEqual(reply.data,1008)
    async def test_converted_reference_only_and_output_receive_only(self):
        await self.owner();self.assertEqual(set(self.state.references),{'bright','soft','cool'})
        output=await self.output();await output.receive_json();await self.command('reference')
        while True:
            message=await output.receive()
            if message.type==WSMsgType.BINARY:break
        magic,epoch,seq,rate,issued=OUTPUT_HEADER.unpack_from(message.data)
        self.assertEqual((magic,epoch,seq,rate),(b'VMOA',self.state.epoch,0,40000))
        self.assertLess(abs(time.time()*1000-issued),400)
        import soundfile as sf
        converted,_=sf.read(self.state.references['bright'],dtype='float32')
        np.testing.assert_array_equal(np.frombuffer(message.data,offset=24,dtype='<f4'),converted[:6400])
        await output.send_bytes(self.frame());reply=await output.receive()
        while reply.type not in (WSMsgType.CLOSE,WSMsgType.CLOSED):reply=await output.receive()
        self.assertEqual(output.close_code,1008)
    async def test_stopped_conversion_cannot_emit_stale_audio(self):
        await self.owner();output=await self.output();await output.receive_json();self.engine.delay=.1
        await self.command('start-live');await self.wait_for(lambda:self.state.mode=='live')
        await self.state.input_packet(self.frame(),self.lease['sessionId']);await self.wait_for(lambda:self.state.engine_busy)
        old=self.state.epoch;await self.command('stop');await asyncio.sleep(.15)
        self.assertGreater(self.state.epoch,old);self.assertTrue(self.state.muted);self.assertEqual(self.state.output_sequence,0)
    async def test_late_frames_stop_silently_and_mailbox_is_bounded(self):
        await self.owner();self.engine.delay=.19
        await self.command('start-live');await self.wait_for(lambda:self.state.mode=='live')
        for index in range(3):
            await self.state.input_packet(self.frame(index),self.lease['sessionId'])
            await self.wait_for(lambda:self.state.metrics['processed']>=index+1)
        self.assertEqual(self.state.status,'overloaded');self.assertTrue(self.state.muted);self.assertEqual(self.state.output_sequence,0)
        self.engine.delay=0;await self.command('start-live');await self.wait_for(lambda:self.state.mode=='live')
        for index in range(20):await self.state.input_packet(self.frame(index),self.lease['sessionId'])
        self.assertEqual(self.state.metrics['droppedInput'],19);self.assertEqual(self.state.pending['sequence'],19)
        self.assertEqual(self.state.pending['audio'].size,2560)
    async def test_backend_load_and_conversion_failure_mute(self):
        await self.owner();self.engine.fail_load=True
        await self.command('start-live');await self.wait_for(lambda:self.state.status=='error');self.assertTrue(self.state.muted)
        self.engine.fail_load=False;self.engine.fail_process=True
        await self.command('start-live');await self.wait_for(lambda:self.state.mode=='live')
        await self.state.input_packet(self.frame(),self.lease['sessionId']);await self.wait_for(lambda:self.state.status=='error')
        self.assertEqual(self.state.output_sequence,0);self.assertTrue(self.state.muted)
    async def test_controller_disconnect_stops_and_reconnect_stays_muted(self):
        await self.owner();await self.command('reference');await self.control.close()
        await self.wait_for(lambda:self.state.status=='disconnected');self.assertTrue(self.state.muted)
        response=await self.post('/api/claim',self.lease);self.assertEqual(response.status,200)
        response=await self.post('/api/action',{**self.lease,'action':'reference'});self.assertEqual(response.status,403)


if __name__=='__main__':unittest.main(verbosity=2)
