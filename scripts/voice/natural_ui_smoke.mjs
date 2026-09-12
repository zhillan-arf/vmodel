// Browser controls with mocked microphone/audio devices; no hardware is opened.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base='http://127.0.0.1:5085';
const cache=await fs.mkdtemp(path.join(root,'.cache/voice/natural-ui-'));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k.toUpperCase())));
const server=spawn(path.join(root,'.tools/voice/venv/Scripts/python.exe'),['-I',path.join(root,'scripts/voice/studio_server.py'),'--port','5085','--state-dir',cache],{cwd:root,env,windowsHide:true,stdio:['ignore','ignore','ignore']});
let browser;const errors=[],external=[];
try{
  for(let i=0;i<60;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1200}});
  await context.addInitScript(()=>{
    window.mock={requests:0,stops:0,contextsClosed:0,permission:'allow',nodes:[],tracks:[],sockets:[]};
    const NativeSocket=WebSocket;
    window.WebSocket=class extends NativeSocket{constructor(...args){super(...args);window.mock.sockets.push(this);}};
    navigator.mediaDevices.getUserMedia=async()=>{
      window.mock.requests++;
      if(window.mock.permission==='deny')throw new DOMException('Mock occupied microphone','NotReadableError');
      const track={stopped:false,handlers:{},stop(){if(!this.stopped){this.stopped=true;window.mock.stops++;}},addEventListener(name,fn){this.handlers[name]=fn;}};
      window.mock.tracks.push(track);return{getTracks:()=>[track]};
    };
    navigator.mediaDevices.enumerateDevices=async()=>[];
    window.AudioContext=class{constructor(options){this.sampleRate=options.sampleRate;this.state='running';this.destination={};this.audioWorklet={addModule:async()=>{}};}resume(){return Promise.resolve();}close(){this.state='closed';window.mock.contextsClosed++;return Promise.resolve();}createMediaStreamSource(){return{connect(node){return node;}};}};
    window.AudioWorkletNode=class{constructor(_context,name){this.name=name;this.port={onmessage:null};window.mock.nodes.push(this);}connect(){return this;}disconnect(){}};
  });
  context.on('request',req=>{if(!req.url().startsWith(base+'/'))external.push(req.url());});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#natural').disabled);
  assert.equal(await page.evaluate(()=>window.mock.requests),0);assert.equal(await page.locator('#monitor').isChecked(),false);
  await page.evaluate(async()=>{
    const lease=JSON.parse(sessionStorage.getItem('ene-voice-owner'));
    const claimed=await(await fetch('/api/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lease)})).json();
    window.packetCounts={natural:0,converted:0};window.observers=[];
    for(const kind of ['natural','converted']){
      const ws=new WebSocket('ws://'+location.host+'/ws/'+(kind==='natural'?'natural-output':'output'));ws.binaryType='arraybuffer';
      ws.onopen=()=>ws.send(JSON.stringify(kind==='natural'?claimed.naturalOutputRoute:claimed.outputRoute));
      ws.onmessage=({data})=>{if(data instanceof ArrayBuffer){window.packetCounts[kind]++;window.lastMagic=String.fromCharCode(...new Uint8Array(data,0,4));}};
      window.observers.push(ws);
    }
  });
  await page.waitForFunction(()=>window.observers.every(ws=>ws.readyState===WebSocket.OPEN));
  await page.locator('#natural').click();await page.waitForFunction(()=>window.mock.nodes.length===1&&window.mock.sockets.some(ws=>ws.url.endsWith('/ws/natural-input')&&ws.readyState===WebSocket.OPEN));
  assert.equal(await page.evaluate(()=>window.mock.requests),1);
  assert((await page.locator('#badge').textContent()).includes('NATURAL VOICE TO OBS'));
  await page.evaluate(()=>window.mock.nodes.at(-1).port.onmessage({data:new Float32Array(2560).fill(.1)}));
  await page.waitForFunction(()=>window.packetCounts.natural===1);
  assert.equal(await page.evaluate(()=>window.lastMagic),'VMNA');assert.equal(await page.evaluate(()=>window.packetCounts.converted),0);
  await page.screenshot({path:path.join(root,'ops/reports/local/voice/natural-active-mocked.png'),fullPage:true});
  await page.locator('[data-voice=soft]').click();await page.waitForFunction(()=>window.mock.stops===1&&!document.body.classList.contains('natural-active'));
  await page.evaluate(()=>window.mock.nodes[0].port.onmessage({data:new Float32Array(2560).fill(.2)}));
  await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.packetCounts.natural),1);
  await page.evaluate(()=>window.mock.permission='deny');await page.locator('#natural').click();
  await page.waitForFunction(()=>window.mock.requests===2&&document.querySelector('#message').textContent.includes('both routes muted'));
  assert.equal(await page.evaluate(()=>window.mock.tracks.filter(t=>!t.stopped).length),0);
  await page.evaluate(()=>window.mock.permission='allow');await page.locator('#natural').click();await page.waitForFunction(()=>window.mock.requests===3&&window.mock.nodes.length===2);
  await page.locator('#stop').click();await page.waitForFunction(()=>window.mock.stops===2);
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#natural').disabled);
  assert.equal(await page.evaluate(()=>window.mock.requests),0);assert((await page.locator('#natural-state').textContent()).includes('off'));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const profile=JSON.parse(await fs.readFile(path.join(cache,'natural-profile.json'),'utf8'));
  assert.equal(profile.automaticFallbackAllowed,false);assert.equal(profile.activeOnStartup,false);
  const report={date:new Date().toISOString(),passed:true,physicalMicrophoneRequests:0,nativeAudioContextsOpened:0,monitoringOrRecordingStarted:false,explicitNaturalActionRequestsMockedMicrophone:true,sourceModeClearlyLabelled:true,separateNaturalVMNAOnly:true,convertedRouteNaturalPackets:0,presetChangeFlushesAndStopsTrack:true,oldInputAfterSwitchDiscarded:true,mockedOccupiedDeviceMutesBothRoutes:true,stopReleasesMockedTracks:true,reloadDoesNotReopenMicrophone:true,persistedProfileCannotAutoStart:true,browserErrors:errors,externalRequests:external,boundary:'Synthetic PCM and mocked browser media/audio classes in an isolated service. No physical microphone, headphone monitoring, OBS recording, inference benchmark or human-quality acceptance.'};
  await fs.writeFile(path.join(root,'ops/reports/voice-natural-ui-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{
  await browser?.close();
  try{const route=JSON.parse(await fs.readFile(path.join(cache,'route.json'),'utf8'));await fetch(base+'/api/shutdown',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({adminKey:route.adminKey})});}catch{}
  await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(()=>{server.kill();resolve();},3000).unref();});
}
