import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const server=await createServer({server:{port:0,strictPort:false,host:'127.0.0.1'}});await server.listen();
const base=server.resolvedUrls.local[0];
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
const checks={};
await context.route('**/avatars/*.vrm',route=>route.fulfill({status:404,body:'Bundled model unavailable in this fixture'}));
try{
  await page.goto(base);await page.locator('.studio-nav').waitFor();
  const graphics=await page.evaluate(async()=>{
    const {AvatarViewer}=await import('/src/viewer.ts');const {defaults}=await import('/src/types.ts');const {renderableFixture,glb,fixtureJSON}=await import('/tests/fixtures/vrm.ts');
    const container=document.createElement('div');container.style.cssText='width:400px;height:400px;position:relative';document.body.append(container);
    const viewer=new AvatarViewer(container,defaults);const blob=renderableFixture();const prepared=await viewer.prepareAvatar(blob);const emptyBeforeCommit=viewer.vrm===null;viewer.commitAvatar(prepared);viewer.draw(0);const active=viewer.vrm;
    let failed=false;try{await viewer.prepareAvatar(glb({...fixtureJSON(),scene:0,scenes:[{nodes:[0]}]}));}catch{failed=true;}
    const preserved=viewer.vrm===active;
    const cancelled=await viewer.prepareAvatar(blob);viewer.cancelPendingLoad();let lateRejected=false;try{viewer.commitAvatar(cancelled);}catch{lateRejected=true;}
    const disposed=cancelled.disposed;viewer.disposePreparedAvatar(cancelled);viewer.dispose();container.remove();
    return{emptyBeforeCommit,failed,preserved,lateRejected,disposed};
  });
  assert(Object.values(graphics).every(Boolean));checks.graphics=graphics;
  const overlay=await page.evaluate(async()=>{
    const {TrackingInspector}=await import('/src/tracking-inspector.ts');const {defaults}=await import('/src/types.ts');
    const anchor=performance.timeOrigin+performance.now();let demand='off';
    const inspector=new TrackingInspector(value=>{demand=value;},()=>defaults,()=>null,()=>new MediaStream(),()=>({anchor,sessionId:'synthetic'}),()=>null,async()=>{throw new Error('No comparison model');});
    document.body.append(inspector.element);inspector.element.hidden=false;inspector.setVisible(true);
    const sample={timestamp:anchor,inferenceMs:1,present:false};
    const frame={version:1,sequence:1,timestamp:anchor,face:{},faceMatrix:null,pose:[],poseImage:[],hands:[],inferenceMs:1,samples:{face:{...sample},pose:{...sample},hands:{...sample}}};
    const task={sampleSequence:1,captureSequence:1,sampleTimeMs:0,startedAtMs:0,finishedAtMs:1,state:'new',present:false};
    const envelope={version:1,sessionId:'synthetic',captureSequence:1,captureTimeMs:0,videoTimeMs:0,inputSize:{width:100,height:100},runtimeVersion:'test',modelHashes:{face:'a'.repeat(64),pose:'b'.repeat(64),hands:'c'.repeat(64)},delegate:'CPU',tasks:{face:{...task},pose:{...task},hands:{...task}}};
    const bitmap=async color=>{const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;const context=canvas.getContext('2d');context.fillStyle=color;context.fillRect(0,0,100,100);return createImageBitmap(canvas);};
    inspector.receive(frame,envelope,await bitmap('#ff0000'));
    const next=structuredClone(envelope);next.captureSequence=2;next.tasks.face.captureSequence=2;next.tasks.face.sampleSequence=2;next.tasks.pose.state='cached';next.tasks.hands.state='cached';
    inspector.receive({...frame,sequence:2},next,await bitmap('#00ff00'));
    await new Promise(resolve=>setTimeout(resolve,80));
    const canvas=inspector.element.querySelector('#observation-canvas'),pixel=()=>Array.from(canvas.getContext('2d').getImageData(200,100,1,1).data);
    const body=pixel();inspector.element.querySelector('#inspector-task').value='face';await new Promise(resolve=>setTimeout(resolve,80));const face=pixel();
    inspector.element.querySelector('#pause-inspector').click();const pausedDemand=demand;inspector.receive({...frame,sequence:3},{...next,captureSequence:3},await bitmap('#0000ff'));await new Promise(resolve=>setTimeout(resolve,80));const paused=pixel();
    inspector.dispose();inspector.element.remove();return{body,face,paused,pausedDemand,closedDemand:demand};
  });
  assert.deepEqual(overlay.body,[255,0,0,255]);assert.deepEqual(overlay.face,[0,255,0,255]);assert.deepEqual(overlay.paused,overlay.face);assert.equal(overlay.pausedDemand,'off');assert.equal(overlay.closedDemand,'off');checks.matchedImagesAndPause=overlay;
  const result=await page.evaluate(async()=>{
    const {LocalModelRepository}=await import('/src/model-repository.ts');
    const {glb,fixtureJSON,renderableFixture}=await import('/tests/fixtures/vrm.ts');
    const {AvatarViewer}=await import('/src/viewer.ts');const {defaults}=await import('/src/types.ts');
    const graphics=async(blob,signal)=>{const container=document.createElement('div');const viewer=new AvatarViewer(container,defaults);try{const prepared=await viewer.prepareAvatar(blob,signal);viewer.disposePreparedAvatar(prepared);}finally{viewer.dispose();}};
    const {sha256}=await import('/src/model-types.ts');
    const {createBackup,inspectBackup,restoreBackup}=await import('/src/library-backup.ts');
    const {transact,requestValue}=await import('/src/library-db.ts');
    const repo=new LocalModelRepository(),controller=new AbortController();
    const blob=renderableFixture(2),inspection=await repo.inspect(blob,controller.signal);
    const termsBlob=new Blob([new Uint8Array([0x82,0xa0])]),termsHash=await sha256(termsBlob);
    const draft={inspection,displayName:'Synthetic fixture',originalFilename:'fixture.vrm',attachments:[{id:crypto.randomUUID(),modelId:'',kind:'terms',originalFilename:'terms.txt',mediaType:'text/plain',blob:termsBlob,sha256:termsHash,encoding:'shift_jis'}],acknowledgment:{acknowledgedAt:new Date().toISOString(),metadataDigest:await sha256(new Blob([JSON.stringify(inspection.rawMeta)])),attachmentHashes:[termsHash]}};
    const [first,second]=await Promise.all([repo.register(draft,controller.signal),repo.register(draft,controller.signal)]);
    const same=first.id===second.id;
    const records=await transact(['models','assets'],'readonly',async tx=>({models:await requestValue(tx.objectStore('models').count()),assets:await requestValue(tx.objectStore('assets').count())}));
    const exported=await repo.export(first.id);const exportHash=await sha256(exported);
    const backup=await createBackup(repo,[first]);
    const plan=await inspectBackup(backup,repo,controller.signal,graphics);
    await repo.rename(first.id,'Renamed fixture');
    const renamed=(await repo.list()).find(x=>x.id===first.id).displayName;
    await repo.remove(first.id);
    const restorePlan=await inspectBackup(backup,repo,controller.signal,graphics);
    const restored=await restoreBackup(restorePlan,repo,controller.signal);
    const restoredHash=await sha256(await repo.export(restored.entries[0].id));const restoredTerms=await repo.attachments(restored.entries[0].id);const termsPreserved=restoredTerms.length===1&&await sha256(restoredTerms[0].blob)===termsHash&&restoredTerms[0].encoding==='shift_jis';
    const bytes=new Uint8Array(await backup.arrayBuffer());bytes[bytes.length-1]^=1;
    let corruptRejected=false;try{await inspectBackup(new Blob([bytes]),repo,controller.signal,graphics);}catch{corruptRejected=true;}
    let rolledBack=false;try{await transact(['models'],'readwrite',async tx=>{tx.objectStore('models').delete(restored.entries[0].id);throw new Error('rollback fixture');});}catch{rolledBack=(await repo.list()).some(x=>x.id===restored.entries[0].id);}
    const cancelled=new AbortController();cancelled.abort();let cancelledBeforeSave=false;try{await repo.register(draft,cancelled.signal);}catch{cancelledBeforeSave=true;}
    const beforeQuota=await transact(['models','assets'],'readonly',async tx=>({models:await requestValue(tx.objectStore('models').count()),assets:await requestValue(tx.objectStore('assets').count())}));
    const changedJSON=fixtureJSON();changedJSON.extensions.VRMC_vrm.meta.name='Quota fixture';const changedInspection=await repo.inspect(glb(changedJSON),controller.signal);const changedDraft={...draft,inspection:changedInspection,acknowledgment:{...draft.acknowledgment,metadataDigest:await sha256(new Blob([JSON.stringify(changedInspection.rawMeta)]))}};
    const originalAdd=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(...args){if(this.name==='models')throw new DOMException('Quota fixture','QuotaExceededError');return originalAdd.apply(this,args);};
    let quotaRejected=false;try{await repo.register(changedDraft,controller.signal);}catch{quotaRejected=true;}finally{IDBObjectStore.prototype.add=originalAdd;}
    const afterQuota=await transact(['models','assets'],'readonly',async tx=>({models:await requestValue(tx.objectStore('models').count()),assets:await requestValue(tx.objectStore('assets').count())}));
    const quotaAtomic=quotaRejected&&JSON.stringify(beforeQuota)===JSON.stringify(afterQuota);
    const restoredId=restored.entries[0].id;
    await transact(['assets'],'readwrite',async tx=>{const asset=await requestValue(tx.objectStore('assets').get(inspection.hash));tx.objectStore('assets').put({...asset,blob:new Blob(['corrupt'])});});
    let corruptStorageRejected=false;try{await repo.resolve(restoredId,controller.signal);}catch{corruptStorageRejected=true;}
    await transact(['assets'],'readwrite',async tx=>{const asset=await requestValue(tx.objectStore('assets').get(inspection.hash));tx.objectStore('assets').put({...asset,blob});});
    const payload=Array.from(new Uint8Array(await backup.arrayBuffer()));repo.close();return{same,records,exportHash,originalHash:inspection.hash,restoredHash,renamed,duplicates:plan.existing.length,corruptRejected,rolledBack,cancelledBeforeSave,quotaAtomic,corruptStorageRejected,termsPreserved,payload};
  });
  assert(result.same);assert.deepEqual(result.records,{models:1,assets:1});assert.equal(result.exportHash,result.originalHash);assert.equal(result.restoredHash,result.originalHash);assert.equal(result.renamed,'Renamed fixture');assert.equal(result.duplicates,1);assert(result.corruptRejected&&result.rolledBack&&result.cancelledBeforeSave&&result.quotaAtomic&&result.corruptStorageRejected&&result.termsPreserved);
  checks.database={atomic:true,duplicateRace:true,originalExport:true,restore:true,corruptRejected:true,rollback:true,cancellation:true,quotaAtomic:true,corruptStorageRejected:true,termsPreserved:true};
  const fresh=await browser.newContext();await fresh.route('**/avatars/*.vrm',route=>route.fulfill({status:404,body:'Bundled model unavailable in this fixture'}));const freshPage=await fresh.newPage();await freshPage.goto(base);await freshPage.locator('.studio-nav').waitFor();
  const restored=await freshPage.evaluate(async payload=>{const {LocalModelRepository}=await import('/src/model-repository.ts');const{inspectBackup,restoreBackup}=await import('/src/library-backup.ts');const repo=new LocalModelRepository(),signal=new AbortController().signal;const before=await repo.list();const{AvatarViewer}=await import('/src/viewer.ts');const{defaults}=await import('/src/types.ts');const plan=await inspectBackup(new Blob([new Uint8Array(payload)]),repo,signal,async(blob,signal)=>{const container=document.createElement('div');const viewer=new AvatarViewer(container,defaults);try{const prepared=await viewer.prepareAvatar(blob,signal);viewer.disposePreparedAvatar(prepared);}finally{viewer.dispose();}});const result=await restoreBackup(plan,repo,signal);const selected=await repo.selected();repo.close();return{before:before.filter(entry=>entry.sourceKind==='imported').length,count:result.entries.length,selected};},result.payload);
  assert.equal(restored.before,0);assert.equal(restored.count,1);assert.equal(restored.selected,undefined);checks.freshProfileSyntheticRestore=true;
  await freshPage.evaluate(async()=>{const{LocalModelRepository}=await import('/src/model-repository.ts');const repo=new LocalModelRepository();for(const entry of await repo.list())if(entry.sourceKind==='imported')await repo.remove(entry.id);repo.close();});
  await freshPage.locator('.studio-nav [data-view="library"]').click();
  await freshPage.setInputFiles('#backup-file',{name:'original.vmlib',mimeType:'application/octet-stream',buffer:Buffer.from(result.payload)});
  await freshPage.waitForFunction(()=>!document.querySelector('#restore-panel').hidden);
  assert.match(await freshPage.locator('#restore-terms').textContent(),/あ/);
  await freshPage.setInputFiles('#backup-file',{name:'invalid.vmlib',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});
  await freshPage.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('Restore failed'));
  assert.equal(await freshPage.locator('#restore-panel').isVisible(),false);
  checks.restoreSummary={originalTerms:true,invalidReplacementClearsPlan:true};
  await fresh.close();
  await mkdir('ops/001-zhil/sprint-001/reports/local/studio-features',{recursive:true});
  for(const [width,height]of [[390,844],[768,1024],[1440,900]]){
    await page.setViewportSize({width,height});
    for(const view of ['studio','library','tracking']){
      await page.locator(`.studio-nav [data-view="${view}"]`).click();
      assert.equal(await page.evaluate(()=>document.body.dataset.view),view);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view} overflow at ${width}`);
      await page.screenshot({path:`ops/001-zhil/sprint-001/reports/local/studio-features/${view}-${width}.png`,fullPage:true});
    }
  }
  checks.viewports=[390,768,1440];
  await page.locator('#inspector-layer').selectOption('accepted');await page.locator('#estimated-view canvas').waitFor();checks.canonicalWithoutModel=true;
  await page.locator('#pause-inspector').click();assert.equal(await page.locator('#pause-inspector').textContent(),'Resume');await page.locator('#pause-inspector').click();checks.pause=true;
  await page.locator('.studio-nav [data-view="library"]').click();await page.setInputFiles('#library-file',{name:'invalid.vrm',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('Import failed'));checks.invalidImport=true;
  const fixture=await page.evaluate(async()=>{const{renderableFixture}=await import('/tests/fixtures/vrm.ts');return Array.from(new Uint8Array(await renderableFixture().arrayBuffer()));});
  await page.setInputFiles('#library-file',{name:'render-fixture.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(fixture)});
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent==='Ready to save');
  assert.equal(await page.evaluate(()=>!!window.__vmodel),false);
  await page.locator('#acknowledge-terms').check();await page.locator('#save-model').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.model-card h2')].some(x=>x.textContent==='render-fixture'));
  assert.equal(await page.evaluate(()=>!!window.__vmodel),false);checks.saveDoesNotSelect=true;
  await page.locator('.model-card').filter({has:page.getByRole('heading',{name:'render-fixture',exact:true})}).getByRole('button',{name:'Use model',exact:true}).click();
  await page.waitForFunction(()=>window.__vmodel?.getState().label==='render-fixture');checks.explicitSelection=true;
  await page.locator('.studio-nav [data-view="studio"]').click();
  const popup=page.waitForEvent('popup');await page.locator('#output').click();const output=await popup;output.on('pageerror',error=>errors.push(error.message));
  await output.waitForFunction(()=>window.__vmodel?.getState().label==='render-fixture');
  assert.equal(await output.locator('.feature-panel').count(),0);checks.outputIsolation=true;
  const originalHash=await page.evaluate(()=>window.__vmodel.getState().avatarId);
  await page.locator('.studio-nav [data-view="library"]').click();
  const changed=await page.evaluate(async()=>{const{renderableFixture}=await import('/tests/fixtures/vrm.ts');return Array.from(new Uint8Array(await renderableFixture(1).arrayBuffer()));});
  await page.setInputFiles('#library-file',{name:'second-fixture.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(changed)});
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent==='Ready to save');
  assert.equal(await output.evaluate(()=>window.__vmodel.getState().avatarId),originalHash);
  await page.locator('#acknowledge-terms').check();await page.locator('#save-model').click();await page.waitForFunction(()=>[...document.querySelectorAll('.model-card h2')].some(x=>x.textContent==='second-fixture'));
  const resources=[];
  for(let i=0;i<25;i++){
    const label=i%2?'render-fixture':'second-fixture';
    await page.locator('.model-card').filter({has:page.getByRole('heading',{name:label,exact:true})}).getByRole('button',{name:'Use model',exact:true}).click();
    await page.waitForFunction(label=>window.__vmodel?.getState().label===label,label);
    await output.waitForFunction(label=>window.__vmodel?.getState().label===label,label);
    if(i>=5)resources.push(await page.evaluate(()=>({...window.__vmodel.viewer.renderer.info.memory})));
  }
  assert(resources.every(value=>value.geometries===resources[0].geometries&&value.textures===resources[0].textures));checks.syntheticSelections={warmup:5,measured:20,resources};
  const active=await page.evaluate(()=>window.__vmodel.getState().avatarId);await page.setInputFiles('#library-file',{name:'bad.vrm',mimeType:'application/octet-stream',buffer:Buffer.from('bad')});await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('Import failed'));assert.equal(await page.evaluate(()=>window.__vmodel.getState().avatarId),active);assert.equal(await output.evaluate(()=>window.__vmodel.getState().avatarId),active);checks.failedImportPreservesStudioAndOutput=true;
  const savedState=()=>page.evaluate(async()=>{const{LocalModelRepository}=await import('/src/model-repository.ts');const repo=new LocalModelRepository();try{return{ids:(await repo.list()).map(x=>x.id).sort(),selected:await repo.selected()};}finally{repo.close();}});
  const persisted=await savedState();
  const temporary=await page.evaluate(async()=>{const{renderableFixture}=await import('/tests/fixtures/vrm.ts');return Array.from(new Uint8Array(await renderableFixture(3).arrayBuffer()));});
  const preview=async()=>{
    await page.setInputFiles('#library-file',{name:'temporary-fixture.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(temporary)});
    await page.waitForFunction(()=>/Ready to save|Import failed|Duplicate bytes/.test(document.querySelector('#library-message').textContent));
    assert.equal(await page.locator('#library-message').textContent(),'Ready to save');
  };
  await preview();await page.locator('#cancel-import').click();
  assert.equal(await page.locator('#model-preview canvas').count(),0);
  assert.equal(await page.evaluate(()=>window.__vmodel.getState().avatarId),active);
  assert.equal(await output.evaluate(()=>window.__vmodel.getState().avatarId),active);
  assert.deepEqual(await savedState(),persisted);checks.cancelPreviewPreservesSelection=true;
  await preview();await page.locator('#try-model').click();
  await page.waitForFunction(()=>window.__vmodel?.getState().label==='temporary-fixture · Temporary');
  await output.waitForFunction(()=>window.__vmodel?.getState().label==='temporary-fixture · Temporary');
  assert.equal(await page.locator('#model-preview canvas').count(),0);
  assert.deepEqual(await savedState(),persisted);
  await page.waitForFunction(()=>document.querySelector('#library-current').textContent.includes('Temporary model: temporary-fixture'));
  assert.equal(await page.locator('#library-current').isVisible(),true);
  assert((await page.locator('#library-current').textContent()).includes('This model is not saved.'));
  checks.temporaryLibraryStatus=true;
  const temporaryHash=await page.evaluate(()=>window.__vmodel.getState().avatarId);
  assert.notEqual(temporaryHash,active);checks.temporarySelectionDoesNotPersist=true;
  await page.reload();
  await page.waitForFunction(hash=>window.__vmodel?.getState().avatarId===hash,active);
  await output.waitForFunction(hash=>window.__vmodel?.getState().avatarId===hash,active);
  assert.deepEqual(await savedState(),persisted);checks.reloadRestoresSavedSelection=true;
  await page.locator('.studio-nav [data-view="tracking"]').click();await page.locator('#inspector-layer').selectOption('accepted');await page.locator('#estimated-view canvas').waitFor();assert.equal(await output.evaluate(()=>window.__vmodel.getState().avatarId),active);
  await output.close();
  assert.deepEqual(errors,[]);
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),checks,errors,limits:['Synthetic fixture only. Bundled model requests receive a test 404 response.','Actual-model acceptance is outside this synthetic check.','No physical camera test.']};
  await writeFile('ops/001-zhil/sprint-001/reports/studio-features-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await context.close();await browser.close();await server.close();}
