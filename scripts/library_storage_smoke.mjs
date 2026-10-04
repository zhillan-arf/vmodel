import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const server = await createServer({ server: { port: 0, strictPort: false, host: '127.0.0.1' } });
let browser;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(), page = await context.newPage(), other = await context.newPage();
  const errors = [];
  for (const target of [page, other]) target.on('pageerror', error => errors.push(error.message));
  await Promise.all([page.goto(base + 'tests/browser-host.html'), other.goto(base + 'tests/browser-host.html')]);
  for (const target of [page, other]) await target.evaluate(async () => {
    const { LocalModelRepository } = await import('/src/model-repository.ts');
    const { sha256 } = await import('/src/model-types.ts');
    const { renderableFixture } = await import('/tests/fixtures/vrm.ts');
    const db = await import('/src/library-db.ts');
    const repo = new LocalModelRepository();
    const inspection = await repo.inspect(renderableFixture(2), new AbortController().signal);
    const terms = new Blob(['Original terms']);
    const attachment = { id: 'draft', modelId: '', kind: 'terms', originalFilename: 'terms.md', mediaType: 'text/plain',
      blob: terms, sha256: await sha256(terms), encoding: 'utf-8' };
    const draft = { inspection, displayName: 'Storage fixture', originalFilename: 'storage.vrm', attachments: [attachment],
      acknowledgment: { acknowledgedAt: new Date().toISOString(), metadataDigest: await sha256(new Blob([JSON.stringify(inspection.rawMeta)])), attachmentHashes: [attachment.sha256] } };
    window.storageFixture = { repo, draft, db, renderableFixture, sha256 };
    window.storageChanges = 0; repo.changes.addEventListener('change', () => window.storageChanges++);
  });
  const checks = {};
  const results = await Promise.all([page, other].map(target => target.evaluate(async () => {
    const { repo, draft } = window.storageFixture;
    return (await repo.register(draft, new AbortController().signal)).id;
  })));
  assert.equal(results[0], results[1]);
  await other.waitForFunction(() => window.storageChanges > 0);
  checks.twoTabDuplicateRace = await page.evaluate(async () => {
    const { transact, requestValue } = window.storageFixture.db;
    return transact(['models', 'assets', 'attachments'], 'readonly', async tx => ({
      models: await requestValue(tx.objectStore('models').count()), assets: await requestValue(tx.objectStore('assets').count()),
      attachments: await requestValue(tx.objectStore('attachments').count()),
    }));
  });
  assert.deepEqual(checks.twoTabDuplicateRace, { models: 1, assets: 1, attachments: 1 });
  const before = await page.evaluate(async () => {
    const { repo } = window.storageFixture;
    localStorage.setItem('vmodel-avatar', 'rei'); localStorage.setItem('vmodel-avatar-settings:existing', '{"version":1}');
    localStorage.setItem('vmodel-calibration:existing', 'unchanged');
    await repo.selected(); await repo.list();
    return { ...localStorage };
  });
  const count = await page.evaluate(() => window.storageChanges);
  await other.evaluate(async () => {
    const { repo } = window.storageFixture;
    await repo.rename((await repo.list()).find(x => x.sourceKind === 'imported').id, 'Name from another tab');
  });
  await page.waitForFunction(count => window.storageChanges > count, count);
  const secondVisit = await context.newPage(); await secondVisit.goto(base + 'tests/browser-host.html');
  checks.secondVisit = await secondVisit.evaluate(async () => {
    const { LocalModelRepository } = await import('/src/model-repository.ts');
    const repo = new LocalModelRepository();
    try { return { entries: await repo.list(), storage: { ...localStorage } }; } finally { repo.close(); }
  });
  assert.equal(checks.secondVisit.entries.find(x => x.id === results[0]).displayName, 'Name from another tab');
  assert.deepEqual(checks.secondVisit.storage, before);
  checks.secondVisit = { sameEntry: true, remoteRename: true, profileKeysUnchanged: true };
  await secondVisit.close();

  checks.rollbackAndCancellation = await page.evaluate(async () => {
    const { repo, draft, db, renderableFixture, sha256 } = window.storageFixture;
    const { transact, requestValue } = db;
    const counts = () => transact(['models', 'assets', 'attachments'], 'readonly', async tx => ({
      models: await requestValue(tx.objectStore('models').count()), assets: await requestValue(tx.objectStore('assets').count()),
      attachments: await requestValue(tx.objectStore('attachments').count()),
    }));
    const before = await counts(), inspection = await repo.inspect(renderableFixture(1), new AbortController().signal);
    const candidate = { ...draft, inspection, acknowledgment: { ...draft.acknowledgment,
      metadataDigest: await sha256(new Blob([JSON.stringify(inspection.rawMeta)])) } };
    const add = IDBObjectStore.prototype.add;
    let quota = false;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'attachments') throw new DOMException('Quota fixture', 'QuotaExceededError');
      return add.apply(this, args);
    };
    try { await repo.register(candidate, new AbortController().signal); }
    catch (error) { quota = error.name === 'QuotaExceededError'; }
    finally { IDBObjectStore.prototype.add = add; }
    const afterQuota = await counts();
    const cancel = new AbortController(); let cancelled = false;
    IDBObjectStore.prototype.add = function (...args) {
      const request = add.apply(this, args);
      if (this.name === 'attachments') request.addEventListener('success', () => cancel.abort());
      return request;
    };
    try { await repo.register(candidate, cancel.signal); }
    catch { cancelled = true; }
    finally { IDBObjectStore.prototype.add = add; }
    const afterCancel = await counts();
    const committed = new AbortController(), entry = await repo.register(candidate, committed.signal); committed.abort();
    const stillSaved = (await repo.resolve(entry.id, new AbortController().signal)).hash === inspection.hash;
    await repo.remove(entry.id);
    const afterRemove = await counts();
    let invalidDraft = false;
    const changed = { ...draft, inspection: { ...draft.inspection, blob: new Blob(['wrong bytes']) } };
    try { await repo.register(changed, new AbortController().signal); } catch { invalidDraft = true; }
    return { before, afterQuota, afterCancel, afterRemove, quota, cancelled, stillSaved, invalidDraft };
  });
  const rollback = checks.rollbackAndCancellation;
  assert(rollback.quota && rollback.cancelled && rollback.stillSaved && rollback.invalidDraft);
  for (const key of ['afterQuota', 'afterCancel', 'afterRemove']) assert.deepEqual(rollback[key], rollback.before);

  checks.restoreTransactions = await page.evaluate(async()=>{
    const {repo,draft,db,renderableFixture,sha256}=window.storageFixture;
    const {restoreBackup}=await import('/src/library-backup.ts'),{defaults}=await import('/src/types.ts');
    const counts=()=>db.transact(['models','assets','attachments'],'readonly',async tx=>({
      models:await db.requestValue(tx.objectStore('models').count()),assets:await db.requestValue(tx.objectStore('assets').count()),attachments:await db.requestValue(tx.objectStore('attachments').count())
    }));
    const drafts=[];
    for(const index of [0,1]){
      const inspection=await repo.inspect(renderableFixture(index),new AbortController().signal);
      drafts.push({...draft,inspection,acknowledgment:{...draft.acknowledgment,metadataDigest:await sha256(new Blob([JSON.stringify(inspection.rawMeta)]))}});
    }
    const plan={drafts,existing:[],settings:{[drafts[0].inspection.hash]:defaults},bytes:0,needsReview:false,reviewHashes:[]},before=await counts();
    const add=IDBObjectStore.prototype.add;let attachments=0,quota=false;
    IDBObjectStore.prototype.add=function(...args){if(this.name==='attachments'&&++attachments===2)throw new DOMException('Restore quota fixture','QuotaExceededError');return add.apply(this,args);};
    try{await restoreBackup(plan,repo,new AbortController().signal);}catch(error){quota=error.name==='QuotaExceededError';}finally{IDBObjectStore.prototype.add=add;}
    const afterQuota=await counts(),controller=new AbortController();attachments=0;let cancelled=false;
    IDBObjectStore.prototype.add=function(...args){const request=add.apply(this,args);if(this.name==='attachments'&&++attachments===2)request.addEventListener('success',()=>controller.abort());return request;};
    try{await restoreBackup(plan,repo,controller.signal);}catch{cancelled=true;}finally{IDBObjectStore.prototype.add=add;}
    const afterCancel=await counts(),set=Storage.prototype.setItem,committed=new AbortController();
    Storage.prototype.setItem=function(key,value){if(key.includes(drafts[0].inspection.hash))throw new DOMException('Settings denied','SecurityError');return set.call(this,key,value);};
    let result;
    try{result=await restoreBackup(plan,repo,committed.signal);}finally{Storage.prototype.setItem=set;}
    committed.abort();const afterCommit=await counts();
    for(const entry of result.entries)await repo.remove(entry.id);
    return{before,afterQuota,afterCancel,afterCommit,afterRemove:await counts(),quota,cancelled,settingsFailures:result.settingsFailures};
  });
  const restore=checks.restoreTransactions;
  assert(restore.quota&&restore.cancelled);assert.equal(restore.settingsFailures,1);
  for(const name of ['afterQuota','afterCancel','afterRemove'])assert.deepEqual(restore[name],restore.before);
  assert.deepEqual(restore.afterCommit,{models:3,assets:3,attachments:3});

  checks.blockedUpgrade = await page.evaluate(async () => {
    const { db } = window.storageFixture;
    const held = await new Promise((resolve, reject) => { const request = indexedDB.open(db.databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    held.onversionchange = () => {};
    const original = IDBFactory.prototype.open;
    let pending, message = '';
    // A native version-2 request exercises the future-upgrade recovery branch.
    IDBFactory.prototype.open = function (name, version) { pending = original.call(this, name, name === db.databaseName ? 2 : version); return pending; };
    try { await db.openLibrary(); } catch (error) { message = error.message; }
    finally { IDBFactory.prototype.open = original; }
    const finished = new Promise(resolve => { pending.addEventListener('error', () => resolve()); pending.addEventListener('success', () => resolve()); });
    held.close(); await finished;
    const unchanged = await db.openLibrary(); const version = unchanged.version; unchanged.close();
    return { message, version };
  });
  assert.match(checks.blockedUpgrade.message, /Close other studio tabs/); assert.equal(checks.blockedUpgrade.version, 1);

  checks.newerSchema = await page.evaluate(async () => {
    const { repo, db } = window.storageFixture;
    const closedOnChange = await db.openLibrary();
    const upgrade = await new Promise((resolve, reject) => { const request = indexedDB.open(db.databaseName, 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    upgrade.close();
    let message = '', closed = false;
    try { closedOnChange.transaction('models'); } catch (error) { closed = error.name === 'InvalidStateError'; }
    try { await repo.list(); } catch (error) { message = error.message; }
    const db2 = await new Promise((resolve, reject) => { const request = indexedDB.open(db.databaseName); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db2.transaction('models'), records = await db.requestValue(tx.objectStore('models').getAll()); db2.close();
    return { message, closed, records: records.length };
  });
  assert.match(checks.newerSchema.message, /newer application version/); assert(checks.newerSchema.closed); assert.equal(checks.newerSchema.records, 1);
  await context.close();

  const ui = await browser.newContext();
  const fixturePage = await ui.newPage(); await fixturePage.goto(base + 'tests/browser-host.html');
  const blobs = await fixturePage.evaluate(async () => {
    const { renderableFixture } = await import('/tests/fixtures/vrm.ts');
    return Promise.all([0, 1, 2, 3].map(async n => Array.from(new Uint8Array(await renderableFixture(n).arrayBuffer()))));
  });
  await fixturePage.close();
  await ui.route('**/avatars/*.vrm', route => route.fulfill({ contentType: 'model/gltf-binary', body: Buffer.from(blobs[route.request().url().endsWith('ene.vrm') ? 0 : 1]) }));
  await ui.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get: () => { throw new DOMException('Storage denied', 'SecurityError'); } }); });
  const denied = await ui.newPage(); denied.on('pageerror', error => errors.push(error.message)); await denied.goto(base);
  await denied.waitForFunction(() => window.__vmodel?.getState().selectedBundle === 'ene');
  await denied.locator('.studio-nav [data-view="library"]').click();
  await denied.waitForFunction(() => document.querySelector('#library-message').textContent.includes('Saved entries are unavailable'));
  await denied.setInputFiles('#library-file', { name: 'temporary.vrm', mimeType: 'application/octet-stream', buffer: Buffer.from(blobs[2]) });
  await denied.waitForFunction(() => document.querySelector('#library-message').textContent === 'Ready to save');
  await denied.locator('#try-model').click();
  await denied.waitForFunction(() => window.__vmodel?.getState().label.includes('Temporary'));
  checks.deniedStorage = { bundledLoads: true, temporaryLoads: true, recoveryText: true };
  await ui.close();
  checks.persistence = {};
  for (const mode of ['granted', 'denied', 'unavailable']) {
    const profile=await browser.newContext();
    await profile.route('**/avatars/*.vrm',route=>route.fulfill({contentType:'model/gltf-binary',body:Buffer.from(blobs[route.request().url().endsWith('ene.vrm')?0:1])}));
    await profile.addInitScript(mode=>{
      window.persistenceRequests=0;
      Object.defineProperty(navigator,'storage',{value:{
        estimate:async()=>({usage:0,quota:0}), persisted:async()=>false,
        persist:mode==='unavailable'?undefined:async()=>{window.persistenceRequests++;return mode==='granted';}
      }});
    },mode);
    const target=await profile.newPage();target.on('pageerror',error=>errors.push(error.message));
    await target.goto(base);await target.waitForFunction(()=>window.__vmodel?.getState().selectedBundle==='ene');
    await target.locator('.studio-nav [data-view="library"]').click();
    assert.equal(await target.evaluate(()=>window.persistenceRequests),0);
    for (const index of [2,3]) {
      await target.setInputFiles('#library-file',{name:`saved-${index}.vrm`,mimeType:'application/octet-stream',buffer:Buffer.from(blobs[index])});
      await target.waitForFunction(()=>document.querySelector('#library-message').textContent==='Ready to save');
      await target.locator('#acknowledge-terms').check();await target.locator('#save-model').click();
      await target.waitForFunction(()=>document.querySelector('#import-panel').hidden);
      const expected=mode==='granted'?'Persistent storage is granted':mode==='denied'?'browser can remove':'persistence is unavailable';
      await target.waitForFunction(expected=>document.querySelector('#library-persistence').textContent.includes(expected),expected);
    }
    const requests=await target.evaluate(()=>window.persistenceRequests);
    assert.equal(requests,mode==='unavailable'?0:1);
    assert.match(await target.locator('#library-storage').textContent(),/2 saved models/);
    checks.persistence[mode]={requestCount:requests,twoSavesWithZeroEstimate:true,statusVisible:true};
    await profile.close();
  }
  assert.deepEqual(errors, []);
  const report = { generatedAt: new Date().toISOString(), browser: browser.version(), checks, errors, fixtureHashes:blobs.map(bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex')),
    platform:process.platform,browserChannel:process.env.VMODEL_BROWSER??'chromium',
    limits: ['Synthetic models only.', 'The blocked-upgrade test changes the requested version through a test wrapper.', 'No physical camera test or human review.'] };
  await mkdir('ops/001-zhil/sprint-001/reports', { recursive: true });
  await writeFile('ops/001-zhil/sprint-001/reports/library-storage-smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser?.close(); await server.close(); }
