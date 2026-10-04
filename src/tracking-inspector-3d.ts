import { associateHands } from './retarget-math';
import type { Landmark, TrackingFrame } from './types';

export const displayPoint=(p:Landmark)=>({x:p.x,y:-p.y,z:-p.z});

export function estimatedSegments(points:ReadonlyArray<Landmark|undefined>,edges:ReadonlyArray<{start:number;end:number}>):number[]{
  const positions:number[]=[];
  for(const edge of edges){
    const a=points[edge.start],b=points[edge.end];
    if(!a||!b||![a.x,a.y,a.z,b.x,b.y,b.z].every(Number.isFinite))continue;
    for(const p of [a,b]){const value=displayPoint(p);positions.push(value.x,value.y,value.z);}
  }
  return positions;
}

export function calculatedWristAlignment(frame:TrackingFrame,side:'left'|'right'):{raw:Landmark[];aligned:Landmark[]}|null{
  if(!frame.samples.pose.present||!frame.samples.hands.present)return null;
  const poseWrist=frame.pose[side==='left'?15:16];
  if(!poseWrist||![poseWrist.x,poseWrist.y,poseWrist.z].every(Number.isFinite))return null;
  const hand=associateHands(frame.hands,frame.poseImage,{imageAspect:frame.inputSize?frame.inputSize.width/frame.inputSize.height:1})[side];
  if(!hand||Array.from(hand.world).some(p=>!p||![p.x,p.y,p.z].every(Number.isFinite)))return null;
  const wrist=hand.world[0];
  return{raw:hand.world,aligned:hand.world.map(p=>({...p,x:poseWrist.x+(p.x-wrist.x),y:poseWrist.y+(p.y-wrist.y),z:poseWrist.z+(p.z-wrist.z)}))};
}
