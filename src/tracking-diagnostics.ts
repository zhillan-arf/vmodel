import type { Landmark } from './types';
export type DiagnosticDemand = 'off' | 'inspect' | 'record';
export type TrackingTask = 'face' | 'pose' | 'hands';
export interface TaskDiagnostic {
  sampleSequence: number; captureSequence: number; sampleTimeMs: number; startedAtMs: number; finishedAtMs: number;
  state: 'new' | 'cached' | 'disabled' | 'error'; present: boolean;
  observations?: Landmark[][];
}
export interface DiagnosticEnvelope {
  version: 1; sessionId: string; captureSequence: number; captureTimeMs: number; videoTimeMs: number;
  inputSize: {width:number;height:number}; runtimeVersion: string; modelHashes: Record<TrackingTask,string>;
  delegate: 'GPU'|'CPU'; tasks: Record<TrackingTask,TaskDiagnostic>;
  receivedAtMs?: number; solverUseTimeMs?: number; displayTimeMs?: number;
}
export type SolverReason = 'accepted'|'not_detected'|'missing_landmark'|'invalid_value'|'low_visibility'|'low_presence'|'stale'|'future_sample'|'disabled_by_mode'|'disabled_by_setting'|'ambiguous_hand'|'hand_distance'|'hand_score'|'missing_bone'|'degenerate_segment'|'invalid_rest'|'invalid_parameter'|'fully_folded'|'plane_jump'|'palm_edge_on'|'clamped'|'held'|'decaying'|'cached';
export interface SolverOutcome { stage:string; channel:string; reason:SolverReason; accepted:boolean; sampleId?:number; jointIndex?:number; value?:number; threshold?:number; defaultApplied?:number }
export type DiagnosticSink = (outcome: SolverOutcome) => void;
export const clockTime = (anchor:number) => performance.timeOrigin + performance.now() - anchor;
export function freshnessReason(timestamp:number, now:number): SolverReason | null {
  if(!Number.isFinite(timestamp)||!Number.isFinite(now))return 'invalid_value';
  const age=now-timestamp;return age < -50 ? 'future_sample' : age >= 500 ? 'stale' : null;
}
export const confidenceAdapterVersion = 'task-confidence-2';
export function landmarkReason(point?:Landmark, task:TrackingTask='pose'): SolverReason | null {
  if(!point)return 'missing_landmark';
  if(!Number.isFinite(point.x+point.y+point.z))return 'invalid_value';
  // Hand landmarks have no measured visibility or presence in Tasks Vision.
  // Keep raw SDK fields in traces. Hand assignment checks the hand score.
  if(task==='hands')return null;
  if(!((point.visibility??1)>0.55))return 'low_visibility';
  if(!((point.presence??1)>0.55))return 'low_presence';
  return null;
}
export function percentile(values:readonly number[], fraction:number):number|null {
  if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*fraction)-1)];
}
export class DiagnosticMetrics {
  private samples: Record<TrackingTask,{id:number;time:number;age:number;warmup:boolean;present:boolean;inferenceMs:number}[]>={face:[],pose:[],hands:[]};
  private highest: Record<TrackingTask,number>={face:0,pose:0,hands:0};
  private uses: {time:number;keys:string[]}[]=[];
  private session='';
  private latestTime=0;
  private capture=0;
  private expire(now:number) {
    this.latestTime=Math.max(this.latestTime,now);
    for(const list of Object.values(this.samples))while(list.length&&list[0].time<this.latestTime-10000)list.shift();
    while(this.uses.length&&this.uses[0].time<this.latestTime-10000)this.uses.shift();
  }
  add(envelope:DiagnosticEnvelope, now:number) {
    if(envelope.sessionId!==this.session){
      this.session=envelope.sessionId;this.samples={face:[],pose:[],hands:[]};
      this.highest={face:0,pose:0,hands:0};this.uses=[];this.latestTime=0;this.capture=0;
    }
    if(envelope.captureSequence<=this.capture||now<this.latestTime)return;
    this.capture=envelope.captureSequence;this.expire(now);
    for(const task of ['face','pose','hands'] as const){
      const sample=envelope.tasks[task],list=this.samples[task];
      if(sample.state==='new'&&sample.sampleSequence>this.highest[task]){
        this.highest[task]=sample.sampleSequence;
        list.push({id:sample.sampleSequence,time:now,age:now-sample.sampleTimeMs,warmup:sample.sampleTimeMs<10000,present:sample.present,inferenceMs:sample.finishedAtMs-sample.startedAtMs});
      }
      if(list.length>1000)list.shift();
    }
  }
  recordUse(outcomes:readonly SolverOutcome[],now:number){
    if(now<this.latestTime)return;
    this.expire(now);
    const keys=[...new Set(outcomes.filter(x=>x.stage!=='application'&&!x.accepted&&x.sampleId!==undefined&&Number.isSafeInteger(x.sampleId)&&x.sampleId>0).map(x=>`${x.channel}:${x.sampleId}`))];
    if(keys.length)this.uses.push({time:now,keys});
    if(this.uses.length>7200)this.uses.shift();
  }
  rejections(now=this.latestTime){
    this.expire(now);
    return{uses:this.uses.reduce((sum,event)=>sum+event.keys.length,0),uniqueSamples:new Set(this.uses.flatMap(event=>event.keys)).size};
  }
  summary(task:TrackingTask,now=this.latestTime){
    this.expire(now);
    const describe=(list:typeof this.samples[TrackingTask])=>{
      const duration=list.length>1?list.at(-1)!.time-list[0].time:0;
      return{detected:list.filter(x=>x.present).length,inferenceP50:percentile(list.map(x=>x.inferenceMs),.5),inferenceP95:percentile(list.map(x=>x.inferenceMs),.95),count:list.length,durationMs:duration,hz:duration>0?(list.length-1)*1000/duration:null,p50:percentile(list.map(x=>x.age),.5),p95:percentile(list.map(x=>x.age),.95)};
    };
    const list=this.samples[task];
    return{...describe(list),warmup:describe(list.filter(x=>x.warmup)),steady:describe(list.filter(x=>!x.warmup))};
  }
}
export class MatchedImages {
  private images=new Map<number,ImageBitmap>();
  retain(capture:number,image:ImageBitmap,envelope:DiagnosticEnvelope){
    this.images.get(capture)?.close();this.images.set(capture,image);
    const used=new Set(Object.values(envelope.tasks).filter(x=>x.state!=='disabled').map(x=>x.captureSequence));
    for(const [id,bitmap]of this.images)if(!used.has(id)){bitmap.close();this.images.delete(id);}
  }
  get(task:TaskDiagnostic){return this.images.get(task.captureSequence);}
  clear(){for(const image of this.images.values())image.close();this.images.clear();}
}
