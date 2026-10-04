import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {captureVisualState} from './visual-state-capture.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.goto(server.resolvedUrls.local[0]+'tests/browser-host.html');
  await page.evaluate(async()=>{
    await import('/src/style.css');const{TrackingInspector}=await import('/src/tracking-inspector.ts'),{defaults}=await import('/src/types.ts'),{motionSample}=await import('/tests/fixtures/tracking-motion.ts');
    const anchor=performance.timeOrigin+performance.now();let sequence=0;window.scenario='stopped';window.visualSettings={...defaults};
    const inspector=window.visualInspector=new TrackingInspector(()=>{},()=>window.visualSettings,()=>null,()=>window.scenario==='stopped'?null:new MediaStream(),()=>({anchor,sessionId:'visual-fixture'}),()=>null,async()=>{throw new Error('No comparison model');});
    document.body.append(inspector.element);inspector.element.hidden=false;inspector.setVisible(true);
    window.sendVisualSample=()=>{
      if(window.scenario==='stopped')return;
      const now=performance.timeOrigin+performance.now(),age=window.scenario==='stale'?1000:0;
      const {frame}=motionSample(3,now-age),{diagnostics}=motionSample(3,now-anchor-age);
      frame.sequence=++sequence;diagnostics.sessionId='visual-fixture';diagnostics.captureSequence=sequence;
      for(const task of Object.values(diagnostics.tasks)){task.sampleSequence=sequence;task.captureSequence=sequence;}
      if(window.scenario==='low-confidence'){frame.pose[13].visibility=.1;frame.poseImage[13].visibility=.1;}
      window.visualSettings={...window.visualSettings,hands:window.scenario!=='disabled-hands'};
      inspector.receive(frame,diagnostics,null);inspector.apply(frame,1/30,now);
    };
    window.visualTimer=setInterval(()=>{if(!['trace-limit','replay'].includes(window.scenario))window.sendVisualSample();},50);
  });
  const visualStates=[];
  const capture=async state=>{assert.equal(await page.locator('#inspector-3d-controls').isVisible(),false);visualStates.push(...await captureVisualState(page,'tracking',state));};
  await page.waitForFunction(()=>document.querySelector('#inspector-state').textContent==='Camera stopped');await capture('camera-stopped');
  for(const scenario of ['valid','low-confidence','stale','disabled-hands']){
    await page.evaluate(scenario=>{window.scenario=scenario;window.sendVisualSample();},scenario);
    const text=scenario==='valid'?'Accepted:':scenario==='low-confidence'?'low visibility':scenario==='stale'?'stale':'disabled by setting';
    await page.waitForFunction(text=>document.querySelector('#channel-summary').textContent.includes(text)||document.querySelector('#shared-hand-summary').textContent.includes(text),text);
    await capture(scenario);
  }
  await page.evaluate(()=>{window.scenario='valid';window.sendVisualSample();});
  await page.locator('#pause-inspector').click();await page.waitForFunction(()=>document.querySelector('#inspector-state').textContent==='Inspector paused');await capture('paused');
  await page.locator('#pause-inspector').click();
  await page.locator('#record-trace').click();
  const trace=await page.evaluate(()=>{
    window.sendVisualSample();const inspector=window.visualInspector;
    inspector.recorder.append({kind:'reset'},60001);inspector.stopRecord();window.scenario='trace-limit';
    return inspector.recorder.export().text();
  });
  assert((await page.locator('#trace-state').textContent()).includes('60 seconds'));await capture('trace-limit');
  await page.setInputFiles('#trace-file',{name:'visual.json',mimeType:'application/json',buffer:Buffer.from(trace)});
  await page.waitForFunction(()=>document.querySelector('#trace-state').textContent.includes('Trace loaded'));
  await page.locator('#replay-trace').click();await page.evaluate(()=>window.scenario='replay');
  await page.locator('#trace-position').evaluate(element=>{element.value=element.max;element.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('#inspector-state').textContent==='Replay');await capture('replay');
  assert(visualStates.every(image=>!image.horizontalOverflow));assert.deepEqual(errors,[]);
  await page.evaluate(()=>{clearInterval(window.visualTimer);window.visualInspector.dispose();});
  await page.route('**/avatars/*.vrm',route=>route.fulfill({status:404,body:'Missing fixture model'}));
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Permission fixture','NotAllowedError');};});
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('not found'));
  await page.locator('[data-view="tracking"]').click();await page.locator('#inspector-start-camera').click();
  await page.waitForFunction(()=>document.querySelector('#camera-message').textContent.includes('Camera permission denied'));
  await capture('permission-failure');assert(visualStates.every(image=>!image.horizontalOverflow));assert.deepEqual(errors,[]);
  await writeFile('ops/001-zhil/sprint-001/reports/tracking-states-smoke.json',JSON.stringify({generatedAt:new Date().toISOString(),browser:browser.version(),visualStates,errors,limits:['Synthetic observations, no camera images, and an empty test stream.','The trace duration fixture injects an event at 60001 ms.','Permission failure uses an injected NotAllowedError through the application camera control.','No physical tracking or human visual acceptance.']},null,2)+'\n');
}finally{await browser?.close();await server.close();}
