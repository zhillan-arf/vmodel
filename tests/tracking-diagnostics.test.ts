import {it,expect} from 'vitest';
import {DiagnosticMetrics,freshnessReason,landmarkReason,percentile,MatchedImages,type DiagnosticEnvelope} from '../src/tracking-diagnostics';
import {solveLimbWorld} from '../src/limb-solver';
import {Quaternion,Vector3} from 'three';
export function envelope(sequence=1,time=0):DiagnosticEnvelope{const task={sampleSequence:sequence,captureSequence:sequence,sampleTimeMs:time,startedAtMs:time,finishedAtMs:time+5,state:'new' as const,present:true};return{version:1,sessionId:'test',captureSequence:sequence,captureTimeMs:time,videoTimeMs:time,inputSize:{width:640,height:480},runtimeVersion:'test',modelHashes:{face:'a'.repeat(64),pose:'b'.repeat(64),hands:'c'.repeat(64)},delegate:'CPU',tasks:{face:{...task},pose:{...task},hands:{...task}}};}
it.each([[-51,'future_sample'],[-50,null],[499,null],[500,'stale']]as const)('preserves freshness at %s ms',(age,reason)=>expect(freshnessReason(1000,1000+age)).toBe(reason));
it('counts distinct samples and resets metrics for a new session',()=>{const metrics=new DiagnosticMetrics();metrics.add(envelope(),10);const cached=envelope();cached.tasks.pose.state='cached';metrics.add(cached,20);metrics.add(envelope(2,100),110);expect(metrics.summary('pose').count).toBe(2);expect(metrics.summary('pose').hz).toBe(10);const restart=envelope();restart.sessionId='restart';metrics.add(restart,0);expect(metrics.summary('pose').hz).toBe(null);});
it('preserves absent confidence and uses exact runtime boundaries',()=>{const p={x:0,y:0,z:0};expect(landmarkReason(p)).toBe(null);expect(p).not.toHaveProperty('visibility');expect(landmarkReason({...p,visibility:.55})).toBe('low_visibility');expect(landmarkReason({...p,presence:.55})).toBe('low_presence');expect(percentile([4,1,3,2],.5)).toBe(2);});
it('closes superseded images and retains cached task images',()=>{const closed:number[]=[];const images=new MatchedImages();const first=envelope();images.retain(1,{width:1,height:1,close:()=>closed.push(1)}as ImageBitmap,first);const next=envelope(2);next.tasks.pose.captureSequence=1;images.retain(2,{width:1,height:1,close:()=>closed.push(2)}as ImageBitmap,next);expect(closed).toEqual([]);images.retain(3,{width:1,height:1,close:()=>closed.push(3)}as ImageBitmap,envelope(3));expect(closed).toEqual([1,2]);images.clear();expect(closed).toEqual([1,2,3]);});
it('reports the folded branch without changing a valid rotation',()=>{const start=new Vector3(),joint=new Vector3(1,0,0),end=new Vector3(1,1,0),rest={upperDirection:new Vector3(1,0,0),lowerDirection:new Vector3(1,0,0),upperWorld:new Quaternion(),lowerWorld:new Quaternion(),bendNormal:new Vector3(0,0,1)};const reasons:string[]=[];const plain=solveLimbWorld(start,joint,end,rest)!,diagnosed=solveLimbWorld(start,joint,end,rest,{diagnostic:r=>reasons.push(r)})!;expect(plain.upperWorld.angleTo(diagnosed.upperWorld)).toBeLessThan(.0001);expect(plain.lowerWorld.angleTo(diagnosed.lowerWorld)).toBeLessThan(.0001);expect(solveLimbWorld(start,joint,start,rest,{diagnostic:r=>reasons.push(r)})).toBeNull();expect(reasons).toContain('fully_folded');});

it('expires stopped sample rates and does not recount old sample identities',()=>{
  const metrics=new DiagnosticMetrics();metrics.add(envelope(1,0),10);metrics.add(envelope(2,100),110);
  expect(metrics.summary('pose',10111).count).toBe(0);
  const duplicate=envelope(2,100);duplicate.captureSequence=3;metrics.add(duplicate,10112);
  expect(metrics.summary('pose').count).toBe(0);
});
it('ignores older captures and separates the warm-up boundary',()=>{
  const metrics=new DiagnosticMetrics();metrics.add(envelope(1,9999),10000);metrics.add(envelope(2,10000),10001);
  metrics.add(envelope(1,9999),10002);
  const summary=metrics.summary('pose');
  expect(summary.count).toBe(2);expect(summary.warmup.count).toBe(1);expect(summary.steady.count).toBe(1);
  expect(summary.warmup.hz).toBeNull();expect(summary.steady.hz).toBeNull();
});
it('counts repeated rejected uses separately from distinct channel samples',()=>{
  const metrics=new DiagnosticMetrics();metrics.add(envelope(),0);
  const rejected={stage:'limb',channel:'leftArm',reason:'stale' as const,accepted:false,sampleId:1};
  metrics.recordUse([rejected,rejected,{...rejected,accepted:true},{...rejected,sampleId:0},{...rejected,sampleId:undefined}],10);
  metrics.recordUse([rejected,{...rejected,channel:'rightArm'}],20);
  expect(metrics.rejections()).toEqual({uses:3,uniqueSamples:2});
  expect(metrics.rejections(10011)).toEqual({uses:2,uniqueSamples:2});
  expect(metrics.rejections(10021)).toEqual({uses:0,uniqueSamples:0});
  metrics.add({...envelope(),sessionId:'next'},0);
  expect(metrics.rejections()).toEqual({uses:0,uniqueSamples:0});
});
