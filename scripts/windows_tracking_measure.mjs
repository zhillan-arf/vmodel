import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';
import { baselineCommit, prepareTrackingBaseline } from './tracking-performance-baseline.mjs';

const channel=process.env.VMODEL_BROWSER??'chrome';
const selected=process.env.VMODEL_MEASURE_MODES?.split(',')??['baseline','off','overlay','estimated','record','dense','video'];
assert(selected.every(mode=>['baseline','off','overlay','estimated','record','dense','video'].includes(mode)));
const repetitions=Number(process.env.VMODEL_MEASURE_REPETITIONS??3);
assert(Number.isSafeInteger(repetitions)&&repetitions>=1&&repetitions<=3);
const tag=process.env.VMODEL_MEASURE_TAG??'';assert(/^[a-z0-9-]*$/.test(tag));
const reportPath=`ops/reports/windows-tracking-${channel}${tag?'-'+tag:''}.json`;
const report={date:new Date().toISOString(),channel,modesRequested:selected,protocol:{warmupSeconds:30,sampleSeconds:60,repetitions,avatarRenderSize:{width:752,height:423}},modes:[],errors:[],limits:[
  'A repeated public NASA photograph supplies the camera stream. No physical camera is used.',
  'Useful pose samples have an accepted spine or arm goal at first use.',
  'These measurements do not establish physical motion quality.',
  'The pinned baseline uses the same installed dependencies, model files, and camera fixture.',
  'Recording samples retain the 60-second and 32 MiB limits. A limit can end recording within the sample.',
]};
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const power=()=>JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',
  '(Get-CimInstance -ClassName BatteryStatus -Namespace root\\wmi | Select-Object -First 1).PowerOnline | ConvertTo-Json -Compress'],{encoding:'utf8',windowsHide:true}));
