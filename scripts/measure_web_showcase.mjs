// Real built showcase measurements. Run after web:build, with other heavy jobs stopped.
// WEB_SHOWCASE_PHASE=cold|playback|lifecycle|all (default all)
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {resolve, relative, extname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import {mediaResponse} from './web_review_response.mjs';

const root=resolve(import.meta.dirname,'..'),dist=resolve(root,'web-showcase/dist');
const out=resolve(root,'ops/reports/local/web-showcase-acceptance');
const phase=process.env.WEB_SHOWCASE_PHASE??'all';
if(!['cold','playback','lifecycle','all'].includes(phase))throw Error('Unknown measurement phase');
const manifest=JSON.parse(await readFile(resolve(dist,'ene/manifest.json'),'utf8'));
const sourceManifest=await readFile(resolve(root,'web-showcase/public/ene/manifest.json'));
if(createHash('sha256').update(sourceManifest).digest('hex')!==createHash('sha256').update(await readFile(resolve(dist,'ene/manifest.json'))).digest('hex'))throw Error('Rebuild showcase after final media staging');
await mkdir(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webm':'video/webm','.webp':'image/webp','.png':'image/png'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const path=resolve(dist,'.'+pathname),rel=relative(dist,path);
    if(rel.startsWith('..')||!types[extname(path)]||!(await stat(path)).isFile())throw Error('Not staged');
    mediaResponse(req,res,await readFile(path),types[extname(path)]);
  }catch{res.writeHead(404);res.end()}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`;
const report={date:new Date().toISOString(),phase,state:'running',platform:os.platform(),release:os.release(),cpu:os.cpus()[0]?.model,
  logicalCores:os.availableParallelism(),ramBytes:os.totalmem(),headless:true,errors:[],
  scope:'Actual final built showcase over an owned loopback server in installed Windows Chrome. CDP network emulation is not a real mobile-network result. No real Safari/Android/iOS claim.'};
const reportPath=resolve(root,`ops/reports/web-showcase-measurement-${phase}.json`);
let browser;
const save=()=>writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
async function stats(cdp){
  const processes=(await cdp.send('SystemInfo.getProcessInfo')).processInfo;
  const ids=processes.map(p=>p.id).filter(id=>Number.isInteger(id)&&id>0);
  let memory=[];
  if(ids.length){
    const value=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`],{encoding:'utf8'}));
    memory=Array.isArray(value)?value:[value];
  }
  return {cpuSeconds:processes.reduce((sum,p)=>sum+p.cpuTime,0),workingSetBytes:memory.reduce((sum,p)=>sum+p.WorkingSet64,0),
    privateBytes:memory.reduce((sum,p)=>sum+p.PrivateMemorySize64,0),processes,memory};
}
async function visible(page){
  await page.locator('#ene-character').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('#ene-character')?.getAttribute('data-playing')==='true',null,{timeout:15000});
}
async function choose(page,id){
  await page.evaluate(resource=>document.querySelector(`button[data-resource="${resource}"]`).click(),id);
  await visible(page);
}
async function format(page,codec){
  await page.evaluate(value=>{const field=document.querySelector('#format');field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}))},codec==='webm'?'auto':'webp');
  await visible(page);
  await page.waitForFunction(expected=>document.querySelector('#ene-character')?.getAttribute('data-format')===expected,codec);
}
async function state(page){
  return page.evaluate(()=>{
    const host=document.querySelector('#ene-character'),media=host.querySelector('.ene-animation');
    const video=media instanceof HTMLVideoElement;
    return {resource:host.dataset.resource,format:host.dataset.format,playing:host.dataset.playing==='true',
      activeAnimationElements:host.querySelectorAll('.ene-animation').length,transitionCanvases:host.querySelectorAll('.ene-snapshot').length,
      cssSize:[host.clientWidth,host.clientHeight],sourceSize:video?[media.videoWidth,media.videoHeight]:media?[media.naturalWidth,media.naturalHeight]:null,
      currentTime:video?media.currentTime:null,quality:video?media.getVideoPlaybackQuality().toJSON?.()??{totalVideoFrames:media.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:media.getVideoPlaybackQuality().droppedVideoFrames}:null,
      url:media?.getAttribute('src')??null,domElements:document.querySelectorAll('*').length,
      jsHeapBytes:performance.memory?.usedJSHeapSize??null,status:document.querySelector('#player-status')?.textContent};
  });
}
const hash=data=>createHash('sha256').update(data).digest('hex');
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  report.browser=browser.version();
  const cdp=await browser.newBrowserCDPSession();
  if(['all','cold'].includes(phase)){
    report.cold=[];
    for(const codec of ['webm','webp']){
      const context=await browser.newContext({viewport:{width:390,height:1300},deviceScaleFactor:1});
      const page=await context.newPage(),requests=[];
      page.on('pageerror',error=>report.errors.push(error.message));
      page.on('request',request=>requests.push(new URL(request.url()).pathname));
      if(codec==='webp')await page.route('**/ene/alpha-probe.webm',route=>route.abort('failed'));
      const network=await context.newCDPSession(page);
      await network.send('Network.enable');await network.send('Network.setCacheDisabled',{cacheDisabled:true});
      await network.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:1250000,uploadThroughput:1250000});
      const started=performance.now();
      await page.goto(base,{waitUntil:'domcontentloaded'});
      const domReadyMs=performance.now()-started;
      await page.waitForFunction(()=>{const im=document.querySelector('.ene-poster');return im?.complete&&im.naturalWidth>0});
      const posterReadyMs=performance.now()-started;
      await visible(page);
      const animationVisibleMs=performance.now()-started,actual=await state(page);
      const families=[...new Set(requests.filter(path=>/\/ene\/(?:home-greeting|desk-)/.test(path)).map(path=>path.split('/')[2]))];
      const record={codec,domReadyMs,posterReadyMs,animationVisibleMs,network:{mbitPerSecond:10,latencyMs:100,cacheDisabled:true},
        forcedFallback:codec==='webp'?'Abort known-alpha probe to exercise actual animated WebP fallback':null,actual,requests,
        onlySelectedFamilyRequested:families.length===1&&families[0]==='home-greeting',withinFourSeconds:animationVisibleMs<=4000};
      report.cold.push(record);await save();
      if(actual.format!==codec||actual.sourceSize[1]!==480||!record.onlySelectedFamilyRequested||!record.withinFourSeconds)throw Error('Cold startup gate failed');
      await page.screenshot({path:resolve(out,`cold-${codec}.png`)});
      await context.close();
      console.log('COLD_READY',codec,Math.round(animationVisibleMs),'ms');
    }
  }
  if(['all','playback'].includes(phase)){
    report.playback=[];
    for(const size of ['small','large']){
      const context=await browser.newContext({viewport:{width:size==='small'?1050:1440,height:1050}});
      const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
      await page.goto(base);await choose(page,'desk-normal');
      for(const codec of ['webm','webp']){
        await format(page,codec);await page.waitForTimeout(1500);
        const beforeState=await state(page),before=await stats(cdp),start=performance.now(),screenshots=[];
        for(let sample=0;sample<3;sample++){
          screenshots.push(hash(await page.locator('#ene-character').screenshot()));await page.waitForTimeout(400);
        }
        const remaining=60000-(performance.now()-start);if(remaining>0)await page.waitForTimeout(remaining);
        const afterState=await state(page),after=await stats(cdp),seconds=(performance.now()-start)/1000;
        const videoFrames=codec==='webm'?{total:afterState.quality.totalVideoFrames-beforeState.quality.totalVideoFrames,
          dropped:afterState.quality.droppedVideoFrames-beforeState.quality.droppedVideoFrames}:null;
        const result={size,codec,seconds,beforeState,afterState,screenshotHashes:screenshots,visiblyChanging:new Set(screenshots).size>1,
          videoFrames,cpuCorePercent:100*(after.cpuSeconds-before.cpuSeconds)/seconds,
          cpuAllCoresPercent:100*(after.cpuSeconds-before.cpuSeconds)/seconds/os.availableParallelism(),before,after};
        report.playback.push(result);await save();
        if(afterState.activeAnimationElements!==1||!afterState.playing||!result.visiblyChanging||afterState.sourceSize[0]!== (size==='small'?480:960)||
          videoFrames&&(videoFrames.total<1300||videoFrames.dropped/videoFrames.total>.05))throw Error('Sustained playback gate failed');
        console.log('PLAYBACK_COMPLETE',size,codec,videoFrames?JSON.stringify(videoFrames):'animated WebP has no video-frame counter');
      }
      await context.close();
    }
  }
  if(['all','lifecycle'].includes(phase)){
    const context=await browser.newContext({viewport:{width:1280,height:1050}}),page=await context.newPage();
    page.on('pageerror',error=>report.errors.push(error.message));
    const requests=[];page.on('request',request=>requests.push({at:Date.now(),path:new URL(request.url()).pathname}));
    await page.goto(base);await visible(page);
    const ids=Object.keys(manifest.resources),warmup=[],warmupStarted=performance.now();
    report.lifecycle={warmupSwitches:warmup,samples:[],requests,plannedSeconds:600,state:'warming'};
    await save();
    for(let index=0;index<20;index++){
      await choose(page,ids[index%5]);await format(page,index<10?'webm':'webp');
      // Decode a full loop during warm-up, including animated WebP's later frames.
      await page.waitForTimeout(manifest.resources[ids[index%5]].durationSeconds*1000+100);
      const actual=await state(page);if(actual.activeAnimationElements!==1)throw Error('Multiple retained active resources during warmup');
      warmup.push(actual);
      report.lifecycle.warmupSeconds=(performance.now()-warmupStarted)/1000;await save();
      if((index+1)%5===0)console.log('WARMUP_SWITCHES',index+1,'/20');
    }
    report.lifecycle={warmupSwitches:warmup,warmupSeconds:(performance.now()-warmupStarted)/1000,samples:[],requests,plannedSeconds:600,state:'measuring',memoryMethod:'Sum of owned browser-process working set/private bytes; JS heap reported separately. Warm-up plays a complete loop after each of 20 switches. No forced GC or cache clearing after warm-up.'};
    const started=performance.now();
    for(let sample=0;sample<=20;sample++){
      if(sample){
        const target=started+sample*30000,remaining=target-performance.now();if(remaining>0)await page.waitForTimeout(remaining);
        await choose(page,ids[sample%5]);await format(page,sample%2?'webm':'webp');await page.waitForTimeout(350);
      }
      const actual=await state(page),process=await stats(cdp);
      report.lifecycle.samples.push({seconds:(performance.now()-started)/1000,actual,process});await save();
      if(actual.activeAnimationElements!==1||actual.transitionCanvases>1||!actual.playing)throw Error('Lifecycle active-resource gate failed');
      console.log('LIFECYCLE_SAMPLE',sample,Math.round((performance.now()-started)/1000),'s',Math.round(process.privateBytes/1048576),'MiB private');
    }
    const samples=report.lifecycle.samples;
    const deltas=samples.slice(1).map((sample,index)=>sample.process.privateBytes-samples[index].process.privateBytes);
    report.lifecycle.privateMemoryMonotonicallyIncreasing=deltas.every(delta=>delta>=0)&&deltas.some(delta=>delta>1048576);
    report.lifecycle.privateBytesStart=samples[0].process.privateBytes;
    report.lifecycle.privateBytesEnd=samples.at(-1).process.privateBytes;
    report.lifecycle.privateBytesPeak=Math.max(...samples.map(sample=>sample.process.privateBytes));
    const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
    report.lifecycle.earlyPrivateBytesMedian=median(samples.slice(0,5).map(sample=>sample.process.privateBytes));
    report.lifecycle.latePrivateBytesMedian=median(samples.slice(-5).map(sample=>sample.process.privateBytes));
    report.lifecycle.privateGrowthBytes=report.lifecycle.latePrivateBytesMedian-report.lifecycle.earlyPrivateBytesMedian;
    report.lifecycle.materialGrowthNeedsReview=report.lifecycle.privateGrowthBytes>Math.max(64*1048576,.2*report.lifecycle.earlyPrivateBytesMedian);
    report.lifecycle.domElementsRange=[Math.min(...samples.map(sample=>sample.actual.domElements)),Math.max(...samples.map(sample=>sample.actual.domElements))];
    if(report.lifecycle.privateMemoryMonotonicallyIncreasing)throw Error('Monotonic memory-growth gate requires investigation');
    if(report.lifecycle.materialGrowthNeedsReview)throw Error('Post-warm-up memory growth requires investigation even though samples fluctuate');
    report.lifecycle.state='passed';
    await context.close();
  }
  report.state=report.errors.length?'failed':'passed';
  if(report.errors.length)throw Error('Browser page errors');
}catch(error){report.state='failed';report.failure=error.stack;process.exitCode=1;console.error(error.message)}
finally{await save();if(browser)await browser.close();await new Promise(done=>server.close(done))}
