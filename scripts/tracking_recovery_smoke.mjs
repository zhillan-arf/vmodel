import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const base=process.env.VMODEL_TEST_URL??'http://127.0.0.1:4173/';
const duration=Number(process.env.VMODEL_SMOKE_MS??70000);
const origin=new URL(base).origin;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const context=await browser.newContext({permissions:['camera'],viewport:{width:1280,height:900}});
const errors=[],messages=[],externalRequests=[],externalResponses=[],blockedByHarness=[];
const external=url=>!url.startsWith(origin+'/')&&!url.startsWith('blob:')&&!url.startsWith('data:');
context.on('request',request=>{if(external(request.url()))externalRequests.push(request.url());});
context.on('response',response=>{if(external(response.url()))externalResponses.push(response.url());});
await context.route('**/*',route=>{
  if(external(route.request().url())){blockedByHarness.push(route.request().url());return route.abort('blockedbyclient');}
  return route.continue();
});
await context.addInitScript(()=>{
  window.__cameraRequests=[];window.__testTracks=[];
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async constraints=>{
    window.__cameraRequests.push(constraints);const stream=await original(constraints);
    window.__testTracks.push(...stream.getTracks());return stream;
  };
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('console',message=>{if(['warning','error'].includes(message.type()))messages.push(message.text());});
async function start(){
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await page.waitForFunction(()=>/Camera active|could not start|unavailable|Tracker stopped|too long/.test(document.querySelector('#status').textContent),undefined,{timeout:65000});
  if(!/Camera active/.test(await page.locator('#status').textContent()))throw new Error(await page.locator('#status').textContent());
  await page.waitForFunction(()=>window.__vmodel?.getStats().inferenceMs>0||/stopped responding/.test(document.querySelector('#status').textContent),undefined,{timeout:65000});
  if(!(await page.evaluate(()=>window.__vmodel.getStats().inferenceMs>0)))throw new Error(await page.locator('#status').textContent());
}
const released=()=>document.querySelector('video').srcObject===null&&window.__testTracks.every(t=>t.readyState==='ended');
try {
  const response=await page.goto(base);
  const policy=response.headers()['content-security-policy'];
  if(!policy?.includes("connect-src 'self'"))throw new Error('Local-only policy missing');
  await page.waitForFunction(()=>!!window.__vmodel,undefined,{timeout:90000});
  const noAutoCamera=await page.evaluate(()=>window.__cameraRequests.length===0);
  await start();
  console.log('Tracking started; measuring past the telemetry flush interval.');
  const samples=[],until=Date.now()+duration;
  while(Date.now()<until){await page.waitForTimeout(1000);samples.push(await page.evaluate(()=>window.__vmodel.getStats()));}
  if(!/Camera active/.test(await page.locator('#status').textContent()))throw new Error('Camera did not stay active');
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  const stopped=await page.evaluate(released);
  await start();await page.waitForTimeout(1500);
  const restarted=(await page.evaluate(()=>window.__vmodel.getStats().inferenceMs))>0;
  // Reserved domain; the test harness also blocks it if the policy ever regresses.
  const probe=async()=>{try{await fetch('https://vmodel-policy-probe.invalid/no-data');return false;}catch{return true;}};
  const pageProbe=await page.evaluate(probe);
  const worker=page.workers()[0];if(!worker)throw new Error('No tracking worker after restart');
  const workerProbe=await worker.evaluate(probe);
  const cameraRequests=await page.evaluate(()=>window.__cameraRequests);
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  const releasedAgain=await page.evaluate(released);
  const result={date:new Date().toISOString(),base,input:'Chromium synthetic fake camera; no real face/gesture acceptance',durationMs:duration,
    samples,stopped,restarted,releasedAgain,noAutoCamera,cameraRequests,policy,pageProbe,workerProbe,
    externalRequests,externalResponses,blockedByHarness,errors,messages};
  await writeFile('ops/reports/tracking-recovery-smoke.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,samples:`${samples.length} samples`,messages:`${messages.length} messages`}));
  if(errors.length||!stopped||!restarted||!releasedAgain||!noAutoCamera||!pageProbe||!workerProbe||externalResponses.length||blockedByHarness.length||cameraRequests.some(c=>c.audio!==false))process.exitCode=1;
}catch(error){
  const result={date:new Date().toISOString(),base,error:String(error),status:await page.locator('#status').textContent(),errors,messages,externalRequests,externalResponses,blockedByHarness};
  await writeFile('ops/reports/tracking-recovery-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=1;
}finally{await browser.close();}
