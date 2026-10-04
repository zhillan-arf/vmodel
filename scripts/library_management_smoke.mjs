import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});const context=await browser.newContext(),page=await context.newPage(),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
  const base=server.resolvedUrls.local[0];await page.goto(base+'tests/browser-host.html');
  const fixtures=await page.evaluate(async()=>{const{renderableFixture}=await import('/tests/fixtures/vrm.ts');return Promise.all([0,1].map(async i=>Array.from(new Uint8Array(await renderableFixture(i).arrayBuffer()))));});
  await context.route('**/avatars/*.vrm',route=>route.fulfill({contentType:'model/gltf-binary',body:Buffer.from(fixtures[0])}));
  await page.goto(base);await page.waitForFunction(()=>!!window.__vmodel);
  const remote=await context.newPage();await remote.goto(base);await remote.waitForFunction(()=>!!window.__vmodel);
  await remote.locator('[data-view="library"]').click();
  await page.locator('[data-view="library"]').click();
  await page.setInputFiles('#library-file',{name:'managed.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(fixtures[1])});
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent==='Ready to save');
  await page.locator('#acknowledge-terms').check();await page.locator('#save-model').click();
  const card=(p,name)=>p.locator('.model-card').filter({has:p.getByRole('heading',{name,exact:true})});
  await card(page,'managed').getByRole('button',{name:'Use model',exact:true}).click();
  await page.waitForFunction(()=>window.__vmodel?.getState().label==='managed'&&document.querySelector('#status').textContent.includes('is ready'));
  const active=await page.evaluate(()=>window.__vmodel.getState());
  await card(page,'managed').locator('summary').click();assert.equal(await card(page,'managed').getByRole('button',{name:'Remove',exact:true}).isDisabled(),true);
  for(const name of ['Ene · Cyber legs','Rei · Adachi Rei']){assert.equal(await card(page,name).count(),1);assert.equal(await card(page,name).getByRole('button',{name:'Remove',exact:true}).count(),0);}
  assert.equal(await page.evaluate(async()=>{const{LocalModelRepository}=await import('/src/model-repository.ts');const repo=new LocalModelRepository();try{for(const id of ['ene','rei']){try{await repo.remove(id);return false;}catch{}}return true;}finally{repo.close();}}),true);
  await card(page,'managed').locator('input[type="checkbox"]').check();
  await card(page,'managed').getByRole('button',{name:'Use model',exact:true}).focus();
  await card(remote,'managed').locator('summary').click();
  remote.once('dialog',d=>d.accept('   '));
  await card(remote,'managed').getByRole('button',{name:'Rename',exact:true}).click();
  await remote.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('1 through 80'));
  assert.equal(await remote.locator('#library-message').getAttribute('role'),'alert');
  assert.equal(await remote.locator('#library-message').getAttribute('aria-live'),'assertive');
  remote.once('dialog',d=>d.accept('Renamed model'));
  await card(remote,'managed').getByRole('button',{name:'Rename',exact:true}).click();
  await card(page,'Renamed model').waitFor();
  assert.equal(await card(page,'Renamed model').locator('input[type="checkbox"]').isChecked(),true);
  assert.equal(await card(page,'Renamed model').locator('details').getAttribute('open'),'');
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Use model');
  assert.deepEqual(await page.evaluate(()=>window.__vmodel.getState()),active);
  if(!(await card(remote,'Renamed model').locator('details').evaluate(el=>el.open)))await card(remote,'Renamed model').locator('summary').click();
  remote.once('dialog',d=>d.accept());await card(remote,'Renamed model').getByRole('button',{name:'Remove',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('no longer saved'));
  assert.equal(await page.locator('#library-current').isVisible(),true);
  assert((await page.locator('#library-current').textContent()).includes('no longer saved'));
  assert.equal(await card(page,'Renamed model').count(),0);assert.deepEqual(await page.evaluate(()=>window.__vmodel.getState()),active);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'import-model');
  assert.deepEqual(errors,[]);
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),activeRemovalDisabled:true,bundleRemovalAbsent:true,
    invalidRenameAnnouncedImmediately:true,remoteRenamePreservesPerformance:true,refreshPreservesFocusDetailsAndSelection:true,remoteRemovalPreservesPerformance:true,missingSavedState:true,errors,
    limits:['Synthetic models and two Chromium tabs. No physical camera check.']};
  await writeFile('ops/001-zhil/sprint-001/reports/library-management-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
