import { Euler, Matrix4 } from 'three';
import type { TrackingFrame } from '../../src/types';
import type { DiagnosticEnvelope } from '../../src/tracking-diagnostics';

export function motionSample(index:number,time:number):{frame:TrackingFrame;diagnostics:DiagnosticEnvelope}{
  const pose=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:1,presence:1})),lift=Math.sin(index*.2)*.3;
  for(const [i,x,y,z]of [[11,.2,-.5,0],[12,-.2,-.5,0],[23,.1,0,0],[24,-.1,0,0],[13,.5,-.5-lift,0],[14,-.5,-.5,0],[15,.7,-.7-lift,.1],[16,-.7,-.7,0],[19,.8,-.8-lift,.1],[20,-.8,-.8,0],[25,.1,.4,0],[26,-.1,.4,0],[27,.1,.8,-.1],[28,-.1,.8,-.1],[31,.1,.8,-.2],[32,-.1,.8,-.2]])pose[i]={x,y,z,visibility:1,presence:1};
  const poseImage=pose.map(p=>({...p,x:p.x*.3+.5,y:p.y*.3+.5}));
  const world=Array.from({length:21},()=>({x:0,y:0,z:0}));
  for(const [start,x]of [[1,-.05],[5,-.03],[9,0],[13,.02],[17,.04]])for(let j=0;j<4;j++)world[start+j]={x,y:-.08-j*.025,z:j*.01*Math.sin(index*.1)};
  if(index%9===0)pose[13].visibility=.55;
  const present=index%11!==0,tracking={timestamp:time,inferenceMs:2,present};
  const frame:TrackingFrame={version:1,sequence:index,timestamp:time,face:{jawOpen:.4},faceMatrix:new Matrix4().makeRotationFromEuler(new Euler(.8*Math.sin(index*.1),1.3*Math.cos(index*.1),.6)).toArray(),pose,poseImage,
    hands:[{side:'Left',score:.95,landmarks:Array.from({length:21},()=>({...poseImage[15]})),world}],inferenceMs:2,samples:{face:{...tracking},pose:{...tracking},hands:{...tracking}}};
  const task={sampleSequence:index,captureSequence:index,sampleTimeMs:time,startedAtMs:time,finishedAtMs:time+2,state:'new' as const,present};
  return{frame,diagnostics:{version:1,sessionId:'motion-fixture',captureSequence:index,captureTimeMs:time,videoTimeMs:time,inputSize:{width:640,height:480},runtimeVersion:'fixture',modelHashes:{face:'a'.repeat(64),pose:'b'.repeat(64),hands:'c'.repeat(64)},delegate:'CPU',tasks:{face:{...task},pose:{...task},hands:{...task}}}};
}
