import { expect,it } from 'vitest';
import { Euler,Matrix4,Quaternion } from 'three';
import { createCanonicalRig } from '../src/canonical-rig';
import { MotionSolver } from '../src/motion-solver';
import { defaults } from '../src/types';
import { landmarkReason,type SolverOutcome } from '../src/tracking-diagnostics';
import { shoulderRoll } from '../src/torso-solver';
import { motionSample } from './fixtures/tracking-motion';

function setup(){
  const rig=createCanonicalRig(),solver=new MotionSolver(rig),outcomes:SolverOutcome[]=[];
  solver.diagnosticSink=value=>outcomes.push(value);
  return{rig,solver,outcomes};
}
function lean(angle:number,time=1000){
  const frame=motionSample(3,time).frame;
  frame.inputSize={width:640,height:480};
  frame.pose[23].visibility=frame.pose[24].visibility=0;
  const dy=Math.tan(angle)*.4*640/480;
  frame.poseImage[11]={x:.7,y:.4-dy/2,z:0,visibility:1};
  frame.poseImage[12]={x:.3,y:.4+dy/2,z:0,visibility:1};
  return frame;
}
it('uses the hand contract without removing raw SDK fields',()=>{
  const {solver,outcomes}=setup(),frame=motionSample(3,1000).frame;
  for(const p of frame.hands[0].world){p.visibility=0;p.presence=0;}
  solver.update(frame,defaults,1/60,1000);
  const fingers=outcomes.filter(x=>x.stage==='solver'&&x.reason==='accepted'&&/Thumb|Index|Middle|Ring|Little/.test(x.channel));
  expect(new Set(fingers.map(x=>x.channel)).size).toBe(15);
  expect(frame.hands[0].world.every(p=>p.visibility===0&&p.presence===0)).toBe(true);
  expect(landmarkReason({x:0,y:0,z:0,visibility:0},'pose')).toBe('low_visibility');
  expect(landmarkReason({x:NaN,y:0,z:0},'hands')).toBe('invalid_value');
});
it.each([-.35,.35])('distributes seated roll %s with hidden hips',angle=>{
  const {solver,rig}=setup(),frame=lean(angle);
  for(let i=0;i<120;i++)solver.update(frame,defaults,1/60,1000);
  expect(shoulderRoll(frame)).toBeCloseTo(angle,6);
  expect(new Euler().setFromQuaternion(rig.bones.get('spine')!.quaternion).z).toBeCloseTo(angle*.45,3);
  expect(new Euler().setFromQuaternion(rig.bones.get('chest')!.getWorldQuaternion(new Quaternion())).z).toBeCloseTo(angle,3);
  expect(rig.bones.get('hips')!.quaternion.angleTo(new Quaternion())).toBeLessThan(1e-6);
});
it('keeps the torso still during a head tilt and supports a neutral shoulder roll',()=>{
  const {solver,rig}=setup(),frame=lean(.2);
  solver.calibrate(frame);
  expect(solver.getCalibration().torsoRoll).toBeCloseTo(.2,6);
  frame.faceMatrix=new Matrix4().makeRotationZ(.4).toArray();
  for(let i=0;i<120;i++)solver.update(frame,defaults,1/60,1000);
  expect(rig.bones.get('chest')!.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeLessThan(.001);
  expect(rig.bones.get('head')!.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeGreaterThan(.05);
});
it('keeps sample reasons between renders without counting application as a new solve',()=>{
  const {solver,outcomes}=setup(),frame=motionSample(3,1000).frame;
  solver.sampleIds={pose:4,hands:5};solver.update(frame,defaults,1/60,1000);outcomes.length=0;
  solver.update(frame,defaults,1/60,1016);
  expect(outcomes).toContainEqual(expect.objectContaining({stage:'solver',channel:'leftUpperArm',reason:'accepted',sampleId:4}));
  expect(outcomes).toContainEqual(expect.objectContaining({stage:'application',channel:'leftUpperArm',reason:'accepted'}));
});
it('holds a rejected arm briefly, then decays, and recovers from fresh data',()=>{
  const {solver,rig,outcomes}=setup(),frame=motionSample(3,1000).frame;
  for(let i=0;i<80;i++)solver.update(frame,defaults,1/60,1000);
  const node=rig.bones.get('leftUpperArm')!,before=node.getWorldQuaternion(new Quaternion());
  const missing=motionSample(3,1100).frame;missing.pose[13].visibility=.1;
  solver.update(missing,defaults,1/60,1100);
  expect(before.angleTo(node.getWorldQuaternion(new Quaternion()))).toBeLessThan(.001);
  expect(outcomes).toContainEqual(expect.objectContaining({stage:'application',channel:'leftUpperArm',reason:'held'}));
  outcomes.length=0;solver.update(missing,defaults,1/60,1300);
  expect(outcomes).toContainEqual(expect.objectContaining({stage:'application',channel:'leftUpperArm',reason:'decaying'}));
  for(let i=0;i<100;i++)solver.update(null,defaults,1/60,2000);
  expect(before.angleTo(node.getWorldQuaternion(new Quaternion()))).toBeGreaterThan(.5);
  for(let i=0;i<30;i++)solver.update(motionSample(3,2100+i*16).frame,defaults,1/60,2100+i*16);
  expect(before.angleTo(node.getWorldQuaternion(new Quaternion()))).toBeLessThan(.02);
});
it('clears detailed hand goals when hands are disabled',()=>{
  const {solver,outcomes}=setup(),frame=motionSample(3,1000).frame;
  solver.update(frame,defaults,1/60,1000);outcomes.length=0;
  solver.update(frame,{...defaults,hands:false},1/60,1016);
  expect(outcomes).toContainEqual(expect.objectContaining({channel:'leftIndexProximal',stage:'application',reason:'decaying'}));
});
it('rejects a malformed palm before it can create finger goals',()=>{
  const {solver,outcomes}=setup(),frame=motionSample(3,1000).frame;
  frame.hands[0].world[8].x=NaN;solver.update(frame,defaults,1/60,1000);
  expect(outcomes.some(x=>x.stage==='solver'&&x.reason==='accepted'&&x.channel.includes('Index'))).toBe(false);
});
