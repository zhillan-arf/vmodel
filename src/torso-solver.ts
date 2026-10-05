import type { TrackingFrame } from './types';
import { landmarkReason } from './tracking-diagnostics';

// The image estimate controls roll only. Hidden hips cannot give reliable pitch.
export function shoulderRoll(frame:TrackingFrame):number|null {
  const a=frame.poseImage[11],b=frame.poseImage[12];
  if(landmarkReason(a)||landmarkReason(b))return null;
  const aspect=frame.inputSize?frame.inputSize.width/frame.inputSize.height:1;
  let x=(a.x-b.x)*aspect,y=b.y-a.y;
  if(!Number.isFinite(aspect)||aspect<=0||Math.abs(x)<.08)return null;
  if(x<0){x=-x;y=-y;}
  return Math.atan2(y,x);
}
