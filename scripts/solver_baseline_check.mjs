import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),directory=await mkdtemp(path.join(root,'tests/solver-baseline-'));
const commit='da48542e991aa202a1b9eaafc1a4f1cbb22ef7b9';
try{
  await mkdir(path.join(directory,'baseline'));
  for(const name of ['retarget','retarget-math','limb-solver','finger-solver','profiles','types'])await writeFile(path.join(directory,'baseline',name+'.ts'),execFileSync('git',['show',`${commit}:src/${name}.ts`]));
  const report=path.join(directory,'result.json');
  await writeFile(path.join(directory,'baseline.parity.ts'),`
import { it,expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Euler,Quaternion } from 'three';
import { Retargeter } from './baseline/retarget';
import { MotionSolver } from '../../src/motion-solver';
import { createCanonicalRig } from '../../src/canonical-rig';
import { defaults } from '../../src/types';
import { motionSample } from '../fixtures/tracking-motion';
it('preserves the committed solver across motion and rig variants',()=>{
  let maxAngle=0,maxPosition=0,updates=0;const cases=['canonical','missing head','missing arm','opposite orientation'];
  for(const variant of cases){
    const make=()=>{const rig=createCanonicalRig(),values=new Map<string,number>();
      if(variant==='missing head')rig.bones.delete('head');if(variant==='missing arm')rig.bones.delete('leftLowerArm');if(variant==='opposite orientation')rig.scene.rotation.y=Math.PI;
      return{rig:{...rig,expressionManager:{getExpression:(name:string)=>name==='surprised'?undefined:{name},getValue:(name:string)=>values.get(name)??0,setValue:(name:string,value:number)=>{values.set(name,value);}}},values};};
    const before=make(),after=make(),baseline=new Retargeter(before.rig as any),current=new MotionSolver(after.rig);current.diagnosticSink=()=>{};
    for(let index=1;index<=180;index++){
      const now=1000+index*17,data=motionSample(index,now).frame,settings={...defaults,mode:index<90?'seated' as const:'standing' as const,hands:index%23!==0};
      if(index%13===0)data.samples.pose.timestamp-=500;if(index%19===0)data.timestamp-=501;if(index%29===0)data.faceMatrix=null;
      if(index===40){const calibration={version:1 as const,head:new Quaternion().setFromEuler(new Euler(0,.2,0)).toArray(),root:[.6,-.4,0]};baseline.setCalibration(calibration);current.setCalibration(calibration);}
      if(index===60){baseline.setExpression('happy');current.setExpression('happy');}
      const frame=index%17===0?null:data,dt=index%2?1/30:1/120;baseline.update(frame,settings,dt,now+2);current.update(frame,settings,dt,now+2);updates++;
      expect([...(baseline as any).goals.keys()].sort()).toEqual([...(current as any).goals.keys()].sort());
      for(const[name,bone]of before.rig.bones){const actual=after.rig.bones.get(name)!;const angle=bone.quaternion.angleTo(actual.quaternion),position=bone.position.distanceTo(actual.position);maxAngle=Math.max(maxAngle,angle);maxPosition=Math.max(maxPosition,position);expect(angle).toBeLessThan(.0001);expect(position).toBeLessThan(1e-10);}
      expect([...before.values]).toEqual([...after.values]);
    }
  }
  writeFileSync(${JSON.stringify(report)},JSON.stringify({cases,updates,maxQuaternionDifferenceRadians:maxAngle,maxPositionDifference:maxPosition,acceptedGoalSetsEqual:true,expressionValuesEqual:true}));
});`);
  const config=path.join(directory,'vitest.config.mjs');
  await writeFile(config,'export default '+JSON.stringify({test:{include:[path.relative(root,path.join(directory,'baseline.parity.ts'))]}}));
  execFileSync('npx',['vitest','run','--config',config,'--reporter=dot'],{stdio:'inherit'});
  const result={generatedAt:new Date().toISOString(),baselineCommit:commit,...JSON.parse(await readFile(report,'utf8')),limits:['Synthetic motion and canonical rig variants only.','No physical camera or actual-model acceptance.']};
  await writeFile('ops/reports/solver-baseline.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await rm(directory,{recursive:true,force:true});}
