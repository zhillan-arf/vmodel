import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const run=promisify(execFile),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=process.cwd(),base='http://127.0.0.1:4173',pidFile=path.join(root,'.cache/server.pid');
const checks={},errors=[];let fixture,browser,activeStudio=false;
async function closeFixture() {
  if(fixture&&fixture.exitCode===null&&fixture.signalCode===null) { const closed=new Promise(resolve=>fixture.once('exit',resolve));fixture.kill();await closed; }
  fixture=null;
}
async function launch(script,...args) { return run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts',script),...args],{cwd:path.join(root,'.cache'),windowsHide:true,timeout:20000}); }
async function health() { try {return await(await fetch(base+'/health',{signal:AbortSignal.timeout(600),cache:'no-store'})).json();}catch{return null;} }
async function waitHealth(expected) {for(let i=0;i<30;i++){const value=await health();if(value?.application===expected)return value;await pause(200);}throw new Error('Expected local server did not become ready.');}
try {
  assert.equal(await health(),null,'Stop only the known project server before testing launcher ownership; do not replace an existing listener.');
  await launch('start.ps1','-NoBrowser');activeStudio=true;await waitHealth('vmodel');
  const firstPid=(await readFile(pidFile,'utf8')).trim();
  await launch('start.ps1','-NoBrowser');assert.equal((await readFile(pidFile,'utf8')).trim(),firstPid);checks.idempotentOwnedLaunch=true;
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext();let external=0;
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1'&&url.port==='4173')return route.continue();external++;return route.abort();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>!!window.__vmodel,undefined,{timeout:90000});
  assert.equal(external,0);checks.actualAvatarLoadsWithExternalNetworkBlocked=true;
  await browser.close();browser=null;
  await launch('stop.ps1');activeStudio=false;assert.equal(await health(),null);checks.ownedStopReleasesPort=true;
  fixture=spawn(process.execPath,['--input-type=module','-e',"import http from 'node:http';http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({application:'vmodel-port-fixture'}));}).listen(4173,'127.0.0.1');"],{cwd:path.join(root,'.cache'),windowsHide:true,stdio:'ignore'});
  await waitHealth('vmodel-port-fixture');
  let refused=false;
  try {await launch('start.ps1','-NoBrowser');}catch(error){refused=/port 4173 may be occupied/.test(error.stderr);}
  assert(refused,'Occupied port should produce a clear startup error.');assert.equal((await health()).application,'vmodel-port-fixture');checks.occupiedPortPreservesExistingServer=true;
  await writeFile(pidFile,String(fixture.pid));refused=false;
  try {await launch('stop.ps1');}catch(error){refused=/not this project server/.test(error.stderr);}
  assert(refused);assert.equal((await health()).application,'vmodel-port-fixture');checks.stalePidDoesNotKillAnotherProcess=true;
  await closeFixture();
  await launch('start.ps1','-NoBrowser');activeStudio=true;await waitHealth('vmodel');checks.restartLeavesStudioReady=true;
  assert.deepEqual(errors,[]);
}catch(error){errors.push(String(error));console.error(error);process.exitCode=1;}
finally {
  await browser?.close();await closeFixture();
  if(!activeStudio&&!(await health()))try{await launch('start.ps1','-NoBrowser');activeStudio=true;}catch(error){errors.push('Studio restore: '+String(error));}
  const result={date:new Date().toISOString(),scope:'Real Windows start/stop scripts from a different working directory; owned loopback port fixture and actual avatar rendering with external requests blocked. No camera/microphone or OBS access. Camera shutdown is separately measured in server-stop-smoke.json.',checks,errors,studioLeftReady:activeStudio};
  await writeFile('ops/001-zhil/sprint-001/reports/launcher-smoke.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
