import {expect,it} from 'vitest';
import type {TrackingFrame} from '../src/types';
import {calculatedWristAlignment,estimatedSegments} from '../src/tracking-inspector-3d';

it('preserves raw lengths and absolute positions without a fixed rig',()=>{
  const edges=[{start:0,end:1}],points=[{x:2,y:3,z:4},{x:5,y:7,z:4}];
  const first=estimatedSegments(points,edges);
  expect(first).toEqual([2,-3,-4,5,-7,-4]);
  expect(Math.hypot(first[3]-first[0],first[4]-first[1],first[5]-first[2])).toBe(5);
  const changed=estimatedSegments([points[0],{x:8,y:11,z:4}],edges);
  expect(Math.hypot(changed[3]-changed[0],changed[4]-changed[1],changed[5]-changed[2])).toBe(10);
});
it('omits missing or nonfinite endpoints instead of substituting the origin',()=>{
  const valid={x:1,y:2,z:3};
  for(const absent of [undefined,{x:NaN,y:2,z:3},{x:1,y:Infinity,z:3},{x:1,y:2,z:-Infinity}]){
    expect(estimatedSegments([valid,absent],[{start:0,end:1}])).toEqual([]);
    expect(estimatedSegments([absent,valid],[{start:0,end:1}])).toEqual([]);
  }
});
it('keeps valid edges and real zero coordinates',()=>{
  expect(estimatedSegments([{x:0,y:0,z:0},undefined,{x:1,y:2,z:3}],[{start:0,end:1},{start:0,end:2}]))
    .toEqual([0,-0,-0,1,-2,-3]);
});

function handFrame():TrackingFrame{
  const pose=Array.from({length:33},()=>({x:2,y:3,z:4}));
  const poseImage=Array.from({length:33},()=>({x:.8,y:.5,z:0,visibility:1}));poseImage[15].x=.2;
  const sample={timestamp:0,inferenceMs:1,present:true};
  return{version:1,sequence:1,timestamp:0,face:{},faceMatrix:null,pose,poseImage,inferenceMs:1,
    hands:[{side:'Right',score:.99,landmarks:Array.from({length:21},()=>({x:.2,y:.5,z:0})),world:Array.from({length:21},(_,i)=>({x:10+i/10,y:20+i/5,z:30+i/4}))}],
    samples:{face:{...sample},pose:{...sample},hands:{...sample}}};
}
it('aligns the associated hand at the pose wrist without changes to source points',()=>{
  const frame=handFrame(),original=structuredClone(frame),aligned=calculatedWristAlignment(frame,'left');
  expect(aligned?.aligned[0]).toEqual(frame.pose[15]);
  expect(aligned?.aligned[1].x).toBeCloseTo(2.1);expect(aligned?.aligned[1].y).toBeCloseTo(3.2);expect(aligned?.aligned[1].z).toBeCloseTo(4.25);
  expect(aligned?.raw).toBe(frame.hands[0].world);expect(frame).toEqual(original);
  expect(calculatedWristAlignment(frame,'right')).toBeNull();
});
it('removes alignment when association is ambiguous or a required sample is absent',()=>{
  const frame=handFrame();frame.hands.push(structuredClone(frame.hands[0]));
  expect(calculatedWristAlignment(frame,'left')).toBeNull();
  for(const task of ['pose','hands']as const){const frame=handFrame();frame.samples[task].present=false;expect(calculatedWristAlignment(frame,'left')).toBeNull();}
});
it('removes alignment for invalid or missing world coordinates',()=>{
  const frame=handFrame();frame.pose[15].z=NaN;expect(calculatedWristAlignment(frame,'left')).toBeNull();
  const missing=handFrame();delete missing.hands[0].world[0];expect(calculatedWristAlignment(missing,'left')).toBeNull();
});
