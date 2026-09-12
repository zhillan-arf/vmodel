"""Loopback controls with separate converted and explicit natural PCM routes.

The microphone is opened only by the user's browser action. Reference-demo
audio is the licensed converted catalog. No failure enables natural speech.
"""
from __future__ import annotations
import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import struct
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from profiles import defaults, load_profiles, save_profiles, update, validate, natural_default, validate_natural, update_natural

UI = Path(__file__).parent / 'studio'
HEADER = struct.Struct('<4sIII')
OUTPUT_HEADER = struct.Struct('<4sIIId')
MAX_FRAME = HEADER.size + 2560*4


def secure_equal(a,b):
    return isinstance(a,str) and isinstance(b,str) and hmac.compare_digest(a,b)


def json_write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary = path.with_suffix('.pending.json')
    temporary.write_text(json.dumps(data,indent=2),encoding='utf-8')
    temporary.replace(path)


class VoiceState:
    def __init__(self,state_dir,engine_factory=None):
        self.directory = Path(state_dir).resolve()
        self.directory.relative_to(ROOT)
        self.directory.mkdir(parents=True,exist_ok=True)
        route_path = self.directory / 'route.json'
        if route_path.exists():
            self.route = json.loads(route_path.read_text())
            if set(self.route) != {'schemaVersion','routeId','outputKey','adminKey'} or self.route['schemaVersion'] != 1:
                raise ValueError('Invalid local route identity; restore its private state file')
            if any(not isinstance(self.route[k],str) or len(self.route[k]) < 24 for k in ['routeId','outputKey','adminKey']):
                raise ValueError('Invalid local route identity')
        else:
            self.route = {'schemaVersion':1,'routeId':secrets.token_urlsafe(24),'outputKey':secrets.token_urlsafe(32),'adminKey':secrets.token_urlsafe(32)}
            json_write(route_path,self.route)
        natural_path=self.directory/'natural-route.json'
        if natural_path.exists():
            self.natural_route=json.loads(natural_path.read_text())
            if set(self.natural_route)!={'schemaVersion','routeId','outputKey'} or self.natural_route['schemaVersion']!=1:raise ValueError('Invalid natural route')
            if any(not isinstance(self.natural_route[k],str) or len(self.natural_route[k])<24 for k in ['routeId','outputKey']):raise ValueError('Invalid natural route key')
        else:
            self.natural_route={'schemaVersion':1,'routeId':secrets.token_urlsafe(24),'outputKey':secrets.token_urlsafe(32)}
            json_write(natural_path,self.natural_route)
        if any(self.natural_route[k]==self.route[k] for k in ['routeId','outputKey']):raise ValueError('Natural and converted routes must have separate keys')
        natural_profile_path=self.directory/'natural-profile.json'
        self.natural_profile=validate_natural(json.loads(natural_profile_path.read_text())) if natural_profile_path.exists() else natural_default()
        self.natural_pcm=None
        self.profiles,self.selected = load_profiles(self.directory / 'profiles.json')
        self.lease = None
        self.lease_expires = 0.0
        self.control_ws = None
        self.input_ws = None
        self.listeners = {}
        self.epoch = secrets.randbelow(2**30)
        self.mode = 'idle'
        self.status = 'muted'
        self.message = 'Ready for a reference demo. Live quality and latency are not accepted.'
        self.muted = True
        self.pending = None
        self.pending_event = asyncio.Event()
        self.executor = ThreadPoolExecutor(max_workers=1,thread_name_prefix='local-rvc')
        self.engine = None
        self.engine_factory = engine_factory
        self.engine_busy = False
        self.load_task = None
        self.demo_task = None
        self.consumer_task = None
        self.heartbeat_task = None
        self.last_input_sequence = -1
        self.last_processed_sequence = -1
        self.output_sequence = 0
        self.metrics = {'inputRms':0.0,'outputRms':0.0,'processed':0,'late':0,'droppedInput':0,'lastComputeMs':None}
        self.consecutive_late = 0
        self.closed = False
        self.references = self._reference_catalog()

    def _reference_catalog(self):
        data = ROOT / 'assets/voice/auditions/reference-v1'
        manifest = json.loads((data / 'manifest.json').read_text())
        result = {}
        for item in manifest['items']:
            if item['id'] not in ('bright','soft','cool'):
                continue  # The natural source is deliberately excluded from broadcast.
            path = (ROOT / item['path']).resolve()
            path.relative_to(data)
            if hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
                raise ValueError('Converted reference catalog changed')
            result[item['id']] = path
        if set(result) != {'bright','soft','cool'}:
            raise ValueError('Three verified converted references are required')
        return result

    def snapshot(self,output_kind=None):
        natural=output_kind=='natural'
        active=self.mode=='natural' if natural else self.mode in ('reference','live')
        output_muted=self.muted or (output_kind is not None and not active)
        metrics=dict(self.metrics)
        if output_kind is not None:
            metrics['inputRms']=0.0
            if output_muted:metrics['outputRms']=0.0
        return {'type':'state','routeId':(self.natural_route if natural else self.route)['routeId'],'epoch':self.epoch,
                'producerId':self.lease['id'] if self.lease else None,
                'mode':self.mode,'status':self.status,'message':self.message,'muted':output_muted,
                'outputKind':'VMNA' if natural else 'VMOA',
                'selected':self.selected,'backend':'Natural voice / local PCM' if self.mode=='natural' else 'Local CPU','liveAccepted':False,
                'metrics':metrics,'sampleRate':40000,'chunkSamples':6400,
                'maxOutputQueuedSamples':9600,'outputPrefillSamples':1600,'maxInputQueuedBlocks':1,
                'outputListeners':len(self.listeners),
                'naturalVoiceBypassAvailable':True,'naturalVoiceActive':self.mode=='natural','microphoneOwnedByBrowser':True}

    async def announce(self,reset=False):
        message = self.snapshot()
        if reset:
            message['reset'] = True
        if self.control_ws is not None and not self.control_ws.closed:
            try:
                await asyncio.wait_for(self.control_ws.send_json(message),0.2)
            except (Exception,asyncio.CancelledError):
                pass
        for listener in list(self.listeners.values()):
            queue=listener['queue']
            output_message=self.snapshot(listener['kind'])
            if reset:output_message['reset']=True
            if reset:
                while not queue.empty():
                    queue.get_nowait()
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(output_message)

    def check_lease(self,data):
        if not self.lease or not secure_equal(data.get('sessionId'),self.lease['id']) or not secure_equal(data.get('controlKey'),self.lease['key']):
            raise PermissionError('This window does not own the voice producer')

    async def claim(self,data):
        if self.lease and (self.control_ws is not None or time.monotonic() < self.lease_expires):
            self.check_lease(data)
        else:
            await self.stop('muted','Audio controls attached; output is muted.')
            self.lease = {'id':secrets.token_urlsafe(24),'key':secrets.token_urlsafe(32)}
        self.lease_expires = time.monotonic()+30
        return {'sessionId':self.lease['id'],'controlKey':self.lease['key'],
                'outputRoute':{'routeId':self.route['routeId'],'outputKey':self.route['outputKey']},
                'naturalOutputRoute':{'routeId':self.natural_route['routeId'],'outputKey':self.natural_route['outputKey']},
                'state':self.snapshot(),'profiles':self.profiles,'naturalProfile':self.natural_profile}

    async def stop(self,status='muted',message='Stopped. Output is muted.'):
        self.epoch += 1
        self.mode,self.status,self.message,self.muted = 'idle',status,message,True
        self.pending = None
        self.pending_event.clear()
        self.metrics['inputRms'] = self.metrics['outputRms'] = 0.0
        if self.natural_pcm is not None:self.natural_pcm.reset()
        current = asyncio.current_task()
        if self.demo_task and self.demo_task is not current:
            self.demo_task.cancel()
        self.demo_task = None
        await self.announce(reset=True)
        if self.input_ws is not None and not self.input_ws.closed:
            await self.input_ws.close(code=1000,message=b'Voice input stopped')

    async def emit(self,audio,epoch,output_kind='converted'):
        import numpy as np
        active=self.mode=='natural' if output_kind=='natural' else self.mode in ('reference','live')
        if epoch != self.epoch or not active or self.muted:
            return
        audio = np.asarray(audio,dtype='<f4')
        if audio.shape != (6400,) or not np.isfinite(audio).all():
            await self.stop('error','Invalid converted output; muted.')
            return
        # A final bound protects the audio output regardless of model values.
        profile=self.natural_profile if output_kind=='natural' else self.profiles[self.selected]
        audio = np.clip(audio*profile['outputGain'],-0.98,0.98)
        self.metrics['outputRms'] = float(np.sqrt(np.mean(audio**2)))
        packet = OUTPUT_HEADER.pack(b'VMNA' if output_kind=='natural' else b'VMOA',epoch,self.output_sequence,40000,time.time()*1000)+audio.tobytes()
        self.output_sequence += 1
        for listener in list(self.listeners.values()):
            if listener['kind']!=output_kind:continue
            queue=listener['queue']
            if queue.full():
                queue.get_nowait()  # receiver sequence checks flush discontinuous output
            queue.put_nowait(packet)

    async def start_natural(self,changes):
        profile=update_natural(self.natural_profile,changes)
        await self.stop('muted','Switching to explicitly requested natural speech; both routes cleared.')
        from natural_pcm import NaturalPCM
        self.natural_pcm=NaturalPCM()
        self.natural_profile=profile
        json_write(self.directory/'natural-profile.json',profile)
        self.mode,self.status,self.message,self.muted='natural','natural-ready','NATURAL VOICE TO OBS: your own speech, with no character model. Stop mutes both routes.',False
        self.last_input_sequence=self.last_processed_sequence=-1
        self.output_sequence=self.consecutive_late=0
        self.metrics={'inputRms':0.0,'outputRms':0.0,'processed':0,'late':0,'droppedInput':0,'lastComputeMs':None}
        await self.announce(reset=True)

    async def reference(self):
        import numpy as np
        import soundfile as sf
        await self.stop()
        epoch = self.epoch
        audio,rate = sf.read(self.references[self.selected],dtype='float32')
        if rate != 40000:
            raise ValueError('Unexpected converted reference sample rate')
        self.mode,self.status,self.message,self.muted = 'reference','reference','Playing a preconverted licensed reference. This is not live microphone conversion.',False
        self.output_sequence = 0
        await self.announce(reset=True)
        async def replay():
            try:
                start = time.monotonic()+0.15
                for index,offset in enumerate(range(0,len(audio),6400)):
                    await asyncio.sleep(max(0,start+index*0.16-time.monotonic()))
                    if epoch != self.epoch:
                        return
                    # A paused server never sends a burst of old reference audio.
                    if time.monotonic()-(start+index*0.16) > 0.16:
                        await self.stop('error','Reference playback fell behind; muted. Retry when the laptop is less busy.')
                        return
                    block = np.pad(audio[offset:offset+6400],(0,max(0,offset+6400-len(audio))))
                    await self.emit(block,epoch)
                await asyncio.sleep(0.2)
                if epoch == self.epoch:
                    await self.stop('muted','Reference finished. Output is muted.')
            except asyncio.CancelledError:
                pass
        self.demo_task = asyncio.create_task(replay())

    async def start_live(self):
        if self.engine_busy:
            raise ValueError('A model operation is finishing. Output remains muted; retry shortly.')
        await self.stop()
        epoch = self.epoch
        profile = validate(self.profiles[self.selected])
        self.status,self.message = 'loading','Loading one local voice. Output remains muted.'
        self.engine_busy = True
        await self.announce(reset=True)
        def load():
            if self.engine is None:
                if self.engine_factory:
                    self.engine = self.engine_factory()
                else:
                    from live_rvc import LiveRVC
                    self.engine = LiveRVC()
            self.engine.load(profile)
        async def perform_load():
            try:
                await asyncio.get_running_loop().run_in_executor(self.executor,load)
            except Exception:
                if epoch == self.epoch:
                    await self.stop('error','The local model could not load. Check the voice setup files; output is muted.')
                return
            finally:
                self.engine_busy = False
            if epoch == self.epoch:
                self.mode,self.status,self.message,self.muted = 'live','ready','Experimental live input ready. Late frames are muted; this laptop has not passed live timing.',False
                self.last_input_sequence = self.last_processed_sequence = -1
                self.output_sequence = self.consecutive_late = 0
                self.metrics = {'inputRms':0.0,'outputRms':0.0,'processed':0,'late':0,'droppedInput':0,'lastComputeMs':None}
                await self.announce(reset=True)
        self.load_task = asyncio.create_task(perform_load())

    async def input_packet(self,packet,session_id):
        import numpy as np
        if not self.lease or session_id != self.lease['id'] or self.mode not in ('live','natural') or self.status not in ('ready','converting','natural-ready','natural-speaking'):
            raise ValueError('No active input for this producer')
        if len(packet) != MAX_FRAME:
            raise ValueError('Invalid input block size')
        magic,epoch,sequence,rate = HEADER.unpack_from(packet)
        natural=self.mode=='natural'
        if magic != (b'VMNI' if natural else b'VMIN') or epoch != self.epoch or rate != 16000 or sequence <= self.last_input_sequence:
            raise ValueError('Wrong input epoch, sequence or rate')
        audio = np.frombuffer(packet,offset=HEADER.size,dtype='<f4').copy()
        if not np.isfinite(audio).all() or float(np.max(np.abs(audio))) > 2:
            raise ValueError('Nonfinite or out-of-range input')
        self.last_input_sequence = sequence
        self.metrics['inputRms'] = float(np.sqrt(np.mean(audio**2)))
        if natural:
            started=time.monotonic()
            try:
                if sequence!=self.last_processed_sequence+1:self.natural_pcm.reset()
                result=self.natural_pcm.process(audio*self.natural_profile['inputGain'])
                self.last_processed_sequence=sequence
                self.metrics['lastComputeMs']=(time.monotonic()-started)*1000
                self.metrics['processed']+=1
                if self.metrics['lastComputeMs']>160:
                    self.metrics['late']+=1
                    await self.stop('overloaded','Natural audio missed its deadline. Both routes muted; start explicitly to retry.')
                else:
                    self.status='natural-speaking'
                    await self.emit(result,epoch,'natural')
            except Exception:
                await self.stop('error','Natural audio processing failed. Both routes are muted; no other mode was started.')
            return
        if self.pending is not None:
            self.metrics['droppedInput'] += 1
        self.pending = {'audio':audio*self.profiles[self.selected]['inputGain'],'epoch':epoch,
                        'sequence':sequence,'received':time.monotonic()}
        self.pending_event.set()

    async def consume(self):
        while not self.closed:
            await self.pending_event.wait()
            self.pending_event.clear()
            item,self.pending = self.pending,None
            if not item or item['epoch'] != self.epoch or self.mode != 'live':
                continue
            if self.engine_busy:
                continue
            self.engine_busy = True
            started = time.monotonic()
            def convert():
                if item['sequence'] != self.last_processed_sequence+1:
                    self.engine.reset()
                return self.engine.process(item['audio'])
            try:
                audio = await asyncio.get_running_loop().run_in_executor(self.executor,convert)
                if item['epoch'] != self.epoch or self.mode != 'live':
                    continue
                self.last_processed_sequence = item['sequence']
                self.metrics['processed'] += 1
                self.metrics['lastComputeMs'] = (time.monotonic()-started)*1000
                if time.monotonic()-item['received'] > self.profiles[self.selected]['audio']['lateCutoffMs']/1000:
                    self.metrics['late'] += 1
                    self.metrics['outputRms'] = 0.0
                    self.consecutive_late += 1
                    self.message = 'Conversion missed its output deadline; that block was muted.'
                    if self.consecutive_late >= 3:
                        await self.stop('overloaded','Three conversion deadlines missed. Microphone input stopped; output is muted. Use the reference demo for routing checks.')
                    else:
                        await self.announce()
                else:
                    self.consecutive_late = 0
                    self.status = 'converting'
                    await self.emit(audio,item['epoch'])
            except Exception:
                if item['epoch'] == self.epoch:
                    await self.stop('error','Conversion failed. Input stopped and output muted; no natural voice was substituted.')
            finally:
                self.engine_busy = False

    async def heartbeat(self):
        while not self.closed:
            await asyncio.sleep(0.5)
            await self.announce()

    async def start(self):
        self.consumer_task = asyncio.create_task(self.consume())
        self.heartbeat_task = asyncio.create_task(self.heartbeat())

    async def close(self):
        self.closed = True
        await self.stop()
        for task in [self.consumer_task,self.heartbeat_task]:
            if task:
                task.cancel()
        for ws in [self.control_ws,self.input_ws,*self.listeners]:
            if ws is not None and not ws.closed:
                await ws.close()
        if self.load_task:
            await asyncio.gather(self.load_task,return_exceptions=True)
        self.executor.shutdown(wait=False,cancel_futures=True)


