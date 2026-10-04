import { Object3D, Vector3 } from 'three';
import type { MotionRig } from './motion-solver';
export function createCanonicalRig(): MotionRig & { bones: Map<string,Object3D> } {
  const scene=new Object3D(),bones=new Map<string,Object3D>();
  const add=(name:string,parent:string|null,position:[number,number,number])=>{const bone=new Object3D();bone.name=name;bone.position.set(...position);(parent?bones.get(parent)!:scene).add(bone);bones.set(name,bone);return bone;};
  add('hips',null,[0,1,0]);add('spine','hips',[0,.2,0]);add('chest','spine',[0,.18,0]);add('neck','chest',[0,.12,0]);add('head','neck',[0,.05,0]);add('leftEye','head',[.03,.06,.08]);
  for(const side of ['left','right']){const sign=side==='left'?1:-1;
    add(side+'Shoulder','chest',[sign*.12,.07,0]);add(side+'UpperArm',side+'Shoulder',[sign*.06,0,0]);add(side+'LowerArm',side+'UpperArm',[sign*.28,0,0]);add(side+'Hand',side+'LowerArm',[sign*.25,0,0]);
    add(side+'UpperLeg','hips',[sign*.11,0,0]);add(side+'LowerLeg',side+'UpperLeg',[0,-.42,0]);add(side+'Foot',side+'LowerLeg',[0,-.43,0]);add(side+'Toes',side+'Foot',[0,0,.15]);
    for(const [finger,offset]of [['Thumb',-.035],['Index',-.018],['Middle',0],['Ring',.018],['Little',.035]] as const){const parts=finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];for(let i=0;i<parts.length;i++)add(side+finger+parts[i],i?side+finger+parts[i-1]:side+'Hand',[sign*(i?.025:.075),0,i?0:offset]);}
  }
  const rest=new Map([...bones].map(([name,bone])=>[name,{position:bone.position.clone(),quaternion:bone.quaternion.clone()}]));
  return{scene,bones,humanoid:{getNormalizedBoneNode:name=>bones.get(name)??null,resetNormalizedPose:()=>{for(const[name,bone]of bones){bone.position.copy(rest.get(name)!.position);bone.quaternion.copy(rest.get(name)!.quaternion);}}}};
}
export function rigSegments(rig:ReturnType<typeof createCanonicalRig>):[Vector3,Vector3][] {
  rig.scene.updateMatrixWorld(true);return[...rig.bones.values()].filter(bone=>bone.parent&&bone.parent!==rig.scene).map(bone=>[bone.parent!.getWorldPosition(new Vector3()),bone.getWorldPosition(new Vector3())]);
}
