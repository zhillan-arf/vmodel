// Final encoded/source comparison on actual white, black and checkerboard composites.
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mediaResponse} from './web_review_response.mjs';
const large=process.argv.includes('--large'),suffix=large?'-large':'';
const root=resolve(import.meta.dirname,'..'),dir=resolve(root,`ops/reports/local/web-production-review${suffix}`);
const index=JSON.parse(await readFile(resolve(dir,'index.json'),'utf8'));
const html=`<!doctype html><meta charset="utf-8"><title>Final Ene media review</title><style>
body{margin:20px;background:#f1f3f8;font:14px system-ui;color:#283247}h1{font-size:22px}h2{margin:18px 0 6px}.grid{display:grid;grid-template-columns:repeat(3,320px);gap:12px}.cell{width:320px;background:conic-gradient(#c8d0dd 25%,white 0 50%,#c8d0dd 0 75%,white 0) 0 0/24px 24px}.cell img{width:100%;height:auto;display:block}.white .cell{background:white}.black .cell{background:#000}.caption{display:flex;justify-content:space-between;font-size:12px}.row{margin-bottom:16px}</style><h1 id="title"></h1><p>Left: RGBA master at delivery size · middle: decoded VP9 WebM · right: decoded animated WebP. Exact matching source frames, 24 fps. Review only.</p><main></main>`;
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://127.0.0.1').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return}
 if(!/^\/(home-greeting|desk-(normal|confused|surprised|excited))\/(source|webm|webp)-\d{4}\.png$/.test(path))throw Error('Not review media');
 mediaResponse(req,res,await readFile(resolve(dir,path.slice(1))),'image/png');
}catch{res.writeHead(404);res.end()}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;const report={date:new Date().toISOString(),state:'running',resources:[],errors:[],scope:'Matched actual source and final codec frames on three CSS backgrounds; no performance or real-device claim.'};
try{
 browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:large?1995:1035,height:950}});page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 if(large)await page.addStyleTag({content:'.grid{grid-template-columns:repeat(3,640px)}.cell{width:640px}'});
 for(const item of index.resources){
  await page.evaluate(({resource,frames})=>{
   document.querySelector('#title').textContent=resource;
   document.querySelector('main').innerHTML=frames.map(frame=>`<section class="row"><h2>Frame ${frame} · ${((frame-1)/24).toFixed(3)} s</h2><div class="grid">${['source','webm','webp'].map(codec=>`<div><p class="caption"><span>${codec}</span></p><div class="cell"><img src="/${resource}/${codec}-${String(frame).padStart(4,'0')}.png"></div></div>`).join('')}</div></section>`).join('');
  },item);
  await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
  const files=[];
  for(const background of ['checker','white','black']){
   await page.evaluate(value=>document.body.className=value,background);
   const file=`${item.resource}-${background}.png`;
   await page.screenshot({path:resolve(dir,file),fullPage:true});files.push(file);
  }
  // Smaller view of three deliberately useful poses, legible as a contact sheet.
  await page.evaluate(()=>{document.body.className='checker';document.querySelectorAll('.row').forEach((row,index)=>{if(![0,2,4].includes(index))row.remove()})});
  const contact=`${item.resource}-contact.png`;await page.screenshot({path:resolve(dir,contact),fullPage:true});
  if(large)await page.locator('.row').first().screenshot({path:resolve(dir,`${item.resource}-detail.png`)});
  report.resources.push({resource:item.resource,rendition:item.rendition,displayCssWidth:large?640:320,frames:item.frames,composites:files,contact});
 }
 report.state=report.errors.length?'failed':'passed';
}catch(error){report.state='failed';report.failure=error.stack;process.exitCode=1}
finally{if(browser)await browser.close();await new Promise(done=>server.close(done));await writeFile(resolve(root,`ops/reports/web-production-visuals${suffix}.json`),JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify(report,null,2));
