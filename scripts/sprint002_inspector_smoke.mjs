import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server=await createServer({server:{host:'127.0.0.1',port:0,watch:null}});let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]+'tests/browser-host.html');
  const checks=await page.evaluate(async()=>{
    const {TrackingInspector}=await import('/src/tracking-inspector.ts');
    const {importTrace}=await import('/src/tracking-recording.ts');
    const {sha256}=await import('/src/model-types.ts');
    const {defaults}=await import('/src/types.ts');
    const {motionSample}=await import('/tests/fixtures/tracking-motion.ts');
    const blob=await(await fetch('/avatars/ene.vrm')).blob(),hash=await sha256(blob);
    const anchor=performance.timeOrigin+performance.now(),stream=new MediaStream();
    const inspector=new TrackingInspector(()=>{},()=>defaults,()=>null,()=>stream,()=>({anchor,sessionId:'motion-fixture'}),()=>blob,async()=>blob);
    document.body.append(inspector.element);inspector.element.hidden=false;inspector.setVisible(true);
    inspector.element.querySelector('#inspector-layer').value='avatar';await inspector.prepareAvatar();
    const receive=index=>{
      const time=performance.timeOrigin+performance.now(),data=motionSample(index,time);
      for(const hand of data.frame.hands)for(const p of hand.world)p.visibility=0;
      for(const task of Object.values(data.diagnostics.tasks)){task.sampleTimeMs-=anchor;task.startedAtMs-=anchor;task.finishedAtMs-=anchor;}
      data.diagnostics.captureTimeMs-=anchor;
      inspector.receive(data.frame,data.diagnostics,null);inspector.apply(data.frame,1/60,time+1);return data.frame;
    };
    receive(3);await inspector.startRecord();const frame=receive(4);
    const before=inspector.outcomes.filter(x=>x.stage==='solver'&&x.reason==='accepted'&&/Index|Middle|Ring|Little|Thumb/.test(x.channel)).length;
    inspector.apply(frame,1/60,frame.timestamp+16);
    const between=inspector.outcomes.filter(x=>x.stage==='solver'&&x.reason==='accepted'&&/Index|Middle|Ring|Little|Thumb/.test(x.channel)).length;
    inspector.stopRecord();const trace=await importTrace(inspector.recorder.export());
    window.confirm=()=>true;const pending=inspector.startRecord();inspector.stopRecord();await pending;
    const result={before,between,modelHash:trace.manifest.rigHashes.includes(hash),solverVersion:trace.manifest.solverVersion,adapter:trace.manifest.confidenceAdapterVersion,diagnosticRig:trace.manifest.diagnosticRig,cancelled:!inspector.recording,events:trace.events.length};
    inspector.dispose();return result;
  });
  assert.equal(checks.before,15);assert.equal(checks.between,15);assert(checks.modelHash&&checks.cancelled&&checks.events>=2);
  assert.equal(checks.solverVersion,'motion-solver-3');assert.equal(checks.adapter,'task-confidence-2');assert.equal(checks.diagnosticRig,'canonical');assert.deepEqual(errors,[]);
  await writeFile('ops/001-zhil/sprint-002/reports/inspector-smoke.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2)+'\n');console.log(checks);
}finally{await browser?.close();await server.close();}