def create_app(state_dir=ROOT/'assets/voice/studio',engine_factory=None):
    from aiohttp import web, WSMsgType
    state = VoiceState(state_dir,engine_factory)
    @web.middleware
    async def boundaries(request,handler):
        port = request.transport.get_extra_info('sockname')[1]
        host = request.headers.get('Host','').lower()
        if host not in {f'127.0.0.1:{port}',f'localhost:{port}'}:
            raise web.HTTPMisdirectedRequest(text='Loopback host required')
        if request.path.startswith(('/api/','/ws/')) and request.headers.get('Origin') != 'http://'+host:
            raise web.HTTPForbidden(text='Same-origin loopback browser required')
        try:
            response = await handler(request)
        except PermissionError:
            response = web.json_response({'error':'This window does not own the producer or route'},status=403)
        except (ValueError,KeyError,TypeError,json.JSONDecodeError):
            response = web.json_response({'error':'Invalid or unsupported voice request'},status=400)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(self)' if request.path == '/' else 'camera=(), microphone=()'
        response.headers['Content-Security-Policy'] = f"default-src 'none'; script-src 'self'; style-src 'self'; media-src 'self' blob:; connect-src 'self' ws://{host}; worker-src 'self'; base-uri 'none'; frame-ancestors 'none'"
        return response
    app = web.Application(middlewares=[boundaries],client_max_size=16384)
    app['voice'] = state
    app['shutdown_event'] = asyncio.Event()
    async def body(request):
        if request.content_type != 'application/json':
            raise ValueError('JSON required')
        value = await request.json()
        if not isinstance(value,dict):
            raise ValueError('JSON object required')
        return value
    async def health(request):
        return web.json_response({'application':'vmodel-voice','status':state.status,'microphoneCapturedByServer':False,'liveAccepted':False})
    async def status(request):
        await body(request)
        return web.json_response(state.snapshot())
    async def claim(request):
        data = await body(request)
        try:
            result = await state.claim(data)
        except PermissionError:
            return web.json_response({'error':'Another Voice Studio window owns the producer. Reconnect that window or wait 30 seconds after closing it.'},status=409)
        return web.json_response(result)
    async def action(request):
        data = await body(request)
        state.check_lease(data)
        command = data.get('action')
        if command != 'stop' and (state.control_ws is None or state.control_ws.closed):
            raise PermissionError('Reconnect the controlling window first')
        if command == 'stop':
            await state.stop()
        elif command == 'reference':
            await state.reference()
        elif command == 'start-live':
            await state.start_live()
        elif command == 'start-natural':
            if data.get('acknowledgeNaturalVoice') is not True:raise ValueError('Natural speech requires an explicit acknowledgement')
            await state.start_natural(data.get('changes',{}))
        elif command == 'select':
            if data.get('voice') not in state.profiles:
                raise ValueError('Unknown voice')
            await state.stop('muted','Preset changed; buffers cleared and output muted.')
            state.selected = data['voice']
            await state.announce(reset=True)
        elif command == 'save':
            await state.stop('muted','Settings saved; output stays muted until started again.')
            state.profiles[state.selected] = update(state.profiles[state.selected],data.get('changes',{}))
            save_profiles(state.directory/'profiles.json',state.profiles,state.selected)
        elif command == 'reset':
            await state.stop()
            state.profiles[state.selected] = defaults()[state.selected]
            save_profiles(state.directory/'profiles.json',state.profiles,state.selected)
        else:
            raise ValueError('Unknown action')
        return web.json_response({'state':state.snapshot(),'profiles':state.profiles,'naturalProfile':state.natural_profile})
    async def shutdown(request):
        data = await body(request)
        if not secure_equal(data.get('adminKey'),state.route['adminKey']):
            raise PermissionError()
        await state.stop()
        app['shutdown_event'].set()
        return web.json_response({'stopping':True})
    async def ws_auth(request,kind):
        ws = web.WebSocketResponse(heartbeat=5,max_msg_size=MAX_FRAME+1,compress=False,writer_limit=32768)
        await ws.prepare(request)
        try:
            first = await asyncio.wait_for(ws.receive_json(),3)
            if not isinstance(first,dict):
                raise ValueError()
            if kind in ('output','natural-output'):
                route=state.natural_route if kind=='natural-output' else state.route
                if not secure_equal(first.get('routeId'),route['routeId']) or not secure_equal(first.get('outputKey'),route['outputKey']):
                    raise PermissionError()
            else:
                state.check_lease(first)
            return ws,first
        except Exception:
            await ws.close(code=1008,message=b'Voice session authorization required')
            return ws,None
    async def control(request):
        ws,data = await ws_auth(request,'control')
        if data is None:
            return ws
        if state.control_ws is not None and not state.control_ws.closed:
            await ws.close(code=1008,message=b'Producer already has a control window')
            return ws
        state.control_ws = ws
        await ws.send_json(state.snapshot())
        try:
            async for message in ws:
                if message.type != WSMsgType.TEXT or message.data != 'ping':
                    await ws.close(code=1008,message=b'Unsupported control frame')
                    break
        finally:
            if state.control_ws is ws:
                state.control_ws = None
                state.lease_expires = time.monotonic()+30
                await state.stop('disconnected','Control window disconnected. Output muted; reconnect and start explicitly.')
        return ws
    async def input_stream(request):
        ws,data = await ws_auth(request,'input')
        if data is None:
            return ws
        expected_mode='natural' if request.path=='/ws/natural-input' else 'live'
        if (state.input_ws is not None and not state.input_ws.closed) or state.mode != expected_mode:
            await ws.close(code=1008,message=b'One ready input producer is required')
            return ws
        state.input_ws = ws
        try:
            async for message in ws:
                if message.type != WSMsgType.BINARY:
                    raise ValueError('Binary input required')
                await state.input_packet(message.data,data['sessionId'])
        except (ValueError,PermissionError):
            await ws.close(code=1008,message=b'Invalid input frame')
        finally:
            if state.input_ws is ws:
                state.input_ws = None
                if state.mode in ('live','natural'):
                    await state.stop('disconnected','Microphone input disconnected; output muted.')
        return ws
    async def output_stream(request):
        natural=request.path=='/ws/natural-output'
        ws,data = await ws_auth(request,'natural-output' if natural else 'output')
        if data is None:
            return ws
        if len(state.listeners) >= 6:
            await ws.close(code=1013,message=b'Too many output listeners')
            return ws
        queue = asyncio.Queue(maxsize=2)
        output_kind='natural' if natural else 'converted'
        state.listeners[ws] = {'queue':queue,'kind':output_kind}
        queue.put_nowait({**state.snapshot(output_kind),'reset':True})
        async def send():
            try:
                while not ws.closed:
                    packet = await queue.get()
                    operation = ws.send_bytes(packet) if isinstance(packet,bytes) else ws.send_json(packet)
                    await asyncio.wait_for(operation,0.15)
            except (TimeoutError,ConnectionError):
                await ws.close(code=1013,message=b'Output fell behind; reconnect muted')
        sender = asyncio.create_task(send())
        try:
            async for message in ws:
                if message.type not in (WSMsgType.PING,WSMsgType.PONG):
                    await ws.close(code=1008,message=b'Output route is receive-only')
        finally:
            sender.cancel()
            await asyncio.gather(sender,return_exceptions=True)
            state.listeners.pop(ws,None)
        return ws
    static = {'/':'index.html','/obs':'obs.html','/obs-natural':'obs-natural.html','/style.css':'style.css','/studio.js':'studio.js',
              '/player.js':'player.js','/pcm-player.js':'pcm-player.js','/pcm-input.js':'pcm-input.js'}
    async def static_file(request):
        name = static.get(request.path)
        if not name:
            raise web.HTTPNotFound()
        return web.FileResponse(UI/name)
    app.router.add_get('/health',health)
    app.router.add_post('/api/status',status)
    app.router.add_post('/api/claim',claim)
    app.router.add_post('/api/action',action)
    app.router.add_post('/api/shutdown',shutdown)
    app.router.add_get('/ws/control',control)
    app.router.add_get('/ws/input',input_stream)
    app.router.add_get('/ws/natural-input',input_stream)
    app.router.add_get('/ws/output',output_stream)
    app.router.add_get('/ws/natural-output',output_stream)
    for path in static:
        app.router.add_get(path,static_file)
    async def startup(app):
        await state.start()
    async def cleanup(app):
        await state.close()
    app.on_startup.append(startup)
    app.on_cleanup.append(cleanup)
    return app


async def run(args):
    from aiohttp import web
    app = create_app(args.state_dir)
    runner = web.AppRunner(app,access_log=None,shutdown_timeout=2)
    await runner.setup()
    site = web.TCPSite(runner,'127.0.0.1',args.port)
    await site.start()
    print(f'Voice Studio ready at http://127.0.0.1:{args.port}/ ; microphone starts only by browser action',flush=True)
    try:
        await app['shutdown_event'].wait()
    finally:
        await runner.cleanup()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=5082)
    parser.add_argument('--state-dir',type=Path,default=ROOT/'assets/voice/studio')
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('Use an unprivileged local port')
    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        pass
