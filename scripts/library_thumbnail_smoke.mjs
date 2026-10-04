import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const manifest=JSON.parse(await readFile('public/avatars/thumbnails/manifest.json','utf8'));
for(const id of ['ene','rei']){
  const hash=file=>readFile(file).then(bytes=>createHash('sha256').update(bytes).digest('hex'));
  assert.equal(await hash(`public/avatars/${id}.vrm`),manifest[id].modelHash);
  assert.equal(await hash(`public/avatars/thumbnails/${manifest[id].modelHash}.png`),manifest[id].thumbnailHash);
}
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]+'tests/browser-host.html');
  await page.evaluate(async()=>{
    await import('/src/style.css');const{LibraryPanel}=await import('/src/library-panel.ts'),{LocalModelRepository}=await import('/src/model-repository.ts');
    window.libraryActive={id:null,requested:null};window.panel=new LibraryPanel(new LocalModelRepository(),async()=>{},()=>window.libraryActive);
    document.body.dataset.view='library';document.body.append(window.panel.element);window.panel.element.hidden=false;window.panel.setVisible(true);
  });
  await page.waitForFunction(()=>document.querySelectorAll('.model-card img').length===2&&[...document.querySelectorAll('.model-card img')].every(image=>image.complete&&image.naturalWidth===320),null,{timeout:60000});
  const images=await page.evaluate(()=>[...document.querySelectorAll('.model-card img')].map(image=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=320;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,320,320).data;let foreground=0,minY=320,maxY=-1;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==24||pixels[i+1]!==35||pixels[i+2]!==57) {foreground++;const y=Math.floor(i/4/320);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    return{entry:image.closest('article').dataset.entryId,width:image.naturalWidth,height:image.naturalHeight,foreground,minY,maxY};
  }));
  for(const image of images){assert.equal(image.height,320);assert(image.foreground>1000);assert(image.minY>=10);assert(image.maxY<=309);}
  await mkdir('ops/001-zhil/sprint-001/reports/local/library-thumbnails',{recursive:true});
  const layouts=[];
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1024});
    const movement=await page.evaluate(async()=>{
      const positions=()=>['#import-model','.model-card button'].map(selector=>document.querySelector(selector).getBoundingClientRect().top+scrollY);
      const before=positions();window.libraryActive={id:null,requested:null,temporaryLabel:'Long model name '.repeat(5)};await window.panel.refresh();
      const after=positions();window.libraryActive={id:null,requested:null};await window.panel.refresh();return before.map((value,index)=>after[index]-value);
    });
    assert(movement.every(value=>Math.abs(value)<1),`Status moved controls: ${movement}`);
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,squares:[...document.querySelectorAll('.model-card img')].map(image=>{const r=image.getBoundingClientRect();return r.width>0&&r.height>0&&Math.abs(r.width-r.height)<1;})}));
    assert.equal(layout.overflow,false);assert(layout.squares.every(Boolean));layouts.push({width,...layout});
    await page.screenshot({path:`ops/001-zhil/sprint-001/reports/local/library-thumbnails/${width}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{document.documentElement.style.zoom='2';window.libraryActive={id:null,requested:null,temporaryLabel:'Long model name '.repeat(5)};await window.panel.refresh();});
  await page.waitForFunction(()=>{const region=document.querySelector('.library-status');return region.scrollHeight>region.clientHeight;});
  await page.locator('.library-status').focus();await page.keyboard.press('End');
  await page.waitForFunction(()=>document.querySelector('.library-status').scrollTop>0);
  await page.route('**/avatars/thumbnails/*.png',route=>route.fulfill({status:404,body:'missing'}));
  await page.evaluate(()=>window.panel.refresh());
  await page.waitForFunction(()=>document.querySelectorAll('.thumbnail-unavailable').length===2);
  assert.equal(await page.locator('.model-card img').count(),0);
  await page.evaluate(()=>window.panel.dispose());assert.deepEqual(errors,[]);
  await writeFile('ops/001-zhil/sprint-001/reports/library-thumbnail-smoke.json',JSON.stringify({generatedAt:new Date().toISOString(),browser:browser.version(),manifest,images,layouts,missingImageFallback:true,statusKeepsControlsStable:true,statusKeyboardScrollAtScaleTwo:true,errors,limits:['Actual bundled models. No human visual acceptance.']},null,2)+'\n');
}finally{await browser?.close();await server.close();}
