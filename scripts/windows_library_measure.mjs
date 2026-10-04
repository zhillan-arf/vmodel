import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';

const channel = process.env.VMODEL_BROWSER ?? 'chrome';
const report = { date: new Date().toISOString(), channel, modes: [], errors: [],
  limits: ['Headless browser on the Windows laptop.', 'No physical camera or human appearance review.'] };
const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
let server, browser;
try {
  assert.equal(process.platform, 'win32');
  report.hardware = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command',
    "@{cpu=(Get-CimInstance Win32_Processor).Name;ram=(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory;power=@(Get-CimInstance -ClassName BatteryStatus -Namespace root\\wmi | Select-Object PowerOnline,RemainingCapacity)} | ConvertTo-Json -Compress"], {encoding:'utf8',windowsHide:true}));
  report.models = {};
  for (const id of ['ene','rei']) report.models[id] = createHash('sha256').update(await readFile(`public/avatars/${id}.vrm`)).digest('hex');
  server = await startIsolatedStudioServer();
  browser = await chromium.launch({channel,headless:true}); report.browser = browser.version();
  const cdp = await browser.newBrowserCDPSession();
  report.graphics = (await cdp.send('SystemInfo.getInfo')).gpu.devices;
  const memory = async () => {
    const ids = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.map(p=>p.id);
    assert(ids.every(Number.isSafeInteger));
    const processes = JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',
      `@(Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,PrivateMemorySize64,WorkingSet64,PeakWorkingSet64) | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true}));
    return {privateBytes:processes.reduce((sum,p)=>sum+p.PrivateMemorySize64,0),peakWorkingSetBytes:processes.reduce((sum,p)=>sum+p.PeakWorkingSet64,0),processes};
  };
  const ready = (page,id) => page.waitForFunction(id => window.__vmodel?.getState().label.toLowerCase().startsWith(id) && window.__vmodel.viewer.renderer.info.render.calls>0 && (!document.querySelector('#status') || document.querySelector('#status').textContent.includes('is ready')),id,{timeout:90000});
  const inspectionWorker=(await readdir('dist/assets')).find(name=>name.startsWith('vrm-inspection.worker-'));
  assert(inspectionWorker);
  for (const outputOpen of [false,true]) {
    const context = await browser.newContext();
    context.on('page',page=>page.on('pageerror',error=>report.errors.push(error.message)));
    const page = await context.newPage(); await page.goto(server.base); await ready(page,'ene');
    let output;
    if(outputOpen){const popup=page.waitForEvent('popup');await page.click('#output');output=await popup;await ready(output,'ene');}
    const result={outputOpen,warmup:5,imports:[],selections:[],before:[],after:[]};report.modes.push(result);
    for(const id of ['ene','rei']){
      const imported=await page.evaluate(async({id,inspectionWorker})=>{
        const blob=await(await fetch(`/avatars/${id}.vrm`)).blob(),started=performance.now();
        const worker=new Worker('/assets/'+inspectionWorker,{type:'module'});
        let inspection;
        try{inspection=await new Promise((resolve,reject)=>{worker.onmessage=({data})=>data.error?reject(new Error(data.error)):resolve(data.result);worker.onerror=event=>reject(new Error(event.message));worker.postMessage({blob});});}finally{worker.terminate();}
        const inspectionMs=performance.now()-started;
        const container=document.createElement('div');container.style.cssText='width:640px;height:480px';document.body.append(container);
        const viewer=new window.__vmodel.viewer.constructor(container,window.__vmodel.getState().settings),prepareStart=performance.now();
        try{
          const candidate=await viewer.prepareAvatar(blob);viewer.commitAvatar(candidate);viewer.draw(0);
          const preparationMs=performance.now()-prepareStart;
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          return {id,hash:inspection.hash,inspectionMs,preparationMs,firstFrameMs:performance.now()-started,drawCalls:viewer.renderer.info.render.calls};
        }finally{viewer.dispose();container.remove();}
      },{id,inspectionWorker});
      assert.equal(imported.hash,report.models[id]);assert(imported.drawCalls>0);result.imports.push(imported);
    }
    for(let index=0;index<25;index++){
      const id=index%2===0?'rei':'ene',start=performance.now();
      await page.selectOption('#avatar-select',id);await ready(page,id);
      const firstFrameMs=performance.now()-start;
      if(output)await ready(output,id);
      const outputReadyMs=output?performance.now()-start:null;
      if(index===4)for(let i=0;i<5;i++)result.before.push(await memory());
      if(index>=5){
        result.selections.push({id,firstFrameMs,outputReadyMs,memory:await memory(),resources:await page.evaluate(()=>({...window.__vmodel.viewer.renderer.info.memory}))});
        console.log(`${channel}: output ${outputOpen}, selection ${index-4}/20`);
      }
    }
    for(const id of ['ene','rei']){
      const samples=result.selections.filter(sample=>sample.id===id);
      for(const sample of samples)assert.deepEqual(sample.resources,samples[0].resources,'Graphics counts changed for the same model.');
    }
    result.resourceStabilityPassed=true;
    const disposed=[];
    for(const target of context.pages())disposed.push(await target.evaluate(()=>{const viewer=window.__vmodel.viewer;viewer.dispose();return {...viewer.renderer.info.memory};}));
    assert(disposed.every(value=>value.geometries===0&&value.textures===0));result.disposed=disposed;
    for(let i=0;i<5;i++){await new Promise(resolve=>setTimeout(resolve,1000));result.after.push(await memory());}
    result.baselineMedianBytes=median(result.before.map(x=>x.privateBytes));
    result.ceilingBytes=result.baselineMedianBytes+Math.max(result.baselineMedianBytes*.15,100*1024*1024);
    result.memoryPassed=result.after.every(x=>x.privateBytes<=result.ceilingBytes);
    await context.close();
    assert(result.memoryPassed,'Post-cleanup memory exceeds L13.');
    await writeFile(`ops/001-zhil/sprint-001/reports/windows-library-${channel}.json`,JSON.stringify(report,null,2)+'\n');
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.errors.push(String(error));report.passed=false;process.exitCode=1;console.error(error);}
finally{await browser?.close();await server?.stop();await writeFile(`ops/001-zhil/sprint-001/reports/windows-library-${channel}.json`,JSON.stringify(report,null,2)+'\n');}
