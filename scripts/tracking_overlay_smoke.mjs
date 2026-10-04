import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(server.resolvedUrls.local[0]+'tests/browser-host.html');
  await page.evaluate(async()=>{
    await import('/src/style.css');const{TrackingInspector}=await import('/src/tracking-inspector.ts');const{defaults}=await import('/src/types.ts');
    const anchor=performance.timeOrigin+performance.now();window.overlaySettings={...defaults};
    const inspector=window.overlayInspector=new TrackingInspector(()=>{},()=>window.overlaySettings,()=>null,()=>null,()=>({anchor,sessionId:'overlay'}),()=>null,async()=>{throw Error('No comparison');});
    document.body.append(inspector.element);inspector.element.hidden=false;inspector.setVisible(true);
    const canvas=inspector.element.querySelector('canvas'),context=canvas.getContext('2d');
    window.overlayDraw={arcs:[],texts:[],strokes:0};
    for(const method of ['fillRect','arc','fillText','stroke']){
      const original=context[method].bind(context);
      context[method]=(...args)=>{if(method==='fillRect')window.overlayDraw={arcs:[],texts:[],strokes:0};if(method==='stroke')window.overlayDraw.strokes++;if(method==='arc')window.overlayDraw.arcs.push(args.slice(0,2));if(method==='fillText')window.overlayDraw.texts.push(args[0]);return original(...args);};
    }
    let sequence=0;
    window.sampleOverlay=async(width,height,mirror,image=true)=>{
      window.overlaySettings.mirror=mirror;sequence++;
      const timestamp=performance.timeOrigin+performance.now(),sampleTimeMs=timestamp-anchor;
      const points=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1,presence:1}));
      for(const[index,[x,y]]of [[0,0],[1,0],[0,1],[1,1]].entries())points[index]={x,y,z:0,visibility:1,presence:1};
      const sample={timestamp,inferenceMs:1,present:true},task={sampleSequence:sequence,captureSequence:sequence,sampleTimeMs,startedAtMs:sampleTimeMs,finishedAtMs:sampleTimeMs+1,state:'new',present:true};
      const frame={version:1,sequence,timestamp,face:{},faceMatrix:null,pose:points,poseImage:points,hands:[],inferenceMs:1,samples:{face:{...sample},pose:{...sample},hands:{...sample}}};
      const diagnostics={version:1,sessionId:'overlay',captureSequence:sequence,captureTimeMs:sampleTimeMs,videoTimeMs:sampleTimeMs,inputSize:{width,height},runtimeVersion:'test',modelHashes:{face:'a'.repeat(64),pose:'b'.repeat(64),hands:'c'.repeat(64)},delegate:'CPU',tasks:{face:{...task},pose:{...task},hands:{...task}}};
      const source=document.createElement('canvas');source.width=width;source.height=height;const ctx=source.getContext('2d');ctx.fillStyle='#c00000';ctx.fillRect(0,0,width/2,height);ctx.fillStyle='#0000c0';ctx.fillRect(width/2,0,width/2,height);
      inspector.receive(frame,diagnostics,image?await createImageBitmap(source):undefined);
    };
  });
  const graphicContrast=await page.evaluate(async()=>{
    const {drawObservationEdge,drawObservationPoint,observationColors}=await import('/src/tracking-graphics.ts');
    const canvas=document.createElement('canvas');canvas.width=100;canvas.height=60;
    const context=canvas.getContext('2d');
    const luminance=rgb=>rgb.slice(0,3).map(value=>{const n=value/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
    const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    const pixel=(x,y)=>Array.from(context.getImageData(x,y,1,1).data);
    const results=[];
    for(const background of ['#000000','#FFFFFF','#7CE1BE','#FFD18A'])for(const stale of [false,true])for(const rejected of [false,true]){
      context.fillStyle=background;context.fillRect(0,0,100,60);
      drawObservationEdge(context,{x:10,y:20},{x:90,y:20},rejected,stale);
      const core=pixel(12,20),outline=pixel(12,22),gap=pixel(18,20),plain=pixel(18,30);
      drawObservationPoint(context,{x:50,y:40},true,stale);
      drawObservationPoint(context,{x:75,y:40},false,stale);
      results.push({background,stale,rejected,lineContrast:contrast(core,outline),pointContrast:contrast(pixel(50,40),pixel(57,40)),normalPointContrast:contrast(pixel(75,40),pixel(78,40)),opaque:core[3]===255,dashGap:!rejected||gap.every((value,index)=>value===plain[index])});
    }
    return{colors:observationColors,cases:results};
  });
  assert(graphicContrast.cases.every(result=>result.lineContrast>=3&&result.pointContrast>=3&&result.normalPointContrast>=3&&result.opaque&&result.dashGap));
  const controlVisibility=[];
  for(const layer of ['observations','estimated','accepted','avatar']){
    await page.locator('#inspector-layer').selectOption(layer);
    for(const task of ['pose','face','hands']){
      await page.locator('#inspector-task').selectOption(task);
      await page.waitForTimeout(60);
      const visible={hand:await page.locator('#inspector-hand').isVisible(),dense:await page.locator('#dense-face').isVisible(),alignment:await page.locator('#align-hands').isVisible(),comparison:await page.locator('#comparison-model').isVisible()};
      assert.deepEqual(visible,{hand:task==='hands'&&['observations','estimated'].includes(layer),dense:task==='face'&&layer==='observations',alignment:task==='hands'&&layer==='estimated',comparison:layer==='avatar'});
      controlVisibility.push({layer,task,...visible});
    }
  }
  await page.locator('#inspector-layer').selectOption('observations');
  await page.locator('#inspector-task').selectOption('pose');
  const cases=[];
  for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]){
    await page.setViewportSize(viewport);
    for(const [width,height]of [[640,480],[1280,720],[480,800]])for(const mirror of [false,true]){
      await page.evaluate(args=>window.sampleOverlay(...args),[width,height,mirror]);
      await page.waitForTimeout(80);
      const actual=await page.evaluate(()=>{const canvas=document.querySelector('#observation-canvas'),rect=canvas.getBoundingClientRect(),ctx=canvas.getContext('2d');return{arcs:window.overlayDraw.arcs.slice(0,4),width:rect.width,height:rect.height,left:Array.from(ctx.getImageData(350,300,1,1).data),right:Array.from(ctx.getImageData(450,300,1,1).data)};});
      const scale=Math.min(800/width,600/height),w=width*scale,h=height*scale;
      assert.equal(actual.arcs.length,4);
      const errors=actual.arcs.map(([x,y],i)=>{const u=i%2,v=Math.floor(i/2);return Math.hypot((x-((800-w)/2+(mirror?1-u:u)*w))*actual.width/800,(y-((600-h)/2+v*h))*actual.height/600);});
      assert(Math.max(...errors)<=1);assert.deepEqual(actual.left,mirror?[0,0,192,255]:[192,0,0,255]);assert.deepEqual(actual.right,mirror?[192,0,0,255]:[0,0,192,255]);
      cases.push({viewport,input:{width,height},mirror,maximumErrorCSSPixels:Math.max(...errors)});
    }
  }
  await page.locator('#joint-index').fill('13');await page.locator('#joint-index').press('ArrowUp');
  await page.waitForFunction(()=>document.querySelector('#joint-detail').textContent.includes('Right elbow 14'));
  for(const mirror of [false,true]){
    await page.evaluate(mirror=>window.sampleOverlay(640,480,mirror,false),mirror);await page.waitForTimeout(300);
    assert((await page.locator('#joint-detail').textContent()).includes('Right elbow 14'));
    assert((await page.evaluate(()=>window.overlayDraw.texts)).includes('No matching image. Points use a plain background.'));
  }
  assert.equal(await page.locator('#observation-state').textContent(),'No matching image. Points use a plain background.');
  assert((await page.locator('#joint-selection').textContent()).includes('Right elbow 14'));
  assert.equal(await page.locator('#joint-selection').getAttribute('aria-live'),'polite');
  const repeatedAnnouncements=await page.evaluate(async()=>{let count=0;const observer=new MutationObserver(()=>count++);for(const id of ['joint-selection','inspector-state'])observer.observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});await new Promise(resolve=>setTimeout(resolve,600));observer.disconnect();return count;});
  assert.equal(repeatedAnnouncements,0);
  await page.locator('#inspector-task').selectOption('face');
  await page.evaluate(()=>{window.overlayInspector.shown.diagnostics.tasks.face.observations=[Array.from({length:478},(_,i)=>({x:(i%20)/20,y:Math.floor(i/20)/24,z:0}))];});
  await page.waitForFunction(()=>window.overlayDraw.strokes>0&&window.overlayDraw.arcs.length===0);
  const faceCounts=[];
  await page.locator('#dense-face').check();
  for(const count of [478,468]){
    await page.evaluate(count=>{window.overlayInspector.shown.diagnostics.tasks.face.observations[0].length=count;},count);
    await page.waitForFunction(count=>window.overlayDraw.arcs.length===count,count);
    faceCounts.push(await page.evaluate(()=>window.overlayDraw.arcs.length));
  }
  await page.waitForFunction(()=>document.querySelector('#joint-detail').textContent.startsWith('face'));
  const faceDetail=await page.locator('#joint-detail').textContent();assert(!faceDetail.includes('"visibility"'));assert(!faceDetail.includes('"presence"'));
  await page.locator('#inspector-task').selectOption('pose');
  await page.evaluate(()=>{const points=[];points[11]={x:0,y:-1,z:0};points[13]={x:.3,y:-1.4,z:0};points[15]={x:NaN,y:0,z:0};window.overlayInspector.shown.frame.pose=points;});
  await page.locator('#inspector-layer').selectOption('estimated');
  await page.waitForFunction(()=>window.overlayInspector.lines?.geometry.getAttribute('position').count===2);
  const geometry=await page.evaluate(()=>Array.from(window.overlayInspector.lines.geometry.getAttribute('position').array));
  const expected=[0,1,0,.3,1.4,0];assert(geometry.every((value,index)=>Math.abs(value-expected[index])<1e-6));
  await page.locator('#joint-index').fill('13');
  await page.waitForFunction(()=>document.querySelector('#joint-detail').textContent.includes('Raw world coordinates · meters')&&document.querySelector('#joint-detail').textContent.includes('\"y\": -1.4'));
  await page.emulateMedia({reducedMotion:'reduce'});
  const position=()=>page.evaluate(()=>window.overlayInspector.camera.position.toArray());
  const originalPosition=await position();
  await page.locator('#orbit-left').focus();await page.keyboard.press('Enter');assert.notDeepEqual(await position(),originalPosition);
  await page.locator('#reset-view').focus();await page.keyboard.press('Enter');
  assert((await position()).every((value,index)=>Math.abs(value-originalPosition[index])<1e-6));
  await page.locator('#zoom-in').focus();await page.keyboard.press('Enter');assert.notDeepEqual(await position(),originalPosition);
  await page.evaluate(()=>{
    const frame=window.overlayInspector.shown.frame;frame.pose[15]={x:.2,y:-1,z:0};
    frame.poseImage[15]={x:.2,y:.5,z:0};frame.poseImage[16]={x:.8,y:.5,z:0};
    frame.hands=[{side:'Right',score:.99,landmarks:Array.from({length:21},()=>({x:.2,y:.5,z:0})),world:Array.from({length:21},(_,i)=>({x:i/100,y:0,z:0}))}];
  });
  await page.locator('#inspector-task').selectOption('hands');await page.locator('#inspector-hand').selectOption('left');
  await page.locator('#align-hands').check();
  await page.waitForFunction(()=>document.querySelector('#alignment-state').textContent==='Calculated wrist alignment');
  assert(await page.evaluate(()=>window.overlayInspector.lines.geometry.getAttribute('position').count>2));
  await page.evaluate(()=>{const frame=window.overlayInspector.shown.frame;frame.hands.push(structuredClone(frame.hands[0]));});
  await page.waitForFunction(()=>document.querySelector('#alignment-state').textContent.includes('unavailable')&&window.overlayInspector.lines.geometry.getAttribute('position').count===0);
  const render3D={calculatedAlignment:true,failedAssociationRemovesAlignment:true,rawGeometry:geometry,originalWorldDetail:true,missingAndNonfiniteEdgesOmitted:true,keyboardOrbitZoomReset:true,reducedMotion:true};
  const renderer=await page.evaluate(()=>{window.previousOverlayRenderer=window.overlayInspector.renderer;return window.previousOverlayRenderer.info.memory.geometries;});
  assert(renderer>0);await page.locator('#inspector-layer').selectOption('observations');
  assert.equal(await page.evaluate(()=>window.previousOverlayRenderer.info.memory.geometries),0);
  assert.equal(await page.evaluate(()=>window.previousOverlayRenderer.getContext().isContextLost()),true);
  assert.equal(await page.locator('#estimated-view canvas').count(),0);
  await page.evaluate(async()=>{const{motionSample}=await import('/tests/fixtures/tracking-motion.ts');const sample=motionSample(3,0);window.overlayInspector.shown=sample;});
  await page.locator('#inspector-task').selectOption('pose');await page.locator('#inspector-layer').selectOption('estimated');
  await page.waitForFunction(()=>window.overlayInspector.renderer!==null);
  await mkdir('ops/001-zhil/sprint-001/reports/local/estimated-views',{recursive:true});
  const views=[];
  for(const [name,steps]of [['front',0],['rotated',4],['side',8]]){
    await page.locator('#reset-view').click();
    for(let i=0;i<steps;i++)await page.locator('#orbit-left').click();
    await page.waitForTimeout(80);await page.locator('#estimated-view').screenshot({path:`ops/001-zhil/sprint-001/reports/local/estimated-views/${name}.png`});
    views.push({name,camera:await position()});
  }
  await page.locator('#reset-view').click();
  await page.waitForTimeout(80);
  const projectedPose=await page.evaluate(()=>{const inspector=window.overlayInspector;return inspector.shown.frame.pose.map(p=>inspector.camera.position.clone().set(p.x,-p.y,-p.z).project(inspector.camera).toArray());});
  assert(projectedPose.every(p=>Math.abs(p[0])<=1&&Math.abs(p[1])<=1),JSON.stringify(projectedPose));
  const estimatedWidths=[];
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    const size=await page.evaluate(()=>{const container=document.querySelector('#estimated-view'),canvas=container.querySelector('canvas');return{panel:container.getBoundingClientRect().width,canvas:canvas.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert(Math.abs(size.panel-size.canvas)<=1);assert.equal(size.overflow,false);estimatedWidths.push({width,...size});
  }
  for(let i=0;i<5;i++){
    await page.evaluate(()=>{window.previousOverlayRenderer=window.overlayInspector.renderer;});
    await page.locator('#inspector-layer').selectOption('observations');
    assert.equal(await page.evaluate(()=>window.previousOverlayRenderer.info.memory.geometries),0);
  assert.equal(await page.evaluate(()=>window.previousOverlayRenderer.getContext().isContextLost()),true);
    await page.locator('#inspector-layer').selectOption('estimated');
    await page.waitForFunction(()=>window.overlayInspector.renderer!==null);
  }
  await page.evaluate(()=>{window.overlayInspector.outcomes=[{stage:'solver',channel:'leftHand',accepted:false,reason:'low_visibility'}];});
  await page.waitForFunction(()=>document.querySelector('#channel-summary').textContent.includes('low visibility'));
  assert.equal(await page.locator('#channel-summary strong').allTextContents().then(labels=>labels.join(',')),'Face,Body,Left hand,Right hand');
  await page.locator('summary').filter({hasText:'Solver values and reasons'}).click();
  assert.equal(await page.locator('#solver-outcomes').isVisible(),true);
  const summaryUpdates=await page.evaluate(async()=>{
    let changes=0,count=0;
    const observer=new MutationObserver(records=>{changes+=records.length;});observer.observe(document.querySelector('#channel-summary span'),{childList:true});
    const timer=setInterval(()=>{window.overlayInspector.outcomes=Array.from({length:++count},()=>({stage:'solver',channel:'face',accepted:true,reason:'accepted'}));},16);
    await new Promise(resolve=>setTimeout(resolve,1100));clearInterval(timer);observer.disconnect();return changes;
  });
  assert(summaryUpdates>0&&summaryUpdates<=5,`Summary changed ${summaryUpdates} times in 1.1 seconds.`);
  await page.locator('#inspector-layer').selectOption('avatar');
  await page.waitForFunction(()=>document.querySelector('#comparison-state').textContent.includes('Select a model'),null,{timeout:2000});
  assert.equal(await page.locator('#comparison-state').getAttribute('role'),'alert');
  await page.evaluate(()=>{
    const inspector=window.overlayInspector,begin=inspector.avatarOperation.begin.bind(inspector.avatarOperation);
    inspector.avatarOperation.begin=()=>begin(10);
    inspector.comparisonAvatar=async()=>new Promise((resolve,reject)=>{window.rejectStalledComparison=reject;});
  });
  await page.locator('#comparison-model').selectOption('rei');
  await page.waitForFunction(()=>document.querySelector('#comparison-state').textContent.includes('exceeded 30 seconds'));
  await page.evaluate(async()=>{
    const{renderableFixture}=await import('/tests/fixtures/vrm.ts');
    const inspector=window.overlayInspector;
    const{ModelOperation}=await import('/src/model-selection.ts');inspector.avatarOperation=new ModelOperation();
    inspector.currentAvatar=()=>renderableFixture();
  });
  await page.locator('#comparison-model').selectOption('current');
  await page.waitForFunction(()=>document.querySelector('#comparison-state').textContent.includes('SHA-256'));
  assert.equal(await page.locator('#comparison-state').getAttribute('role'),'status');
  const recoveredComparison=await page.locator('#comparison-state').textContent();
  await page.evaluate(()=>window.rejectStalledComparison(new Error('Late provider failure')));
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#comparison-state').textContent(),recoveredComparison);
  const liveComparison=await page.evaluate(()=>{
    const inspector=window.overlayInspector;
    window.overlaySettings={...window.overlaySettings,background:'#334455',framing:'bust'};
    let configured=0;const configure=inspector.avatarViewer.configure.bind(inspector.avatarViewer);
    inspector.avatarViewer.configure=settings=>{configured++;configure(settings);};
    for(let i=0;i<3;i++)inspector.apply(inspector.latest.frame,1/60,inspector.latest.frame.timestamp+i);
    const text=document.querySelector('#comparison-state').textContent;
    return{details:JSON.parse(text.slice(text.indexOf('{'))),background:inspector.avatarViewer.scene.background.getHexString(),configured};
  });
  assert.equal(liveComparison.details.settings.background,'#334455');
  assert.equal(liveComparison.details.settings.framing,'bust');
  assert.equal(liveComparison.background,'334455');assert.equal(liveComparison.configured,1);
  await page.evaluate(()=>window.overlayInspector.dispose());assert.deepEqual(errors,[]);
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),cases,graphicContrast,controlVisibility,keyboardJointSelection:true,repeatedAnnouncements,faceCounts,views,estimatedWidths,knownPoseFullyVisible:true,repeatedDisposal:5,graphicsContextsReleased:true,comparisonFailureRecovery:true,channelSummaryRows:true,summaryUpdates,liveComparisonSettings:true,missingFaceConfidencePreserved:true,render3D,anatomicalLabelStable:true,missingImageLabel:true,errors,
    limits:['Synthetic points and two-color images. Draw calls and canvas pixels are measured.','Comparison timeout uses a 10 ms injected deadline. Production uses 30 seconds.','No physical camera or screen-reader check.']};
  await writeFile('ops/001-zhil/sprint-001/reports/tracking-overlay-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
