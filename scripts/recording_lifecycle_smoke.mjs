import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server=await createServer({server:{port:0,host:'127.0.0.1'}});let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]+'tests/browser-host.html');
  const checks=await page.evaluate(async()=>{
    const{TrackingInspector}=await import('/src/tracking-inspector.ts'),{importTrace}=await import('/src/tracking-recording.ts'),{defaults}=await import('/src/types.ts');
    const anchor=performance.timeOrigin+performance.now(),stream=new MediaStream();let camera=stream,demand='off',confirmations=0,allowDiscard=false;
    const originalConfirm=window.confirm,originalRecorder=window.MediaRecorder;window.confirm=()=>{confirmations++;return allowDiscard;};
    const inspector=new TrackingInspector(value=>demand=value,()=>defaults,()=>null,()=>camera,()=>({anchor,sessionId:'fixture'}),()=>null,async()=>{throw new Error('No comparison model');});
    document.body.append(inspector.element);inspector.element.hidden=false;inspector.setVisible(true);
    let sequence=0;
    const receive=()=>{
      const now=performance.timeOrigin+performance.now(),time=now-anchor,id=++sequence,task={sampleSequence:id,captureSequence:id,sampleTimeMs:time,startedAtMs:time,finishedAtMs:time,state:'new',present:false},sample={timestamp:now,present:false,inferenceMs:0};
      const frame={version:1,sequence:id,timestamp:now,face:{},faceMatrix:null,pose:[],poseImage:[],hands:[],inferenceMs:0,samples:{face:{...sample},pose:{...sample},hands:{...sample}}};
      inspector.receive(frame,{version:1,sessionId:'fixture',captureSequence:id,captureTimeMs:time,videoTimeMs:time,inputSize:{width:640,height:480},runtimeVersion:'fixture',modelHashes:{face:'a'.repeat(64),pose:'b'.repeat(64),hands:'c'.repeat(64)},delegate:'CPU',tasks:{face:{...task},pose:{...task},hands:{...task}}},null);inspector.apply(frame,.016,now+1);
    };
    const click=id=>inspector.element.querySelector('#'+id).click();
    try{
      receive();const videoOffByDefault=!inspector.element.querySelector('#record-video').checked;click('record-trace');receive();click('stop-trace');
      const original=inspector.recorder,trace=await importTrace(original.export()),text=await original.export().text();
      const defaultExport={videoOffByDefault,noVideo:trace.manifest.video===undefined,noDeviceId:!text.includes('deviceId'),noAbsolutePath:!text.includes('/home/')&&!text.includes('C:\\'),samples:trace.events.filter(event=>event.kind==='sample').length,applies:trace.events.filter(event=>event.kind==='apply').length};
      click('record-trace');const discardRejected=confirmations===1&&inspector.recorder===original&&!inspector.recording;
      allowDiscard=true;window.MediaRecorder=undefined;inspector.element.querySelector('#record-video').checked=true;click('record-trace');
      const unsupportedText=inspector.element.querySelector('#trace-state').textContent.includes('Trace recording remains available');receive();
      await new Promise(resolve=>setTimeout(resolve,80));const visibleRecording=inspector.element.querySelector('#inspector-state').textContent==='Recording trace';
      camera=null;inspector.apply(null,.016,performance.timeOrigin+performance.now());
      const unsupportedTrace=await importTrace(inspector.recorder.export()),cameraLossStops=!inspector.recording&&demand==='inspect';
      camera=stream;inspector.element.querySelector('#record-video').checked=false;click('record-trace');receive();const hiddenRecorder=inspector.recorder;inspector.setVisible(false);
      const hiddenStops=!inspector.recording&&demand==='off'&&inspector.recorder===hiddenRecorder;await importTrace(hiddenRecorder.export());
      inspector.setVisible(true);click('record-trace');receive();inspector.dispose();let closed=0;inspector.receive({}, {}, {close:()=>closed++});
      const disposed={traceCleared:inspector.recorder===null,replayCleared:inspector.replay===null,videoCleared:inspector.videoBlob===null,lateImageClosed:closed===1,demandOff:demand==='off'};
      return{defaultExport,discardRejected,unsupportedText,visibleRecording,unsupportedTraceUsable:unsupportedTrace.events.length>=2,cameraLossStops,hiddenStops,disposed};
    }finally{window.confirm=originalConfirm;window.MediaRecorder=originalRecorder;inspector.dispose();inspector.element.remove();}
  });
  assert(Object.values(checks.defaultExport).every(Boolean));
  for(const key of ['discardRejected','unsupportedText','visibleRecording','unsupportedTraceUsable','cameraLossStops','hiddenStops'])assert(checks[key],key);
  assert(Object.values(checks.disposed).every(Boolean));assert.deepEqual(errors,[]);
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),checks,errors,limits:['Synthetic observations and a test stream.','No physical camera acceptance.']};
  await writeFile('ops/reports/recording-lifecycle-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
