import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});const context=await browser.newContext();
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=server.resolvedUrls.local[0];await page.goto(base+'tests/browser-host.html');
  const fixtures=await page.evaluate(async()=>{const{renderableFixture}=await import('/tests/fixtures/vrm.ts');return Promise.all([0,1,2].map(async i=>Array.from(new Uint8Array(await renderableFixture(i).arrayBuffer()))));});
  const hashes=fixtures.map(bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  await context.route('**/avatars/*.vrm',route=>route.fulfill({contentType:'model/gltf-binary',body:Buffer.from(fixtures[route.request().url().endsWith('ene.vrm')?0:1])}));
  await page.goto(base);await page.waitForFunction(hash=>window.__vmodel?.getState().avatarId===hash,hashes[0]);
  const popup=page.waitForEvent('popup');await page.locator('#output').click();const output=await popup;output.on('pageerror',e=>errors.push(e.message));
  await output.waitForFunction(hash=>window.__vmodel?.getState().avatarId===hash,hashes[0]);
  await page.locator('[data-view="library"]').click();await page.waitForFunction(()=>document.querySelectorAll('.model-card').length===2);
  const original=await page.evaluate(()=>window.__vmodel.getState()),checks=[];
  const unchanged=async()=>{
    assert.deepEqual(await page.evaluate(()=>window.__vmodel.getState()),original);
    assert.equal(await output.evaluate(()=>window.__vmodel.getState().avatarId),hashes[0]);
    assert.equal(await page.locator('#model-preview canvas').count(),0);
    assert.equal(await page.locator('#save-model').isDisabled(),true);
    assert.equal(await page.evaluate(async()=>{const{LocalModelRepository}=await import('/src/model-repository.ts');const repo=new LocalModelRepository();try{return(await repo.list()).filter(x=>x.sourceKind==='imported').length;}finally{repo.close();}}),0);
  };
  const importFile=()=>page.setInputFiles('#library-file',{name:'candidate.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(fixtures[2])});
  for(const phase of ['inspection','preview'])for(const action of ['cancel','timeout']){
    console.log(`${phase}: ${action}`);
    await page.evaluate(async phase=>{
      window.lifecycle={terminated:0,started:false};
      if(phase==='inspection'){
        const Original=window.Worker;window.restoreLifecycle=()=>{window.Worker=Original;};
        window.Worker=class extends Original{
          postMessage(...args){window.lifecycle.started=true;}
          terminate(){window.lifecycle.terminated++;super.terminate();}
        };
      }else{
        const{AvatarViewer}=await import('/src/viewer.ts');const original=AvatarViewer.prototype.prepareAvatar;
        window.restoreLifecycle=()=>{AvatarViewer.prototype.prepareAvatar=original;};
        AvatarViewer.prototype.prepareAvatar=async function(...args){
          const candidate=await original.apply(this,args);window.lifecycle.started=true;
          window.lifecycle.viewer=this;window.lifecycle.candidate=candidate;
          return new Promise(resolve=>{window.releaseLifecycle=()=>resolve(candidate);});
        };
      }
    },phase);
    await importFile();await page.waitForFunction(()=>window.lifecycle.started);
    assert.equal(await page.locator('#library-progress').isVisible(),true);
    if(action==='cancel')await page.locator('#cancel-import').click();
    else await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('exceeded 30 seconds'),null,{timeout:35000});
    await page.evaluate(async phase=>{
      window.restoreLifecycle();
      if(phase==='preview'){window.releaseLifecycle();await new Promise(resolve=>setTimeout(resolve,0));}
    },phase);
    await unchanged();
    assert.equal(await page.locator('#library-progress').isVisible(),false);
    if(action==='cancel')assert.equal(await page.evaluate(()=>document.activeElement.id),'import-model');
    else assert.equal(await page.locator('#library-message').getAttribute('aria-live'),'assertive');
    if(phase==='inspection')assert.equal(await page.evaluate(()=>window.lifecycle.terminated),1);
    else assert.equal(await page.evaluate(()=>{try{window.lifecycle.viewer.commitAvatar(window.lifecycle.candidate);return false;}catch{return true;}}),true);
    checks.push({phase,action,preserved:true,progress:true,announcementOrFocus:true,lateCandidateRejected:phase==='preview'});
  }
  await importFile();await page.waitForFunction(()=>document.querySelector('#library-message').textContent==='Ready to save');
  await page.locator('#cancel-import').click();await unchanged();assert.deepEqual(errors,[]);
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),hashes,checks,retry:true,errors,
    limits:['Synthetic models replace the bundled models.','The test holds worker messages or prepared candidates. Actual 30-second timers remain unchanged.']};
  await writeFile('ops/001-zhil/sprint-001/reports/import-lifecycle-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
