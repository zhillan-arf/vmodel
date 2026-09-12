import { chromium } from '@playwright/test';
import { connectOBS } from './obs-client.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const obs=await connectOBS(), results=[], errors=[];
let browser, page;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function screenshot(sceneName,path){
  const {imageData}=await obs.request('GetSourceScreenshot',{sourceName:sceneName,imageFormat:'png'});
  const bytes=Buffer.from(imageData.split(',')[1],'base64');await writeFile(path,bytes);
  return createHash('sha256').update(bytes).digest('hex');
}
try {
 if((await obs.request('GetRecordStatus')).outputActive || (await obs.request('GetStreamStatus')).outputActive)throw new Error('Stop the existing OBS recording/stream before running this check.');
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--window-size=1100,680']});
 // A real desktop capture must use the native viewport. Emulated Playwright
 // dimensions can extend beneath browser chrome and invalidate a crop.
 const context=await browser.newContext({viewport:null});
 await context.addInitScript(()=>{window.__cameraRequests=0;navigator.mediaDevices.getUserMedia=async()=>{window.__cameraRequests++;throw new Error('Physical media capture is disabled in this fixture.');};});
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.VMODEL_TEST_URL??'http://127.0.0.1:4173/');
 await page.waitForFunction(()=>!!window.__vmodel,undefined,{timeout:90000});
 await page.locator('#clean').click();
 const title='Ene Output Capture Check '+Date.now();await page.evaluate(title=>{document.title=title;},title);
 await mkdir('ops/reports/local/obs',{recursive:true});
 for(const orientation of ['Landscape','Portrait']) {
  const sourceName='Ene '+orientation+' Window',sceneName='Ene '+orientation;
  await obs.request('SetCurrentProfile',{profileName:sceneName});await obs.request('SetCurrentProgramScene',{sceneName});
  await page.evaluate(orientation=>{
    const select=document.querySelector('#orientation');select.value=orientation.toLowerCase();select.dispatchEvent(new Event('change'));
    clearInterval(window.__poseTimer);
    window.__poseYaw=.35;
    const update=()=>{
      const timestamp=performance.timeOrigin+performance.now(),a=window.__poseYaw,c=Math.cos(a),s=Math.sin(a);
      window.__vmodel.setFrame({version:1,sequence:1,timestamp,face:{jawOpen:.2},faceMatrix:[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1],pose:[],poseImage:[],hands:[],inferenceMs:0,
        samples:Object.fromEntries(['face','pose','hands'].map(name=>[name,{timestamp,inferenceMs:0,present:name==='face'}]))});
    };update();window.__poseTimer=setInterval(update,33);
  },orientation);
  let layoutReady=false;
  for(let i=0;i<30;i++) {
    layoutReady=await page.evaluate(async({title,orientation})=>{const {layouts}=await (await fetch('/api/output-layout')).json();return layouts.some(layout=>layout.title===title&&layout.orientation===orientation.toLowerCase()&&layout.viewport.width===innerWidth&&layout.viewport.height===innerHeight);},{title,orientation});
    if(layoutReady)break;await pause(250);
  }
  assert.equal(layoutReady,true,'Current output geometry must be published before capture.');
  if(process.env.VMODEL_OBS_DEBUG==='1')console.log(JSON.stringify({browserLayout:await page.evaluate(async()=>({title:document.title,api:await(await fetch('/api/output-layout')).json()}))}));
  const {stdout}=await promisify(execFile)(process.execPath,['scripts/configure_obs.mjs','--attach','--title',title,...(orientation==='Portrait'?['--portrait']:[])]);
  const attachment=JSON.parse(stdout);assert.equal(attachment.attached,true);
  const {sceneItemId}=await obs.request('GetSceneItemId',{sceneName,sourceName});
  await obs.request('SetSceneItemEnabled',{sceneName,sceneItemId,sceneItemEnabled:true});
  let transform;
  for(let i=0;i<30;i++) {
    await pause(250);transform=(await obs.request('GetSceneItemTransform',{sceneName,sceneItemId})).sceneItemTransform;
    if(transform.sourceWidth>0&&transform.sourceHeight>0)break;
  }
  assert(transform.sourceWidth>0&&transform.sourceHeight>0);
  const metrics=await page.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{innerWidth,innerHeight,canvas:{left:r.left,top:r.top,width:r.width,height:r.height},dpr:devicePixelRatio};});
  const crop=attachment.crop;
  await pause(1000);
  const first=await screenshot(sceneName,`ops/reports/local/obs/${orientation.toLowerCase()}-a.png`);
  await page.evaluate(()=>{window.__poseYaw=-.35;});await pause(1000);
  const second=await screenshot(sceneName,`ops/reports/local/obs/${orientation.toLowerCase()}-b.png`);
  assert.notEqual(first,second);
  assert.equal(await page.evaluate(()=>window.__cameraRequests),0);
  const result={orientation,video:await obs.request('GetVideoSettings'),source:{width:transform.sourceWidth,height:transform.sourceHeight},metrics,crop,changed:first!==second,
    transform:(await obs.request('GetSceneItemTransform',{sceneName,sceneItemId})).sceneItemTransform,stats:await obs.request('GetStats')};
  results.push(result);console.log(JSON.stringify({orientation,source:result.source,crop,changed:true}));
  await obs.request('SetSceneItemEnabled',{sceneName,sceneItemId,sceneItemEnabled:false});
 }
 assert.deepEqual(errors,[]);
}catch(error){errors.push(String(error));console.error(error);process.exitCode=1;}
finally {
 for(const orientation of ['Landscape','Portrait']) {
  try {const sceneName='Ene '+orientation;const {sceneItemId}=await obs.request('GetSceneItemId',{sceneName,sourceName:sceneName+' Window'});await obs.request('SetSceneItemEnabled',{sceneName,sceneItemId,sceneItemEnabled:false});}catch{}
 }
 await writeFile('ops/reports/obs-capture-smoke.json',JSON.stringify({date:new Date().toISOString(),input:'Visible owned Chrome window with actual Ene and deterministic face frames. No physical camera/microphone or recording/stream was started.',results,errors},null,2));
 await browser?.close();obs.close();
}
