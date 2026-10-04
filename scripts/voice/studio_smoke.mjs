import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base='http://127.0.0.1:5083';
const cache=await fs.mkdtemp(path.join(root,'.cache/voice/studio-ui-'));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k.toUpperCase())));
const server=spawn(path.join(root,'.tools/voice/venv/Scripts/python.exe'),['-I',path.join(root,'scripts/voice/studio_server.py'),'--port','5083','--state-dir',cache],{cwd:root,env,windowsHide:true,stdio:['ignore','ignore','pipe']});
let serverErrors='';server.stderr.on('data',d=>serverErrors+=d.toString());
let browser;const errors=[],external=[];let microphoneRequests=0;
try{
  for(let i=0;i<60;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const context=await browser.newContext({viewport:{width:1280,height:1100}});
  await context.exposeBinding('micAttempt',()=>microphoneRequests++);
  await context.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{await window.micAttempt();throw new Error('No physical microphone in tests');};});
  context.on('request',req=>{if(!req.url().startsWith(base+'/'))external.push(req.url());});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#reference').waitFor();await page.waitForFunction(()=>!document.querySelector('#reference').disabled);
  assert.equal(await page.locator('#monitor').isChecked(),false);
  const privateURL=await page.locator('#route').inputValue();assert(privateURL.startsWith(base+'/obs#route='));
  const output=await context.newPage();output.on('pageerror',e=>errors.push(e.message));await output.goto(privateURL);
  await output.waitForFunction(()=>window.voiceOutput?.ws?.readyState===WebSocket.OPEN&&window.voiceOutput.context.state==='running');
  const compared=[];
  for(const voice of ['bright','soft','cool']){
    await page.locator(`[data-voice="${voice}"]`).click();await page.waitForFunction(voice=>document.querySelector(`[data-voice="${voice}"]`).classList.contains('selected'),voice);
    await page.locator('#reference').click();
    await output.waitForFunction(()=>window.voiceOutput.sequence>=2);
    assert.equal(await output.evaluate(()=>window.voiceOutput.context.sampleRate),40000);
    compared.push(voice);await page.locator('#stop').click();await output.waitForFunction(()=>!window.voiceOutput.allow&&window.voiceOutput.sequence===-1);
  }
  await page.locator('#output-gain').fill('0.65');await page.locator('#context').selectOption('800');await page.locator('#save').click();
  await page.waitForFunction(()=>document.querySelector('#message').textContent.toLowerCase().includes('saved'));
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#reference').disabled);
  assert.equal(await page.locator('#output-gain').inputValue(),'0.65');assert.equal(await page.locator('#context').inputValue(),'800');
  await page.locator('#monitor').check();await page.locator('#reference').click();await output.waitForFunction(()=>window.voiceOutput.sequence>=2);
  await page.locator('#monitor').uncheck();const before=await output.evaluate(()=>window.voiceOutput.sequence);await output.waitForFunction(n=>window.voiceOutput.sequence>n+2,before);
  await page.locator('#stop').click();
  const other=await context.newPage();await other.goto(base);await other.waitForFunction(()=>document.querySelector('#message').textContent.includes('Another Voice Studio window'));await other.close();
  await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#context').value==='1600');
  await page.screenshot({path:path.join(root,'ops/001-zhil/sprint-001/reports/local/voice/studio-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(root,'ops/001-zhil/sprint-001/reports/local/voice/studio-mobile.png'),fullPage:true});
  await page.close();await output.waitForFunction(()=>!window.voiceOutput.allow);
  await output.evaluate(()=>window.voiceOutput.close());await output.close();
  assert.equal(microphoneRequests,0);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const report={date:new Date().toISOString(),passed:true,compared,saveRestoreReset:true,monitoringIndependentOfOutput:true,secondControlWindowRejected:true,stopAndControllerLossMute:true,outputSampleRate:40000,mobileOverflow:false,physicalMicrophoneRequests:microphoneRequests,externalRequests:external,browserErrors:errors,privateProductionProfilesModified:false,boundary:'Converted reference UI and Web Audio receiver only. No live inference, subjective listening, physical latency or OBS acceptance.'};
  await fs.writeFile(path.join(root,'ops/001-zhil/sprint-001/reports/voice-studio-ui-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{
  await browser?.close();
  try{const route=JSON.parse(await fs.readFile(path.join(cache,'route.json'),'utf8'));await fetch(base+'/api/shutdown',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({adminKey:route.adminKey})});}catch{}
  await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(()=>{server.kill();resolve();},3000).unref();});
  if(serverErrors)console.error(serverErrors);
}
