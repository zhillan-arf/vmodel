import {it,expect} from 'vitest';
import {TraceRecorder,importTrace,replayTrace,solverVersion} from '../src/tracking-recording';
import {defaults,type TrackingFrame} from '../src/types';
import {createCanonicalRig} from '../src/canonical-rig';
import {MotionSolver} from '../src/motion-solver';
import type {DiagnosticEnvelope} from '../src/tracking-diagnostics';
const frame:TrackingFrame={version:1,sequence:1,timestamp:0,face:{},faceMatrix:null,pose:[],poseImage:[],hands:[],inferenceMs:1,samples:{face:{timestamp:0,inferenceMs:1,present:false},pose:{timestamp:0,inferenceMs:0,present:false},hands:{timestamp:0,inferenceMs:0,present:false}}};
const task={sampleSequence:1,captureSequence:1,sampleTimeMs:0,startedAtMs:0,finishedAtMs:1,state:'new' as const,present:false};
const diagnostic:DiagnosticEnvelope={version:1,sessionId:'synthetic',captureSequence:1,captureTimeMs:0,videoTimeMs:0,inputSize:{width:640,height:480},runtimeVersion:'test',modelHashes:{face:'a'.repeat(64),pose:'b'.repeat(64),hands:'c'.repeat(64)},delegate:'CPU',tasks:{face:{...task},pose:{...task},hands:{...task}}};
function record(){const recorder=new TraceRecorder({runtime:'test',modelHashes:diagnostic.modelHashes,solverVersion,settings:defaults,calibration:null,rigHashes:[]});recorder.append({kind:'sample',frame,diagnostics:diagnostic,reasons:[]},0);recorder.append({kind:'apply',frameSequence:1,solverTimeMs:10,dt:1/60},10);return recorder;}
it('retains a valid prefix at a duration limit',async()=>{const recorder=record();expect(recorder.append({kind:'reset'},60001)).toBe(false);expect(recorder.stoppedReason).toContain('60 seconds');expect((await importTrace(recorder.export())).events).toHaveLength(2);});
it('rejects missing references and unexpected fields',async()=>{const trace=record().trace;(trace.events[1]as any).frameSequence=99;await expect(importTrace(new Blob([JSON.stringify(trace)]))).rejects.toThrow('apply');(trace.events[1]as any).frameSequence=1;(trace.events[0]as any).deviceId='private';await expect(importTrace(new Blob([JSON.stringify(trace)]))).rejects.toThrow('fields');});
it('replays from reset with identical canonical rotations and reasons',()=>{const trace=record().trace;const run=()=>{let rig=createCanonicalRig(),solver=new MotionSolver(rig);const reasons:string[]=[];replayTrace(trace,{reset:()=>{rig=createCanonicalRig();solver=new MotionSolver(rig);solver.diagnosticSink=x=>reasons.push(x.reason);},settings:()=>{},calibration:x=>solver.setCalibration(x),sample:()=>{},apply:(frame,dt,now)=>solver.update(frame,defaults,dt,now)});return{rotations:[...rig.bones.values()].map(x=>x.quaternion.toArray()),reasons};};expect(run()).toEqual(run());});
it('stores cached task arrays once and reconstructs them for replay',async()=>{
  const recorder=record(),first=recorder.trace.events[0];if(first.kind!=='sample')throw new Error('fixture');
  first.frame.pose=[{x:1,y:2,z:3}];
  const next=structuredClone(frame);next.sequence=2;next.timestamp=20;next.pose=[{x:1,y:2,z:3}];
  const diagnosticNext=structuredClone(diagnostic);diagnosticNext.captureSequence=2;diagnosticNext.tasks.face.sampleSequence=2;diagnosticNext.tasks.pose.state='cached';
  recorder.append({kind:'sample',frame:next,diagnostics:diagnosticNext,reasons:[]},20);
  recorder.append({kind:'apply',frameSequence:2,solverTimeMs:21,dt:1/60},21);
  const sample=recorder.trace.events[2];if(sample.kind!=='sample')throw new Error('fixture');expect(sample.references?.pose).toBe(1);expect(sample.frame.pose).toEqual([]);
  const trace=await importTrace(recorder.export());const lengths:number[]=[];
  replayTrace(trace,{reset:()=>{},settings:()=>{},calibration:()=>{},sample:frame=>lengths.push(frame.pose.length),apply:()=>{}});expect(lengths).toEqual([1,1]);
});
it('rejects unknown reasons and invalid diagnostic dimensions',async()=>{const trace=record().trace;const sample=trace.events[0];if(sample.kind!=='sample')throw new Error('fixture');sample.reasons=[{stage:'solver',channel:'head',reason:'invented' as any,accepted:false}];await expect(importTrace(new Blob([JSON.stringify(trace)]))).rejects.toThrow('reason');sample.reasons=[];sample.diagnostics.inputSize.width=0;await expect(importTrace(new Blob([JSON.stringify(trace)]))).rejects.toThrow('dimensions');});
it('restores cached face observations without changing stored events',async()=>{
  const recorder=record(),first=recorder.trace.events[0];if(first.kind!=='sample')throw new Error('fixture');
  first.diagnostics.tasks.face.observations=[[{x:.2,y:.3,z:.4}]];
  const next=structuredClone(diagnostic);next.captureSequence=2;next.tasks.face.state='cached';
  recorder.append({kind:'sample',frame:{...frame,sequence:2},diagnostics:next,reasons:[]},20);
  const trace=await importTrace(recorder.export()),before=JSON.stringify(trace),observations:unknown[]=[];
  replayTrace(trace,{reset:()=>{},settings:()=>{},calibration:()=>{},sample:(_,data)=>observations.push(data.tasks.face.observations),apply:()=>{}});
  expect(observations[1]).toEqual(observations[0]);expect(JSON.stringify(trace)).toBe(before);
});
it.each([
  ['manifest hash',(t:any)=>{t.manifest.modelHashes.pose='wrong';}],
  ['missing model hash',(t:any)=>{delete t.manifest.modelHashes.hands;}],
  ['rig hash',(t:any)=>{t.manifest.rigHashes=['wrong'];}],
  ['capture sequence',(t:any)=>{t.events[0].diagnostics.captureSequence=-1;}],
  ['task sequence',(t:any)=>{t.events[0].diagnostics.tasks.pose.sampleSequence=-1;}],
  ['task duration',(t:any)=>{t.events[0].diagnostics.tasks.pose.finishedAtMs=-1;}],
  ['model mismatch',(t:any)=>{t.events[0].diagnostics.modelHashes.pose='d'.repeat(64);}],
  ['confidence type',(t:any)=>{t.events[0].frame.pose=[{x:0,y:0,z:0,presence:'high'}];}],
  ['face array',(t:any)=>{t.events[0].frame.face=[];}],
  ['missing hash',(t:any)=>{delete t.events[0].diagnostics.modelHashes.face;}],
  ['optional time',(t:any)=>{t.events[0].diagnostics.displayTimeMs='now';}],
  ['reference identity',(t:any)=>{t.events[2].diagnostics.tasks.pose.sampleSequence=8;}],
  ['reference session',(t:any)=>{t.events[2].diagnostics.sessionId='other';}],
  ['reference raw data',(t:any)=>{t.events[2].frame.pose=[{x:0,y:0,z:0}];}],
  ['reference observations',(t:any)=>{t.events[2].diagnostics.tasks.face.observations=[];}],
]as const)('rejects malformed %s',async(_,change)=>{
  const recorder=record();recorder.append({kind:'sample',frame:{...frame,sequence:2},diagnostics:{...structuredClone(diagnostic),captureSequence:2},reasons:[]},20);
  change(recorder.trace);await expect(importTrace(recorder.export())).rejects.toThrow();
});
it.each(['samples','applies','events']as const)('retains an importable prefix at the %s limit',async limit=>{
  const recorder=record();
  const count=limit==='samples'?1800:limit==='applies'?7200:10000;
  for(let i=1;i<=count;i++){
    const event=limit==='samples'?{kind:'sample' as const,frame:{...frame,sequence:i+1},diagnostics:{...structuredClone(diagnostic),captureSequence:i+1},reasons:[]}:
      limit==='applies'?{kind:'apply' as const,frameSequence:1,solverTimeMs:10+i,dt:1/60}:{kind:'reset' as const};
    if(!recorder.append(event,10+i))break;
  }
  expect(recorder.stoppedReason).toContain(String(count));
  const imported=await importTrace(recorder.export());
  expect(limit==='events'?imported.events.length:imported.events.filter(x=>x.kind===(limit==='samples'?'sample':'apply')).length).toBe(count);
});
it('deduplicates a repeated earlier capture',async()=>{
  const recorder=record();recorder.append({kind:'sample',frame:{...frame,sequence:2},diagnostics:{...structuredClone(diagnostic),captureSequence:2},reasons:[]},20);
  recorder.append({kind:'sample',frame,diagnostics:diagnostic,reasons:[]},21);
  expect((await importTrace(recorder.export())).events.filter(x=>x.kind==='sample')).toHaveLength(2);
});
it('retains an importable prefix below 32 MiB',async()=>{
  const recorder=record();
  const observations=[Array.from({length:478},()=>({x:.1234567890123456,y:.2345678901234567,z:.3456789012345678,visibility:.9876543210987654,presence:.8765432109876543}))];
  for(let i=2;i<=1801;i++){
    const data=structuredClone(diagnostic);data.captureSequence=i;
    for(const task of Object.values(data.tasks)){task.sampleSequence=i;task.captureSequence=i;}
    data.tasks.face.observations=observations;
    if(!recorder.append({kind:'sample',frame:{...frame,sequence:i},diagnostics:data,reasons:[]},i*10))break;
  }
  expect(recorder.stoppedReason).toContain('32 MiB');expect(recorder.export().size).toBeLessThanOrEqual(32*1048576);
  expect((await importTrace(recorder.export())).events.length).toBeGreaterThan(2);
},20000);
it('restores current settings and calibration after a reset and backward seek',()=>{
  const recorder=record(),settings={...defaults,smoothing:8},calibration={version:1 as const,head:[0,0,0,1],root:[.6,-.4,0]};
  recorder.append({kind:'settings',settings},20);recorder.append({kind:'calibration',calibration},21);recorder.append({kind:'reset'},22);
  recorder.append({kind:'apply',frameSequence:1,solverTimeMs:30,dt:1/60},30);
  let activeSettings=defaults,activeCalibration:unknown=null,applied:unknown[]=[];
  const target={reset:()=>{activeSettings=defaults;activeCalibration=null;applied=[];},settings:(value:typeof defaults)=>{activeSettings=value;},calibration:(value:unknown)=>{activeCalibration=value;},sample:()=>{},apply:()=>{applied.push({settings:activeSettings,calibration:activeCalibration});}};
  replayTrace(recorder.trace,target);const forward=structuredClone(applied);
  expect(forward).toEqual([{settings,calibration}]);replayTrace(recorder.trace,target,1);expect(applied).toEqual([{settings:defaults,calibration:null}]);
  replayTrace(recorder.trace,target);expect(applied).toEqual(forward);
});
it.each(['start','hash','null']as const)('rejects invalid video metadata: %s',async kind=>{
  const recorder=record();
  recorder.trace.manifest.video={traceId:recorder.trace.id,startOffsetMs:0,stopOffsetMs:1000,mimeType:'video/webm'};
  if(kind==='start')recorder.trace.manifest.startTimeMs=-1;
  if(kind==='hash')(recorder.trace.manifest.video as any).sha256=['a'.repeat(64)];
  if(kind==='null')(recorder.trace.manifest as any).video=null;
  await expect(importTrace(recorder.export())).rejects.toThrow();
});
