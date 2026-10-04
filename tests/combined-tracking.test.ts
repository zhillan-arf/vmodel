import { expect,it } from 'vitest';
import { Euler,Quaternion } from 'three';
import { createCanonicalRig } from '../src/canonical-rig';
import { MotionSolver } from '../src/motion-solver';
import { defaults } from '../src/types';
import { motionSample } from './fixtures/tracking-motion';
import { combinedObservations,isCombinedCapture } from '../src/combined-observations';
import { trackingSummary } from '../src/tracking-summary';

it('puts gaze results in the face summary',()=>{
  const result=trackingSummary(['leftEye','rightEye'].map(channel=>({stage:'solver',channel,accepted:true,reason:'accepted'})));
  expect(result.rows[0].text).toContain('Accepted: 2.');
  expect(result.rows[1].text).toBe('No solver result.');
});

it('keeps all four observation groups on the same capture',()=>{
  const {frame,diagnostics}=motionSample(3,1000);
  diagnostics.tasks.face.observations=[Array.from({length:478},()=>({x:.5,y:.3,z:0}))];
  frame.hands.push({...structuredClone(frame.hands[0]),side:'Right'});
  expect(isCombinedCapture(diagnostics)).toBe(true);
  expect(combinedObservations(frame,diagnostics).map(g=>g.points.length)).toEqual([33,478,21,21]);
  diagnostics.tasks.hands.captureSequence--;
  expect(isCombinedCapture(diagnostics)).toBe(false);
  expect(combinedObservations(frame,diagnostics).map(g=>g.task)).toEqual(['pose','face']);
  diagnostics.tasks.hands.state='disabled';
  expect(isCombinedCapture(diagnostics)).toBe(true);
  diagnostics.tasks.face.present=false;
  expect(combinedObservations(frame,diagnostics).map(g=>g.task)).toEqual(['pose']);
});

it.each(['left','right'] as const)('moves the %s shoulder and returns after loss',side=>{
  const rig=createCanonicalRig(),solver=new MotionSolver(rig),frame=motionSample(3,1000).frame;
  const index=side==='left'?13:14;
  frame.pose[11].y=frame.pose[12].y=-.5;
  frame.pose[13].y=frame.pose[14].y=-.5;
  frame.pose[index].y=-.9;
  const selected=rig.bones.get(side+'Shoulder')!,other=rig.bones.get((side==='left'?'right':'left')+'Shoulder')!;
  for(let i=0;i<100;i++)solver.update(frame,defaults,1/60,1000);
  expect(selected.quaternion.angleTo(new Quaternion())).toBeGreaterThan(.1);
  expect(other.quaternion.angleTo(new Quaternion())).toBeLessThan(.001);
  for(let i=0;i<100;i++)solver.update(frame,defaults,1/60,2000);
  expect(selected.quaternion.angleTo(new Quaternion())).toBeLessThan(.001);
});

it.each([0,Math.PI])('applies bounded gaze with rig orientation %s',orientation=>{
  const rig=createCanonicalRig();rig.scene.rotation.y=orientation;
  const solver=new MotionSolver(rig),frame=motionSample(3,1000).frame;
  for(const side of ['Left','Right'])for(const direction of ['In','Out','Up','Down'])frame.face['eyeLook'+direction+side]=0;
  frame.face.eyeLookOutLeft=1;frame.face.eyeLookInRight=1;
  for(let i=0;i<100;i++)solver.update(frame,defaults,1/60,1000);
  for(const side of ['left','right'])expect(new Euler().setFromQuaternion(rig.bones.get(side+'Eye')!.quaternion).y).toBeCloseTo(.35,3);
  for(let i=0;i<100;i++)solver.update(null,defaults,1/60,2000);
  for(const side of ['left','right'])expect(rig.bones.get(side+'Eye')!.quaternion.angleTo(new Quaternion())).toBeLessThan(.001);
});

it('rejects a shoulder estimate with a hidden elbow',()=>{
  const rig=createCanonicalRig(),solver=new MotionSolver(rig),frame=motionSample(3,1000).frame;
  frame.pose[13]={...frame.pose[13],y:-1,visibility:.1};
  const reasons:string[]=[];solver.diagnosticSink=result=>{if(result.channel==='leftShoulder')reasons.push(result.reason);};
  solver.update(frame,defaults,1/60,1000);
  expect(reasons).toContain('low_visibility');expect(reasons).not.toContain('accepted');
});

it('moves a visible shoulder when the hips are hidden',()=>{
  const rig=createCanonicalRig(),solver=new MotionSolver(rig),frame=motionSample(3,1000).frame;
  frame.pose[23].visibility=frame.pose[24].visibility=0;
  frame.pose[13].y=-.9;
  for(let i=0;i<100;i++)solver.update(frame,defaults,1/60,1000);
  expect(rig.bones.get('leftShoulder')!.quaternion.angleTo(new Quaternion())).toBeGreaterThan(.1);
});
