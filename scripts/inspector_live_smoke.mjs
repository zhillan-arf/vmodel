import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const context=await browser.newContext({permissions:['camera']});
  await context.addInitScript(()=>{
    const original=createImageBitmap;window.retainedImages={created:0,closed:0,peak:0};
    window.createImageBitmap=async(...args)=>{
      const bitmap=await original(...args);
      if(args[0] instanceof ImageBitmap){const state=window.retainedImages;state.created++;state.peak=Math.max(state.peak,state.created-state.closed);const close=bitmap.close.bind(bitmap);let closed=false;bitmap.close=()=>{if(!closed){closed=true;state.closed++;}close();};}
      return bitmap;
    };
  });
  const page=await context.newPage(),errors=[],externalRequests=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
  context.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).hostname!=='127.0.0.1')externalRequests.push(r.url());});
  const base=server.resolvedUrls.local[0];await page.goto(base+'tests/browser-host.html');
  const fixture=await page.evaluate(async()=>{const{renderableFixture}=await import('/tests/fixtures/vrm.ts');return Array.from(new Uint8Array(await renderableFixture().arrayBuffer()));});
  await context.route('**/avatars/*.vrm',route=>route.fulfill({contentType:'model/gltf-binary',body:Buffer.from(fixture)}));
  await page.goto(base);await page.waitForFunction(()=>!!window.__vmodel);
  const popup=page.waitForEvent('popup');await page.locator('#output').click();const output=await popup;await output.waitForFunction(()=>!!window.__vmodel);
  await page.locator('[data-view="tracking"]').click();await page.locator('#inspector-start-camera').click();
  await page.waitForFunction(()=>window.__vmodel.getStats().sequence>=4&&document.querySelector('#observation-state').textContent==='Matched camera image.',null,{timeout:65000});
  const initial=await page.evaluate(()=>window.__vmodel.getStats().sequence);console.log('Camera and inspector are active.');
  await page.locator('#pause-inspector').click();
  const frozen=await page.evaluate(()=>document.querySelector('#observation-canvas').toDataURL());
  await page.waitForFunction(sequence=>window.__vmodel.getStats().sequence>=sequence+5,initial,{timeout:30000});
  await output.waitForFunction(sequence=>window.__vmodel.getStats().sequence>=sequence+5,initial,{timeout:30000});
  assert.equal(await page.evaluate(()=>document.querySelector('#observation-canvas').toDataURL()),frozen);
  assert.equal(await page.locator('#inspector-task').isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.querySelector('#camera-video').srcObject.getVideoTracks()[0].readyState),'live');
  const paused=await page.evaluate(()=>window.__vmodel.getStats().sequence);
  await page.locator('#pause-inspector').click();
  await page.waitForFunction(frozen=>document.querySelector('#observation-canvas').toDataURL()!==frozen,frozen,{timeout:30000});
  assert.equal(await page.locator('#inspector-task').isDisabled(),false);
  await page.locator('[data-view="studio"]').click();
  await page.waitForFunction(()=>window.retainedImages.created===window.retainedImages.closed);
  await page.waitForFunction(sequence=>window.__vmodel.getStats().sequence>=sequence+5,paused,{timeout:30000});
  await output.waitForFunction(sequence=>window.__vmodel.getStats().sequence>=sequence+5,paused,{timeout:30000});
  const images=await page.evaluate(()=>window.retainedImages);assert(images.created>0);assert(images.peak<=5);
  await page.locator('#stop').click();
  await page.waitForFunction(()=>document.querySelector('#camera-video').srcObject===null);
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),initialSequence:initial,pausedSequence:paused,
    pauseKeepsCameraAndOutput:true,pauseFreezesDisplay:true,resumeUpdatesDisplay:true,hiddenInspectorKeepsOutput:true,images,errors,externalRequests,
    limits:['Chromium fake camera and installed tracking worker. Synthetic model replaces both bundled files.','Peak image count includes one pending camera copy and up to four inspector images.','No physical gesture or target-laptop acceptance.']};
  await writeFile('ops/reports/inspector-live-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
