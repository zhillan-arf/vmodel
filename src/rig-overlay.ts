import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments, Points, PointsMaterial, Vector3 } from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

export const trackedBones: VRMHumanBoneName[] = ['hips','spine','chest','upperChest','neck','head','leftEye','rightEye'];
for (const side of ['left','right']) {
  for (const part of ['Shoulder','UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot','Toes']) trackedBones.push((side+part) as VRMHumanBoneName);
  for (const finger of ['Thumb','Index','Middle','Ring','Little']) {
    for (const part of finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal']) trackedBones.push((side+finger+part) as VRMHumanBoneName);
  }
}

/** Show the bones that deform the model after VRM updates. */
export class RigOverlay {
  readonly lines = new LineSegments(new BufferGeometry(), new LineBasicMaterial({color:0x60dcea,depthTest:false,depthWrite:false}));
  readonly points = new Points(new BufferGeometry(), new PointsMaterial({color:0xffd18a,size:5,sizeAttenuation:false,depthTest:false,depthWrite:false}));
  constructor() {
    this.lines.renderOrder=10000; this.points.renderOrder=10001;
    this.lines.frustumCulled=false; this.points.frustumCulled=false;
  }
  update(vrm:VRM) {
    vrm.scene.updateMatrixWorld(true);
    const nodes=trackedBones.flatMap(name=>{const node=vrm.humanoid.getRawBoneNode(name);return node?[node]:[];});
    const selected=new Set(nodes),positions:number[]=[],joints:number[]=[];
    for(const node of nodes){
      const position=node.getWorldPosition(new Vector3());joints.push(...position.toArray());
      let parent=node.parent;
      while(parent&&!selected.has(parent))parent=parent.parent;
      if(parent)positions.push(...parent.getWorldPosition(new Vector3()).toArray(),...position.toArray());
    }
    for(const [object,values] of [[this.lines,positions],[this.points,joints]] as const){
      const attribute=object.geometry.getAttribute('position');
      if(attribute&&attribute.count*3===values.length){attribute.array.set(values);attribute.needsUpdate=true;}
      else {object.geometry.dispose();object.geometry=new BufferGeometry();object.geometry.setAttribute('position',new Float32BufferAttribute(values,3));}
    }
  }
  dispose(){for(const object of [this.lines,this.points]){object.removeFromParent();object.geometry.dispose();object.material.dispose();}}
}
