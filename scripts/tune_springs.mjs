import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
try{
  await page.goto('http://127.0.0.1:4173/');await page.waitForFunction(()=>!!window.__vmodel,undefined,{timeout:90000});
  await page.locator('#springMotion').selectOption('full');
  const results=await page.evaluate(()=>{
    const {viewer,retarget}=window.__vmodel;retarget.update=()=>{};
    const vrm=viewer.vrm,manager=vrm.springBoneManager,head=vrm.humanoid.getNormalizedBoneNode('head'),hips=vrm.humanoid.getNormalizedBoneNode('hips');
    const root=hips.position.clone(),results=[];
    for(const [stiffness,drag] of [[1,0.5],[2,0.65],[3,0.8],[4,0.85],[6,0.9]])for(const speed of [0.06,0.45]){
      vrm.humanoid.resetNormalizedPose();hips.position.copy(root);vrm.update(0);manager.reset();
      const initial=new Map([...manager.joints].map(j=>[j,j.bone.quaternion.clone()]));
      for(const j of manager.joints){j.settings.stiffness=stiffness;j.settings.dragForce=drag;}
      let peak=0,bone='';
      for(let i=0;i<180;i++){
        head.rotation.y=Math.sin(i*speed);head.rotation.z=Math.cos(i*speed*0.7)*0.35;hips.position.x=root.x+Math.sin(i*speed*0.8)*0.15;
        vrm.update(1/60);
        for(const j of manager.joints){const angle=j.bone.quaternion.angleTo(initial.get(j));if(angle>peak){peak=angle;bone=j.bone.name;}}
      }
      results.push({stiffness,drag,speed,peakDegrees:peak*180/Math.PI,bone});
    }return results;
  });
  await writeFile('ops/reports/spring-tuning.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
