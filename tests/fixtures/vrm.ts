import { requiredBones } from '../../src/vrm-inspection';
export function fixtureJSON(version:'0'|'1'='1') {
  const humanBones=Object.fromEntries(requiredBones.map((bone,node)=>[bone,{node}]));
  return {asset:{version:'2.0'},nodes:requiredBones.map(name=>({name})),extensions:version==='1'?{VRMC_vrm:{specVersion:'1.0',meta:{name:'Synthetic fixture',authors:['VModel tests'],licenseUrl:'https://example.test/terms'},humanoid:{humanBones}}}:{VRM:{specVersion:'0.0',meta:{title:'Synthetic fixture'},humanoid:{humanBones:requiredBones.map((bone,node)=>({bone,node}))}}}};
}
export function glb(json:unknown,binary?:Uint8Array):Blob{
  const raw=new TextEncoder().encode(JSON.stringify(json)),jsonLength=Math.ceil(raw.length/4)*4,binLength=binary?Math.ceil(binary.length/4)*4:0,total=20+jsonLength+(binary?8+binLength:0),bytes=new Uint8Array(total),view=new DataView(bytes.buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,total,true);view.setUint32(12,jsonLength,true);view.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+jsonLength);bytes.set(raw,20);
  if(binary){view.setUint32(20+jsonLength,binLength,true);view.setUint32(24+jsonLength,0x004e4942,true);bytes.set(binary,28+jsonLength);}
  return new Blob([bytes]);
}
export function renderableFixture(variant=0):Blob {
  const nodes:any[]=[];const humanBones:Record<string,{node:number}>={};
  const add=(name:string,parent:string|null,translation:number[])=>{const node=nodes.length;humanBones[name]={node};nodes.push({name,translation,children:[]});if(parent)nodes[humanBones[parent].node].children.push(node);};
  add('hips',null,[0,1,0]);add('spine','hips',[0,.2,0]);add('head','spine',[0,.35,0]);
  for(const side of ['left','right']){const x=side==='left'?1:-1;add(side+'UpperArm','spine',[x*.18,.25,0]);add(side+'LowerArm',side+'UpperArm',[x*.28,0,0]);add(side+'Hand',side+'LowerArm',[x*.25,0,0]);add(side+'UpperLeg','hips',[x*.11,0,0]);add(side+'LowerLeg',side+'UpperLeg',[0,-.42,0]);add(side+'Foot',side+'LowerLeg',[0,-.43,0]);}
  const positions=new Float32Array([-.15,0,0,.15,0,0,0,.5,0]);nodes.push({mesh:0});
  return glb({asset:{version:'2.0'},extensionsUsed:['VRMC_vrm'],scene:0,scenes:[{nodes:[0,nodes.length-1]}],nodes,buffers:[{byteLength:positions.byteLength}],bufferViews:[{buffer:0,byteLength:positions.byteLength}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-.15,0,0],max:[.15,.5,0]}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[.3+variant*.2,.8,.9,1]}}],extensions:{VRMC_vrm:{specVersion:'1.0',meta:{name:'Synthetic rig',authors:['VModel tests'],licenseUrl:'https://vrm.dev/licenses/1.0/'},humanoid:{humanBones}}}},new Uint8Array(positions.buffer));
}
