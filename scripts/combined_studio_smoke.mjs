import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const channel=process.env.VMODEL_BROWSER;
const browserName=channel??'chromium';
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
const report={date:new Date().toISOString(),channel:browserName,checks:{},errors:[],externalRequests:[],limits:[
  'Synthetic models and a simulated camera use the installed tracking worker.',
  'Camera loss and storage failure are injected. No physical or human acceptance.',
]};
try{
  await server.listen();const base=server.resolvedUrls.local[0];
  browser=await chromium.launch({channel,headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  report.browser=browser.version();const context=await browser.newContext({permissions:['camera']});
  context.on('page',page=>page.on('pageerror',error=>report.errors.push(error.message)));
  context.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).hostname!=='127.0.0.1')report.externalRequests.push(request.url());});
  const page=await context.newPage();await page.goto(base+'tests/browser-host.html');
  const fixtures=await page.evaluate(async()=>{const{renderableFixture}=await import('/tests/fixtures/vrm.ts');return Promise.all([0,1,2].map(async n=>Array.from(new Uint8Array(await renderableFixture(n).arrayBuffer()))));});
  report.fixtureHashes=fixtures.map(bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  await context.route('**/avatars/*.vrm',route=>route.fulfill({contentType:'model/gltf-binary',body:Buffer.from(fixtures[0])}));
  await page.goto(base);await page.waitForFunction(()=>!!window.__vmodel);
  const popup=page.waitForEvent('popup');await page.click('#output');const output=await popup;await output.waitForFunction(()=>!!window.__vmodel);
  await page.click('#start');await page.waitForFunction(()=>window.__vmodel.getStats().sequence>=4,null,{timeout:90000});
  await page.evaluate(()=>window.combinedStream=document.querySelector('#camera-video').srcObject);
  const continuity=async()=>{
    const before=await page.evaluate(()=>window.__vmodel.getStats().sequence);
    await page.waitForFunction(before=>window.__vmodel.getStats().sequence>before,before,{timeout:30000});
    await output.waitForFunction(before=>window.__vmodel.getStats().sequence>before,before,{timeout:30000});
    assert(await page.evaluate(()=>window.combinedStream===document.querySelector('#camera-video').srcObject&&window.combinedStream.getVideoTracks()[0].readyState==='live'));
    assert.equal(await output.evaluate(()=>window.__vmodel.getState().avatarId),await page.evaluate(()=>window.__vmodel.getState().avatarId));
  };
  await page.click('[data-view="library"]');
  await page.setInputFiles('#library-file',{name:'combined.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(fixtures[1])});
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent==='Ready to save');await continuity();
  await page.check('#acknowledge-terms');await page.click('#save-model');
  const card=page.locator('.model-card').filter({has:page.getByRole('heading',{name:'combined',exact:true})});await card.waitFor();
  await card.getByRole('button',{name:'Use model',exact:true}).click();
  await page.waitForFunction(()=>window.__vmodel.getState().label==='combined');await output.waitForFunction(()=>window.__vmodel.getState().label==='combined');
  await continuity();report.checks.importAndSelectionDuringTracking=true;
  await page.click('[data-view="tracking"]');await page.waitForFunction(()=>document.querySelector('#observation-state').textContent==='Matched camera image.',null,{timeout:30000});
  await page.click('#pause-inspector');await continuity();await page.click('#pause-inspector');
  await page.click('#record-trace');const recordStart=await page.evaluate(()=>window.__vmodel.getStats().sequence);
  await page.waitForFunction(sequence=>window.__vmodel.getStats().sequence>=sequence+3,recordStart,{timeout:30000});
  await continuity();await page.click('#stop-trace');
  const state=await page.evaluate(()=>window.__vmodel.getState());await page.click('#replay-trace');
  await page.waitForFunction(()=>document.querySelector('#inspector-state').textContent==='Replay');await continuity();
  assert.deepEqual(await page.evaluate(()=>window.__vmodel.getState()),state);
  await output.reload();await output.waitForFunction(id=>window.__vmodel?.getState().avatarId===id,state.avatarId);await continuity();
  report.checks.pauseTraceReplayAndOutputReload=true;
  await page.click('#live-inspector');const previousTime=await page.evaluate(()=>window.__vmodel.getStats().samples.face.timestamp);
  await page.evaluate(()=>{const track=window.combinedStream.getVideoTracks()[0];track.stop();track.dispatchEvent(new Event('ended'));});
  await page.waitForFunction(()=>document.querySelector('#camera-video').srcObject===null);
  assert.equal(await page.evaluate(()=>window.__vmodel.getState().avatarId),state.avatarId);
  await page.click('#inspector-start-camera');await page.waitForFunction(previousTime=>window.__vmodel.getStats().sequence>=4&&window.__vmodel.getStats().samples.face.timestamp>previousTime&&document.querySelector('#camera-video').srcObject!==null,previousTime,{timeout:90000});
  await page.evaluate(()=>window.combinedStream=document.querySelector('#camera-video').srcObject);await continuity();report.checks.cameraLossAndRestart=true;
  await page.click('[data-view="library"]');
  await page.setInputFiles('#library-file',{name:'quota.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(fixtures[2])});
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent==='Ready to save');
  await page.evaluate(async()=>{const{LocalModelRepository}=await import('/src/model-repository.ts');window.restoreRegister=LocalModelRepository.prototype.register;LocalModelRepository.prototype.register=async()=>{throw new DOMException('Injected storage limit','QuotaExceededError');};});
  await page.check('#acknowledge-terms');await page.click('#save-model');await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('Save failed'));
  await continuity();assert.equal(await page.evaluate(()=>window.__vmodel.getState().avatarId),state.avatarId);
  await page.evaluate(async()=>{const{LocalModelRepository}=await import('/src/model-repository.ts');LocalModelRepository.prototype.register=window.restoreRegister;});
  await page.click('#save-model');await page.waitForFunction(()=>document.querySelector('#library-message').textContent.startsWith('Saved quota.'));await continuity();
  report.checks.storageFailureAndRetryDuringTracking=true;
  await page.click('[data-view="studio"]');await page.click('#stop');
  await page.waitForFunction(()=>document.querySelector('#camera-video').srcObject===null);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.passed=true;
}catch(error){report.errors.push(String(error));report.passed=false;process.exitCode=1;console.error(error);}
finally{await browser?.close();await server.close();await writeFile(`ops/reports/combined-studio-${browserName}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
