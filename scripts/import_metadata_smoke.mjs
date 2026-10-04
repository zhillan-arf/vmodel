import {captureVisualState} from './visual-state-capture.mjs';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext();
  const externalRequests=[],errors=[];
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1'){externalRequests.push(url.href);return route.abort();}
    if(url.pathname.startsWith('/avatars/'))return route.fulfill({status:404,body:'Missing test bundle'});
    return route.continue();
  });
  await context.addInitScript(()=>{
    window.metadataExecuted=false;window.graphicsContexts=0;
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2')window.graphicsContexts++;return getContext.call(this,type,...args);};
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);await page.locator('.studio-nav [data-view="library"]').click();
  const visualStates=await captureVisualState(page,'library','empty');
  const capture=async state=>visualStates.push(...await captureVisualState(page,'library',state));
  const fixtures=await page.evaluate(async()=>{
    const {fixtureJSON,glb,renderableFixture}=await import('/tests/fixtures/vrm.ts');
    const attack='<img src="https://metadata-probe.invalid/image" onerror="window.metadataExecuted=true"><script>window.metadataExecuted=true</script>';
    const invalid=[
      {name:'external-buffer',json:{...fixtureJSON(),buffers:[{uri:'https://metadata-probe.invalid/buffer',byteLength:4}]}},
      {name:'external-image',json:{...fixtureJSON(),images:[{uri:'https://metadata-probe.invalid/image'}]}},
      {name:'script-image',json:{...fixtureJSON(),images:[{uri:'javascript:window.metadataExecuted=true'}]}},
      {name:'required-extension',json:{...fixtureJSON(),extensionsRequired:['VMODEL_unknown_extension']}},
    ];
    const bytes=await renderableFixture().arrayBuffer(),length=new DataView(bytes).getUint32(12,true);
    const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
    Object.assign(json.extensions.VRMC_vrm.meta,{version:'embedded-1',allowRedistribution:true,name:attack,authors:[attack],otherLicenseUrl:'javascript:window.metadataExecuted=true',extraTermsLink:'data:text/html,'+attack});
    const encoded=blob=>blob.arrayBuffer().then(value=>Array.from(new Uint8Array(value)));
    return{attack,invalid:await Promise.all(invalid.map(async item=>({name:item.name,bytes:await encoded(glb(item.json))}))),valid:await encoded(glb(json,new Uint8Array(bytes,28+length)))};
  });
  const checks=[];
  for(const fixture of fixtures.invalid){
    const before=await page.evaluate(()=>window.graphicsContexts);
    await page.setInputFiles('#library-file',{name:fixture.name+'.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(fixture.bytes)});
    await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('Import failed'));
    assert.equal(await page.evaluate(()=>window.graphicsContexts),before);
    if(fixture.name==='external-buffer')await capture('inspection-error');
    checks.push({name:fixture.name,rejectedBeforeGraphics:true,message:await page.locator('#library-message').textContent()});
  }
  await page.setInputFiles('#library-file',{name:'metadata.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(fixtures.valid)});
  await page.waitForFunction(()=>/Ready to save|Import failed/.test(document.querySelector('#library-message').textContent));
  assert.equal(await page.locator('#library-message').textContent(),'Ready to save');
  await capture('preview');
  assert((await page.locator('#model-terms').textContent()).includes(fixtures.attack.replaceAll('"','\\"')));
  await page.evaluate(()=>{
    const original=File.prototype.arrayBuffer;
    File.prototype.arrayBuffer=function(){
      if(this.name==='delayed-terms.txt')return new Promise((resolve,reject)=>{window.rejectOldTerms=()=>reject(new Error('Old terms failure'));});
      return original.call(this);
    };
  });
  await page.setInputFiles('#terms-files',{name:'delayed-terms.txt',mimeType:'text/plain',buffer:Buffer.from('Old terms')});
  await page.waitForFunction(()=>typeof window.rejectOldTerms==='function');
  await page.setInputFiles('#terms-files',{name:'terms.md',mimeType:'text/plain',buffer:Buffer.from(fixtures.attack+'\nRedistribution is prohibited.')});
  await page.waitForFunction(attack=>document.querySelector('#attachment-terms').textContent.includes(attack),fixtures.attack);
  assert.equal(await page.locator('#embedded-version').textContent(),'Embedded model version: embedded-1');
  await page.locator('#package-version').fill('package-2');
  await page.evaluate(async()=>{window.rejectOldTerms();await new Promise(resolve=>setTimeout(resolve,0));});
  assert.equal(await page.locator('#library-message').textContent(),'Ready to save');
  const state=await page.evaluate(()=>({executed:window.metadataExecuted,elements:document.querySelectorAll('#model-terms img,#model-terms script,#attachment-terms img,#attachment-terms script').length,
    unsafeLinks:[...document.querySelectorAll('#model-terms a,#attachment-terms a')].filter(a=>/^(javascript|data):/.test(a.href)).length}));
  assert.deepEqual(state,{executed:false,elements:0,unsafeLinks:0});assert.deepEqual(externalRequests,[]);assert.deepEqual(errors,[]);
  await capture('terms-conflict');
  await page.locator('#model-name').fill('Metadata fixture');
  await page.locator('#acknowledge-terms').check();
  await page.evaluate(()=>{window.originalModelAdd=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(...args){if(this.name==='models')throw new DOMException('Quota fixture','QuotaExceededError');return window.originalModelAdd.apply(this,args);};});
  await page.locator('#save-model').click();await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('Save failed'));
  await capture('quota-failure');
  await page.evaluate(()=>{IDBObjectStore.prototype.add=window.originalModelAdd;});
  await page.locator('#save-model').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.model-card h2')].some(x=>x.textContent==='Metadata fixture'));
  await capture('saved-entry');
  await page.setInputFiles('#library-file',{name:'duplicate.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(fixtures.valid)});
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('Duplicate bytes'));
  await capture('duplicate');
  const versions=await page.evaluate(async()=>{
    const {LocalModelRepository}=await import('/src/model-repository.ts');
    const {createBackup,inspectBackup,restoreBackup}=await import('/src/library-backup.ts');
    const {sha256}=await import('/src/model-types.ts');
    const repo=new LocalModelRepository();
    try{
      const entry=(await repo.list()).find(x=>x.sourceKind==='imported');
      const originalTerms=(await repo.attachments(entry.id)).find(x=>x.kind==='terms');
      if(!originalTerms)throw new Error('The late failure removed the current terms.');
      const backup=await createBackup(repo,[entry]);await repo.remove(entry.id);
      const signal=new AbortController().signal;
      const plan=await inspectBackup(backup,repo,signal,async()=>{});
      const result=await restoreBackup(plan,repo,signal),restored=result.entries[0];
      const restoredTerms=(await repo.attachments(restored.id)).find(x=>x.kind==='terms');
      return{embedded:restored.rawMeta.version,supplied:restored.packageVersion,
        sameMetadata:JSON.stringify(entry.rawMeta)===JSON.stringify(restored.rawMeta),
        sameTerms:await sha256(originalTerms.blob)===await sha256(restoredTerms.blob)};
    }finally{repo.close();}
  });
  assert.deepEqual(versions,{embedded:'embedded-1',supplied:'package-2',sameMetadata:true,sameTerms:true});
  assert.deepEqual(externalRequests,[]);assert.deepEqual(errors,[]);
  const backupBytes=await page.evaluate(async()=>{
    const{LocalModelRepository}=await import('/src/model-repository.ts'),{createBackup}=await import('/src/library-backup.ts');
    const repo=new LocalModelRepository();try{return Array.from(new Uint8Array(await(await createBackup(repo,(await repo.list()).filter(entry=>entry.sourceKind==='imported'))).arrayBuffer()));}finally{repo.close();}
  });
  const backupFile={name:'focus.vmlib',mimeType:'application/octet-stream',buffer:Buffer.from(backupBytes)};
  await page.setInputFiles('#backup-file',backupFile);await page.locator('#restore-panel').waitFor({state:'visible'});
  await page.locator('#cancel-restore').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'restore-models');
  assert.equal(await page.locator('#library-message').textContent(),'Restore canceled.');
  await page.setInputFiles('#backup-file',backupFile);await page.locator('#restore-panel').waitFor({state:'visible'});
  await page.locator('#restore-acknowledgment').check();await page.locator('#commit-restore').click();
  await page.locator('#restore-panel').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.activeElement.id),'restore-models');
  assert.equal(await page.locator('#library-message').getAttribute('role'),'status');
  assert.deepEqual(errors,[]);
  assert(visualStates.every(image=>!image.horizontalOverflow));
  const report={visualStates,restoreFocusReturned:true,lateTermsFailureIgnored:true,versions,generatedAt:new Date().toISOString(),browser:browser.version(),checks,plainText:state,externalRequests,errors,
    limits:['Synthetic metadata and terms. External requests are blocked and counted by the test.']};
  await writeFile('ops/reports/import-metadata-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
