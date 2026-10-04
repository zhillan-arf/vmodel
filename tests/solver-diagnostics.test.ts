import { expect, it } from 'vitest';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { createCanonicalRig } from '../src/canonical-rig';
import { MotionSolver } from '../src/motion-solver';
import { solveLimbWorld } from '../src/limb-solver';
import { associateHands, calibratedHeadWorld, palmWorldRotation } from '../src/retarget-math';
import { defaults, type TrackingFrame, type HandObservation } from '../src/types';
import type { SolverOutcome, SolverReason } from '../src/tracking-diagnostics';

function frame(timestamp=1000):TrackingFrame {
  const pose=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:1,presence:1}));
  for(const [i,x,y,z]of [[11,.2,-.5,0],[12,-.2,-.5,0],[23,.1,0,0],[24,-.1,0,0],[13,.5,-.5,0],[14,-.5,-.5,0],[15,.7,-.7,0],[16,-.7,-.7,0],[19,.8,-.8,0],[20,-.8,-.8,0],[25,.1,.4,0],[26,-.1,.4,0],[27,.1,.8,-.1],[28,-.1,.8,-.1],[31,.1,.8,-.2],[32,-.1,.8,-.2]])pose[i]={x,y,z,visibility:1,presence:1};
  const sample={timestamp,inferenceMs:1,present:true};
  return {version:1,sequence:1,timestamp,face:{jawOpen:.4},faceMatrix:new Matrix4().identity().toArray(),pose,poseImage:pose.map(p=>({...p,x:p.x*.3+.5,y:p.y*.3+.5})),hands:[],inferenceMs:1,samples:{face:{...sample},pose:{...sample},hands:{...sample,present:false}}};
}
function setup(missing?:string){
  const rig=createCanonicalRig();if(missing)rig.bones.delete(missing);
  const solver=new MotionSolver(rig),outcomes:SolverOutcome[]=[];solver.sampleIds={face:10,pose:20,hands:30};solver.diagnosticSink=x=>outcomes.push(x);
  return {rig,solver,outcomes};
}
it.each([
  ['missing_landmark',(f:TrackingFrame)=>{f.pose=[];}],
  ['invalid_value',(f:TrackingFrame)=>{f.pose[13].x=NaN;}],
  ['low_visibility',(f:TrackingFrame)=>{f.pose[13].visibility=.55;f.pose[13].presence=.1;}],
  ['low_presence',(f:TrackingFrame)=>{f.pose[13].presence=.55;}],
  ['degenerate_segment',(f:TrackingFrame)=>{f.pose[13]={...f.pose[11]};}],
]as const)('reports the first %s branch for the left arm',(reason,change)=>{
  const {solver,outcomes}=setup(),data=frame();change(data);solver.update(data,defaults,1/60,1000);
  const failures=outcomes.filter(x=>x.channel==='leftArm'&&!x.accepted);expect(failures).toHaveLength(1);expect(failures[0].reason).toBe(reason);
  expect(failures[0].sampleId).toBe(20);
  if(reason==='low_presence'||reason==='low_visibility')expect(failures[0]).toMatchObject({jointIndex:13,value:.55,threshold:.55});
});
it.each([[-51,'future_sample'],[500,'stale']]as const)('reports the hands age gate at %s ms',(age,reason)=>{
  const {solver,outcomes}=setup(),data=frame();data.samples.hands={timestamp:1000-age,present:true,inferenceMs:1};
  solver.update(data,defaults,1/60,1000);expect(outcomes).toContainEqual(expect.objectContaining({channel:'hands',reason,sampleId:30}));
});
it.each([-50,499])('accepts pose age %s ms',age=>{
  const {solver,outcomes}=setup(),data=frame();data.samples.pose.timestamp=1000-age;solver.update(data,defaults,1/60,1000);
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'leftUpperArm',reason:'accepted',sampleId:20}));
});
it('reports mode, setting, detection, and missing bone gates',()=>{
  const {solver,outcomes}=setup('leftUpperArm');solver.update(frame(),{...defaults,hands:false},1/60,1000);solver.update(null,defaults,1/60,1016);
  for(const reason of ['disabled_by_mode','disabled_by_setting','missing_bone','not_detected'])expect(outcomes.some(x=>x.reason===reason)).toBe(true);
});
it('keeps absent confidence separate from the runtime default',()=>{
  const {solver,outcomes}=setup(),data=frame();delete (data.pose[13]as {presence?:number}).presence;
  solver.update(data,defaults,1/60,1000);
  const outcome=outcomes.find(x=>x.stage==='confidence.presence'&&x.channel==='leftArm');
  expect(outcome).toMatchObject({defaultApplied:1,jointIndex:13,sampleId:20,accepted:true});expect(outcome).not.toHaveProperty('value');
  expect(data.pose[13]).not.toHaveProperty('presence');
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'leftHand',reason:'accepted',sampleId:20}));
});
it('preserves rotations and positions with diagnostics enabled across 90 frames',()=>{
  const plain=createCanonicalRig(),diagnosed=createCanonicalRig(),a=new MotionSolver(plain),b=new MotionSolver(diagnosed);
  b.diagnosticSink=()=>{};
  for(let i=0;i<90;i++){
    const data=frame(1000+i*17),settings={...defaults,mode:i<45?'seated' as const:'standing' as const};
    data.faceMatrix=new Matrix4().makeRotationFromEuler(new Euler(Math.sin(i*.1),Math.cos(i*.1),.3)).toArray();
    if(i%7===0)data.pose[13].visibility=.55;if(i%11===0)data.samples.pose.present=false;
    a.update(data,settings,1/60,data.timestamp);b.update(data,settings,1/60,data.timestamp);
    for(const[name,bone]of plain.bones){expect(bone.quaternion.angleTo(diagnosed.bones.get(name)!.quaternion)).toBeLessThan(.0001);expect(bone.position.distanceTo(diagnosed.bones.get(name)!.position)).toBe(0);}
  }
});
const rest={upperDirection:new Vector3(1,0,0),lowerDirection:new Vector3(1,0,0),upperWorld:new Quaternion(),lowerWorld:new Quaternion(),bendNormal:new Vector3(0,0,1)};
it.each(['invalid_rest','invalid_parameter','fully_folded','plane_jump','clamped']as const)('reports limb branch %s',reason=>{
  const outcomes:{reason:SolverReason;value?:number;threshold?:number}[]=[],options={diagnostic:(reason:SolverReason,value?:number,threshold?:number)=>outcomes.push({reason,value,threshold})};
  let end=new Vector3(1,1,0),customRest=rest;
  if(reason==='invalid_rest')customRest={...rest,upperWorld:new Quaternion(0,0,0,0)};
  if(reason==='invalid_parameter')Object.assign(options,{maxFlexion:Math.PI});
  if(reason==='fully_folded')end=new Vector3();
  if(reason==='plane_jump'){end=new Vector3(1,-1,0);Object.assign(options,{previousNormal:new Vector3(0,0,1)});}
  if(reason==='clamped')Object.assign(options,{maxFlexion:.5});
  const result=solveLimbWorld(new Vector3(),new Vector3(1,0,0),end,customRest,options);
  expect(outcomes[0].reason).toBe(reason);expect(result===null).toBe(reason!=='clamped');
  if(reason==='clamped')expect(outcomes[0]).toEqual({reason,value:Math.PI/2,threshold:.5});
});
function hand(score=.9,x=.5):HandObservation {const points=Array.from({length:21},()=>({x,y:.5,z:0}));return{side:'Left',score,landmarks:points,world:points};}
it.each(['hand_score','hand_distance','ambiguous_hand']as const)('reports hand branch %s',reason=>{
  const outcomes:SolverOutcome[]=[],pose=frame().poseImage;pose[15]={x:.5,y:.5,z:0,visibility:1,presence:1};pose[16]={...pose[15]};
  const hands=reason==='hand_score'?[hand(.6)]:reason==='hand_distance'?[hand(.9,.95)]:[hand()];
  associateHands(hands,reason==='hand_score'?[]:pose,{diagnostic:x=>outcomes.push(x)});
  expect(outcomes.some(x=>x.reason===reason)).toBe(true);
  if(reason==='hand_score')expect(outcomes[0]).toMatchObject({value:.6,threshold:.85});
});
it('reports the palm facing limit and the head axis limit',()=>{
  const rest={wrist:new Vector3(),middle:new Vector3(0,1,0),index:new Vector3(1,1,0),little:new Vector3(-1,1,0)},outcomes:SolverOutcome[]=[];
  const observed={...rest,index:new Vector3(0,1,1),little:new Vector3(0,1,-1)};
  expect(palmWorldRotation(rest,observed,new Quaternion(),{diagnostic:x=>outcomes.push(x)})).toBeNull();
  expect(outcomes[0]).toMatchObject({reason:'palm_edge_on',value:0,threshold:.06});
  calibratedHeadWorld(new Quaternion().setFromEuler(new Euler(0,1.3,0)),new Quaternion(),new Quaternion(),undefined,x=>outcomes.push(x));
  expect(outcomes).toContainEqual(expect.objectContaining({reason:'clamped',channel:'head.y',threshold:1.1,accepted:true}));
});
it.each([.55,.550000001])('preserves the strict confidence boundary at %s',visibility=>{
  const {solver,outcomes}=setup(),data=frame();data.pose[13].visibility=visibility;solver.update(data,defaults,1/60,1000);
  expect(outcomes.some(x=>x.channel==='leftUpperArm'&&x.reason==='accepted')).toBe(visibility>.55);
});
it('reports root translation limits with the observed values',()=>{
  const {solver,outcomes}=setup(),data=frame();for(const index of [23,24]){data.poseImage[index].x=2;data.poseImage[index].y=2;}
  solver.update(data,{...defaults,mode:'standing'},1/60,1000);
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'root.x',reason:'clamped',value:.75,threshold:.2,sampleId:20}));
  const vertical=outcomes.find(x=>x.channel==='root.y'&&x.reason==='clamped')!;expect(vertical.value).toBeCloseTo(-.45);expect(vertical.threshold).toBe(-.12);
});
it('reports the first rejected grounding point',()=>{
  const {solver,outcomes}=setup(),data=frame();data.poseImage[27].visibility=.55;data.poseImage[28].x=2;
  solver.update(data,{...defaults,mode:'standing'},1/60,1000);
  const rejected=outcomes.filter(x=>x.channel==='ground'&&!x.accepted);expect(rejected).toHaveLength(1);expect(rejected[0]).toMatchObject({reason:'low_visibility',value:.55,threshold:.55,jointIndex:27,sampleId:20});
});
it('reports an out-of-frame grounding coordinate and a zero parent scale',()=>{
  const first=setup(),data=frame();data.poseImage[27].x=1.2;first.solver.update(data,{...defaults,mode:'standing'},1/60,1000);
  expect(first.outcomes).toContainEqual(expect.objectContaining({channel:'ground',reason:'invalid_value',jointIndex:27,value:1.2,threshold:1}));
  const second=setup();second.rig.scene.getWorldScale=target=>target.set(1,0,1);second.solver.update(frame(),{...defaults,mode:'standing'},1/60,1000);
  expect(second.outcomes).toContainEqual(expect.objectContaining({channel:'ground',reason:'invalid_rest',value:0,threshold:1e-5}));
});
it('distinguishes coefficient defaults from raw and gained clamps',()=>{
  const {solver,outcomes}=setup(),data=frame();data.face={jawOpen:2,eyeBlinkLeft:-.1,eyeBlinkRight:NaN};solver.update(data,defaults,1/60,1000);
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'jawOpen',reason:'clamped',value:2,threshold:1,sampleId:10}));
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'aa',reason:'clamped',value:1.8,threshold:1,sampleId:10}));
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'eyeBlinkLeft',reason:'clamped',value:-.1,threshold:0}));
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'eyeBlinkRight',reason:'invalid_value',defaultApplied:0}));
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'mouthSmileLeft',reason:'not_detected',defaultApplied:0}));
});
it.each([[-51,'future_sample',-50],[500,'stale',500]]as const)('reports the observed age %s and its threshold',(age,reason,threshold)=>{
  const {solver,outcomes}=setup(),data=frame();data.samples.face.timestamp=1000-age;solver.update(data,defaults,1/60,1000);
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'face',reason,value:age,threshold,sampleId:10}));
});
it('records only the confidence defaults evaluated before a rejection',()=>{
  const {solver,outcomes}=setup(),data=frame();delete data.pose[13].visibility;data.pose[13].presence=.55;solver.update(data,defaults,1/60,1000);
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'leftArm',jointIndex:13,stage:'confidence.visibility',defaultApplied:1}));
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'leftArm',jointIndex:13,reason:'low_presence'}));
  const other=setup(),next=frame();next.pose[13].visibility=.55;delete next.pose[13].presence;other.solver.update(next,defaults,1/60,1000);
  expect(other.outcomes.some(x=>x.channel==='leftArm'&&x.jointIndex===13&&x.stage==='confidence.presence')).toBe(false);
});
it('distinguishes invalid palm values from degenerate geometry',()=>{
  const rest={wrist:new Vector3(),middle:new Vector3(0,1,0),index:new Vector3(1,1,0),little:new Vector3(-1,1,0)},outcomes:SolverOutcome[]=[];
  palmWorldRotation(rest,{...rest,index:new Vector3(NaN,1,0)},new Quaternion(),{diagnostic:x=>outcomes.push(x)});expect(outcomes[0].reason).toBe('invalid_value');
  outcomes.length=0;palmWorldRotation(rest,{...rest,middle:new Vector3()},new Quaternion(),{diagnostic:x=>outcomes.push(x)});expect(outcomes[0].reason).toBe('degenerate_segment');
});
it('reports root mode and sample gates before landmark checks',()=>{
  const seated=setup();seated.solver.update(frame(),defaults,1/60,1000);expect(seated.outcomes).toContainEqual(expect.objectContaining({channel:'root',reason:'disabled_by_mode'}));
  const absent=setup(),data=frame();data.samples.pose.present=false;absent.solver.update(data,{...defaults,mode:'standing'},1/60,1000);expect(absent.outcomes).toContainEqual(expect.objectContaining({channel:'root',reason:'not_detected'}));
  const stale=setup();stale.solver.update(frame(),{...defaults,mode:'standing'},1/60,1500);expect(stale.outcomes).toContainEqual(expect.objectContaining({channel:'root',reason:'stale',value:500,threshold:500}));
});
it('reports hand score bounds without using a candidate index as a joint',()=>{
  const outcomes:SolverOutcome[]=[];associateHands([hand(.4),hand(1.1)],[],{diagnostic:x=>outcomes.push(x)});
  expect(outcomes[0]).toMatchObject({channel:'hand candidate 0',reason:'hand_score',value:.4,threshold:.5});
  expect(outcomes[1]).toMatchObject({channel:'hand candidate 1',reason:'hand_score',value:1.1,threshold:1});expect(outcomes[1].jointIndex).toBeUndefined();
});
