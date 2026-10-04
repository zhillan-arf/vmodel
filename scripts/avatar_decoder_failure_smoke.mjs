import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${server.resolvedUrls.local[0]}tests/browser-host.html`);
  const results=await page.evaluate(async()=>{
    const {AvatarViewer}=await import('/src/viewer.ts');const {defaults}=await import('/src/types.ts');
    const {GLTFLoader}=await import('/tests/fixtures/decoder-loader.ts');
    const {renderableFixture,glb}=await import('/tests/fixtures/vrm.ts');
    const original=await renderableFixture().arrayBuffer(),view=new DataView(original),length=view.getUint32(12,true);
    const json=JSON.parse(new TextDecoder().decode(new Uint8Array(original,20,length)));
    const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;canvas.getContext('2d').fillRect(0,0,1,1);
    json.images=[{uri:canvas.toDataURL()}];json.textures=[{source:0}];json.materials[0].pbrMetallicRoughness.baseColorTexture={index:0};
    const blob=glb(json,new Uint8Array(original,28+length));
    const fixtureHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const container=document.createElement('div');container.style.cssText='width:320px;height:240px';document.body.append(container);
    const viewer=new AvatarViewer(container,defaults);viewer.commitAvatar(await viewer.prepareAvatar(blob));viewer.draw(0);
    const active=viewer.vrm,baseline={...viewer.renderer.info.memory},results=[];
    const register=GLTFLoader.prototype.register;
    try{
      for(const stage of ['mesh','afterRoot']){
        const counts=[];const seen=new Set();
        const watch=(object,kind,method='dispose')=>{
          if(!object||seen.has(object))return;seen.add(object);
          const row={kind,count:0};counts.push(row);const original=object[method].bind(object);
          object[method]=()=>{row.count++;original();};
        };
        const watchScene=scene=>scene.traverse(mesh=>{
          watch(mesh.geometry,'geometry');
          for(const material of Array.isArray(mesh.material)?mesh.material:mesh.material?[mesh.material]:[]){
            watch(material,'material');watch(material.map,'texture');watch(material.map?.source?.data,'image','close');
          }
        });
        GLTFLoader.prototype.register=function(callback){return register.call(this,parser=>{
          const plugin=callback(parser);if(plugin.name!=='VRMLoaderPlugin')return plugin;
          if(stage==='mesh'){
            const load=parser.loadMesh.bind(parser);
            parser.loadMesh=async index=>{const mesh=await load(index);watchScene(mesh);throw new Error('Mesh decoder fixture');};
          }else{
            const afterRoot=plugin.afterRoot.bind(plugin);
            plugin.afterRoot=async result=>{await afterRoot(result);watchScene(result.scene);throw new Error('Root decoder fixture');};
          }
          return plugin;
        });};
        let error='';try{await viewer.prepareAvatar(blob);}catch(failure){error=String(failure);}
        GLTFLoader.prototype.register=register;viewer.draw(0);
        results.push({fixtureHash,stage,error,counts,activePreserved:viewer.vrm===active,resources:{...viewer.renderer.info.memory},baseline});
      }
    }finally{GLTFLoader.prototype.register=register;viewer.dispose();container.remove();}
    return results;
  });
  for(const result of results){
    assert(result.error.includes('decoder fixture'));assert(result.activePreserved);
    assert.deepEqual(result.resources,result.baseline);
    assert.deepEqual(result.counts.map(x=>x.kind).sort(),['geometry','image','material','texture']);
    assert(result.counts.every(x=>x.count===1));
  }
  assert.deepEqual(errors,[]);
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),results,errors,
    limits:['Real GLTF loader with injected mesh and root failures. Synthetic textured VRM only.']};
  await writeFile('ops/reports/avatar-decoder-failure-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
