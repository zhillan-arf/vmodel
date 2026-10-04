import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1000,height:800}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:4173/');await page.waitForFunction(()=>!!window.__vmodel,undefined,{timeout:90000});
  const results=[];
  for(const mode of ['full','gentle','off','full']){
    await page.locator('#springMotion').selectOption(mode);
    results.push(await page.evaluate(mode=>{
      const {viewer,retarget}=window.__vmodel;retarget.update=()=>{};
      const vrm=viewer.vrm,manager=vrm.springBoneManager;vrm.humanoid.resetNormalizedPose();manager.reset();
      const head=vrm.humanoid.getNormalizedBoneNode('head'),hips=vrm.humanoid.getNormalizedBoneNode('hips');
      const root=hips.position.clone();let finite=true,maxDistance=0,peakAngle=0;
      const allBones=[];vrm.scene.traverse(node=>{if(node.isBone)allBones.push(node);});
      const initial=new Map([...manager.joints].map(joint=>[joint,joint.bone.quaternion.clone()]));
      for(let i=0;i<180;i++){
        head.rotation.y=Math.sin(i*0.45)*1.0;head.rotation.z=Math.cos(i*0.3)*0.35;
        hips.position.x=root.x+Math.sin(i*0.35)*0.15;
        // Includes a large elapsed delta as if the tab resumed after suspension.
        viewer.draw(i===90?10:1/60);
        for(const bone of allBones){
          const position=bone.getWorldPosition(bone.position.clone());
          finite&&=position.toArray().every(Number.isFinite)&&bone.quaternion.toArray().every(Number.isFinite);
          maxDistance=Math.max(maxDistance,position.length());
        }
        for(const joint of manager.joints)peakAngle=Math.max(peakAngle,joint.bone.quaternion.angleTo(initial.get(joint)));
      }
      hips.position.copy(root);
      return {mode,steps:180,includesResumeDeltaSeconds:10,activeJoints:manager.joints.size,finite,maxDistance,peakAngle};
    },mode));
  }
  const passed=results.every(r=>r.finite&&r.maxDistance<4)&&results[0].activeJoints>0&&results[2].activeJoints===0&&results[3].activeJoints===results[0].activeJoints;
  const report={date:new Date().toISOString(),input:'Direct animated head/root transforms, with a 10-second resume delta',passed,results,errors};
  await writeFile('ops/001-zhil/sprint-001/reports/spring-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  if(!passed||errors.length)process.exitCode=1;
}finally{await browser.close();}
