import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DiagnosticVideo } from '../src/tracking-video';
class Recorder {
  static supported=true;static fail=false;static latest:Recorder;
  static isTypeSupported(){return this.supported;}
  state='inactive';onstop:(()=>void)|null=null;onerror:(()=>void)|null=null;ondataavailable:((event:{data:Blob})=>void)|null=null;
  constructor(readonly stream:{tracks:EventTarget[]}){Recorder.latest=this;}
  start(){if(Recorder.fail)throw new Error('Recorder failed');this.state='recording';}
  stop(){this.state='inactive';this.onstop?.();}
}
beforeEach(()=>{Recorder.supported=true;Recorder.fail=false;vi.useFakeTimers();vi.stubGlobal('MediaRecorder',Recorder);vi.stubGlobal('MediaStream',class {constructor(readonly tracks:EventTarget[]) {}});});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
function setup(){const track=new EventTarget(),audio=new EventTarget(),stream={getVideoTracks:()=>[track],getAudioTracks:()=>[audio]} as unknown as MediaStream;return{track,stream,video:new DiagnosticVideo(),done:vi.fn()};}
it('keeps video unavailable separate from trace recording',()=>{
  Recorder.supported=false;const{video,stream,done}=setup();expect(()=>video.start(stream,'trace',done,0)).toThrow('Trace recording remains available');expect(video.active).toBe(false);
});
it('releases a failed start and permits retry',()=>{
  const{video,stream,done}=setup();Recorder.fail=true;expect(()=>video.start(stream,'trace',done,0)).toThrow('Recorder failed');expect(video.active).toBe(false);
  Recorder.fail=false;video.start(stream,'trace',done,0);expect(video.active).toBe(true);video.stop();
});
it('records video tracks only and stops at 60 seconds',async()=>{
  const{video,stream,track,done}=setup();video.start(stream,'trace',done,15);expect(Recorder.latest.stream.tracks).toEqual([track]);
  Recorder.latest.ondataavailable?.({data:new Blob(['video'])});await vi.advanceTimersByTimeAsync(60000);
  expect(video.active).toBe(false);expect(done).toHaveBeenCalledOnce();expect(done.mock.calls[0][1]).toMatchObject({traceId:'trace',startOffsetMs:15,stopOffsetMs:60015});
});
it.each(['error','camera loss','size']as const)('retains the partial video after %s',async reason=>{
  const{video,stream,track,done}=setup();video.start(stream,'trace',done,0);Recorder.latest.ondataavailable?.({data:new Blob(['partial'])});
  if(reason==='error')Recorder.latest.onerror?.();else if(reason==='camera loss')track.dispatchEvent(new Event('ended'));else{
    const oversize=new Blob(['oversize']);Object.defineProperty(oversize,'size',{value:64*1048576});Recorder.latest.ondataavailable?.({data:oversize});
  }
  expect(video.active).toBe(false);expect(await done.mock.calls[0][0].text()).toBe('partial');
});
it('removes old camera listeners before another recording',()=>{
  const first=setup(),next=new EventTarget();first.video.start(first.stream,'first',first.done,0);first.video.stop();
  first.video.start({getVideoTracks:()=>[next]} as unknown as MediaStream,'next',first.done,0);first.track.dispatchEvent(new Event('ended'));expect(first.video.active).toBe(true);
  next.dispatchEvent(new Event('ended'));expect(first.video.active).toBe(false);
});
