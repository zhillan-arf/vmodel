import { sha256 } from './model-types';
import type { TrackingTrace } from './tracking-recording';
import type { DiagnosticEnvelope, TrackingTask } from './tracking-diagnostics';
import type { VideoMapping } from './tracking-video';

export function replayVideoTime(trace:TrackingTrace,diagnostics:DiagnosticEnvelope,task:TrackingTask):number|null {
  const mapping=trace.manifest.video,start=trace.manifest.startTimeMs,sample=diagnostics.tasks[task];
  if(!mapping||start===undefined||mapping.traceId!==trace.id||sample.state==='disabled')return null;
  const offset=sample.sampleTimeMs-start;
  return offset<mapping.startOffsetMs||offset>=mapping.stopOffsetMs?null:(offset-mapping.startOffsetMs)/1000;
}
export class ReplayVideo {
  private video:HTMLVideoElement|null=null;
  private url:string|null=null;
  private operation:AbortController|null=null;
  private requested:number|null=null;
  private ready=false;
  get frame(){return this.ready&&this.requested!==null&&this.video&&!this.video.seeking?this.video:null;}
  async load(blob:Blob,mapping:VideoMapping,traceId:string){
    this.clear();
    const operation=this.operation=new AbortController(),signal=operation.signal;
    if(blob.size===0||blob.size>64*1048576)throw new Error('Camera video must contain data and must not exceed 64 MiB.');
    if(mapping.traceId!==traceId)throw new Error('Camera video belongs to another trace.');
    if(mapping.sha256&&await sha256(blob)!==mapping.sha256)throw new Error('Camera video hash does not match this trace.');
    signal.throwIfAborted();
    const video=document.createElement('video');video.muted=true;video.preload='auto';video.playsInline=true;
    this.video=video;this.url=URL.createObjectURL(blob);
    video.onseeked=()=>{this.ready=this.requested!==null&&Math.abs(video.currentTime-this.requested)<.002&&video.readyState>=2;};
    try{
      await new Promise<void>((resolve,reject)=>{
        const timer=setTimeout(()=>finish(new Error('Camera video preparation exceeded 15 seconds.')),15000);
        const abort=()=>finish(signal.reason);
        const finish=(error?:unknown)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);video.onloadeddata=null;video.onerror=null;error?reject(error):resolve();};
        video.onloadeddata=()=>finish();video.onerror=()=>finish(new Error('This camera video cannot be decoded.'));
        signal.addEventListener('abort',abort,{once:true});video.src=this.url!;
      });
      signal.throwIfAborted();
    }catch(error){if(this.operation===operation)this.clear();throw error;}
  }
  seek(seconds:number|null){
    const video=this.video;
    if(!video||seconds===null||!Number.isFinite(seconds)||seconds<0||Number.isFinite(video.duration)&&seconds>=video.duration){this.requested=null;this.ready=false;return;}
    if(this.requested===seconds)return;
    this.requested=seconds;this.ready=false;
    if(Math.abs(video.currentTime-seconds)<.0005&&!video.seeking){this.ready=video.readyState>=2;return;}
    video.currentTime=seconds;
  }
  clear(){
    this.operation?.abort();this.operation=null;this.requested=null;this.ready=false;
    if(this.video){this.video.onseeked=null;this.video.pause();this.video.removeAttribute('src');this.video.load();this.video=null;}
    if(this.url)URL.revokeObjectURL(this.url);this.url=null;
  }
}
