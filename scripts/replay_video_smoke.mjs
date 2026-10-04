import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server=await createServer({server:{port:0,host:'127.0.0.1'}});let browser;
try{
  await server.listen();const base=server.resolvedUrls.local[0];browser=await chromium.launch({headless:true});const context=await browser.newContext();context.setDefaultTimeout(15000);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'tests/browser-host.html');
  const checks={video:[]};let videoBytes,videoMapping;
  for(const mode of ['stop','camera loss','recorder error','size limit','duration limit']){
    const result=await page.evaluate(async mode=>{
      const{DiagnosticVideo}=await import('/src/tracking-video.ts');
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;document.body.append(canvas);const drawing=canvas.getContext('2d');let frame=0;
      const draw=()=>{drawing.fillStyle=frame++%2?'#00ff00':'#ff0000';drawing.fillRect(0,0,160,120);};draw();const timer=setInterval(draw,33),stream=canvas.captureStream(30);
      const Original=window.MediaRecorder,originalTimeout=window.setTimeout;let native,deadline;
      window.setTimeout=function(fn,delay,...args){if(delay===60000)deadline=()=>fn(...args);return originalTimeout(fn,delay,...args);};
      window.MediaRecorder=class extends Original{constructor(...args){super(...args);native=this;}};
      const video=new DiagnosticVideo();let finish;const stopped=new Promise(resolve=>finish=resolve);
      try{
        video.start(stream,'video-fixture',(blob,mapping)=>finish({blob,mapping}),10);
        const audioTracks=native.stream.getAudioTracks().length;window.MediaRecorder=Original;
        await new Promise((resolve,reject)=>{
          let chunks=0;
          const timeout=setTimeout(()=>reject(new Error('The recorder did not supply two video chunks within 10 seconds.')),10000);
          native.addEventListener('dataavailable',function receive(event){
            if(event.data.size>0&&++chunks>=2){clearTimeout(timeout);native.removeEventListener('dataavailable',receive);resolve();}
          });
        });
        if(mode==='camera loss'){stream.getVideoTracks()[0].stop();stream.getVideoTracks()[0].dispatchEvent(new Event('ended'));}
        else if(mode==='recorder error')native.dispatchEvent(new Event('error'));
        else if(mode==='size limit'){const oversized=new Blob(['oversized']);Object.defineProperty(oversized,'size',{value:64*1048576+1});native.dispatchEvent(new BlobEvent('dataavailable',{data:oversized}));}
        else if(mode==='duration limit')deadline();else video.stop();
        const{blob,mapping}=await stopped,url=URL.createObjectURL(blob),player=document.createElement('video');player.muted=true;player.src=url;document.body.append(player);
        try{
          await new Promise((resolve,reject)=>{player.onloadeddata=resolve;player.onerror=()=>reject(new Error(`Video playback failed: ${mode}, ${blob.size} bytes, ${blob.type}, ${player.error?.message}`));});await player.play();
          const playbackDeadline=performance.now()+5000;
          while(player.currentTime===0&&performance.now()<playbackDeadline)await new Promise(resolve=>setTimeout(resolve,20));
          return{mode,payload:Array.from(new Uint8Array(await blob.arrayBuffer())),bytes:blob.size,audioTracks,width:player.videoWidth,height:player.videoHeight,advanced:player.currentTime>0,currentTime:player.currentTime,duration:player.duration,drawnFrames:frame,mapping,active:video.active};
        }finally{player.pause();player.remove();URL.revokeObjectURL(url);}
      }finally{window.MediaRecorder=Original;window.setTimeout=originalTimeout;video.stop();clearInterval(timer);stream.getTracks().forEach(track=>track.stop());canvas.remove();}
    },mode);
    if(!result.advanced){await writeFile('ops/reports/local/replay-video-failure.webm',Buffer.from(result.payload));console.error({...result,payload:undefined});}
    assert(result.bytes>0);assert.equal(result.audioTracks,0);assert.equal(result.width,160);assert.equal(result.height,120);assert(result.advanced);assert.equal(result.active,false);if(!videoBytes){videoBytes=result.payload;videoMapping=result.mapping;}delete result.payload;checks.video.push(result);
  }
  checks.videoCleanup=await page.evaluate(async({videoBytes,videoMapping})=>{
    const{ReplayVideo}=await import('/src/replay-video.ts'),{sha256}=await import('/src/model-types.ts');
    const blob=new Blob([new Uint8Array(videoBytes)]),mapping={...videoMapping,sha256:await sha256(blob)},replay=new ReplayVideo();
    const create=URL.createObjectURL,revoke=URL.revokeObjectURL;let created=0,released=0;
    URL.createObjectURL=function(blob){created++;return create.call(this,blob);};URL.revokeObjectURL=function(url){released++;return revoke.call(this,url);};
    try{
      await replay.load(blob,mapping,mapping.traceId);replay.seek(.2);
      const deadline=performance.now()+3000;while(!replay.frame&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
      const video=replay.frame;if(!video)throw new Error('Replay seek failed');const time=video.currentTime;
      replay.clear();const sourceReleased=video.getAttribute('src')===null;
      const pending=replay.load(new Blob(['invalid video']),{...mapping,sha256:undefined},mapping.traceId).then(()=>false,()=>true);replay.clear();const cancelled=await pending;
      return{created,released,time,sourceReleased,cancelled,noFrame:replay.frame===null};
    }finally{replay.clear();URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
  },{videoBytes,videoMapping});
  assert.equal(checks.videoCleanup.created,checks.videoCleanup.released);assert(checks.videoCleanup.sourceReleased&&checks.videoCleanup.cancelled&&checks.videoCleanup.noFrame);assert(Math.abs(checks.videoCleanup.time-.2)<.002);
  const assets=await page.evaluate(async()=>{const{renderableFixture}=await import('/tests/fixtures/vrm.ts');return Promise.all([0,1].map(async n=>Array.from(new Uint8Array(await renderableFixture(n).arrayBuffer()))));});
  await context.route('**/avatars/*.vrm',route=>route.fulfill({contentType:'model/gltf-binary',body:Buffer.from(assets[route.request().url().endsWith('ene.vrm')?0:1])}));
  await page.goto(base);await page.waitForFunction(()=>window.__vmodel?.getState().selectedBundle==='ene');
  const popup=page.waitForEvent('popup');await page.locator('#output').click();const output=await popup;output.on('pageerror',error=>errors.push(error.message));await output.waitForFunction(()=>!!window.__vmodel?.getState().avatarId);
  const before=await page.evaluate(()=>window.__vmodel.getState()),peerBefore=await output.evaluate(()=>window.__vmodel.getState());
  const trace=await page.evaluate(async({videoBytes,videoMapping})=>{
    const{sha256}=await import('/src/model-types.ts');const{TraceRecorder,solverVersion}=await import('/src/tracking-recording.ts'),{defaults}=await import('/src/types.ts');
    const settings={...defaults,orientation:'portrait',mirror:false,background:'#000000'},hashes={face:'a'.repeat(64),pose:'b'.repeat(64),hands:'c'.repeat(64)};
    const recorder=new TraceRecorder({runtime:'fixture',modelHashes:hashes,solverVersion,settings,calibration:{version:1,head:[0,0,0,1],root:[.6,-.4,0]},rigHashes:[],startTimeMs:1000});
    recorder.trace.manifest.video={...videoMapping,traceId:recorder.trace.id,sha256:await sha256(new Blob([new Uint8Array(videoBytes)]))};
    const sample={timestamp:1210,present:false,inferenceMs:0},task={sampleSequence:1,captureSequence:1,sampleTimeMs:1210,startedAtMs:1210,finishedAtMs:1210,state:'new',present:false};
    recorder.append({kind:'sample',frame:{version:1,sequence:1,timestamp:0,face:{},faceMatrix:null,pose:[],poseImage:[{x:.2,y:.4,z:0,visibility:1}],hands:[],inferenceMs:0,samples:{face:{...sample},pose:{...sample},hands:{...sample}}},diagnostics:{version:1,sessionId:'replay-fixture',captureSequence:1,captureTimeMs:0,videoTimeMs:0,inputSize:{width:640,height:480},runtimeVersion:'fixture',modelHashes:hashes,delegate:'CPU',tasks:{face:{...task},pose:{...task},hands:{...task}}},reasons:[]},0);
    recorder.append({kind:'calibration',calibration:{version:1,head:[0,0,0,1],root:[.2,.1,0]}},8);
    recorder.append({kind:'apply',frameSequence:1,dt:.016,solverTimeMs:16},16);
    window.outputMessages=[];const post=BroadcastChannel.prototype.postMessage;BroadcastChannel.prototype.postMessage=function(message){if(this.name.startsWith('vmodel-output'))window.outputMessages.push(structuredClone(message));return post.call(this,message);};
    window.liveModel=window.__vmodel.viewer.vrm;
    return await recorder.export().text();
  },{videoBytes,videoMapping});
  await page.locator('.studio-nav [data-view="tracking"]').click();await page.setInputFiles('#trace-file',{name:'motion.json',mimeType:'application/json',buffer:Buffer.from(trace)});
  await page.waitForFunction(()=>document.body.innerText.includes('Trace loaded. Select Replay.'));await page.locator('#replay-trace').click();
  await page.locator('#trace-position').evaluate(element=>{element.value=element.max;element.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('#inspector-state').textContent==='Replay');
  assert((await page.locator('#trace-state').textContent()).includes('16.0 ms'));
  assert.deepEqual(await page.evaluate(()=>window.__vmodel.getState()),before);assert.deepEqual(await output.evaluate(()=>window.__vmodel.getState()),peerBefore);
  assert(await page.evaluate(()=>window.liveModel===window.__vmodel.viewer.vrm));
  const messages=await page.evaluate(()=>window.outputMessages);assert.equal(messages.filter(message=>message.type==='frame').length,0);
  for(const message of messages.filter(message=>message.type==='snapshot'))assert.deepEqual(message.state.settings,before.settings);
  const pixels=await page.locator('#observation-canvas').evaluate(canvas=>{const context=canvas.getContext('2d');return{recorded:Array.from(context.getImageData(160,240,1,1).data),live:Array.from(context.getImageData(640,240,1,1).data)};});
  assert.deepEqual(pixels.recorded,[228,234,245,255]);assert.deepEqual(pixels.live,[16,24,39,255]);checks.replayUsesRecordedMirror=true;
  checks.replayIsolation={liveStateUnchanged:true,peerStateUnchanged:true,liveModelUnchanged:true,noPublishedFrames:true};
  await page.locator('#inspector-layer').selectOption('avatar');
  await page.waitForFunction(()=>document.querySelector('#comparison-state').textContent.includes('SHA-256'));
  const comparison=async()=>{const text=await page.locator('#comparison-state').textContent();return JSON.parse(text.slice(text.indexOf('{')));};
  assert.deepEqual((await comparison()).calibration.root,[.2,.1,0]);
  await page.locator('#trace-position').evaluate(element=>{element.value='0';element.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.deepEqual((await comparison()).calibration.root,[.6,-.4,0]);
  await page.locator('#trace-position').evaluate(element=>{element.value=element.max;element.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.deepEqual((await comparison()).calibration.root,[.2,.1,0]);
  assert.deepEqual(await page.evaluate(()=>window.__vmodel.getState()),before);assert.deepEqual(await output.evaluate(()=>window.__vmodel.getState()),peerBefore);
  checks.comparisonFieldsFollowReplay=true;
  await page.locator('.studio-nav [data-view="studio"]').click();
  assert.equal(await page.locator('#inspector-avatar canvas').count(),0);
  await page.locator('.studio-nav [data-view="tracking"]').click();
  await page.waitForFunction(()=>!!document.querySelector('#inspector-avatar canvas')&&document.querySelector('#comparison-state').textContent.includes('SHA-256'),null,{timeout:10000});
  assert.deepEqual((await comparison()).calibration.root,[.2,.1,0]);
  assert.deepEqual(await page.evaluate(()=>window.__vmodel.getState()),before);
  assert.deepEqual(await output.evaluate(()=>window.__vmodel.getState()),peerBefore);
  checks.comparisonReturnsAfterNavigation=true;
  await page.locator('#inspector-layer').selectOption('observations');

  await page.setInputFiles('#camera-video-file',{name:'camera.webm',mimeType:'video/webm',buffer:Buffer.from(videoBytes)});
  await page.waitForFunction(()=>document.querySelector('#trace-state').textContent.includes('Camera video matches'));
  await page.waitForFunction(()=>{const pixel=document.querySelector('#observation-canvas').getContext('2d').getImageData(640,240,1,1).data;return pixel[0]>200||pixel[1]>200;});
  checks.recordedVideoImport=true;
  await page.setInputFiles('#camera-video-file',{name:'wrong.webm',mimeType:'video/webm',buffer:Buffer.from('wrong video')});
  await page.waitForFunction(()=>document.querySelector('#trace-state').textContent.includes('hash does not match'));
  await page.waitForFunction(()=>document.querySelector('#observation-canvas').getContext('2d').getImageData(640,240,1,1).data[0]===16);
  checks.wrongVideoRejected=true;
  await page.setInputFiles('#trace-file',{name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"type":"unknown"}')});
  await page.waitForFunction(()=>document.body.innerText.includes('Unsupported trace format'));
  assert.deepEqual(await page.evaluate(()=>window.__vmodel.getState()),before);assert.deepEqual(await output.evaluate(()=>window.__vmodel.getState()),peerBefore);checks.invalidTraceIsolation=true;
  assert.deepEqual(errors,[]);
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),platform:process.platform,browserChannel:process.env.VMODEL_BROWSER??'chromium',checks,errors,limits:['Canvas video source only.','Camera loss and recorder error use injected events.','The size gate uses an overridden Blob.size.','The test waits for encoded data before each stop condition. Unit tests check the 60-second timer.','No physical video timing or human review.']};
  await writeFile('ops/reports/replay-video-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
