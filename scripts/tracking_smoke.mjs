import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const context=await browser.newContext({permissions:['camera'],viewport:{width:1280,height:900}});
const page=await context.newPage();const errors=[],messages=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',message=>{if(['warning','error'].includes(message.type()))messages.push(message.text());});
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>!!window.__vmodel,undefined,{timeout:90000});
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
  console.log('AFTER_START',await page.locator('#status').textContent());
  await page.waitForFunction(()=>window.__vmodel?.getStats().inferenceMs>0 || /could not start|unavailable|Tracker stopped/.test(document.querySelector('#status').textContent),undefined,{timeout:60000});
  if(!(await page.evaluate(()=>window.__vmodel.getStats().inferenceMs>0)))throw new Error(await page.locator('#status').textContent());
  const samples=[];
  for(let i=0;i<5;i++){await page.waitForTimeout(1000);samples.push(await page.evaluate(()=>window.__vmodel.getStats()));}
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  const stopped=await page.evaluate(()=>document.querySelector('video').srcObject===null);
  const result={input:'Chromium synthetic fake camera; no real face/gesture acceptance',samples,stopped,errors,messages};
  await writeFile('ops/reports/tracking-smoke.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  if(errors.length||!stopped)process.exitCode=1;
} catch(error) {
  const result={error:String(error),status:await page.locator('#status').textContent(),errors,messages,video:await page.evaluate(()=>{const v=document.querySelector('video');return {readyState:v.readyState,paused:v.paused,width:v.videoWidth,stream:!!v.srcObject};})};
  await writeFile('ops/reports/tracking-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=1;
} finally{await browser.close();}
