import { readFile, writeFile } from 'node:fs/promises';
import { validateBytes } from 'gltf-validator';
import { createHash } from 'node:crypto';
const bytes=await readFile('assets/avatars/ene.vrm');
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
const report=await validateBytes(new Uint8Array(bytes),{maxIssues:1000});
const vrm=gltf.extensions?.VRMC_vrm;
const required=['hips','spine','head',...['left','right'].flatMap(side=>['UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot'].map(part=>side+part))];
const failures=[];
const profile=JSON.parse(await readFile('config/avatars/ene.json','utf8'));
if(!vrm||vrm.specVersion!=='1.0')failures.push('Expected VRM 1.0');
for(const name of required)if(!Number.isInteger(vrm?.humanoid?.humanBones?.[name]?.node))failures.push(`Missing humanoid bone ${name}`);
const human=vrm?.humanoid?.humanBones??{};
const assigned=Object.values(human).map(b=>b.node);
if(new Set(assigned).size!==assigned.length)failures.push('Contradictory humanoid assignments share a node');
for(const [name,sourceName] of Object.entries(profile.humanoid)){
  const node=human[name]?.node;
  if(!Number.isInteger(node)||!gltf.nodes[node])failures.push(`Invalid profile assignment ${name}`);
  else if(gltf.nodes[node].name!==sourceName)failures.push(`Profile/export bone name mismatch: ${name}`);
}
const parents=new Map(gltf.nodes.flatMap((node,parent)=>(node.children??[]).map(child=>[child,parent])));
const hierarchy={spine:'hips',chest:'spine',neck:'chest',head:'neck'};
for(const side of ['left','right'])Object.assign(hierarchy,{[side+'Shoulder']:'chest',[side+'UpperArm']:side+'Shoulder',[side+'LowerArm']:side+'UpperArm',[side+'Hand']:side+'LowerArm',[side+'UpperLeg']:'hips',[side+'LowerLeg']:side+'UpperLeg',[side+'Foot']:side+'LowerLeg'});
for(const [child,parent] of Object.entries(hierarchy)){
  if(!human[child]||!human[parent])continue;
  let node=parents.get(human[child].node);const visited=new Set();
  while(node!==undefined&&node!==human[parent].node&&!visited.has(node)){visited.add(node);node=parents.get(node);}
  if(node!==human[parent].node)failures.push(`${child} is not a descendant of ${parent}`);
}
for(const name of ['blinkLeft','blinkRight','aa'])if(!vrm?.expressions?.preset?.[name]?.morphTargetBinds?.length)failures.push(`Unbound required expression ${name}`);
const boundExpressions=Object.entries(vrm?.expressions?.preset??{}).filter(([,e])=>e.morphTargetBinds?.length).map(([name])=>name);
for(const name of Object.keys(profile.expressions))if(!boundExpressions.includes(name))failures.push(`Profile expression not bound: ${name}`);
for(const name of boundExpressions)if(!(name in profile.expressions))failures.push(`Unexpected automatic expression: ${name}`);
if(gltf.images?.some(image=>image.uri&&!image.uri.startsWith('data:')))failures.push('External image dependency');
if(gltf.buffers?.some(buffer=>buffer.uri))failures.push('External buffer dependency');
const result={file:'assets/avatars/ene.vrm',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,requiredBoneCount:required.length,mappedBoneCount:assigned.length,hierarchyChecked:hierarchy,
  boundExpressions,
  springs:gltf.extensions?.VRMC_springBone?.springs?.length??0,failures,gltfValidation:report};
await writeFile('ops/001-zhil/sprint-001/reports/vrm-validation.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({bytes:result.bytes,failures,springs:result.springs,errors:report.issues.numErrors,warnings:report.issues.numWarnings,firstIssues:report.issues.messages.slice(0,8)}));
if(failures.length||report.issues.numErrors)process.exitCode=1;
