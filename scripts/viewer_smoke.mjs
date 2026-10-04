import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[],checks={},memory=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.VMODEL_TEST_URL??'http://127.0.0.1:4173/');
 await page.waitForFunction(()=>!!window.__vmodel,undefined,{timeout:90000});
 const original=await page.evaluate(()=>window.__vmodel.getState().avatarId);
 for(let i=0;i<4;i++) {
  if(i){
   await page.evaluate(()=>{window.__oldRetarget=window.__vmodel.retarget;});
   await page.locator('#avatar-file').setInputFiles([]);
   await page.locator('#avatar-file').setInputFiles('assets/avatars/ene.vrm');
   await page.waitForFunction(()=>window.__oldRetarget!==window.__vmodel.retarget,undefined,{timeout:90000});
  }
  await page.waitForTimeout(350);
  memory.push(await page.evaluate(()=>({...window.__vmodel.viewer.renderer.info.memory,programs:window.__vmodel.viewer.renderer.info.programs.length})));
 }
 assert(memory.every(sample=>sample.geometries===memory[0].geometries&&sample.textures===memory[0].textures&&sample.programs===memory[0].programs));
 checks.gpuResourcesStableAcrossReloads=true;
 await page.locator('#avatar-file').setInputFiles('ops/001-zhil/sprint-001/resources/ene.vmd');
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('VMD is animation'));
 assert.equal(await page.evaluate(()=>window.__vmodel.getState().avatarId),original);
 checks.invalidMotionRetainsWorkingAvatar=true;
 await page.evaluate(()=>{window.__contextControl=window.__vmodel.viewer.renderer.getContext().getExtension('WEBGL_lose_context');window.__contextControl.loseContext();});
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Graphics paused'));
 await page.waitForTimeout(500);await page.evaluate(()=>window.__contextControl.restoreContext());
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Graphics restored'),undefined,{timeout:15000});
 await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.__vmodel.getState().avatarId),original);
 checks.contextRestoresWithoutReload=true;
 assert.deepEqual(errors,[]);
}catch(error){checks.failure=String(error);console.error(error);process.exitCode=1;}
finally{await writeFile('ops/001-zhil/sprint-001/reports/viewer-smoke.json',JSON.stringify({date:new Date().toISOString(),checks,memory,errors},null,2));console.log(JSON.stringify({checks,memory,errors}));await browser.close();}