let browser,server,baselineServer;
try{
  assert.equal(process.platform,'win32');
  const bytes=await readFile('assets/testing/jsc2026e002116.jpg');
  report.fixtureHash=createHash('sha256').update(bytes).digest('hex');
  report.fixtureCrop={x:150,y:75,width:520,height:400};report.inputSize={width:640,height:480};
  assert.equal(report.fixtureHash,'194f6ba51f7bdeb090c9a47e7ab69d3fa191fbb6240cd4b6f118a215bc27caf0');
  report.modelHash=createHash('sha256').update(await readFile('public/avatars/ene.vrm')).digest('hex');
  report.runtimeAssets=JSON.parse(await readFile('config/runtime-assets.json','utf8'));
  report.workerHashes={};
  const workerHash=async root=>{
    const folder=path.join(root,'dist/assets'),name=(await readdir(folder)).find(name=>name.startsWith('tracking.worker-'));
    return createHash('sha256').update(await readFile(path.join(folder,name))).digest('hex');
  };
  report.workerHashes.current=await workerHash(process.cwd());
  if(selected.includes('baseline')){
    const workspaceRoot=await prepareTrackingBaseline();report.baselineCommit=baselineCommit;
    report.workerHashes.baseline=await workerHash(workspaceRoot);
    baselineServer=await startIsolatedStudioServer({workspaceRoot});
  }
  report.hardware=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',
    "@{cpu=(Get-CimInstance Win32_Processor).Name;ram=(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory;power=@(Get-CimInstance -ClassName BatteryStatus -Namespace root\\wmi | Select-Object PowerOnline,RemainingCapacity);obs=@(Get-Process obs64 -ErrorAction SilentlyContinue | Select-Object Id)} | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true}));
  server=await startIsolatedStudioServer();
  browser=await chromium.launch({channel,headless:true});report.browser=browser.version();
  const cdp=await browser.newBrowserCDPSession();
  report.graphics=(await cdp.send('SystemInfo.getInfo')).gpu.devices;
  const memory=async()=>{
    const ids=(await cdp.send('SystemInfo.getProcessInfo')).processInfo.map(p=>p.id);assert(ids.every(Number.isSafeInteger));
    const rows=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`@(Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,PrivateMemorySize64) | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true}));
    return rows.reduce((sum,row)=>sum+row.PrivateMemorySize64,0);
  };
  for(const mode of selected){
    const context=await browser.newContext();
    await context.addInitScript(data=>{
      window.cameraRequests=0;window.maxInFlight=0;window.pendingFrames=0;window.delegates=[];window.maxFacePoints=0;
      const NativeWorker=window.Worker;
      window.Worker=class extends NativeWorker{
        constructor(...args){super(...args);this.addEventListener('message',({data})=>{
          if(data.type==='result')window.pendingFrames--;
          if(data.type==='ready')window.delegates.push(data.delegate);
          window.maxFacePoints=Math.max(window.maxFacePoints,data.diagnostics?.tasks.face.observations?.[0]?.length??0);
        });}
        postMessage(data,...args){if(data.type==='frame'){window.pendingFrames++;window.maxInFlight=Math.max(window.maxInFlight,window.pendingFrames);}return super.postMessage(data,...args);}
      };
      navigator.mediaDevices.getUserMedia=async()=>{
        window.cameraRequests++;
        const image=new Image();image.src=data;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
        const draw=canvas.getContext('2d');
        const render=()=>{draw.fillStyle='#182236';draw.fillRect(0,0,640,480);draw.drawImage(image,150,75,520,400,8,0,624,480);};
        render();const timer=setInterval(render,1000/30),stream=canvas.captureStream(30);
        const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};
        return stream;
      };
    },'data:image/jpeg;base64,'+bytes.toString('base64'));
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(mode==='baseline'?baselineServer.base:server.base);await page.waitForFunction(()=>!!window.__vmodel,{},{timeout:90000});
    await page.evaluate(()=>{
      const viewer=window.__vmodel.viewer,resize=viewer.resize.bind(viewer);
      viewer.resize=()=>{resize();viewer.renderer.setSize(752,423,false);};viewer.resize();
      const retarget=window.__vmodel.retarget,update=retarget.update.bind(retarget);
      window.measure=null;
      retarget.update=(frame,settings,dt,now)=>{
        update(frame,settings,dt,now);
        const m=window.measure;if(!m||!frame)return;
        m.frames++;
        for(const task of ['face','pose','hands']){
          const sample=frame.samples[task];if(sample.timestamp>m.last[task]){m.last[task]=sample.timestamp;m.counts[task]++;if(sample.present)m.presentCounts[task]++;}
        }
        const stamp=frame.samples.pose.timestamp;
        if(stamp>m.lastUseful&&now-stamp<500&&['spine','leftUpperArm','rightUpperArm'].some(name=>retarget.goals.get(name)?.timestamp===stamp)){
          m.lastUseful=stamp;m.ages.push(now-stamp);
        }
      };
    });
    await page.click('#start');
    await page.waitForFunction(()=>window.__vmodel.getStats().sequence>=5,null,{timeout:90000});
    if(!['baseline','off'].includes(mode)){
      await page.click('[data-view="tracking"]');
      if(mode==='estimated')await page.selectOption('#inspector-layer','estimated');
      if(mode==='dense'){await page.selectOption('#inspector-task','face');await page.check('#dense-face');}
      if(mode==='video')await page.check('#record-video');
    }
    console.log(`${mode}: 30-second warm-up.`);await page.waitForTimeout(30000);
    const result={mode,samples:[],memoryBefore:await memory()};report.modes.push(result);
    for(let repetition=0;repetition<repetitions;repetition++){
      const powerBefore=power(),startedAt=new Date().toISOString();assert.equal(typeof powerBefore,'boolean');
      if(mode==='record'||mode==='video'){
        await page.evaluate(()=>{
          window.recordingStates=[];window.recordingObserver?.disconnect();
          const element=document.querySelector('#inspector-state');
          window.recordingObserver=new MutationObserver(()=>window.recordingStates.push({time:performance.now(),state:element.textContent}));
          window.recordingObserver.observe(element,{childList:true,characterData:true,subtree:true});
        });
        await page.click('#record-trace');
        await page.waitForFunction(expected=>document.querySelector('#inspector-state').textContent===expected,
          mode==='video'?'Recording trace and camera video':'Recording trace');
      }
      await page.evaluate(()=>{
        const samples=window.__vmodel.getStats().samples;
        const last=Object.fromEntries(['face','pose','hands'].map(task=>[task,samples?.[task].timestamp??0]));
        window.measure={start:performance.now(),frames:0,last,counts:{face:0,pose:0,hands:0},presentCounts:{face:0,pose:0,hands:0},lastUseful:last.pose,ages:[]};
      });
      await page.waitForTimeout(60000);
      const sample=await page.evaluate(()=>{
        const m=window.measure;window.measure=null;const seconds=(performance.now()-m.start)/1000;
        const sorted=m.ages.sort((a,b)=>a-b);
        const canvas=window.__vmodel.viewer.renderer.domElement;
        return {seconds,fps:m.frames/seconds,taskHz:Object.fromEntries(Object.entries(m.counts).map(([k,v])=>[k,v/seconds])),presentSamples:m.presentCounts,usefulPoseHz:m.ages.length/seconds,p95AgeMs:sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]??null,usefulSamples:m.ages.length,cameraRequests:window.cameraRequests,maxInFlight:window.maxInFlight,delegates:window.delegates,maxFacePoints:window.maxFacePoints,inspectorState:document.querySelector('#inspector-state')?.textContent??null,renderSize:{width:canvas.width,height:canvas.height},settings:window.__vmodel.getState().settings};
      });
      sample.startedAt=startedAt;sample.finishedAt=new Date().toISOString();sample.powerBefore=powerBefore;sample.powerAfter=power();
      if(mode==='record'||mode==='video')sample.recordingStates=await page.evaluate(()=>{window.recordingObserver.disconnect();return window.recordingStates;});
      if(mode==='video'){
        await page.waitForFunction(()=>!document.querySelector('#export-video').disabled,null,{timeout:10000});
        const downloadReady=page.waitForEvent('download');await page.click('#export-video');const download=await downloadReady;
        const video=await readFile(await download.path());assert(video.length>1024);assert.equal(video.subarray(0,4).toString('hex'),'1a45dfa3');
        sample.video={bytes:video.length,sha256:createHash('sha256').update(video).digest('hex')};
      }
      sample.privateBytes=await memory();result.samples.push(sample);
      assert.equal(sample.powerBefore,sample.powerAfter,'Power changed during the sample. Repeat with a fixed power source.');
      assert.equal(sample.cameraRequests,1);assert.equal(sample.maxInFlight,1);
      assert.deepEqual(sample.renderSize,report.protocol.avatarRenderSize);
      assert(sample.usefulSamples>0,'The fixture produced no useful pose samples.');
      if(mode==='dense')assert(sample.presentSamples.face>0&&sample.maxFacePoints>=468,'Dense face points were not exercised.');
      console.log(`${mode}: sample ${repetition+1}/${repetitions}, ${sample.fps.toFixed(1)} FPS, ${sample.usefulPoseHz.toFixed(2)} useful pose Hz.`);
      if(mode==='record'||mode==='video')await page.click('#stop-trace');
    }
    await page.click(['baseline','off'].includes(mode)?'#stop':'#inspector-stop-camera');
    await context.close();result.memoryAfter=await memory();
    await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  }
  const combined=mode=>{const samples=report.modes.filter(x=>x.mode===mode).flatMap(x=>x.samples);return samples.length?{samples}:undefined;};
  const off=combined('off'),overlay=combined('overlay');
  report.consistentPower=new Set(report.modes.flatMap(mode=>mode.samples.flatMap(sample=>[sample.powerBefore,sample.powerAfter]))).size===1;
  assert(report.consistentPower,'The modes used different power sources. Repeat with a fixed power source.');
  const baseline=combined('baseline');
  if(baseline&&off){
    report.offSampleCounts={baseline:baseline.samples.length,off:off.samples.length};
    report.offComparison={fpsRatio:median(off.samples.map(x=>x.fps))/median(baseline.samples.map(x=>x.fps)),
      taskHzRatios:Object.fromEntries(['face','pose','hands'].map(task=>[task,median(off.samples.map(x=>x.taskHz[task]))/median(baseline.samples.map(x=>x.taskHz[task]))]))};
    report.offLimitsPassed=baseline.samples.length>=3&&off.samples.length>=3&&report.offComparison.fpsRatio>=.95&&Object.values(report.offComparison.taskHzRatios).every(ratio=>ratio>=.95);
  }
  if(off&&overlay){
    report.defaultSampleCounts={off:off.samples.length,overlay:overlay.samples.length};
    const value=(mode,key)=>median(mode.samples.map(x=>x[key]));
    report.defaultComparison={fpsRatio:value(overlay,'fps')/value(off,'fps'),usefulPoseRatio:value(overlay,'usefulPoseHz')/value(off,'usefulPoseHz'),additionalP95AgeMs:value(overlay,'p95AgeMs')-value(off,'p95AgeMs')};
    const c=report.defaultComparison;report.defaultLimitsPassed=off.samples.length>=3&&overlay.samples.length>=3&&c.fpsRatio>=.9&&c.usefulPoseRatio>=.9&&c.additionalP95AgeMs<=20;
  }
  assert.deepEqual(report.errors,[]);report.completed=true;
}catch(error){report.errors.push(String(error));report.completed=false;process.exitCode=1;console.error(error);}
finally{await browser?.close();await server?.stop();await baselineServer?.stop();await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');}
