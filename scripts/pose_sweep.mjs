import { chromium } from '@playwright/test';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:1000}});
const folder='ops/reports/local/pose-sweep';await mkdir(folder,{recursive:true});
const poses=[
  {name:'t-pose',bones:{}},
  {name:'arms-up',bones:{leftUpperArm:[0,0,1.2],rightUpperArm:[0,0,-1.2]}},
  {name:'elbows-bent',bones:{leftLowerArm:[0,-1.5,0],rightLowerArm:[0,1.5,0]}},
  {name:'head-turn',bones:{head:[0,0.8,0],neck:[0,0.15,0]}},
  {name:'wrists',bones:{leftHand:[0.7,0.2,0.4],rightHand:[-0.7,-0.2,-0.4]}},
  {name:'squat',bones:{leftUpperLeg:[-0.75,0,0.12],rightUpperLeg:[-0.75,0,-0.12],leftLowerLeg:[1.3,0,0],rightLowerLeg:[1.3,0,0],spine:[0.25,0,0]},rootDrop:0.16},
  {name:'fingers',bones:Object.fromEntries(['left','right'].flatMap(side=>['Index','Middle','Ring','Little'].flatMap(finger=>['Proximal','Intermediate','Distal'].map(segment=>[side+finger+segment,[0,0,side==='left'?-0.95:0.95]]))))},
  {name:'neutral-face',bones:{},face:true},
  {name:'blink-left',bones:{},expressions:{blinkLeft:1},face:true},
  {name:'blink-right',bones:{},expressions:{blinkRight:1},face:true},
  {name:'mouth-aa',bones:{},expressions:{aa:1},face:true},
  {name:'smile-blink-jaw',bones:{},expressions:{happy:0.6,blinkLeft:0.8,blinkRight:0.8,aa:0.6},face:true},
  {name:'neutral-after',bones:{},face:true},
];
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(process.env.VMODEL_TEST_URL??'http://127.0.0.1:4173/');
  await page.waitForFunction(()=>!!window.__vmodel,undefined,{timeout:90000});
  await page.getByRole('button',{name:'Clean view',exact:true}).click();
  await page.evaluate(()=>{window.__vmodel.retarget.update=()=>{};});
  const results=[];
  for(const pose of poses){
    const result=await page.evaluate(pose=>{
      const viewer=window.__vmodel.viewer,vrm=viewer.vrm;
      vrm.humanoid.resetNormalizedPose();
      for(const expression of vrm.expressionManager.expressions)vrm.expressionManager.setValue(expression.expressionName,0);
      for(const [name,angles] of Object.entries(pose.bones)){
        const node=vrm.humanoid.getNormalizedBoneNode(name);if(!node)throw new Error('Missing bone '+name);
        node.rotation.set(...angles);
      }
      const hips=vrm.humanoid.getNormalizedBoneNode('hips');hips.position.y-=pose.rootDrop??0;
      for(const [name,value] of Object.entries(pose.expressions??{}))vrm.expressionManager.setValue(name,value);
      vrm.update(0);vrm.scene.updateMatrixWorld(true);vrm.springBoneManager?.reset();
      if(pose.face){
        const head=vrm.humanoid.getRawBoneNode('head');const target=head.getWorldPosition(head.position.clone());target.y+=0.065;
        viewer.camera.position.copy(target);viewer.camera.position.z+=0.8;viewer.camera.lookAt(target);viewer.camera.updateProjectionMatrix();
      }else {viewer.resize();viewer.camera.position.z*=1.3;}
      const bones=Object.fromEntries(Object.entries(vrm.humanoid.humanBones).map(([name,{node}])=>[name,node.getWorldPosition(node.position.clone()).toArray()]));
      const finite=Object.values(bones).every(position=>position.every(Number.isFinite));
      const measuredExpressions=Object.fromEntries(['blinkLeft','blinkRight','aa','happy','surprised'].map(name=>[name,vrm.expressionManager.getValue(name)]));
      return {name:pose.name,finite,bones,expressions:pose.expressions??{},measuredExpressions};
    },pose);
    await page.waitForTimeout(500);
    await page.locator('#stage').screenshot({path:`${folder}/${pose.name}.png`});
    results.push({...result,image:`${folder}/${pose.name}.png`});
  }
  const avatarSha256=createHash('sha256').update(await readFile('assets/avatars/ene.vrm')).digest('hex');
  await writeFile('ops/reports/pose-sweep.json',JSON.stringify({date:new Date().toISOString(),avatarSha256,input:'Direct normalized VRM poses; independent of camera solver',results,errors},null,2));
  console.log(JSON.stringify({poses:results.length,finite:results.every(r=>r.finite),errors}));
  if(errors.length||results.some(r=>!r.finite))process.exitCode=1;
}finally{await browser.close();}
