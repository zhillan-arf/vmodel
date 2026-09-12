import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'public/notices');await mkdir(output,{recursive:true});
const app=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const queue=Object.keys(app.dependencies), seen=new Set(), packages=[];
while(queue.length) {
  const name=queue.shift();if(seen.has(name))continue;seen.add(name);
  const folder=path.join(root,'node_modules',name);
  const metadata=JSON.parse(await readFile(path.join(folder,'package.json'),'utf8'));
  queue.push(...Object.keys(metadata.dependencies??{}));
  let text='',source='';
  const names=await readdir(folder);
  for(const filename of names.filter(value=>/^(LICENSE|COPYING|NOTICE)(\..*)?$/i.test(value))) {
    const content=await readFile(path.join(folder,filename),'utf8');text+=`${filename}\n\n${content}\n\n`;source+=`${source?', ':''}node_modules/${name}/${filename}`;
  }
  if(!text&&name==='@mediapipe/tasks-vision'&&metadata.license==='Apache-2.0') {
    text='MediaPipe Tasks Vision '+metadata.version+'\nPublisher: Google / MediaPipe Authors\nSource: https://github.com/google-ai-edge/mediapipe\n\n'+await readFile(path.join(root,'config/notices/Apache-2.0.txt'),'utf8');
    source='Installed package license declaration plus retained Apache-2.0 text; npm package omits a separate LICENSE file.';
  }
  if(!text)throw new Error(`No retained runtime license text for ${name}; review before packaging.`);
  const filename=name.replaceAll('/','__').replace('@','')+'.txt';
  await writeFile(path.join(output,filename),text);
  packages.push({name,version:metadata.version,license:metadata.license,notice:filename,source,sha256:createHash('sha256').update(text).digest('hex')});
}
await copyFile(path.join(root,'config/model-notices.json'),path.join(output,'tracking-models.json'));
await copyFile(path.join(root,'config/notices/Apache-2.0.txt'),path.join(output,'Apache-2.0.txt'));
await writeFile(path.join(output,'index.json'),JSON.stringify({application:app.name,version:app.version,scope:'Installed runtime libraries and pinned tracking models. Character assets retain their separate private terms; authoring/OBS/voice tools retain notices in their isolated distributions.',packages:packages.sort((a,b)=>a.name.localeCompare(b.name)),trackingModels:'tracking-models.json',trackingModelLicense:'Apache-2.0.txt'},null,2)+'\n');
console.log(`Runtime notices ready: ${packages.length} packages and tracking-model notice manifest.`);
