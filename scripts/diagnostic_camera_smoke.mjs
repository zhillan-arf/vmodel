import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const server=await createServer({server:{host:'127.0.0.1',port:0}});
await server.listen();let browser;
try {
  browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const context=await browser.newContext({permissions:['camera']});
  const page=await context.newPage(),errors=[],externalRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).hostname!=='127.0.0.1')externalRequests.push(request.url());});
  await page.goto(`${server.resolvedUrls.local[0]}tests/browser-host.html`);
  await page.evaluate(async()=>{
    const {CameraTracker}=await import('/src/camera.ts');
    const {defaults}=await import('/src/types.ts');
    const video=document.createElement('video');video.muted=true;video.playsInline=true;document.body.append(video);
    const state=window.cameraCheck={frames:0,diagnostics:[],statuses:[],tracks:[],images:0,closed:0};
    state.tracker=new CameraTracker(video,()=>state.frames++,message=>state.statuses.push(message),()=>defaults,
      (frame,envelope,image)=>{
        if(image){state.images++;image.close();state.closed++;}
        if(state.diagnostics.length<2000)state.diagnostics.push({sessionId:envelope.sessionId,captureSequence:envelope.captureSequence,
          receivedAtMs:envelope.receivedAtMs,captureTimeMs:envelope.captureTimeMs,
          matches:Object.keys(envelope.tasks).every(task=>Math.abs(envelope.tasks[task].sampleTimeMs+state.tracker.getSessionClock().anchor-frame.samples[task].timestamp)<.001)});
      });
    state.tracker.setDiagnosticDemand('inspect');
    await state.tracker.start();state.tracks.push(...state.tracker.getStream().getTracks());
  });
  await page.waitForFunction(()=>window.cameraCheck.diagnostics.length>=4,undefined,{timeout:65000});
  const first=await page.evaluate(()=>window.cameraCheck.tracker.getSessionClock().sessionId);
  console.log('Camera results received. Checking the 70-second run.');
  for(let seconds=0;seconds<70;seconds+=10){
    await page.waitForTimeout(10000);
    assert(await page.evaluate(()=>!!window.cameraCheck.tracker.getStream()));
    console.log(`Camera run: ${seconds+10} seconds.`);
  }
  const stopped=await page.evaluate(()=>{
    const state=window.cameraCheck;state.tracker.stop();
    return state.tracks.every(track=>track.readyState==='ended')&&document.querySelector('video').srcObject===null;
  });
  assert(stopped);
  await page.evaluate(async()=>{
    const state=window.cameraCheck;state.tracker.setDiagnosticDemand('off');await state.tracker.start();
    state.tracks.push(...state.tracker.getStream().getTracks());state.before={frames:state.frames,images:state.images,diagnostics:state.diagnostics.length};
  });
  await page.waitForFunction(()=>window.cameraCheck.frames>=window.cameraCheck.before.frames+4,undefined,{timeout:65000});
  const result=await page.evaluate(()=>{
    const state=window.cameraCheck,second=state.tracker.getSessionClock().sessionId;
    const diagnosticsOff=state.images===state.before.images&&state.diagnostics.length===state.before.diagnostics;
    state.tracker.stop();
    return {second,diagnosticsOff,frames:state.frames,images:state.images,closed:state.closed,
      diagnostics:state.diagnostics,statuses:state.statuses,
      released:state.tracks.every(track=>track.readyState==='ended')&&document.querySelector('video').srcObject===null};
  });
  assert.notEqual(first,result.second);assert(result.diagnosticsOff&&result.released);
  assert(result.diagnostics.every(item=>item.sessionId===first&&item.matches&&item.receivedAtMs>=item.captureTimeMs));
  assert.equal(result.images,result.closed);assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
  await writeFile('ops/reports/diagnostic-camera-smoke.json',JSON.stringify({generatedAt:new Date().toISOString(),browser:browser.version(),
    input:'Chromium fake camera; installed tracking worker and models.',durationMs:70000,stopped,
    ...result,errors,externalRequests,platform:process.platform,browserChannel:process.env.VMODEL_BROWSER??'chromium',limits:['No physical camera or gesture test. Performance acceptance requires separate measurements.']},null,2)+'\n');
  console.log(JSON.stringify({frames:result.frames,images:result.images,restart:true,diagnosticsOff:result.diagnosticsOff,released:result.released}));
} finally {await browser?.close();await server.close();}
