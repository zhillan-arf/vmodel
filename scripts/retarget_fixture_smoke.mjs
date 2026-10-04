import { chromium } from '@playwright/test';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const results = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
function frame(yaw = 0) {
  const q = new Quaternion().setFromEuler(new Euler(0,yaw,0));
  const pose = Array.from({length:33}, () => ({x:0,y:0,z:0,visibility:0}));
  for (const [index,x,y] of [[11,.2,.5],[12,-.2,.5],[23,.1,0],[24,-.1,0],[13,.5,.5],[14,-.5,.5],[15,.75,.5],[16,-.75,.5],[25,.1,-.4],[26,-.1,-.4],[27,.1,-.8],[28,-.1,-.8],[31,.1,-.8],[32,-.1,-.8]]) {
    const p = new Vector3(x,y,index>28?.1:0).applyQuaternion(q); pose[index] = {x:p.x,y:-p.y,z:-p.z,visibility:1};
  }
  const image = pose.map(p => ({...p,visibility:0})); image[15] = {x:.75,y:.5,z:0,visibility:1}; image[16] = {x:.25,y:.5,z:0,visibility:1};
  return {version:1,sequence:1,timestamp:0,face:{},faceMatrix:new Matrix4().makeRotationFromQuaternion(q).toArray(),pose,poseImage:image,hands:[],inferenceMs:0,
    samples:Object.fromEntries(['face','pose','hands'].map(name=>[name,{timestamp:0,inferenceMs:0,present:name!=='hands'}]))};
}
async function apply(data, name) {
  const result = await page.evaluate(({data,name}) => {
    clearInterval(window.__poseTimer);
    const app = window.__vmodel, vrm = app.viewer.vrm;
    app.viewer.resize();
    app.retarget.setCalibration(null);
    const updateTime = () => {
      data.timestamp = performance.timeOrigin + performance.now();
      for (const sample of Object.values(data.samples)) sample.timestamp = data.timestamp;
      app.setFrame(data);
    };
    updateTime();
    for(let i=0;i<100;i++){app.retarget.update(data,app.getState().settings,1/60,data.timestamp);vrm.update(1/60);}
    updateTime(); window.__poseTimer = setInterval(updateTime,33);
    vrm.scene.updateMatrixWorld(true);
    const node = name => vrm.humanoid.getNormalizedBoneNode(name);
    const quaternion = name => { const bone=node(name); return bone.getWorldQuaternion(bone.quaternion.clone()).toArray(); };
    const position = name => {const bone=node(name);return bone.getWorldPosition(bone.position.clone()).toArray();};
    const positions = Object.fromEntries(['leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand'].map(name=>[name,position(name)]));
    let finite=true;vrm.scene.traverse(bone=>{finite&&=[...bone.position.toArray(),...bone.quaternion.toArray(),...bone.scale.toArray()].every(Number.isFinite);});
    const fingers=Object.fromEntries(['Index','Middle','Ring','Little'].flatMap(finger=>['Proximal','Intermediate','Distal'].map(part=>{const name='left'+finger+part;return[name,node(name).quaternion.toArray()];})));
    return {name,avatarId:app.getState().avatarId,head:quaternion('head'),leftHand:quaternion('leftHand'),positions,fingers,
      hipsLocal:node('hips').position.toArray(),knees:['leftLowerLeg','rightLowerLeg'].map(name=>node(name).quaternion.toArray()),
      expressions:Object.fromEntries(['aa','blinkLeft','blinkRight'].map(name=>[name,vrm.expressionManager.getValue(name)])),finite};
  }, {data,name});
  results.push(result); assert(result.finite); return result;
}
try {
  await mkdir('ops/001-zhil/sprint-001/reports/local/retarget', {recursive:true});
  await page.goto(process.env.VMODEL_TEST_URL ?? 'http://127.0.0.1:4173/');
  await page.waitForFunction(()=>!!window.__vmodel,undefined,{timeout:90000});
  const neutral = await apply(frame(), 'neutral');
  const turned = await apply(frame(.4), 'torso-and-head-yaw');
  const delta = new Quaternion().fromArray(turned.head).multiply(new Quaternion().fromArray(neutral.head).invert());
  assert(Math.abs(new Euler().setFromQuaternion(delta,'YXZ').y-.4)<.01);
  for (const [side,sign] of [['left',1],['right',-1]]) {
    const expected = new Vector3(sign,0,0).applyQuaternion(new Quaternion().setFromEuler(new Euler(0,.4,0)));
    for(const [a,b] of [['UpperArm','LowerArm'],['LowerArm','Hand']]) {
      const direction = new Vector3().fromArray(turned.positions[side+b]).sub(new Vector3().fromArray(turned.positions[side+a])).normalize();
      assert(direction.dot(expected)>.995);
    }
  }
  await page.screenshot({path:'ops/001-zhil/sprint-001/reports/local/retarget/torso-head.png'});
  const blink = frame(); blink.face={eyeBlinkLeft:.9,eyeBlinkRight:0,jawOpen:.4};
  const faceResult = await apply(blink,'left-blink-mouth');
  assert(faceResult.expressions.blinkLeft>.85);assert(faceResult.expressions.blinkRight<.05);assert(faceResult.expressions.aa>.7);
  await page.screenshot({path:'ops/001-zhil/sprint-001/reports/local/retarget/blink-mouth.png'});
  // Build an observed hand from this avatar's rest geometry, then rotate its palm.
  // This checks palm twist through the actual rig without claiming camera detection.
  const handReference = await page.evaluate(() => {
    clearInterval(window.__poseTimer);const vrm=window.__vmodel.viewer.vrm;
    vrm.humanoid.resetNormalizedPose();vrm.scene.updateMatrixWorld(true);
    const point = name => {const bone=vrm.humanoid.getNormalizedBoneNode(name);return bone.getWorldPosition(bone.position.clone()).toArray();};
    const capture = () => {
      const points=[point('leftHand')];
      for(const finger of ['Thumb','Index','Middle','Ring','Little']) {
        const names=finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];
        const p=names.map(part=>point('left'+finger+part));
        const distal=vrm.humanoid.getNormalizedBoneNode('left'+finger+'Distal');
        const parentRotation=distal.parent.getWorldQuaternion(distal.quaternion.clone());
        const ownRotation=distal.getWorldQuaternion(distal.quaternion.clone()).multiply(parentRotation.invert());
        const tipVector=distal.position.clone().fromArray(p[2]).sub(distal.position.clone().fromArray(p[1])).applyQuaternion(ownRotation).multiplyScalar(.8);
        const tip=distal.position.clone().fromArray(p[2]).add(tipVector).toArray();points.push(...p,tip);
      }
      return points;
    };
    const points=capture();
    const bone=vrm.humanoid.getNormalizedBoneNode('leftHand');
    const rotation=bone.getWorldQuaternion(bone.quaternion.clone()).toArray();
    for(const finger of ['Index','Middle','Ring','Little']) for(const part of ['Proximal','Intermediate','Distal']) vrm.humanoid.getNormalizedBoneNode('left'+finger+part).rotation.set(0,0,-.95);
    vrm.scene.updateMatrixWorld(true); const fist=capture();
    vrm.humanoid.resetNormalizedPose();vrm.scene.updateMatrixWorld(true);
    return {points,fist,rotation};
  });
  const points=handReference.points.map(p=>new Vector3().fromArray(p));
  const wrist=points[0], axis=points[9].clone().sub(wrist).normalize();
  const across=points[5].clone().sub(points[17]).normalize();
  const normal=across.clone().cross(axis).normalize();
  let twist;
  for(const angle of [.9,-.9,.5,-.5]) {
    const candidate=new Quaternion().setFromAxisAngle(axis,angle);
    if(Math.abs(normal.clone().applyQuaternion(candidate).z)>.2){twist=candidate;break;}
  }
  assert(twist);
  const handFrame=frame();handFrame.samples.hands.present=true;
  handFrame.hands=[{side:'Right',score:.99,landmarks:Array.from({length:21},()=>({x:.75,y:.5,z:0})),world:points.map(p=>{
    const v=p.clone().sub(wrist).applyQuaternion(twist);return{x:v.x,y:-v.y,z:-v.z};
  })}];
  const palm = await apply(handFrame,'left-palm-twist-wrist-association');
  const expected=twist.clone().multiply(new Quaternion().fromArray(handReference.rotation));
  assert(new Quaternion().fromArray(palm.leftHand).angleTo(expected)<.01);
  await page.screenshot({path:'ops/001-zhil/sprint-001/reports/local/retarget/palm-twist.png'});
  handFrame.hands[0].world=handReference.fist.map(p=>{
    const v=new Vector3().fromArray(p).sub(wrist).applyQuaternion(twist);return{x:v.x,y:-v.y,z:-v.z};
  });
  const fist=await apply(handFrame,'closed-fingers');
  for(const q of Object.values(fist.fingers)) {
    const angle=new Quaternion().fromArray(q).angleTo(new Quaternion()); assert(angle>.6&&angle<1.75);
  }
  await page.evaluate(()=>{
    const viewer=window.__vmodel.viewer,hand=viewer.vrm.humanoid.getNormalizedBoneNode('leftHand');
    const target=hand.getWorldPosition(hand.position.clone());target.x+=.035;
    viewer.camera.position.copy(target);viewer.camera.position.z+=.45;viewer.camera.lookAt(target);viewer.camera.updateProjectionMatrix();
  });
  await page.screenshot({path:'ops/001-zhil/sprint-001/reports/local/retarget/fist-closeup.png'});
  await page.locator('#mode').selectOption('standing');
  const standing=frame();
  for(const [index,x,y,z] of [[23,.55,.45,0],[24,.45,.45,0],[27,.55,.9,0],[28,.45,.9,0]]) standing.poseImage[index]={x,y,z,visibility:1};
  const standingNeutral=await apply(standing,'standing-neutral');
  standing.pose[25]={x:.1,y:.3,z:-.2,visibility:1};standing.pose[26]={x:-.1,y:.3,z:-.2,visibility:1};
  standing.pose[27]={x:.1,y:.65,z:0,visibility:1};standing.pose[28]={x:-.1,y:.65,z:0,visibility:1};
  standing.pose[31]={x:.1,y:.65,z:-.1,visibility:1};standing.pose[32]={x:-.1,y:.65,z:-.1,visibility:1};
  const crouch=await apply(standing,'standing-knee-bend');
  assert(crouch.knees.every(q=>new Quaternion().fromArray(q).angleTo(new Quaternion())>.8));
  const drop=standingNeutral.hipsLocal[1]-crouch.hipsLocal[1];assert(drop>0&&drop<=.351);
  await page.screenshot({path:'ops/001-zhil/sprint-001/reports/local/retarget/knee-bend.png'});
  await page.locator('#mode').selectOption('seated');
  const lost=frame();lost.pose=[];lost.hands=[];lost.faceMatrix=null;Object.values(lost.samples).forEach(sample=>sample.present=false);
  const loss=await apply(lost,'tracking-loss');assert(loss.expressions.aa<.01);assert(loss.expressions.blinkLeft<.01);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,cases:results.map(r=>r.name),errors}));
} catch(error) { errors.push(String(error)); console.error(error); process.exitCode=1; }
finally {
  await writeFile('ops/001-zhil/sprint-001/reports/retarget-fixture-smoke.json',JSON.stringify({date:new Date().toISOString(),input:'Deterministic measurements through actual Ene runtime; no physical camera/inference or live gesture acceptance',results,errors},null,2));
  await browser.close();
}
