import { motionSample as sample } from './fixtures/tracking-motion';
import { expect, it } from 'vitest';
import { Euler, Matrix4, Quaternion } from 'three';
import { MotionSolver } from '../src/motion-solver';
import { createCanonicalRig } from '../src/canonical-rig';
import { TraceRecorder, importTrace, replayTrace, solverVersion, type ReplayTarget } from '../src/tracking-recording';
import { defaults, type Calibration, type StudioSettings, type TrackingFrame } from '../src/types';
import type { DiagnosticEnvelope, SolverOutcome } from '../src/tracking-diagnostics';

function runner(){
  let rig=createCanonicalRig(),solver=new MotionSolver(rig),settings:StudioSettings={...defaults},calibration:Calibration|null=null,outcomes:SolverOutcome[]=[];
  const target:ReplayTarget={reset:()=>{rig=createCanonicalRig();solver=new MotionSolver(rig);outcomes=[];},settings:value=>{settings=value;},calibration:value=>{calibration=value;solver.setCalibration(value);},sample:()=>{},apply:(frame,dt,now,diagnostics)=>{
    outcomes=[];solver.diagnosticSink=x=>outcomes.push(x);solver.sampleIds=Object.fromEntries(Object.entries(diagnostics.tasks).map(([name,task])=>[name,task.sampleSequence]));solver.update(frame,settings,dt,now);
  }};
  return{target,snapshot:()=>({bones:[...rig.bones].map(([name,bone])=>({name,rotation:bone.quaternion.toArray(),position:bone.position.toArray()})),outcomes:structuredClone(outcomes),settings:structuredClone(settings),calibration:structuredClone(calibration)})};
}
it('matches forward motion, settings, calibration, loss, and backward seeks',async()=>{
  const first=sample(1,0),recorder=new TraceRecorder({runtime:'fixture',modelHashes:first.diagnostics.modelHashes,solverVersion,settings:defaults,calibration:null,rigHashes:[]}),live=runner(),expected=new Map<number,ReturnType<typeof live.snapshot>>();
  let settings:StudioSettings={...defaults},calibration:Calibration|null=null,time=0;
  live.target.reset();live.target.settings(settings);live.target.calibration(calibration);
  for(let i=1;i<=90;i++){
    time+=i===50?800:17;
    if(i===20||i===60){settings={...settings,mode:i===20?'standing':'seated',smoothing:8,hands:i===20};recorder.append({kind:'settings',settings},time);live.target.settings(settings);}
    if(i===30){calibration={version:1,head:new Quaternion().setFromEuler(new Euler(0,.2,0)).toArray(),root:[.6,-.4,0]};recorder.append({kind:'calibration',calibration},time);live.target.calibration(calibration);}
    if(i===40){recorder.append({kind:'reset'},time);live.target.reset();live.target.settings(settings);live.target.calibration(calibration);}
    const data=sample(i,time);if(i%13===0)data.frame.samples.pose.timestamp-=500;
    recorder.append({kind:'sample',...data,reasons:[]},time);
    for(const [offset,dt]of [[2,1/30],[8,1/120]]){
      live.target.apply(data.frame,dt,time+offset,data.diagnostics);
      const snapshot=live.snapshot();recorder.append({kind:'apply',frameSequence:i,solverTimeMs:time+offset,dt,reasons:snapshot.outcomes},time+offset);expected.set(recorder.trace.events.length-1,snapshot);
    }
  }
  const trace=await importTrace(recorder.export()),replay=runner(),before=JSON.stringify(trace);
  for(const index of [trace.events.length-1,2,120,60,trace.events.length-1]){
    const through=[...expected.keys()].filter(key=>key<=index).at(-1)!;
    replayTrace(trace,replay.target,through);const actual=replay.snapshot(),reference=expected.get(through)!;
    expect(actual.outcomes).toEqual(reference.outcomes);expect(actual.settings).toEqual(reference.settings);expect(actual.calibration).toEqual(reference.calibration);
    for(let i=0;i<actual.bones.length;i++){expect(new Quaternion().fromArray(actual.bones[i].rotation).angleTo(new Quaternion().fromArray(reference.bones[i].rotation))).toBeLessThan(.0001);expect(actual.bones[i].position).toEqual(reference.bones[i].position);}
  }
  expect(JSON.stringify(trace)).toBe(before);
  const reasons=[...expected.values()].flatMap(x=>x.outcomes.map(o=>o.reason));for(const reason of ['accepted','clamped','low_visibility','stale','not_detected','disabled_by_mode','disabled_by_setting'])expect(reasons).toContain(reason);
});
it('passes the referenced sample identity to each apply after reset',()=>{
  const a=sample(1,0),b=sample(2,10),recorder=new TraceRecorder({runtime:'fixture',modelHashes:a.diagnostics.modelHashes,solverVersion,settings:defaults,calibration:null,rigHashes:[]});
  recorder.append({kind:'sample',...a,reasons:[]},0);recorder.append({kind:'sample',...b,reasons:[]},10);recorder.append({kind:'reset'},11);recorder.append({kind:'apply',frameSequence:1,solverTimeMs:12,dt:.01},12);
  const seen:number[]=[];replayTrace(recorder.trace,{reset:()=>{},settings:()=>{},calibration:()=>{},sample:()=>{},apply:(_,__,___,diagnostics)=>seen.push(diagnostics.tasks.pose.sampleSequence)});expect(seen).toEqual([1]);
});
