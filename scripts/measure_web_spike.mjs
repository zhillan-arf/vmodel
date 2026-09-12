// Disposable loopback-only codec harness. Does not serve private model/source assets.
import {chromium,firefox,webkit} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
const root=resolve(import.meta.dirname,'..'),media=resolve(root,'ops/reports/local/web-resource-spike');
const html=await readFile(resolve(root,'scripts/web_resource_harness.html'));
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://127.0.0.1').pathname;if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}if(!/^\/media\/[a-z0-9.-]+$/.test(path)){res.writeHead(404);res.end();return}const name=path.slice(7),data=await readFile(resolve(media,name));res.setHeader('Content-Type',name.endsWith('.webm')?'video/webm':name.endsWith('.webp')?'image/webp':'image/png');res.setHeader('Content-Length',data.length);res.setHeader('Cache-Control','no-store');res.end(data)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const sampleSize=Number(process.env.WEB_SPIKE_SIZE??480), durationOverride=Number(process.env.WEB_SPIKE_DURATION_MS??0);
if(![480,960].includes(sampleSize))throw Error('Unsupported spike size');
const reportSuffix=sampleSize===480?'':'-large';
const results=[];await mkdir(media,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
function memory(ids){const numeric=ids.filter(x=>Number.isInteger(x)&&x>0);if(!numeric.length)return null;return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`Get-Process -Id ${numeric.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64,PeakWorkingSet64 | ConvertTo-Json -Compress`],{encoding:'utf8'}))}
async function stats(cdp){if(!cdp)return null;const processes=(await cdp.send('SystemInfo.getProcessInfo')).processInfo;return {cpuSeconds:processes.reduce((n,p)=>n+p.cpuTime,0),processes,memory:memory(processes.map(p=>p.id))}}
try{for(const spec of [{name:'chrome',type:chromium,channel:'chrome'},{name:'firefox',type:firefox},{name:'webkit',type:webkit}]){
  if(process.env.WEB_SPIKE_ENGINE&&process.env.WEB_SPIKE_ENGINE!==spec.name)continue;
  const result={engine:spec.name,status:'running',errors:[],network:[]};let browser;
  try{
    browser=await spec.type.launch({headless:true,...(spec.channel?{channel:spec.channel}:{})});result.version=browser.version();
    const context=await browser.newContext({viewport:sampleSize===480?{width:1050,height:460}:{width:2020,height:800}});const page=await context.newPage();
    page.on('pageerror',e=>result.errors.push(e.message));page.on('request',r=>result.network.push(r.url().replace(base,'')));
    await page.goto(base);await page.evaluate(()=>harness.ready);if(sampleSize===960)await page.addStyleTag({content:'.cell{width:640px;height:640px}'});result.posterInitial=await page.evaluate(()=>harness.state());
    result.alphaProbe=await page.evaluate(()=>harness.alphaProbe('/media/alpha-probe.webm'));
    result.lostAlpha=await page.evaluate(()=>harness.choose('/media/opaque-probe.webm'));
    result.codecRejection=await page.evaluate(()=>harness.choose('/media/missing-codec.webm'));
    result.autoplayRejection=await page.evaluate(()=>harness.play({codec:'webm',forceRejection:true}));
    result.autoplayRejectionKind=result.autoplayRejection.rejection?.includes('NotAllowedError')?'Injected NotAllowedError exercises catch; not a browser policy claim':'Codec unavailable before injection; actual load/timeout poster path tested';
    const cdp=spec.name==='chrome'?await browser.newBrowserCDPSession():null;
    result.playbacks=[];
    for(const codec of ['webm','webp']){
      const start=performance.now();const played=await page.evaluate(args=>harness.play({...args,copies:1}),{codec,size:sampleSize});
      const startupMs=performance.now()-start;
      if(played.mode!==codec){if(codec==='webm'&&!result.alphaProbe.supported){result.playbacks.push({codec,supported:false,played,startupMs,note:'Unsupported WebM is bypassed by known-alpha selection; animated WebP is measured below'});continue}throw Error('Required animated path did not load: '+codec)}
      const actualAlpha=await page.evaluate(()=>{const e=document.querySelector('#checker').firstElementChild;const c=document.createElement('canvas');c.width=e.videoWidth||e.naturalWidth;c.height=e.videoHeight||e.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(e,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let zero=0,full=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)zero++;if(pixels[i]===255)full++}return{width:c.width,height:c.height,cornerAlpha:pixels[3],zero,full,partial:pixels.length/4-zero-full}});
      await page.waitForTimeout(1500);const before=await stats(cdp),wall=performance.now();
      const stateBefore=await page.evaluate(()=>harness.state());const images=[];
      for(let k=0;k<3;k++){images.push(hash(await page.locator('#checker').screenshot()));await page.waitForTimeout(350)}
      const durationMs=durationOverride||(spec.name==='chrome'?60000:10000);const remaining=durationMs-(performance.now()-wall);if(remaining>0)await page.waitForTimeout(remaining);
      const stateAfter=await page.evaluate(()=>harness.state());const after=await stats(cdp),wallSeconds=(performance.now()-wall)/1000;
      const q0=stateBefore.video[0]?.quality,q1=stateAfter.video[0]?.quality;
      result.playbacks.push({codec,played,startupMs,actualAlpha,durationSeconds:wallSeconds,sourceSize:sampleSize,displayCssPixels:sampleSize===480?320:640,activeMedia:1,screenshotHashes:images,visuallyChanging:new Set(images).size>1,
        videoFrames:q1?{total:q1.totalVideoFrames-q0.totalVideoFrames,dropped:q1.droppedVideoFrames-q0.droppedVideoFrames}:null,
        cpuCorePercent:before?100*(after.cpuSeconds-before.cpuSeconds)/wallSeconds:null,
        cpuAllCoresPercent:before?100*(after.cpuSeconds-before.cpuSeconds)/wallSeconds/os.availableParallelism():null,
        processStart:before,processEnd:after});
      await page.evaluate(args=>harness.play({...args,copies:3}),{codec,size:sampleSize});await page.waitForTimeout(500);
      await page.screenshot({path:resolve(media,`${spec.name}-${codec}${reportSuffix}-composite.png`)});
      const paused=await page.evaluate(()=>harness.pause());const resumed=await page.evaluate(args=>harness.play({...args,copies:1}),{codec,size:sampleSize});
      result.playbacks.at(-1).pause=paused;result.playbacks.at(-1).resume=resumed;
      console.log(spec.name,codec,'measured',startupMs.toFixed(1),'ms startup');
    }
    if(spec.name==='chrome'){
      const network=await context.newCDPSession(page);await network.send('Network.enable');await network.send('Network.setCacheDisabled',{cacheDisabled:true});
      await network.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:1250000,uploadThroughput:1250000});
      result.throttledStartup=[];
      for(const codec of ['webm','webp']){const before=performance.now();const played=await page.evaluate(args=>harness.play({...args,copies:1}),{codec,size:sampleSize});result.throttledStartup.push({codec,ms:performance.now()-before,played,mbitPerSecond:10,latencyMs:100,cacheDisabled:true})}
    }
    result.status='passed';
    if(result.errors.length||!result.alphaProbe.supported&&spec.name==='chrome'||result.lostAlpha.mode!=='webp'||result.codecRejection.mode!=='webp'||result.autoplayRejection.mode!=='poster'||result.playbacks.filter(p=>p.supported!==false).some(p=>!p.visuallyChanging||p.actualAlpha.cornerAlpha!==0||p.actualAlpha.zero<50000||p.actualAlpha.full<10000||p.pause.mode!=='poster'||p.resume.mode!==p.codec))throw Error('Codec/lifecycle assertion failed');
  }catch(e){result.status=browser?'failed':'unavailable';result.failure=e.stack;console.log(spec.name,result.status,e.message)}finally{if(browser)await browser.close();results.push(result);await writeFile(resolve(root,`ops/reports/web-spike-browsers${reportSuffix}.json`),JSON.stringify({date:new Date().toISOString(),platform:os.platform(),release:os.release(),cpu:os.cpus()[0]?.model,logicalCores:os.availableParallelism(),ramBytes:os.totalmem(),headless:true,scope:'Automated desktop engines on this Windows laptop; not actual Safari/iOS/Android hardware',results},null,2)+'\n')}
}}finally{await new Promise(r=>server.close(r))}
if(results.some(r=>r.status==='failed'))process.exitCode=1;
