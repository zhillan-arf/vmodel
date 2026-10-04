import {captureVisualState} from './visual-state-capture.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
const server=await createServer({server:{port:0,host:'127.0.0.1'}});let browser;
try{
  await server.listen();const base=server.resolvedUrls.local[0];browser=await chromium.launch({headless:true});
  const context=await browser.newContext();context.setDefaultTimeout(15000);const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'tests/browser-host.html');
  const fixtures=await page.evaluate(async()=>{const{renderableFixture}=await import('/tests/fixtures/vrm.ts');return Promise.all([0,1].map(async n=>Array.from(new Uint8Array(await renderableFixture(n).arrayBuffer()))));});
  const hashes=fixtures.map(bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  await context.route('**/avatars/*.vrm',route=>route.fulfill({contentType:'model/gltf-binary',body:Buffer.from(fixtures[route.request().url().endsWith('ene.vrm')?0:1])}));
  await page.goto(base);await page.waitForFunction(hash=>window.__vmodel?.getState().avatarId===hash,hashes[0]);
  const popup=page.waitForEvent('popup');await page.locator('#output').click();const output=await popup;output.on('pageerror',e=>errors.push(e.message));
  await output.waitForFunction(hash=>window.__vmodel?.getState().avatarId===hash,hashes[0]);
  const select=async(index)=>{await page.selectOption('#avatar-select',index?'rei':'ene');await page.waitForFunction(hash=>window.__vmodel?.getState().avatarId===hash,hashes[index]);};
  const ready=async(index)=>{await output.waitForFunction(hash=>window.__vmodel?.getState().avatarId===hash,hashes[index]);await page.waitForFunction(()=>document.querySelector('#output-peer-status').textContent.includes('ready'));};
  const checks={},visualStates=[];
  const before=await page.evaluate(()=>window.__vmodel.getState());
  await page.evaluate(async()=>{const{AvatarViewer}=await import('/src/viewer.ts');window.originalPrepare=AvatarViewer.prototype.prepareAvatar;AvatarViewer.prototype.prepareAvatar=async()=>{throw new Error('Studio avatar preparation fixture');};});
  await page.selectOption('#avatar-select','rei');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Studio avatar preparation fixture'));
  assert.deepEqual(await page.evaluate(()=>window.__vmodel.getState()),before);
  assert.equal(await page.locator('#avatar-select').inputValue(),'ene');
  await page.evaluate(async()=>{const{AvatarViewer}=await import('/src/viewer.ts');AvatarViewer.prototype.prepareAvatar=window.originalPrepare;});
  checks.studioFailurePreservesState=true;

  await output.evaluate(async()=>{const{AvatarViewer}=await import('/src/viewer.ts');window.originalPrepare=AvatarViewer.prototype.prepareAvatar;AvatarViewer.prototype.prepareAvatar=async()=>{throw new Error('Peer decode fixture');};});
  await select(1);await page.waitForFunction(()=>document.querySelector('#output-peer-status').textContent.includes('Peer decode fixture'));
  assert.equal(await output.evaluate(()=>window.__vmodel.getState().avatarId),hashes[0]);
  assert.equal((await output.locator('body').innerText()).includes('Peer decode fixture'),false);
  checks.peerFailurePreservesOldModel=true;checks.errorOnlyInStudio=true;
  visualStates.push(...await captureVisualState(page,'output','mismatch-studio'));
  visualStates.push(...await captureVisualState(output,'output','mismatch-clean-output'));
  assert.equal(await output.evaluate(()=>window.__vmodel.getState().avatarId),hashes[0]);
  assert.equal((await output.locator('body').innerText()).includes('Peer decode fixture'),false);
  assert(visualStates.every(image=>!image.horizontalOverflow));
  await output.evaluate(async()=>{const{AvatarViewer}=await import('/src/viewer.ts');AvatarViewer.prototype.prepareAvatar=window.originalPrepare;});
  await ready(1);checks.peerRetry=true;

  await select(0);await ready(0);
  await output.evaluate(()=>{
    const original=crypto.subtle.digest;window.originalDigest=original;window.hashPaused=false;
    crypto.subtle.digest=async function(...args){window.hashPaused=true;await new Promise(resolve=>window.releaseHash=resolve);return original.apply(this,args);};
  });
  await select(1);await output.waitForFunction(()=>window.hashPaused);
  await select(0);await page.waitForFunction(()=>document.querySelector('#output-peer-status').textContent.includes('ready'));
  await output.evaluate(()=>{crypto.subtle.digest=window.originalDigest;window.releaseHash();});
  await output.waitForTimeout(150);
  assert.equal(await output.evaluate(()=>window.__vmodel.getState().avatarId),hashes[0]);checks.lateHashCannotReplaceNewerRevision=true;

  await output.evaluate(async()=>{
    const{AvatarViewer}=await import('/src/viewer.ts');const original=AvatarViewer.prototype.prepareAvatar;
    window.deadlines=[];window.originalTimer=window.setTimeout;window.setTimeout=function(fn,delay,...args){const id=window.originalTimer(fn,delay,...args);if(delay===30000)window.deadlines.push(()=>{clearTimeout(id);fn(...args);});return id;};
    AvatarViewer.prototype.prepareAvatar=async function(...args){const candidate=await original.apply(this,args);window.lateCandidate=candidate;await new Promise(resolve=>window.releaseCandidate=resolve);return candidate;};
  });
  await select(1);await output.waitForFunction(()=>!!window.releaseCandidate);
  await output.evaluate(()=>{for(const expire of window.deadlines)expire();});
  await page.waitForFunction(()=>document.querySelector('#output-peer-status').textContent.includes('exceeded 30 seconds'));
  assert.equal(await output.evaluate(()=>window.__vmodel.getState().avatarId),hashes[0]);
  await output.evaluate(async()=>{const{AvatarViewer}=await import('/src/viewer.ts');AvatarViewer.prototype.prepareAvatar=window.originalPrepare;window.setTimeout=window.originalTimer;window.releaseCandidate();});
  await output.waitForFunction(()=>window.lateCandidate.disposed);await ready(1);
  checks.deadlineKeepsOldModel=true;checks.lateCandidateDisposed=true;

  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;window.originalPut=put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='preferences'&&value.key==='selectedModelId')throw new DOMException('Selection persistence fixture','QuotaExceededError');return put.call(this,value,...args);};});
  await select(0);await page.waitForFunction(()=>document.querySelector('#status').textContent==='Selected for this session only');await ready(0);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});checks.persistenceFailureKeepsSelection=true;

  await output.reload();await ready(0);checks.reloadedPeerReceivesLatest=true;
  const late=await context.newPage();late.on('pageerror',e=>errors.push(e.message));await late.goto(output.url());await late.waitForFunction(hash=>window.__vmodel?.getState().avatarId===hash,hashes[0]);checks.latePeerReceivesLatest=true;
  await late.close();await output.close();await page.waitForFunction(()=>document.querySelector('#output-status').textContent.includes('Output closed'));
  assert.equal(await page.locator('#output-peer-status').textContent(),'');checks.closedPeersClearStatus=true;
  await page.evaluate(async()=>{
    const {LocalModelRepository}=await import('/src/model-repository.ts');
    const original=LocalModelRepository.prototype.select;
    LocalModelRepository.prototype.select=async function(id){
      await new Promise(resolve=>{window.finishSelectionSave=resolve;});
      return original.call(this,id);
    };
    window.restoreSelectionSave=()=>{LocalModelRepository.prototype.select=original;};
  });
  await select(1);
  await page.waitForFunction(()=>!!window.finishSelectionSave);
  assert.equal(await page.locator('#status').textContent(),'Saving model selection…');
  await page.evaluate(()=>{window.restoreSelectionSave();window.finishSelectionSave();});
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Rei')&&document.querySelector('#status').textContent.includes('is ready'));
  await page.reload();await page.waitForFunction(hash=>window.__vmodel?.getState().avatarId===hash,hashes[1]);
  checks.readyWaitsForSelectionSave=true;checks.studioReloadKeepsSelection=true;
  assert.deepEqual(errors,[]);
  const report={visualStates,generatedAt:new Date().toISOString(),browser:browser.version(),platform:process.platform,browserChannel:process.env.VMODEL_BROWSER??'chromium',fixtureHashes:hashes,checks,errors,limits:['Synthetic models only.','The deadline test triggers the timer callbacks after candidate preparation.','No physical camera test or human review.']};
  await writeFile('ops/001-zhil/sprint-001/reports/output-failure-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
