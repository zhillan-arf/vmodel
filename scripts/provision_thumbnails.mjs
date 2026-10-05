import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const output='public/avatars/thumbnails';
await mkdir(output,{recursive:true});
const sources=await readdir('src');
const rendererHash=hash(Buffer.concat(await Promise.all([...sources.filter(name=>name.endsWith('.ts')).sort().map(name=>`src/${name}`),'package-lock.json','scripts/provision_thumbnails.mjs'].map(name=>readFile(name)))));
let manifest={};try{manifest=JSON.parse(await readFile(`${output}/manifest.json`,'utf8'));}catch{}
const pending=[];
for(const id of ['ene','rei','rei-v2','ene-v2']){
  let bytes;try{bytes=await readFile(`public/avatars/${id}.vrm`);}catch(error){if(error.code==='ENOENT'){console.log(`${id}: bundled model is unavailable. Thumbnail was not generated.`);continue;}throw error;}
  const modelHash=hash(bytes),file=`${output}/${modelHash}.png`,previous=manifest[id];
  let valid=false;try{valid=previous?.modelHash===modelHash&&previous.rendererHash===rendererHash&&previous.thumbnailHash===hash(await readFile(file));}catch{}
  if(!valid)pending.push({id,modelHash,file});
}
if(pending.length){
  const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
  try{
    await server.listen();
    for(const channel of [undefined,'chrome','msedge']){try{browser=await chromium.launch({headless:true,...(channel?{channel}:{})});break;}catch{}}
    if(!browser)throw new Error('A browser is required to create model thumbnails. Install Chrome or Edge, or run npx playwright install chromium.');
    for(const item of pending){
      const page=await browser.newPage();
      await page.goto(server.resolvedUrls.local[0]+'tests/browser-host.html');
      const data=await page.evaluate(async id=>{
        const {AvatarViewer}=await import('/src/viewer.ts'),{defaults}=await import('/src/types.ts'),{captureModelThumbnail}=await import('/src/model-thumbnail.ts');
        const container=document.createElement('div');container.style.cssText='position:relative;width:512px;height:512px';document.body.append(container);
        const viewer=new AvatarViewer(container,{...defaults,framing:'body',quality:'low'});
        try{
          const response=await fetch(`/avatars/${id}.vrm`);if(!response.ok)throw new Error('Bundled model is unavailable.');
          const candidate=await viewer.prepareAvatar(await response.blob());viewer.commitAvatar(candidate);
          for(let frame=0;frame<120;frame++)candidate.retarget.update(null,defaults,1/60,frame*1000/60);
          return Array.from(new Uint8Array(await(await captureModelThumbnail(viewer)).arrayBuffer()));
        }finally{viewer.dispose();container.remove();}
      },item.id);
      const bytes=Buffer.from(data);await writeFile(item.file,bytes);
      manifest[item.id]={modelHash:item.modelHash,rendererHash,thumbnailHash:hash(bytes),width:320,height:320};
      await page.close();console.log(`${item.id}: model thumbnail is ready.`);
    }
    await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
  }finally{await browser?.close();await server.close();}
}
