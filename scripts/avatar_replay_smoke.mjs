// Record differences from the previous solver. Test current replay determinism.
// Sprint 002 changes torso distribution and recovery, so exact old parity is obsolete.
import assert from 'node:assert/strict';
import {writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const baselineCommit='da48542e991aa202a1b9eaafc1a4f1cbb22ef7b9';
const baselineDirectory=await mkdtemp(path.join(process.cwd(),'tests/avatar-baseline-'));
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
  for(const name of ['retarget','retarget-math','limb-solver','finger-solver','profiles','types'])await writeFile(path.join(baselineDirectory,name+'.ts'),execFileSync('git',['show',`${baselineCommit}:src/${name}.ts`]));
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(server.resolvedUrls.local[0]+'tests/browser-host.html');
  const result=await page.evaluate(async baselinePath=>{
    const{Retargeter:Baseline}=await import(baselinePath);
    const{AvatarViewer}=await import('/src/viewer.ts');const{MotionSolver}=await import('/src/motion-solver.ts');
    const{createCanonicalRig}=await import('/src/canonical-rig.ts');const{motionSample}=await import('/tests/fixtures/tracking-motion.ts');
    const{TraceRecorder,replayTrace,solverVersion}=await import('/src/tracking-recording.ts');const{defaults}=await import('/src/types.ts');const{sha256}=await import('/src/model-types.ts');
    const settings={...defaults,mode:'standing'},first=motionSample(3,0);
    const recorder=new TraceRecorder({runtime:'fixture',modelHashes:first.diagnostics.modelHashes,solverVersion,settings,calibration:null,rigHashes:[]});
    for(let i=1;i<=120;i++){
      const time=i*1000/60,data=motionSample(i<=60?3:7,time);data.frame.sequence=i;data.diagnostics.captureSequence=i;
      for(const task of Object.values(data.diagnostics.tasks)){task.captureSequence=i;task.sampleSequence=i;}
      recorder.append({kind:'sample',...data,reasons:[]},time);recorder.append({kind:'apply',frameSequence:i,solverTimeMs:time,dt:1/60},time);
    }
    const trace=recorder.trace,names=[...createCanonicalRig().bones.keys()],results=[];
    for(const id of ['canonical','ene','rei']){
      let viewer=null,hash=null,rig;
      if(id==='canonical')rig=createCanonicalRig();
      else{
        const blob=await(await fetch(`/avatars/${id}.vrm`)).blob();hash=await sha256(blob);
        const container=document.createElement('div');document.body.append(container);viewer=new AvatarViewer(container,settings);
        const candidate=await viewer.prepareAvatar(blob);viewer.commitAvatar(candidate);rig=candidate.vrm;
      }
      let solver,current=null,liveSettings=settings;
      const snapshot=()=>Object.fromEntries(names.flatMap(name=>{const bone=rig.humanoid.getNormalizedBoneNode(name);return bone?[[name,bone.quaternion.clone()]]:[];}));
      const positions=()=>Object.fromEntries(names.flatMap(name=>{const bone=rig.humanoid.getNormalizedBoneNode(name);return bone?[[name,bone.position.clone()]]:[];}));
      const baseline=new Baseline(rig),reference=new Map();
      for(const event of trace.events){if(event.kind==='sample')current=event.frame;else if(event.kind==='apply'){baseline.update(current,settings,event.dt,event.solverTimeMs);reference.set(event.frameSequence,{bones:snapshot(),positions:positions(),goals:[...baseline.goals.keys()].sort()});}}
      solver=new MotionSolver(rig);let baselineAngle=0,baselinePosition=0,goalsEqual=true;
      let halfway;
      for(const event of trace.events){if(event.kind==='sample')current=event.frame;else if(event.kind==='apply'){solver.update(current,settings,event.dt,event.solverTimeMs);const expected=reference.get(event.frameSequence);for(const[name,q]of Object.entries(snapshot()))baselineAngle=Math.max(baselineAngle,q.angleTo(expected.bones[name]));for(const[name,p]of Object.entries(positions()))baselinePosition=Math.max(baselinePosition,p.distanceTo(expected.positions[name]));goalsEqual&&=JSON.stringify([...solver.goals.keys()].sort())===JSON.stringify(expected.goals);if(event.frameSequence===60)halfway=snapshot();}}
      const final=snapshot(),angle=(a,b)=>Math.max(...Object.keys(a).map(name=>a[name].angleTo(b[name])));
      const leftChange=Math.max(...['leftUpperArm','leftLowerArm'].map(name=>halfway[name].angleTo(final[name])));
      const rightChange=Math.max(...['rightUpperArm','rightLowerArm'].map(name=>halfway[name].angleTo(final[name])));
      const target={reset:()=>{solver=new MotionSolver(rig);},settings:value=>{liveSettings=value;},calibration:value=>solver.setCalibration(value),sample:()=>{},apply:(frame,dt,now)=>solver.update(frame,liveSettings,dt,now)};
      replayTrace(trace,target);const forwardError=angle(final,snapshot());
      replayTrace(trace,target,119);const backwardError=angle(halfway,snapshot());
      replayTrace(trace,target);const repeatedError=angle(final,snapshot());
      results.push({id,hash,baselineAngle,baselinePosition,goalsEqual,bones:Object.keys(final).length,leftChangeRadians:leftChange,rightChangeRadians:rightChange,forwardError,backwardError,repeatedError});
      viewer?.dispose();
    }
    return{traceText:await recorder.export().text(),traceHash:await sha256(recorder.export()),samples:120,results};
  },'/'+path.relative(process.cwd(),path.join(baselineDirectory,'retarget.ts')).split(path.sep).join('/'));
  for(const item of result.results){assert(Number.isFinite(item.baselineAngle)&&item.baselinePosition<1e-10,JSON.stringify(item));assert(item.leftChangeRadians>.01,JSON.stringify(item));assert(item.rightChangeRadians<.0001,JSON.stringify(item));for(const key of ['forwardError','backwardError','repeatedError'])assert(item[key]<.0001,JSON.stringify(item));}
  assert.deepEqual(errors,[]);
  await mkdir('ops/001-zhil/sprint-001/reports/local',{recursive:true});await writeFile('ops/001-zhil/sprint-001/reports/local/avatar-comparison-trace.json',result.traceText);
  const {traceText,...measurements}=result;
  const report={tracePath:'ops/001-zhil/sprint-001/reports/local/avatar-comparison-trace.json',baselineCommit,generatedAt:new Date().toISOString(),browser:browser.version(),...measurements,errors,
    limits:['The old solver supplies comparison measurements, not an equality requirement.','The current solver includes shoulder control, torso distribution, and bounded recovery.','Synthetic anatomical input on the local Ene and native Rei rigs.','No physical detector accuracy or target-laptop performance claim.']};
  await writeFile('ops/001-zhil/sprint-001/reports/avatar-replay-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();await rm(baselineDirectory,{recursive:true,force:true});}
