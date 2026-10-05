import assert from 'node:assert/strict';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const base='ops/001-zhil/sprint-002/reports';
const server=await createServer({server:{host:'127.0.0.1',port:0,watch:null}});
let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]+'tests/browser-host.html');
  const results=await page.evaluate(async()=>{
    const {AvatarViewer}=await import('/src/viewer.ts');
    const {MotionSolver}=await import('/src/motion-solver.ts');
    const {defaults}=await import('/src/types.ts');
    const {motionSample}=await import('/tests/fixtures/tracking-motion.ts');
    const {gestureHand}=await import('/tests/fixtures/hand-gestures.ts');
    const {Quaternion,Euler}=await import('/node_modules/three/build/three.module.js');
    const models=[];
    for(const id of ['ene','rei']){
      const container=document.createElement('div');container.style.cssText='width:800px;height:600px';document.body.append(container);
      const viewer=new AvatarViewer(container,{...defaults,springMotion:'off'});
      viewer.commitAvatar(await viewer.prepareAvatar(await(await fetch('/avatars/'+id+'.vrm')).blob()));
      const rig=viewer.vrm,node=name=>rig.humanoid.getNormalizedBoneNode(name);
      const gestures=[];
      for(const gesture of ['open','fist','point','peace']){
        const solver=new MotionSolver(rig),frame=motionSample(3,1000).frame;
        frame.poseImage=[];frame.hands=[gestureHand('left',gesture),gestureHand('right',gesture)];
        const rest=Object.fromEntries([...solver.rests].map(([name,value])=>[name,value.local.clone()]));
        for(let i=0;i<120;i++)solver.update(frame,defaults,1/60,1000);
        const fingers=Object.fromEntries([...solver.rests.keys()].filter(name=>/Thumb|Index|Middle|Ring|Little/.test(name)).map(name=>[name,rest[name].angleTo(node(name).quaternion)]));
        gestures.push({gesture,fingers});
      }
      const rolls=[];
      for(const angle of [-.35,.35]){
        const solver=new MotionSolver(rig),frame=motionSample(3,1000).frame;
        const rest=node('chest').getWorldQuaternion(new Quaternion());
        frame.inputSize={width:640,height:480};frame.pose[23].visibility=frame.pose[24].visibility=0;
        const dy=Math.tan(angle)*.4*640/480;
        frame.poseImage[11]={x:.7,y:.4-dy/2,z:0,visibility:1};frame.poseImage[12]={x:.3,y:.4+dy/2,z:0,visibility:1};
        for(let i=0;i<120;i++)solver.update(frame,defaults,1/60,1000);
        rolls.push({requested:angle,actual:new Euler().setFromQuaternion(node('chest').getWorldQuaternion(new Quaternion()).multiply(rest.invert())).z});
      }
      models.push({id,gestures,rolls});viewer.dispose();container.remove();
    }
    return models;
  });
  const sourceHashes={};
  for(const file of ['src/motion-solver.ts','src/torso-solver.ts','src/finger-solver.ts','src/tracking.worker.ts','src/tracking-recording.ts'])sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
  const failures=[];
  for(const model of results){
    for(const roll of model.rolls)if(Math.abs(roll.actual-roll.requested)>.002)failures.push({model:model.id,roll});
    for(const {gesture,fingers}of model.gestures){
      assert.equal(Object.keys(fingers).length,30);
      for(const [name,angle]of Object.entries(fingers)){
        assert(Number.isFinite(angle));if(name.includes('Thumb'))continue;
        const bent=gesture==='fist'||gesture==='point'&&!name.includes('Index')||gesture==='peace'&&/Ring|Little/.test(name);
        if(bent?angle<.25:angle>.32)failures.push({model:model.id,gesture,name,angle});
      }
    }
  }
  await mkdir(base,{recursive:true});
  await writeFile(base+'/motion-smoke.json',JSON.stringify({date:new Date().toISOString(),sourceHashes,results,errors,failures,limits:['Synthetic gestures test the solver and both avatar rigs.','Physical accuracy, cuffs, and camera delay require human tests.']},null,2)+'\n');
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  console.log('Ene and Rei passed four gestures and two torso rolls.');
}finally{await browser?.close();await server.close();}
