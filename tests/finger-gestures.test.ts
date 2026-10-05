import { expect,it } from 'vitest';
import { Quaternion } from 'three';
import { createCanonicalRig } from '../src/canonical-rig';
import { MotionSolver } from '../src/motion-solver';
import { defaults } from '../src/types';
import { gestureHand as hand } from './fixtures/hand-gestures';
import { motionSample } from './fixtures/tracking-motion';

it.each(['open','fist','point','peace'])('reproduces a synthetic %s gesture on both hands',gesture=>{
  const rig=createCanonicalRig(),solver=new MotionSolver(rig),frame=motionSample(3,1000).frame;
  frame.poseImage=[];frame.hands=[hand('left',gesture),hand('right',gesture)];
  for(let i=0;i<120;i++)solver.update(frame,defaults,1/60,1000);
  for(const side of ['left','right'])for(const finger of ['Index','Middle','Ring','Little']){
    const bent=gesture==='fist'||gesture==='point'&&finger!=='Index'||gesture==='peace'&&(finger==='Ring'||finger==='Little');
    for(const [part,angle]of [['Proximal',.8],['Intermediate',1],['Distal',.5]]as const){
      const actual=rig.bones.get(side+finger+part)!.quaternion.angleTo(new Quaternion());
      expect(actual,side+finger+part).toBeCloseTo(bent?angle:0,2);
    }
  }
});
