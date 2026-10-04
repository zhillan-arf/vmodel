// An owned isolated service restart with mocked Web Audio and denied media.
// No Voice Studio controller, producer, inference, OBS, monitoring or recording.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const reservation=net.createServer();await new Promise((resolve,reject)=>reservation.once('error',reject).listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const base=`http://127.0.0.1:${port}`,cache=await fs.mkdtemp(path.join(root,'.cache/voice/receiver-restart-'));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k.toUpperCase())));
const processes=[];let server,browser;
const exited=child=>child.exitCode!==null||child.signalCode!==null;
async function waitForExit(child,timeoutMs) {
  if(exited(child))return true;
  return new Promise(resolve=>{
    const finish=value=>{clearTimeout(timeout);child.removeListener('exit',onExit);resolve(value);};
    const onExit=()=>finish(true),timeout=setTimeout(()=>finish(false),timeoutMs);
    child.once('exit',onExit);
  });
}
async function startServer() {
  server=spawn(path.join(root,'.tools/voice/venv/Scripts/python.exe'),['-I',path.join(root,'scripts/voice/studio_server.py'),'--port',String(port),'--state-dir',cache],{cwd:root,env,windowsHide:true,stdio:['ignore','ignore','ignore']});
  processes.push(server);
  const readyUntil=performance.now()+8000;
  for(let i=0;i<80&&performance.now()<readyUntil;i++) {
    if(exited(server))throw Error('Owned test service could not start');
    try {
      const timeoutMs=Math.max(1,Math.min(500,Math.ceil(readyUntil-performance.now())));
      if((await fetch(base+'/health',{signal:AbortSignal.timeout(timeoutMs)})).ok)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Owned test service startup timed out');
}
async function stopServer() {
  if(!server||exited(server)){server=null;return;}
  const owned=server;
  try {
    const route=JSON.parse(await fs.readFile(path.join(cache,'route.json'),'utf8'));
    await fetch(base+'/api/shutdown',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({adminKey:route.adminKey}),signal:AbortSignal.timeout(2000)});
  }catch{}
  if(!await waitForExit(owned,4000)) {
    owned.kill();
    if(!await waitForExit(owned,2000))throw Error('Owned test service did not exit; refusing to reuse its port');
  }
  server=null;
}
const errors=[],external=[],producerRequests=[],pages=[],records=[];
try {
  await startServer();
  const privateRoutes={converted:JSON.parse(await fs.readFile(path.join(cache,'route.json'),'utf8')),natural:JSON.parse(await fs.readFile(path.join(cache,'natural-route.json'),'utf8'))};
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();
  await context.addInitScript(()=>{
    window.receiverTest={contexts:0,closed:0,microphoneRequests:0,pcm:0,resets:0,sockets:[]};
    navigator.mediaDevices.getUserMedia=async()=>{window.receiverTest.microphoneRequests++;throw Error('Physical media is forbidden in this test');};
    const NativeSocket=WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){super(...args);window.receiverTest.sockets.push(this.url);}};
    window.AudioContext=class {
      constructor(options){window.receiverTest.contexts++;this.sampleRate=options.sampleRate;this.state='running';this.destination={};this.audioWorklet={addModule:async()=>{}};}
      resume(){return Promise.resolve();}close(){this.state='closed';window.receiverTest.closed++;return Promise.resolve();}
      createGain(){return{gain:{value:1},connect:node=>node};}
    };
    window.AudioWorkletNode=class{constructor(){this.port={postMessage(message){if(message.type==='reset')window.receiverTest.resets++;if(message.type==='pcm')window.receiverTest.pcm++;}};}connect(node){return node;}};
  });
  context.on('request',request=>{if(!request.url().startsWith(base+'/'))external.push(request.url());if(/\/api\/(claim|action)|\/ws\/(control|input|natural-input)/.test(request.url()))producerRequests.push(request.url());});
  for(const kind of ['converted','natural']) {
    const page=await context.newPage();pages.push(page);page.on('pageerror',error=>errors.push(error.message));let navigations=0;page.on('framenavigated',()=>navigations++);
    const route=privateRoutes[kind],receiverPath=kind==='natural'?'/obs-natural':'/obs';
    await page.goto(base+receiverPath+'#route='+encodeURIComponent(route.routeId)+'&key='+encodeURIComponent(route.outputKey));
    await page.waitForFunction(()=>window.voiceOutput?.epoch!==null&&window.voiceOutput?.ws?.readyState===WebSocket.OPEN);
    records.push({kind,page,oldEpoch:await page.evaluate(()=>window.voiceOutput.epoch),navigations:()=>navigations});
  }
  await stopServer();
  for(const {page} of records)await page.waitForFunction(()=>window.voiceOutput.epoch===null&&!window.voiceOutput.allow);
  await new Promise(resolve=>setTimeout(resolve,1100));
  await startServer();
  const evidence=[];
  for(const record of records) {
    await record.page.waitForFunction(old=>window.voiceOutput.epoch!==null&&window.voiceOutput.epoch!==old&&window.voiceOutput.ws?.readyState===WebSocket.OPEN,record.oldEpoch,{timeout:15000});
    const result=await record.page.evaluate(()=>({allow:window.voiceOutput.allow,producer:window.voiceOutput.producer,contexts:window.receiverTest.contexts,microphoneRequests:window.receiverTest.microphoneRequests,pcm:window.receiverTest.pcm,resets:window.receiverTest.resets,sockets:window.receiverTest.sockets.map(url=>new URL(url).pathname)}));
    assert.equal(result.allow,false);assert.equal(result.producer,null);assert.equal(result.contexts,1);assert.equal(result.microphoneRequests,0);assert.equal(result.pcm,0);assert.equal(record.navigations(),1);assert(result.sockets.length>=2);
    assert(result.sockets.every(route=>route===(record.kind==='natural'?'/ws/natural-output':'/ws/output')));
    evidence.push({kind:record.kind,reconnectedWithoutNavigation:true,freshEpoch:true,mutedWithoutProducer:true,oneMockAudioContext:true,outputOnlySockets:result.sockets.length});
  }
  // A receiver with a replaced private identity must stop on auth rejection;
  // it must never acquire new keys or claim a producer to repair itself.
  await stopServer();
  for(const kind of ['converted','natural']) {
    const file=path.join(cache,kind==='natural'?'natural-route.json':'route.json');
    const value=JSON.parse(await fs.readFile(file,'utf8'));
    value.routeId=randomBytes(24).toString('hex');value.outputKey=randomBytes(32).toString('hex');
    await fs.writeFile(file,JSON.stringify(value));
  }
  await startServer();
  for(const [index,record] of records.entries()) {
    await record.page.waitForFunction(()=>window.voiceOutput.ws===null&&window.voiceOutput.retryTimer===null&&document.querySelector('#status').textContent.includes('Verify the private receiver route'),null,{timeout:15000});
    const before=await record.page.evaluate(()=>window.receiverTest.sockets.length);
    await record.page.waitForTimeout(1500);
    assert.equal(await record.page.evaluate(()=>window.receiverTest.sockets.length),before);
    assert.equal(await record.page.evaluate(()=>window.voiceOutput.allow),false);
    assert.equal(await record.page.evaluate(()=>window.receiverTest.microphoneRequests),0);
    assert.equal(await record.page.evaluate(()=>window.receiverTest.pcm),0);
    assert.equal(record.navigations(),1);
    await record.page.evaluate(()=>window.voiceOutput.close());assert.equal(await record.page.evaluate(()=>window.receiverTest.closed),1);
    evidence[index].replacedIdentityStopsRetries=true;
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(producerRequests,[]);
  const report={date:new Date().toISOString(),passed:true,receivers:evidence,physicalMicrophoneRequests:0,nativeAudioContextsOpened:0,producerActivated:false,OBSContacted:false,monitoringOrRecordingStarted:false,browserErrors:errors,externalRequests:external,boundary:'Real local WebSockets and an owned service restart, with mocked Web Audio. No physical media, neural inference, audio playback/quality or live latency acceptance.'};
  await fs.writeFile(path.join(root,'ops/001-zhil/sprint-001/reports/voice-reconnect-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {
  await browser?.close();await stopServer();
  for(const child of processes)if(!exited(child)){child.kill();await waitForExit(child,2000);}
}
