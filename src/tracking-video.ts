export interface VideoMapping {traceId:string;startOffsetMs:number;stopOffsetMs:number;mimeType:string;sha256?:string}
export class DiagnosticVideo {
  private recorder:MediaRecorder|null=null;
  private timer:ReturnType<typeof setTimeout>|undefined;
  get active(){return this.recorder!==null;}
  start(stream:MediaStream,traceId:string,onStop:(blob:Blob,mapping:VideoMapping)=>void,offset:number){
    if(this.recorder)throw new Error('Camera video recording is already active.');
    const type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(value=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(value));
    if(!type)throw new Error('Camera video recording is unavailable. Trace recording remains available.');
    const tracks=stream.getVideoTracks(),started=performance.now();
    const recorder=new MediaRecorder(new MediaStream(tracks),{mimeType:type,videoBitsPerSecond:2000000});
    let chunks:Blob[]=[],size=0;
    const ended=()=>{if(this.recorder===recorder)this.stop();};
    const cleanup=()=>{
      clearTimeout(this.timer);
      for(const track of tracks)track.removeEventListener('ended',ended);
      if(this.recorder===recorder)this.recorder=null;
    };
    this.recorder=recorder;
    recorder.ondataavailable=event=>{
      if(size+event.data.size>64*1048576){this.stop();return;}
      chunks.push(event.data);size+=event.data.size;
    };
    recorder.onstop=()=>{
      cleanup();const blob=new Blob(chunks,{type});chunks=[];
      onStop(blob,{traceId,startOffsetMs:offset,stopOffsetMs:offset+performance.now()-started,mimeType:type});
    };
    recorder.onerror=()=>this.stop();
    for(const track of tracks)track.addEventListener('ended',ended,{once:true});
    try{recorder.start(1000);this.timer=setTimeout(()=>this.stop(),60000);}
    catch(error){cleanup();chunks=[];throw error;}
  }
  stop(){clearTimeout(this.timer);if(this.recorder&&this.recorder.state!=='inactive')this.recorder.stop();}
}
