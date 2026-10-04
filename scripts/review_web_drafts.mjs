// Bounded private review: actual decoded alpha, animation, two loops and controls.
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {mediaResponse} from './web_review_response.mjs';
const root=resolve(import.meta.dirname,'..'),dir=resolve(root,'ops/001-zhil/sprint-001/reports/local/web-resources');
const server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://127.0.0.1').pathname;if(path==='/')path='/review.html';if(!/^\/(review\.html|(?:home-greeting|desk-normal)\/[a-z0-9.-]+\.(?:webm|webp|png))$/.test(path)){res.writeHead(404);res.end();return}const data=await readFile(resolve(dir,path.slice(1)));mediaResponse(req,res,data,path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.webm')?'video/webm':path.endsWith('.webp')?'image/webp':'image/png')}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const report={date:new Date().toISOString(),scope:'Private Chrome draft playback on Windows; 12 fps previews, no final rendition or device acceptance claim',errors:[]};
const hash=b=>createHash('sha256').update(b).digest('hex');
try{browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();const page=await browser.newPage({viewport:{width:1100,height:900}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.readyState>=2));
 report.initialFrameHashes=[];for(let i=0;i<2;i++)report.initialFrameHashes.push(hash(await page.locator('.stage').nth(i).screenshot()));
 await page.evaluate(()=>{window.samples=[[],[]];window.timer=setInterval(()=>document.querySelectorAll('video').forEach((v,i)=>samples[i].push(v.currentTime)),100)});
 await page.waitForTimeout(10500);
 report.webm=await page.evaluate(()=>{clearInterval(timer);return [...document.querySelectorAll('video')].map((v,i)=>{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(v,0,0);const a=x.getImageData(0,0,c.width,c.height).data;let zero=0,full=0;for(let n=3;n<a.length;n+=4){zero+=a[n]===0;full+=a[n]===255}return {resource:i===0?'home-greeting':'desk-normal',size:[c.width,c.height],duration:v.duration,loopResets:samples[i].filter((t,n)=>n>0&&t<samples[i][n-1]-.5).length,distinctPlaybackTimes:new Set(samples[i].map(t=>t.toFixed(2))).size,cornerAlpha:a[3],transparentPixels:zero,opaquePixels:full,partialPixels:a.length/4-zero-full,quality:v.getVideoPlaybackQuality().toJSON?.()??{totalVideoFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:v.getVideoPlaybackQuality().droppedVideoFrames}}})});
 await page.click('#pause');const paused=await page.evaluate(()=>[...document.querySelectorAll('video')].map(v=>({paused:v.paused,time:v.currentTime})));await page.waitForTimeout(250);report.pauseStable=await page.evaluate(p=>[...document.querySelectorAll('video')].every((v,i)=>v.paused&&Math.abs(v.currentTime-p[i].time)<.02),paused);
 await page.click('#replay');await page.waitForTimeout(300);report.replay=await page.evaluate(()=>[...document.querySelectorAll('video')].map(v=>({playing:!v.paused,time:v.currentTime})));
 await page.click('#pause');await page.evaluate(async()=>{const vs=[...document.querySelectorAll('video')];await Promise.all(vs.map((v,i)=>new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=i===0?2.6:.8}))) });
 await page.waitForTimeout(500); // seeked precedes the compositor's presented frame
 report.seekTimes=await page.evaluate(()=>[...document.querySelectorAll('video')].map(v=>v.currentTime));
 report.seekFrameHashes=[];for(let i=0;i<2;i++)report.seekFrameHashes.push(hash(await page.locator('.stage').nth(i).screenshot()));report.webmPixelsChange=report.seekFrameHashes.map((h,i)=>h!==report.initialFrameHashes[i]);
 for(const bg of ['checker','white','black']){await page.click(`[data-bg="${bg}"]`);await page.screenshot({path:resolve(dir,`chrome-${bg}.png`)});}
 await page.addStyleTag({content:'.card:nth-child(2) .stage{width:320px;height:320px}'});await page.locator('.card:nth-child(2) .stage').screenshot({path:resolve(dir,'desk-normal','chrome-320px.png')});
 await page.click('#codec');await page.waitForFunction(()=>[...document.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0));
 report.webpCornerAlpha=await page.evaluate(()=>[...document.querySelectorAll('img')].map(im=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,1,1).data[3]}));
 report.webpHashes=[[],[]];for(let k=0;k<3;k++){for(let i=0;i<2;i++)report.webpHashes[i].push(hash(await page.locator('.stage').nth(i).screenshot()));await page.waitForTimeout(450)}
 report.webpChanges=report.webpHashes.map(x=>new Set(x).size>1);await page.click('#pause');report.webpPauseUsesPoster=await page.evaluate(()=>[...document.querySelectorAll('img')].every((im,i)=>im.src===document.querySelectorAll('video')[i].poster));
 report.passed=report.webpCornerAlpha.every(a=>a===0)&&report.webmPixelsChange.every(Boolean)&&report.seekTimes.every((t,i)=>Math.abs(t-(i===0?2.6:.8))<.1)&&!report.errors.length&&report.pauseStable&&report.webpPauseUsesPoster&&report.webpChanges.every(Boolean)&&report.webm.every(v=>v.cornerAlpha===0&&v.transparentPixels>10000&&v.opaquePixels>5000&&v.loopResets>=2)&&report.replay.every(v=>v.playing&&v.time<1);
 await writeFile(resolve(root,'ops/001-zhil/sprint-001/reports/web-drafts-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
