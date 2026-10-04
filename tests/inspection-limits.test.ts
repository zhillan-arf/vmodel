import { afterEach, expect, it } from 'vitest';
import { inspectVRM, limits } from '../src/vrm-inspection';
import { validateAttachments } from '../src/library-validation';
import { sha256, type Attachment } from '../src/model-types';
import { fixtureJSON, glb } from './fixtures/vrm';
const MiB=1048576;
const selectedLimits={...limits};
afterEach(()=>Object.assign(limits,selectedLimits));
function png(width:number,height:number){const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);return bytes;}
function images(dimensions:[number,number][]){const bytes=new Uint8Array(dimensions.length*24);dimensions.forEach(([w,h],i)=>bytes.set(png(w,h),i*24));return{json:{...fixtureJSON(),buffers:[{byteLength:bytes.length}],bufferViews:dimensions.map((_,i)=>({buffer:0,byteOffset:i*24,byteLength:24})),images:dimensions.map((_,i)=>({bufferView:i,mimeType:'image/png'}))},bytes};}
function sparseGeometry(count:number){return{buffers:[{byteLength:8}],bufferViews:[{buffer:0,byteOffset:0,byteLength:4},{buffer:0,byteOffset:4,byteLength:4}],accessors:[{count,type:'SCALAR',componentType:5126,sparse:{count:1,indices:{bufferView:0,componentType:5125},values:{bufferView:1}}}]};}
it.each(['nodes','meshes','primitives','accessors','images']as const)('checks the %s collection boundary',async name=>{
  for(const excess of [0,1]){
    const size=limits[name]+excess;let json:any=fixtureJSON(),bytes:Uint8Array|undefined;
    if(name==='nodes')json.nodes=[...json.nodes,...Array.from({length:size-json.nodes.length},()=>({}))];
    if(name==='meshes')json.meshes=Array.from({length:size},()=>({primitives:[]}));
    if(name==='primitives')json.meshes=[{primitives:Array.from({length:size},()=>({attributes:{}}))}];
    if(name==='accessors'){bytes=new Uint8Array(4);Object.assign(json,{buffers:[{byteLength:4}],bufferViews:[{buffer:0,byteLength:4}],accessors:Array.from({length:size},()=>({bufferView:0,count:1,type:'SCALAR',componentType:5126}))});}
    if(name==='images')({json,bytes}=images(Array.from({length:size},()=>[1,1])));
    const result=inspectVRM(glb(json,bytes));if(excess)await expect(result).rejects.toThrow(name==='primitives'?'primitives':name);else await expect(result).resolves.toHaveProperty('hash');
  }
});
it('checks the input size gate without a large allocation',async()=>{
  const blob=glb(fixtureJSON());Object.defineProperty(blob,'size',{configurable:true,value:limits.input});await expect(inspectVRM(blob)).resolves.toHaveProperty('hash');
  Object.defineProperty(blob,'size',{value:limits.input+1});await expect(inspectVRM(blob)).rejects.toThrow('150 MiB');
});
it('checks the JSON byte boundary with actual encoded bytes',async()=>{
  for(const excess of [0,4]){const json={...fixtureJSON(),extras:''};const overhead=new TextEncoder().encode(JSON.stringify(json)).length;json.extras='a'.repeat(limits.json+excess-overhead);
    const result=inspectVRM(glb(json));if(excess)await expect(result).rejects.toThrow('bounded JSON');else await expect(result).resolves.toHaveProperty('hash');}
});
it('checks the JSON depth boundary',async()=>{
  for(const excess of [0,1]){let nested:unknown=0;for(let depth=1;depth<limits.depth+excess;depth++)nested={next:nested};const result=inspectVRM(glb({...fixtureJSON(),extras:nested}));if(excess)await expect(result).rejects.toThrow('JSON');else await expect(result).resolves.toHaveProperty('hash');}
});
it('checks the JSON value count boundary',async()=>{
  const count=(value:unknown):number=>1+(value&&typeof value==='object'?Object.values(value).reduce<number>((sum,item)=>sum+count(item),0):0);
  for(const excess of [0,1]){const json={...fixtureJSON(),extras:[] as number[]};json.extras=Array(limits.values-count(json)+excess).fill(0);const result=inspectVRM(glb(json));if(excess)await expect(result).rejects.toThrow('JSON');else await expect(result).resolves.toHaveProperty('hash');}
});
it.each(['width','height']as const)('checks the image %s boundary before decode',async axis=>{
  for(const excess of [0,1]){const fixture=images([[axis==='width'?limits.dimension+excess:1,axis==='height'?limits.dimension+excess:1]]);const result=inspectVRM(glb(fixture.json,fixture.bytes));if(excess)await expect(result).rejects.toThrow('8192');else await expect(result).resolves.toHaveProperty('resources.pixels',8192);}
});
it('checks the decoded pixel boundary with image headers',async()=>{
  for(const excess of [0,1]){const fixture=images([...Array.from({length:3},()=>[8192,8192] as [number,number]),...(excess?[[1,1] as [number,number]]:[])]);const result=inspectVRM(glb(fixture.json,fixture.bytes));if(excess)await expect(result).rejects.toThrow('pixel limit');else await expect(result).resolves.toHaveProperty('resources.pixels',limits.pixels);}
});
it('checks the geometry estimate boundary with a sparse accessor',async()=>{
  for(const excess of [0,1]){const result=inspectVRM(glb({...fixtureJSON(),...sparseGeometry(limits.geometry/4+excess)},new Uint8Array(8)));if(excess)await expect(result).rejects.toThrow('128 MiB');else await expect(result).resolves.toHaveProperty('resources.geometryBytes',limits.geometry);}
});
it('checks the combined boundary without changing another ceiling',async()=>{
  expect(limits.geometry+Math.ceil(limits.pixels*4*4/3)).toBeGreaterThan(limits.combined);
  for(const excess of [0,1]){
    const fixture=images([[8192,8192],[8192,8192],[8192,5120],...(excess?[[1,1] as [number,number]]:[])]),geometry=sparseGeometry(limits.geometry/4);
    const bytes=new Uint8Array(fixture.bytes.length+8);bytes.set(fixture.bytes);const offset=fixture.bytes.length;
    const json={...fixture.json,buffers:[{byteLength:bytes.length}],bufferViews:[...fixture.json.bufferViews,...geometry.bufferViews.map(view=>({...view,byteOffset:view.byteOffset+offset}))],accessors:geometry.accessors.map(accessor=>({...accessor,sparse:{...accessor.sparse,indices:{...accessor.sparse.indices,bufferView:fixture.json.bufferViews.length},values:{bufferView:fixture.json.bufferViews.length+1}}}))};
    const result=inspectVRM(glb(json,bytes));if(excess)await expect(result).rejects.toThrow('1024 MiB');else{const inspected=await result;expect(inspected.resources.geometryBytes+inspected.resources.textureBytes).toBe(limits.combined);}
  }
});
async function attachment(blob:Blob,kind:'terms'|'thumbnail'='terms'):Promise<Attachment>{return{id:'fixture',modelId:'fixture',kind,blob,originalFilename:kind==='terms'?'terms.txt':'thumbnail.png',mediaType:kind==='terms'?'text/plain':'image/png',encoding:kind==='terms'?'utf-8':'',sha256:await sha256(blob)};}
it('checks terms count, per-file size, and total bytes',async()=>{
  const small=await attachment(new Blob(['terms']));await expect(validateAttachments(Array(8).fill(small))).resolves.toBeUndefined();await expect(validateAttachments(Array(9).fill(small))).rejects.toThrow('limits');
  const maximum=await attachment(new Blob(['a'.repeat(2*MiB)]));await expect(validateAttachments([maximum])).resolves.toBeUndefined();
  await expect(validateAttachments([await attachment(new Blob(['a'.repeat(2*MiB+1)]))])).rejects.toThrow('2 MiB');
  await expect(validateAttachments(Array(4).fill(maximum))).resolves.toBeUndefined();await expect(validateAttachments([...Array(4).fill(maximum),small])).rejects.toThrow('limits');
});
it('checks thumbnail byte and dimension gates',async()=>{
  const bytes=new Uint8Array(512*1024);bytes.set(png(320,320));await expect(validateAttachments([await attachment(new Blob([bytes]),'thumbnail')])).resolves.toBeUndefined();
  await expect(validateAttachments([await attachment(new Blob([bytes,new Uint8Array(1)]),'thumbnail')])).rejects.toThrow('thumbnail');
  for(const [width,height]of [[319,320],[321,320],[320,319],[320,321]])await expect(validateAttachments([await attachment(new Blob([png(width,height)]),'thumbnail')])).rejects.toThrow('320 by 320');
});
