import { expect,it } from 'vitest';
import { replayVideoTime } from '../src/replay-video';
import type { TrackingTrace } from '../src/tracking-recording';
import type { DiagnosticEnvelope } from '../src/tracking-diagnostics';
const trace={id:'trace',manifest:{startTimeMs:1000,video:{traceId:'trace',startOffsetMs:10,stopOffsetMs:1010,mimeType:'video/webm'}}} as TrackingTrace;
function envelope(time:number,state='new'){return{tasks:{pose:{sampleTimeMs:time,state},face:{sampleTimeMs:time+400,state:'new'}}} as DiagnosticEnvelope;}
it('uses the cached task sample time rather than the current capture time',()=>{
  const data=envelope(1210,'cached');data.captureTimeMs=1610;expect(replayVideoTime(trace,data,'pose')).toBe(.2);expect(replayVideoTime(trace,data,'face')).toBe(.6);
});
it.each([[1009,null],[1010,0],[2009,.999],[2010,null]])('checks mapped video coverage at %s ms',(time,expected)=>expect(replayVideoTime(trace,envelope(time!),'pose')).toBe(expected));
it('rejects missing anchors, disabled tasks, and other trace mappings',()=>{
  expect(replayVideoTime({...trace,manifest:{...trace.manifest,startTimeMs:undefined}},envelope(1210),'pose')).toBeNull();
  expect(replayVideoTime(trace,envelope(1210,'disabled'),'pose')).toBeNull();expect(replayVideoTime({...trace,id:'other'},envelope(1210),'pose')).toBeNull();
});
