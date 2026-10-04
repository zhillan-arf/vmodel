import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';

const server=await createServer({server:{host:'127.0.0.1',port:0,watch:null}});let browser;
const output='ops/001-zhil/sprint-001/reports';
try{
  await server.listen();browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]+'tests/browser-host.html');
  const models=await page.evaluate(async()=>{
    const {AvatarViewer}=await import('/src/viewer.ts'),{MotionSolver}=await import('/src/motion-solver.ts');
    const {trackedBones}=await import('/src/rig-overlay.ts'),{defaults}=await import('/src/types.ts');
    const {motionSample}=await import('/tests/fixtures/tracking-motion.ts');
    const {Quaternion,Vector3}=await import('/node_modules/three/build/three.module.js'),{sha256}=await import('/src/model-types.ts');
    const results=[];
    for(const id of ['ene','rei']){
      const container=document.createElement('div');container.style.cssText='position:relative;width:700px;height:600px';document.body.append(container);
      const viewer=new AvatarViewer(container,defaults),blob=await(await fetch('/avatars/'+id+'.vrm')).blob();
      const candidate=await viewer.prepareAvatar(blob);viewer.commitAvatar(candidate);viewer.setRigVisible(true);
      const vrm=viewer.vrm,node=name=>vrm.humanoid.getNormalizedBoneNode(name),raw=name=>vrm.humanoid.getRawBoneNode(name);
      const missing=trackedBones.filter(name=>name!=='upperChest'&&!node(name));
      const weights=Object.fromEntries(trackedBones.filter(name=>raw(name)).map(name=>[name,0]));
      vrm.scene.traverse(mesh=>{
        if(!mesh.isSkinnedMesh)return;
        const indices=mesh.geometry.attributes.skinIndex,weight=mesh.geometry.attributes.skinWeight;
        if(!indices||!weight)return;
        const names=new Map(Object.keys(weights).map(name=>[raw(name),name]));
        for(let i=0;i<indices.count;i++)for(let j=0;j<4;j++){
          const name=names.get(mesh.skeleton.bones[indices.getComponent(i,j)]);
          if(name&&weight.getComponent(i,j)>.001)weights[name]++;
        }
      });
      const snapshot=()=>Object.fromEntries(trackedBones.filter(name=>node(name)).map(name=>[name,node(name).quaternion.clone()]));
      const settle=(solver,frame)=>{for(let i=0;i<100;i++)solver.update(frame,defaults,1/60,frame.timestamp);vrm.update(0);};
      let solver=new MotionSolver(vrm),frame=motionSample(3,1000).frame;frame.hands=[];frame.samples.hands.present=false;
      frame.pose[11].y=frame.pose[12].y=frame.pose[13].y=frame.pose[14].y=-.5;
      settle(solver,frame);const before=snapshot();
      frame=structuredClone(frame);frame.timestamp=1001;for(const sample of Object.values(frame.samples))sample.timestamp=1001;
      frame.pose[13].y=-.9;frame.face.eyeBlinkLeft=.9;frame.face.eyeBlinkRight=.1;frame.face.jawOpen=.4;
      for(const side of ['Left','Right'])for(const direction of ['In','Out','Up','Down'])frame.face['eyeLook'+direction+side]=0;
      frame.face.eyeLookOutLeft=1;frame.face.eyeLookInRight=1;
      settle(solver,frame);const after=snapshot();
      const shoulder=before.leftShoulder.angleTo(after.leftShoulder),otherShoulder=before.rightShoulder.angleTo(after.rightShoulder);
      const gaze=['leftEye','rightEye'].map(name=>before[name].angleTo(after[name]));
      const expressions=Object.fromEntries(['aa','blinkLeft','blinkRight'].map(name=>[name,vrm.expressionManager.getValue(name)]));
      const fingers=[];
      for(const side of ['left','right']){
        solver=new MotionSolver(vrm);
        const capture=()=>{
          vrm.scene.updateMatrixWorld(true);
          const position=name=>node(name).getWorldPosition(new Vector3());
          const points=[position(side+'Hand')];
          for(const finger of ['Thumb','Index','Middle','Ring','Little']){
            const parts=finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];
            const p=parts.map(part=>position(side+finger+part)),distal=node(side+finger+'Distal');
            const delta=distal.getWorldQuaternion(new Quaternion()).multiply(distal.parent.getWorldQuaternion(new Quaternion()).invert());
            points.push(...p,p[2].clone().add(p[2].clone().sub(p[1]).applyQuaternion(delta).multiplyScalar(.8)));
          }
          const wrist=points[0].clone();return points.map(p=>{p.sub(wrist);return{x:p.x,y:-p.y,z:-p.z};});
        };
        const source=capture(),vector=p=>new Vector3(p.x,p.y,p.z);
        const normal=vector(source[5]).sub(vector(source[17])).cross(vector(source[9]).sub(vector(source[0]))).normalize();
        const facing=new Quaternion().setFromUnitVectors(normal,new Vector3(0,0,1));
        const orient=points=>points.map(p=>{const v=vector(p).applyQuaternion(facing);return{x:v.x,y:v.y,z:v.z};});
        const open=orient(source);
        for(const finger of ['Thumb','Index','Middle','Ring','Little']){
          vrm.humanoid.resetNormalizedPose();
          const parts=finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];
          for(const part of parts){const name=side+finger+part,axis=solver.fingerAxes.get(name)??new Vector3(0,0,side==='left'?-1:1);node(name).quaternion.multiply(new Quaternion().setFromAxisAngle(axis,.65));}
          const closed=orient(capture());
          solver=new MotionSolver(vrm);const data=motionSample(3,2000).frame;
          data.pose=[];data.poseImage=[];data.samples.pose.present=false;
          data.hands=[{side:side==='left'?'Left':'Right',score:.99,world:open,landmarks:Array.from({length:21},()=>({x:side==='left'?.8:.2,y:.5,z:0}))}];
          settle(solver,data);const initial=snapshot(),initialRaw=Object.fromEntries(parts.map(part=>[part,raw(side+finger+part).quaternion.clone()]));
          data.timestamp=2001;for(const sample of Object.values(data.samples))sample.timestamp=2001;data.hands[0].world=closed;
          settle(solver,data);
          fingers.push({side,finger,joints:parts.map(part=>{const name=side+finger+part;return{name,angle:initial[name].angleTo(node(name).quaternion),rawAngle:initialRaw[part].angleTo(raw(name).quaternion),weightedVertices:weights[name],deformedVertices:Object.keys(weights).filter(child=>{let ancestor=raw(child);while(ancestor){if(ancestor===raw(name))return true;ancestor=ancestor.parent;}return false;}).reduce((sum,child)=>sum+weights[child],0)};})});
        }
        vrm.humanoid.resetNormalizedPose();
      }
      results.push({id,sha256:await sha256(blob),missing,weights,shoulder,otherShoulder,gaze,expressions,fingers,overlayJoints:(viewer.draw(0),viewer.rigOverlay.points.geometry.attributes.position.count)});
      viewer.dispose();container.remove();
    }
    return results;
  });
  await mkdir(output+'/local/combined-tracking',{recursive:true});
  await writeFile(output+'/combined-tracking-models.json',JSON.stringify({models,errors},null,2)+'\n');
  for(const model of models){
    assert.deepEqual(model.missing,[]);assert(model.shoulder>.1);assert(model.otherShoulder<.001);
    assert(model.gaze.every(angle=>angle>.3&&angle<.4));assert(model.expressions.aa>.7&&model.expressions.blinkLeft>.85);
    assert.equal(model.fingers.length,10);
    for(const finger of model.fingers)for(const joint of finger.joints)assert(joint.angle>.05&&joint.rawAngle>.05&&joint.deformedVertices>0,JSON.stringify({id:model.id,...finger}));
    assert(model.overlayJoints===53);
  }
  await page.evaluate(async()=>{
    await import('/src/style.css');
    const {TrackingInspector}=await import('/src/tracking-inspector.ts'),{defaults}=await import('/src/types.ts');
    const {motionSample}=await import('/tests/fixtures/tracking-motion.ts');
    const anchor=performance.timeOrigin+performance.now(),settings={...defaults};
    const inspector=window.inspector=new TrackingInspector(()=>{},()=>settings,()=>null,()=>new MediaStream(),()=>({anchor,sessionId:'combined'}),()=>null,async id=>(await fetch('/avatars/'+id+'.vrm')).blob());
    document.body.append(inspector.element);inspector.element.hidden=false;inspector.setVisible(true);
    let index=3;
    window.sendSample=async(cached=false)=>{
      const time=performance.timeOrigin+performance.now(),data=motionSample(++index,time);data.diagnostics.sessionId='combined';
      data.diagnostics.captureTimeMs=time-anchor;
      for(const task of Object.values(data.diagnostics.tasks)){task.present=true;task.sampleTimeMs=time-anchor;}
      data.diagnostics.tasks.face.observations=[Array.from({length:478},(_,i)=>({x:.5+Math.cos(i)*.08,y:.22+Math.sin(i)*.1,z:0}))];
      data.frame.hands.push({...structuredClone(data.frame.hands[0]),side:'Right'});
      if(cached){data.diagnostics.tasks.pose.captureSequence--;data.diagnostics.tasks.hands.captureSequence--;}
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#26394a';ctx.fillRect(0,0,640,480);ctx.fillStyle='#ffffff';ctx.fillText('Synthetic camera image',20,30);
      inspector.receive(data.frame,data.diagnostics,await createImageBitmap(canvas));inspector.apply(data.frame,1/30,time);
      return index;
    };
  });
  await page.locator('#inspector-layer').selectOption('combined');
  for(const id of ['ene','rei']){
    await page.locator('#comparison-model').selectOption(id);
    await page.waitForFunction(id=>window.inspector.comparisonAsset?.id===id,id,{timeout:90000});
    const capture=await page.evaluate(()=>window.sendSample());
    await page.waitForFunction(()=>document.querySelector('#observation-state').textContent.includes('Face: 478 points. Body: 33 points. Hands: 2.'));
    assert(await page.locator('#observation-canvas').isVisible());assert(await page.locator('#inspector-avatar canvas').isVisible());
    await page.evaluate(()=>window.sendSample(true));await page.waitForTimeout(80);
    assert.equal(await page.locator('#mapping-guide').getAttribute('data-capture'),String(capture));
    await page.locator('#pause-inspector').click();
    const frozen=await page.locator('#observation-canvas').evaluate(canvas=>canvas.toDataURL());
    await page.evaluate(()=>window.sendSample());await page.waitForTimeout(80);
    assert.equal(await page.locator('#observation-canvas').evaluate(canvas=>canvas.toDataURL()),frozen);
    await page.locator('#pause-inspector').click();
    await page.locator('#model-focus').selectOption('leftHand');await page.waitForTimeout(80);
    await page.screenshot({path:output+'/local/combined-tracking/'+id+'-hand.png'});
    await page.evaluate(async()=>{window.inspector.settings().orientation='portrait';await window.sendSample();});
    await page.waitForTimeout(150);
    assert(await page.evaluate(async()=>{
      const {trackedBones}=await import('/src/rig-overlay.ts'),viewer=window.inspector.avatarViewer;
      return trackedBones.filter(name=>name.startsWith('left')&&/Hand|Thumb|Index|Middle|Ring|Little/.test(name)).every(name=>{
        const bone=viewer.vrm.humanoid.getRawBoneNode(name),point=bone.getWorldPosition(bone.position.clone()).project(viewer.camera);
        return Math.abs(point.x)<1&&Math.abs(point.y)<1&&Math.abs(point.z)<1;
      });
    }));
    await page.evaluate(async()=>{window.inspector.settings().orientation='landscape';await window.sendSample();});
    await page.locator('#model-focus').selectOption('body');
    await page.screenshot({path:output+'/local/combined-tracking/'+id+'-combined.png'});
    await page.locator('#show-model-bones').uncheck();assert(await page.evaluate(()=>!window.inspector.avatarViewer.rigOverlay));
    await page.locator('#show-model-bones').check();
  }
  await page.waitForTimeout(700);
  const announcements=await page.evaluate(async()=>{let changes=0;const observer=new MutationObserver(()=>changes++);observer.observe(document.querySelector('#observation-state'),{childList:true,subtree:true,characterData:true});await new Promise(resolve=>setTimeout(resolve,300));observer.disconnect();return changes;});
  assert.equal(announcements,0);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(80);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>window.inspector.dispose());assert.deepEqual(errors,[]);
  const report={date:new Date().toISOString(),models,errors,combinedView:true,pause:true,cachedCapture:true,mobileLayout:true,limits:['Synthetic motion tests use the actual model files.','These checks do not measure camera accuracy or physical gestures.']};
  await writeFile(output+'/combined-tracking-smoke.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:true,models:models.map(m=>({id:m.id,fingers:m.fingers.length,shoulder:m.shoulder,gaze:m.gaze})),errors}));
}finally{await browser?.close();await server.close();}

