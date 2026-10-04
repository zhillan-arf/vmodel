import type { Calibration, StudioSettings, TrackingFrame } from './types';
import { normalizeSettings } from './types';
import { validCalibration } from './profiles';
import type { VideoMapping } from './tracking-video';
import type { DiagnosticEnvelope, SolverOutcome } from './tracking-diagnostics';
export const traceLimits={duration:60000,samples:1800,applies:7200,events:10000,bytes:32*1024*1024};
export const solverVersion='motion-solver-1';
export interface TraceManifest {runtime:string;modelHashes:Record<string,string>;solverVersion:string;settings:StudioSettings;calibration:Calibration|null;rigHashes:string[];startTimeMs?:number;video?:VideoMapping}
type EventData = {kind:'sample';frame:TrackingFrame;diagnostics:DiagnosticEnvelope;reasons:SolverOutcome[];references?:Partial<Record<'face'|'pose'|'hands',number>>}|{kind:'apply';frameSequence:number;solverTimeMs:number;dt:number;reasons?:SolverOutcome[]}|{kind:'settings';settings:StudioSettings}|{kind:'calibration';calibration:Calibration|null}|{kind:'reset'};
export type TraceEvent=EventData&{sequence:number;timeMs:number};
export interface TrackingTrace {type:'vmodel-trace';version:1;id:string;manifest:TraceManifest;events:TraceEvent[]}
export class TraceRecorder {
  readonly trace:TrackingTrace;
  private bytes:number;
  private samples=0;
  private applies=0;
  private frames=new Set<number>();
  private identities=new Map<string,number>();
  stoppedReason='';
  constructor(manifest:TraceManifest){this.trace={type:'vmodel-trace',version:1,id:crypto.randomUUID(),manifest:structuredClone(manifest),events:[]};this.bytes=new TextEncoder().encode(JSON.stringify(this.trace)).length;}
  append(event:EventData,timeMs:number):boolean {
    if(this.stoppedReason)return false;
    if(!Number.isFinite(timeMs)||timeMs<0||timeMs<(this.trace.events.at(-1)?.timeMs??0))throw new Error('Invalid trace event time.');
    const reason=this.trace.events.length>=traceLimits.events?'Trace reached 10000 events.':timeMs>traceLimits.duration?'Trace reached 60 seconds.':event.kind==='sample'&&this.samples>=traceLimits.samples?'Trace reached 1800 captures.':event.kind==='apply'&&this.applies>=traceLimits.applies?'Trace reached 7200 apply events.':'';
    if(reason){this.stoppedReason=reason;return false;}
    if(event.kind==='sample'&&this.frames.has(event.frame.sequence))return true;
    const value:TraceEvent={...structuredClone(event),timeMs,sequence:this.trace.events.length};
    if(value.kind==='sample'){
      const references:Partial<Record<'face'|'pose'|'hands',number>>={};
      for(const name of ['face','pose','hands']as const){
        const task=value.diagnostics.tasks[name],key=`${value.diagnostics.sessionId}:${name}:${task.sampleSequence}`;
        const previous=this.identities.get(key);
        if(previous!==undefined&&task.state!=='disabled'){
          references[name]=previous;delete task.observations;
          if(name==='face'){value.frame.face={};value.frame.faceMatrix=null;}
          if(name==='pose'){value.frame.pose=[];value.frame.poseImage=[];}
          if(name==='hands')value.frame.hands=[];
        }
      }
      if(Object.keys(references).length)value.references=references;
    }
    const bytes=new TextEncoder().encode(JSON.stringify(value)).length+1;
    if(this.bytes+bytes>traceLimits.bytes-4096){this.stoppedReason='Trace reached 32 MiB.';return false;}
    this.bytes+=bytes;this.trace.events.push(value);
    if(event.kind==='sample'){this.samples++;this.frames.add(event.frame.sequence);for(const name of ['face','pose','hands']as const){const task=event.diagnostics.tasks[name],key=`${event.diagnostics.sessionId}:${name}:${task.sampleSequence}`;if(!this.identities.has(key))this.identities.set(key,event.frame.sequence);}}if(event.kind==='apply')this.applies++;return true;
  }
  export(){return new Blob([JSON.stringify(this.trace)],{type:'application/json'});}
}
function exact(value:unknown,allowed:string[]):asserts value is Record<string,any>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new Error('Unexpected trace fields.');}
function finiteTree(value:unknown,depth=0,counter={n:0}){if(depth>32||++counter.n>16*1024*1024)throw new Error('Trace data exceeds limits.');if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Invalid trace number.');if(value&&typeof value==='object')for(const child of Object.values(value))finiteTree(child,depth+1,counter);}
function points(value:unknown,limit:number){if(!Array.isArray(value)||value.length>limit)throw new Error('Invalid landmark count.');for(const point of value){exact(point,['x','y','z','visibility','presence']);if(!['x','y','z'].every(key=>typeof point[key]==='number'&&Number.isFinite(point[key])))throw new Error('Invalid landmark.');for(const key of ['visibility','presence'])if(point[key]!==undefined&&(typeof point[key]!=='number'||!Number.isFinite(point[key])))throw new Error('Invalid landmark confidence.');}}
function validateFrame(frame:unknown):asserts frame is TrackingFrame {
  exact(frame,['version','sequence','timestamp','inputSize','face','faceMatrix','pose','poseImage','hands','inferenceMs','samples']);
  if(frame.version!==1||(!Number.isSafeInteger(frame.sequence)||frame.sequence<0)||!Number.isFinite(frame.timestamp)||!Number.isFinite(frame.inferenceMs))throw new Error('Invalid trace frame.');
  if(frame.inputSize!==undefined){exact(frame.inputSize,['width','height']);if(![frame.inputSize.width,frame.inputSize.height].every(x=>Number.isSafeInteger(x)&&x>0&&x<=16384))throw new Error('Invalid frame dimensions.');}
  points(frame.pose,33);points(frame.poseImage,33);
  if(!Array.isArray(frame.hands)||frame.hands.length>2)throw new Error('Invalid hand count.');
  for(const hand of frame.hands){exact(hand,['side','landmarks','world','score']);points(hand.landmarks,21);points(hand.world,21);if(typeof hand.side!=='string'||!Number.isFinite(hand.score))throw new Error('Invalid hand observation.');}
  if(frame.faceMatrix!==null&&(!Array.isArray(frame.faceMatrix)||frame.faceMatrix.length!==16||frame.faceMatrix.some((x:unknown)=>typeof x!=='number')))throw new Error('Invalid face matrix.');
  if(!frame.face||typeof frame.face!=='object'||Array.isArray(frame.face)||Object.keys(frame.face).length>64||Object.values(frame.face).some(x=>typeof x!=='number'))throw new Error('Invalid face coefficients.');
  exact(frame.samples,['face','pose','hands']);for(const task of ['face','pose','hands']){exact(frame.samples[task],['timestamp','inferenceMs','present']);if(!Number.isFinite(frame.samples[task].timestamp)||!Number.isFinite(frame.samples[task].inferenceMs)||typeof frame.samples[task].present!=='boolean')throw new Error('Invalid tracking sample.');}
}
function validateDiagnostics(value:unknown){
  exact(value,['version','sessionId','captureSequence','captureTimeMs','videoTimeMs','inputSize','runtimeVersion','modelHashes','delegate','tasks','receivedAtMs','solverUseTimeMs','displayTimeMs']);
  if(value.version!==1||typeof value.sessionId!=='string'||value.sessionId.length>128||typeof value.runtimeVersion!=='string'||value.runtimeVersion.length>128||!['GPU','CPU'].includes(value.delegate))throw new Error('Invalid diagnostics.');
  if(!Number.isSafeInteger(value.captureSequence)||value.captureSequence<0)throw new Error('Invalid capture sequence.');
  for(const key of ['receivedAtMs','solverUseTimeMs','displayTimeMs'])if(value[key]!==undefined&&!Number.isFinite(value[key]))throw new Error('Invalid diagnostic time.');
  for(const key of ['captureSequence','captureTimeMs','videoTimeMs'])if(!Number.isFinite(value[key]))throw new Error('Invalid diagnostic time.');
  exact(value.inputSize,['width','height']);if(![value.inputSize.width,value.inputSize.height].every(x=>Number.isSafeInteger(x)&&x>0&&x<=16384))throw new Error('Invalid input dimensions.');
  exact(value.modelHashes,['face','pose','hands']);for(const hash of ['face','pose','hands'].map(name=>value.modelHashes[name]))if(typeof hash!=='string'||!/^([a-f0-9]{64})$/.test(hash))throw new Error('Invalid tracking model hash.');
  exact(value.tasks,['face','pose','hands']);
  for(const name of ['face','pose','hands']){const task=value.tasks[name];exact(task,['sampleSequence','captureSequence','sampleTimeMs','startedAtMs','finishedAtMs','state','present','observations']);if(!['new','cached','disabled','error'].includes(task.state)||!Number.isSafeInteger(task.sampleSequence)||!Number.isSafeInteger(task.captureSequence)||task.sampleSequence<0||task.captureSequence<0)throw new Error('Invalid task diagnostic.');for(const key of ['sampleTimeMs','startedAtMs','finishedAtMs'])if(!Number.isFinite(task[key]))throw new Error('Invalid task time.');if(task.finishedAtMs<task.startedAtMs)throw new Error('Invalid task duration.');if(typeof task.present!=='boolean')throw new Error('Invalid task presence.');if(task.observations!==undefined){if(!Array.isArray(task.observations)||task.observations.length>2)throw new Error('Invalid diagnostic observations.');for(const array of task.observations)points(array,name==='face'?478:name==='pose'?33:21);}}
}
function validateSettings(value:unknown){
  const normalized=normalizeSettings(value);exact(value,Object.keys(normalized));
  if(Object.keys(value).length!==Object.keys(normalized).length||Object.entries(normalized).some(([key,expected])=>value[key]!==expected))throw new Error('Invalid trace settings.');
}
function validateCalibration(value:unknown){if(value===null)return;exact(value,['version','head','root']);if(!validCalibration(value))throw new Error('Invalid trace calibration.');}
function validateReasons(value:unknown){
  if(!Array.isArray(value)||value.length>512)throw new Error('Invalid solver reasons.');
  const reasons=['accepted','not_detected','missing_landmark','invalid_value','low_visibility','low_presence','stale','future_sample','disabled_by_mode','disabled_by_setting','ambiguous_hand','hand_distance','hand_score','missing_bone','degenerate_segment','invalid_rest','invalid_parameter','fully_folded','plane_jump','palm_edge_on','clamped'];
  for(const reason of value){exact(reason,['stage','channel','reason','accepted','sampleId','jointIndex','value','threshold','defaultApplied']);if(!reasons.includes(reason.reason)||typeof reason.accepted!=='boolean'||typeof reason.stage!=='string'||typeof reason.channel!=='string'||reason.stage.length>80||reason.channel.length>80)throw new Error('Invalid solver reason.');for(const key of ['sampleId','jointIndex'])if(reason[key]!==undefined&&(!Number.isSafeInteger(reason[key])||reason[key]<0))throw new Error('Invalid solver reference.');for(const key of ['value','threshold','defaultApplied'])if(reason[key]!==undefined&&!Number.isFinite(reason[key]))throw new Error('Invalid solver measurement.');}
}
export async function importTrace(blob:Blob):Promise<TrackingTrace>{
  if(blob.size>traceLimits.bytes)throw new Error('Trace exceeds 32 MiB.');
  const value:unknown=JSON.parse(await blob.text());finiteTree(value);exact(value,['type','version','id','manifest','events']);
  if(value.type!=='vmodel-trace'||value.version!==1||typeof value.id!=='string'||!Array.isArray(value.events)||value.events.length>traceLimits.events)throw new Error('Unsupported trace format.');
  exact(value.manifest,['runtime','modelHashes','solverVersion','settings','calibration','rigHashes','startTimeMs','video']);
  if(value.manifest.video!==undefined){exact(value.manifest.video,['traceId','startOffsetMs','stopOffsetMs','mimeType','sha256']);const video=value.manifest.video;if(video.traceId!==value.id||!Number.isFinite(video.startOffsetMs)||!Number.isFinite(video.stopOffsetMs)||video.startOffsetMs<0||video.stopOffsetMs<video.startOffsetMs||video.stopOffsetMs-video.startOffsetMs>61000||typeof video.mimeType!=='string')throw new Error('Invalid video timing.');}
  if(value.manifest.startTimeMs!==undefined&&(!Number.isFinite(value.manifest.startTimeMs)||value.manifest.startTimeMs<0))throw new Error('Invalid trace start time.');
  if(value.manifest.video?.sha256!==undefined&&(typeof value.manifest.video.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.manifest.video.sha256)))throw new Error('Invalid video hash.');
  validateSettings(value.manifest.settings);validateCalibration(value.manifest.calibration);
  if(typeof value.manifest.runtime!=='string'||typeof value.manifest.solverVersion!=='string'||!Array.isArray(value.manifest.rigHashes)||value.manifest.rigHashes.length>3)throw new Error('Invalid trace manifest.');
  exact(value.manifest.modelHashes,['face','pose','hands']);
  for(const hash of [...['face','pose','hands'].map(name=>value.manifest.modelHashes[name]),...value.manifest.rigHashes])if(typeof hash!=='string'||!/^([a-f0-9]{64})$/.test(hash))throw new Error('Invalid manifest hash.');
  if(value.manifest.settings?.version!==1||value.manifest.calibration!==null&&!validCalibration(value.manifest.calibration))throw new Error('Invalid trace initial state.');
  let time=0,samples=0,applies=0;const frames=new Map<number,Extract<TraceEvent,{kind:'sample'}>>();
  for(const [index,event]of value.events.entries()){
    const keys:Record<string,string[]>={sample:['frame','diagnostics','reasons','references'],apply:['frameSequence','solverTimeMs','dt','reasons'],settings:['settings'],calibration:['calibration'],reset:[]};
    if(!keys[event.kind])throw new Error('Unknown trace event.');exact(event,['kind','sequence','timeMs',...keys[event.kind]]);
    if(event.sequence!==index||!Number.isFinite(event.timeMs)||event.timeMs<time||event.timeMs>traceLimits.duration)throw new Error('Invalid trace event order.');time=event.timeMs;
    if(event.kind==='sample'){
      validateFrame(event.frame);validateDiagnostics(event.diagnostics);
      if(frames.has(event.frame.sequence)||++samples>traceLimits.samples)throw new Error('Duplicate or excessive samples.');
      for(const name of ['face','pose','hands'])if(event.diagnostics.modelHashes[name]!==value.manifest.modelHashes[name])throw new Error('Tracking model hash changed.');
      if(event.references){
        exact(event.references,['face','pose','hands']);
        for(const [name,reference]of Object.entries(event.references)){
          const previous=frames.get(reference as number),task=event.diagnostics.tasks[name];
          if(!previous)throw new Error('Missing task sample reference.');
          const source=previous.diagnostics.tasks[name as 'face'|'pose'|'hands'];
          if(event.diagnostics.sessionId!==previous.diagnostics.sessionId||task.state==='disabled'||
            ['sampleSequence','captureSequence','sampleTimeMs','startedAtMs','finishedAtMs','present'].some(key=>task[key]!==source[key as keyof typeof source]))throw new Error('Task reference has a different identity.');
          const raw=event.frame;
          if(task.observations!==undefined||(name==='face'&&(Object.keys(raw.face).length||raw.faceMatrix!==null))||
            (name==='pose'&&(raw.pose.length||raw.poseImage.length))||(name==='hands'&&raw.hands.length))throw new Error('Task reference contains repeated observations.');
        }
      }
      frames.set(event.frame.sequence,event as Extract<TraceEvent,{kind:'sample'}>);validateReasons(event.reasons);
    }
    if(event.kind==='apply'&&event.reasons)validateReasons(event.reasons);
    if(event.kind==='apply'&&(!frames.has(event.frameSequence)||++applies>traceLimits.applies||!Number.isFinite(event.solverTimeMs)||!Number.isFinite(event.dt)||event.dt<0||event.dt>0.1))throw new Error('Invalid apply event.');
    if(event.kind==='settings'){validateSettings(event.settings);if(event.settings?.version!==1)throw new Error('Invalid trace settings.');event.settings=normalizeSettings(event.settings);}
    if(event.kind==='calibration')validateCalibration(event.calibration);
  }
  return value as unknown as TrackingTrace;
}
export interface ReplayTarget {reset():void;settings(settings:StudioSettings):void;calibration(calibration:Calibration|null):void;sample(frame:TrackingFrame,diagnostics:DiagnosticEnvelope):void;apply(frame:TrackingFrame,dt:number,now:number,diagnostics:DiagnosticEnvelope):void}
export function materializeSample(event:Extract<TraceEvent,{kind:'sample'}>,frames:Map<number,TrackingFrame>):TrackingFrame{
  const frame={...event.frame};
  for(const name of ['face','pose','hands']as const){const reference=event.references?.[name];if(reference===undefined)continue;const previous=frames.get(reference);if(!previous)throw new Error('Missing task sample reference.');
    if(name==='face'){frame.face=previous.face;frame.faceMatrix=previous.faceMatrix;}
    if(name==='pose'){frame.pose=previous.pose;frame.poseImage=previous.poseImage;}
    if(name==='hands')frame.hands=previous.hands;
  }
  return frame;
}
export function replayTrace(trace:TrackingTrace,target:ReplayTarget,through=trace.events.length-1){
  let settings=structuredClone(trace.manifest.settings),calibration=structuredClone(trace.manifest.calibration);
  const reset=()=>{target.reset();target.settings(structuredClone(settings));target.calibration(structuredClone(calibration));};
  reset();
  const frames=new Map<number,TrackingFrame>(),diagnostics=new Map<number,DiagnosticEnvelope>();
  for(const event of trace.events){if(event.sequence>through)break;
    if(event.kind==='sample'){
      const frame=materializeSample(event,frames),envelope=structuredClone(event.diagnostics);
      for(const name of ['face','pose','hands']as const){const reference=event.references?.[name];if(reference!==undefined){const observations=diagnostics.get(reference)?.tasks[name].observations;if(observations)envelope.tasks[name].observations=observations;}}
      frames.set(frame.sequence,frame);diagnostics.set(frame.sequence,envelope);target.sample(frame,envelope);
    }
    else if(event.kind==='apply')target.apply(frames.get(event.frameSequence)!,event.dt,event.solverTimeMs,diagnostics.get(event.frameSequence)!);
    else if(event.kind==='settings'){settings=structuredClone(event.settings);target.settings(settings);}
    else if(event.kind==='calibration'){calibration=structuredClone(event.calibration);target.calibration(calibration);}
    else reset();
  }
}
