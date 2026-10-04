import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FaceLandmarker,PoseLandmarker,HandLandmarker } from '@mediapipe/tasks-vision';
import { DiagnosticMetrics,MatchedImages,type DiagnosticEnvelope,type DiagnosticDemand,type SolverOutcome,type TrackingTask } from './tracking-diagnostics';
import { drawObservationEdge, drawObservationPoint } from './tracking-graphics';
import { trackingSummary } from './tracking-summary';
import { MotionSolver } from './motion-solver';
import { calculatedWristAlignment, estimatedSegments } from './tracking-inspector-3d';
export { displayPoint } from './tracking-inspector-3d';
import { createCanonicalRig,rigSegments } from './canonical-rig';
import { TraceRecorder,importTrace,replayTrace,solverVersion,type TrackingTrace } from './tracking-recording';
import { ReplayVideo,replayVideoTime } from './replay-video';
import { DiagnosticVideo } from './tracking-video';
import { download } from './library-backup';
import { AvatarViewer } from './viewer';
import { combinedObservations,isCombinedCapture } from './combined-observations';
import { trackedBones } from './rig-overlay';
import { ModelOperation,prepareSelection,abortable } from './model-selection';
import { sha256 } from './model-types';
import type { Calibration,Landmark,StudioSettings,TrackingFrame } from './types';
export function containedPoint(p:Pick<Landmark,'x'|'y'>,input:{width:number;height:number},width:number,height:number,mirror:boolean){const scale=Math.min(width/input.width,height/input.height),w=input.width*scale,h=input.height*scale;return{x:(width-w)/2+(mirror?1-p.x:p.x)*w,y:(height-h)/2+p.y*h};}
export class TrackingInspector {
  readonly element=document.createElement('section');
  private canvas:HTMLCanvasElement;
  private images=new MatchedImages();
  private metrics=new DiagnosticMetrics();
  private visible=false;
  private disposed=false;
  private traceImportGeneration=0;
  private paused=false;
  private latest:{frame:TrackingFrame;diagnostics:DiagnosticEnvelope}|null=null;
  private shown:{frame:TrackingFrame;diagnostics:DiagnosticEnvelope}|null=null;
  private combinedLatest:typeof this.latest=null;
  private frozen:HTMLCanvasElement|null=null;
  private rig=createCanonicalRig();
  private solver=new MotionSolver(this.rig);
  private outcomes:SolverOutcome[]=[];
  private recorder:TraceRecorder|null=null;
  private recordingSolver:MotionSolver|null=null;
  private recording=false;
  private recordingStart=0;
  private recordingTimer:ReturnType<typeof setTimeout>|undefined;
  private recordedFrame=-1;
  private replay:TrackingTrace|null=null;
  private replaying=false;
  private replaySettings:StudioSettings|null=null;
  private displaySettings(){return this.replaying&&this.replaySettings?this.replaySettings:this.settings();}
  private settingsState='';
  private calibrationState='';
  private video=new DiagnosticVideo();
  private videoBlob:Blob|null=null;
  private replayVideo=new ReplayVideo();
  private videoImportGeneration=0;
  private scene:THREE.Scene|null=null;
  private renderer:THREE.WebGLRenderer|null=null;
  private camera:THREE.PerspectiveCamera|null=null;
  private controls:OrbitControls|null=null;
  private lines:THREE.LineSegments|null=null;
  private avatarViewer:AvatarViewer|null=null;
  private avatarSolver:MotionSolver|null=null;
  private comparisonSettings='';
  private comparisonAsset:{id:string;hash:string}|null=null;
  private avatarOperation=new ModelOperation();
  private frameHandle=0;
  private lastDraw=0;
  private lastSummary=0;
  private lastUse=0;
  private solverCalibration='';
  private selectedJoint=13;
  constructor(private demand:(demand:DiagnosticDemand)=>void,private settings:()=>StudioSettings,private calibration:()=>Calibration|null,private stream:()=>MediaStream|null,private clock:()=>{anchor:number;sessionId:string},private currentAvatar:()=>Blob|null,private comparisonAvatar:(id:string,signal:AbortSignal)=>Promise<Blob>){
    this.element.className='feature-panel';this.element.dataset.studioPanel='tracking';this.element.hidden=true;
    this.element.innerHTML=`<h1>Tracking Inspector</h1><p>Observations show camera points. Estimated 3D shows calculated depth. Accepted motion shows solver results. Avatar shows model appearance.</p>
      <p id="camera-message" role="status"></p><div class="toolbar"><button id="inspector-start-camera">Start camera</button><button id="inspector-stop-camera">Stop camera</button><button id="pause-inspector">Pause inspector</button><span id="inspector-state" role="status">Camera stopped</span></div>
      <label>Layer<select id="inspector-layer"><option value="observations">Observations</option><option value="estimated">Estimated 3D</option><option value="accepted">Accepted motion</option><option value="avatar">Avatar</option><option value="combined">Camera and model</option></select></label>
      <div class="toolbar"><label>Task<select id="inspector-task"><option value="pose">Body</option><option value="face">Face</option><option value="hands">Hands</option></select></label><label>Hand<select id="inspector-hand"><option value="left">Left hand</option><option value="right">Right hand</option></select></label><label class="check"><input id="dense-face" type="checkbox"> Dense face points</label><label class="check"><input id="align-hands" type="checkbox"> Calculated wrist alignment</label></div>
      <p>Accepted: solid line. Rejected: dashed line. Stale: faded line. Missing: no marker.</p><div class="inspector-layout"><div class="comparison-views"><div class="camera-pane"><canvas id="observation-canvas" width="800" height="600" role="img" aria-label="Tracking observations" aria-describedby="observation-state"></canvas><p id="observation-state" role="status"></p><div id="estimated-view" hidden><p>Estimated 3D · meters · X right · Y up · Z forward</p><p id="alignment-state" role="status"></p></div></div><div class="model-pane"><div id="inspector-avatar" hidden></div><label>Comparison model<select id="comparison-model"><option value="current">Current model</option><option value="ene">Ene</option><option value="rei">Rei</option></select></label><p id="comparison-load-state" role="status" aria-live="polite"></p><details id="comparison-details"><summary>Model data</summary><p id="comparison-state" role="status" aria-live="polite"></p></details><label id="rig-control" class="check" hidden><input id="show-model-bones" type="checkbox" checked> Show model bones</label><label id="focus-control" hidden>Model view<select id="model-focus"><option value="body">Body</option><option value="face">Face</option><option value="leftHand">Left hand</option><option value="rightHand">Right hand</option></select></label><p id="rig-coverage" hidden></p><p id="mapping-guide" hidden>Camera points set joint directions. These directions rotate model bones. Skin weights move the surface. Face points control head motion, eyes, and mouth shapes. Blue lines show model bones. Gold points show joints. Bone lengths remain fixed.</p></div>
      <div id="inspector-3d-controls" class="toolbar" hidden><button id="orbit-left">Orbit left</button><button id="orbit-right">Orbit right</button><button id="zoom-in">Zoom in</button><button id="zoom-out">Zoom out</button><button id="reset-view">Reset view</button></div></div>
      <div><label>Joint index<input id="joint-index" type="number" min="0" max="477" value="13"></label><p id="joint-selection" role="status" aria-live="polite"></p><div id="channel-summary" aria-label="Solver summary"></div><p id="shared-hand-summary"></p><details><summary>Joint values</summary><pre id="joint-detail"></pre></details><details><summary>Timing and distributions</summary><pre id="tracking-metrics"></pre></details><details><summary>Solver values and reasons</summary><pre id="solver-outcomes"></pre></details><details><summary>Recorded reasons</summary><pre id="recorded-outcomes">No replay result</pre></details></div></div>
      <section><h2>Trace</h2><p>Traces contain personal movement. Exports contain no camera images by default.</p>
      <label class="check"><input id="record-video" type="checkbox"> Record camera video</label><div class="toolbar"><button id="record-trace">Record trace</button><button id="stop-trace">Stop recording</button><button id="export-trace">Export trace</button><button id="export-video" disabled>Export camera video</button><button id="import-trace">Import trace</button><input id="trace-file" type="file" accept=".json" hidden></div>
      <div class="toolbar"><button id="replay-trace">Replay</button><button id="import-camera-video">Import camera video</button><input id="camera-video-file" type="file" accept="video/webm" hidden><button id="remove-camera-video">Remove camera video</button><button id="step-back">Step back</button><button id="step-forward">Step forward</button><button id="live-inspector">Return to live</button></div><label>Replay event<input id="trace-position" type="range" min="0" max="0" value="0"></label><p id="trace-state" role="status"></p></section>`;
    this.get('inspector-start-camera').onclick=()=>document.querySelector<HTMLButtonElement>('#start')?.click();
    this.get('inspector-stop-camera').onclick=()=>document.querySelector<HTMLButtonElement>('#stop')?.click();
    for(const label of ['Face','Body','Left hand','Right hand']){const row=document.createElement('p');const heading=document.createElement('strong');heading.textContent=label;const value=document.createElement('span');row.append(heading,document.createElement('br'),value);this.get('channel-summary').append(row);}
    this.canvas=this.get('observation-canvas');
    this.get('pause-inspector').onclick=()=>{this.paused=!this.paused;this.get('pause-inspector').textContent=this.paused?'Resume':'Pause inspector';if(this.paused){if(!this.replaying)this.shown=this.layer==='combined'?this.combinedLatest:this.latest;this.frozen=document.createElement('canvas');this.frozen.width=this.canvas.width;this.frozen.height=this.canvas.height;this.frozen.getContext('2d')!.drawImage(this.canvas,0,0);}else{this.frozen=null;if(!this.replaying)this.shown=this.latest;}for(const id of ['inspector-task','inspector-hand','dense-face','align-hands']){const control=this.get<HTMLInputElement>(id);control.disabled=this.paused;control.title=this.paused?'Resume the inspector to change this control.':'';}this.setDemand();};
    this.get('show-model-bones').onchange=()=>this.avatarViewer?.setRigVisible(this.get<HTMLInputElement>('show-model-bones').checked);
    this.get('model-focus').onchange=()=>this.avatarViewer?.setDiagnosticFocus(this.get<HTMLSelectElement>('model-focus').value);
    this.get('comparison-model').onchange=()=>{if(this.hasAvatar)void this.prepareAvatar();};
    this.get('inspector-layer').onchange=()=>{this.dispose3D();this.avatarOperation.cancel();this.avatarViewer?.dispose();this.avatarViewer=null;this.avatarSolver=null;if(this.hasAvatar)void this.prepareAvatar();};
    this.get<HTMLInputElement>('joint-index').oninput=()=>{this.selectedJoint=Math.max(0,Math.min(477,Number(this.get<HTMLInputElement>('joint-index').value)));};
    this.canvas.onclick=event=>{const sample=this.shown;if(!sample)return;const rect=this.canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*800/rect.width,y=(event.clientY-rect.top)*600/rect.height;let distance=Infinity;this.points(sample).forEach((p,i)=>{const q=containedPoint(p,sample.diagnostics.inputSize,800,600,this.displaySettings().mirror),d=Math.hypot(q.x-x,q.y-y);if(d<distance){distance=d;this.selectedJoint=i;}});this.get<HTMLInputElement>('joint-index').value=String(this.selectedJoint);};
    this.get('record-trace').onclick=()=>this.startRecord();this.get('stop-trace').onclick=()=>this.stopRecord();
    this.get('export-trace').onclick=()=>{if(this.recorder)download(this.recorder.export(),'tracking-trace.json');};
    this.get('export-video').onclick=()=>{if(this.videoBlob)download(this.videoBlob,'tracking-camera.webm');};
    const file=this.get<HTMLInputElement>('trace-file');this.get('import-trace').onclick=()=>file.click();file.onchange=()=>{const selected=file.files?.[0];file.value='';if(selected){const generation=++this.traceImportGeneration;void importTrace(selected).then(trace=>{if(this.disposed||generation!==this.traceImportGeneration)return;if(this.replay&&!confirm('Replace the current replay trace?'))return;this.clearReplayVideo();this.replay=trace;this.get<HTMLInputElement>('trace-position').max=String(Math.max(0,trace.events.length-1));this.message('Trace loaded. Select Replay.');}).catch(e=>{if(!this.disposed&&generation===this.traceImportGeneration)this.message(String(e));});}};
    const cameraFile=this.get<HTMLInputElement>('camera-video-file');
    this.get('import-camera-video').onclick=()=>cameraFile.click();
    cameraFile.onchange=()=>{const file=cameraFile.files?.[0];cameraFile.value='';if(file)void this.importCameraVideo(file);};
    this.get('remove-camera-video').onclick=()=>{this.clearReplayVideo();this.message('Camera video removed. Replay uses a plain background.');};
    this.get('replay-trace').onclick=()=>{this.replay??=this.recorder?.trace??null;if(this.replay){this.get<HTMLInputElement>('trace-position').max=String(Math.max(0,this.replay.events.length-1));this.seek(0);}};
    this.get('step-back').onclick=()=>this.seek(Number(this.get<HTMLInputElement>('trace-position').value)-1);this.get('step-forward').onclick=()=>this.seek(Number(this.get<HTMLInputElement>('trace-position').value)+1);
    this.get('trace-position').oninput=()=>this.seek(Number(this.get<HTMLInputElement>('trace-position').value));
    this.get('live-inspector').onclick=()=>{this.clearReplayVideo();this.replaying=false;this.paused=false;this.get('pause-inspector').textContent='Pause inspector';for(const id of ['inspector-task','inspector-hand','dense-face','align-hands'])this.get<HTMLInputElement>(id).disabled=false;this.shown=this.latest;this.resetSolver();this.setDemand();this.message('Live inspector');};
    this.get('reset-view').onclick=()=>this.reset3DView();
    for(const [id,angle]of [['orbit-left',-.2],['orbit-right',.2]] as const)this.get(id).onclick=()=>{if(!this.camera||!this.controls)return;const delta=this.camera.position.clone().sub(this.controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),angle);this.camera.position.copy(this.controls.target).add(delta);this.controls.update();};
    for(const [id,scale]of [['zoom-in',.9],['zoom-out',1.1]]as const)this.get(id).onclick=()=>{if(this.camera&&this.controls){this.camera.position.sub(this.controls.target).multiplyScalar(scale).add(this.controls.target);this.controls.update();}};
    const draw=(now:number)=>{if(this.visible&&!document.hidden&&now-this.lastDraw>=1000/30){this.draw(now);this.lastDraw=now;}this.frameHandle=requestAnimationFrame(draw);};this.frameHandle=requestAnimationFrame(draw);
  }
  private get<T extends HTMLElement=HTMLElement>(id:string){return this.element.querySelector<T>(`#${id}`)!;}
  private get task(){return this.get<HTMLSelectElement>('inspector-task').value as TrackingTask;}
  private get hasAvatar(){return this.layer==='avatar'||this.layer==='combined';}
  private get layer(){return this.get<HTMLSelectElement>('inspector-layer').value;}
  private message(text:string){this.get('trace-state').textContent=text;}
  private setDemand(){this.demand(this.recording?'record':this.visible&&!this.paused&&!this.replaying?'inspect':'off');}
  setVisible(visible:boolean){this.visible=visible;if(!visible){if(this.recording)this.stopRecord();this.clearReplayVideo();this.images.clear();this.dispose3D();this.avatarOperation.cancel();this.avatarViewer?.dispose();this.avatarViewer=null;this.avatarSolver=null;}else if(this.hasAvatar&&!this.avatarViewer){void this.prepareAvatar();}this.setDemand();}
  receive(frame:TrackingFrame,diagnostics:DiagnosticEnvelope,image:ImageBitmap|null){
    if(this.disposed){image?.close();return;}
    if(this.latest&&this.latest.diagnostics.sessionId!==diagnostics.sessionId){this.stopRecord();this.images.clear();this.combinedLatest=null;this.resetSolver();}
    if(image)this.images.retain(diagnostics.captureSequence,image,diagnostics);
    this.latest={frame,diagnostics};if(isCombinedCapture(diagnostics))this.combinedLatest=this.latest;if(!this.paused&&!this.replaying)this.shown=this.latest;
    this.metrics.add(diagnostics,diagnostics.receivedAtMs??diagnostics.captureTimeMs);
    if(this.recording&&this.recorder){
      const time=performance.now()-this.recordingStart;
      const copy=structuredClone(frame),anchor=this.clock().anchor;copy.timestamp-=anchor;for(const task of Object.values(copy.samples))task.timestamp-=anchor;
      if(this.recorder.append({kind:'sample',frame:copy,diagnostics,reasons:[]},time))this.recordedFrame=frame.sequence;
      if(this.recorder.stoppedReason)this.stopRecord();
    }
  }
  apply(frame:TrackingFrame|null,dt:number,now:number){
    if(this.recording&&!this.stream())this.stopRecord();
    if(!frame)return;
    if(!this.replaying&&!this.paused&&this.visible){this.showComparisonDetails(this.settings(),this.calibration());const calibration=JSON.stringify(this.calibration());if(calibration!==this.solverCalibration){this.solver.setCalibration(this.calibration());this.avatarSolver?.setCalibration(this.calibration());this.solverCalibration=calibration;}this.outcomes=[];this.solver.diagnosticSink=outcome=>{if(this.outcomes.length<512)this.outcomes.push(outcome);};if(this.latest)this.solver.sampleIds=Object.fromEntries(Object.entries(this.latest.diagnostics.tasks).map(([name,task])=>[name,task.sampleSequence]));this.solver.update(frame,this.settings(),dt,now);this.avatarSolver?.update(frame,this.settings(),dt,now);this.lastUse=now;this.metrics.recordUse(this.outcomes,now-this.clock().anchor);}
    if(this.latest)this.latest.diagnostics.solverUseTimeMs=now-this.clock().anchor;
    if(this.recording&&this.recorder&&this.recordedFrame===frame.sequence){const recordedReasons:SolverOutcome[]=[];if(this.recordingSolver&&this.latest)this.recordingSolver.sampleIds=Object.fromEntries(Object.entries(this.latest.diagnostics.tasks).map(([name,task])=>[name,task.sampleSequence]));if(this.recordingSolver)this.recordingSolver.diagnosticSink=outcome=>{if(recordedReasons.length<512)recordedReasons.push(outcome);};const time=performance.now()-this.recordingStart,settings=JSON.stringify(this.settings()),calibration=JSON.stringify(this.calibration());if(settings!==this.settingsState){this.recorder.append({kind:'settings',settings:this.settings()},time);this.settingsState=settings;}if(calibration!==this.calibrationState){this.recorder.append({kind:'calibration',calibration:this.calibration()},time);this.recordingSolver?.setCalibration(this.calibration());this.calibrationState=calibration;}const relative=structuredClone(frame);relative.timestamp-=this.clock().anchor;for(const sample of Object.values(relative.samples))sample.timestamp-=this.clock().anchor;this.recordingSolver?.update(relative,this.settings(),dt,now-this.clock().anchor);this.recorder.append({kind:'apply',frameSequence:frame.sequence,solverTimeMs:now-this.clock().anchor,dt,reasons:recordedReasons},time);if(this.recorder.stoppedReason)this.stopRecord();}
  }
  private startRecord(){
    if(this.video.active){this.message('Stop camera video before starting another trace.');return;}
    if(!this.latest||!this.stream()){this.message('Start the camera before recording a trace.');return;}
    if(this.recorder&&!confirm('Discard the previous unsaved trace?'))return;
    this.stopRecord();this.videoBlob=null;this.get<HTMLButtonElement>('export-video').disabled=true;
    this.recordingStart=performance.now();
    this.recorder=new TraceRecorder({runtime:this.latest.diagnostics.runtimeVersion,modelHashes:this.latest.diagnostics.modelHashes,solverVersion,settings:this.settings(),calibration:this.calibration(),rigHashes:[],startTimeMs:performance.timeOrigin+this.recordingStart-this.clock().anchor});this.recordingSolver=new MotionSolver(createCanonicalRig());this.recordingSolver.setCalibration(this.calibration());this.recordedFrame=-1;this.recording=true;this.settingsState=JSON.stringify(this.settings());this.calibrationState=JSON.stringify(this.calibration());this.recordingTimer=setTimeout(()=>{if(this.recorder)this.recorder.stoppedReason='Trace reached 60 seconds.';this.stopRecord();},60000);this.setDemand();this.message('Recording trace');
    const recorded=this.recorder;
    if(this.get<HTMLInputElement>('record-video').checked)try{this.video.start(this.stream()!,this.recorder.trace.id,(blob,mapping)=>{void sha256(blob).then(hash=>{if(this.recorder!==recorded)return;this.videoBlob=blob;recorded.trace.manifest.video={...mapping,sha256:hash};this.get<HTMLButtonElement>('export-video').disabled=false;this.message('Camera video is ready. Export the trace and camera video together.');}).catch(e=>this.message(String(e)));},performance.now()-this.recordingStart);}catch(e){this.message(String(e));}
  }
  private clearReplayVideo(){this.videoImportGeneration++;this.replayVideo.clear();}
  private async importCameraVideo(file:File){
    const trace=this.replay??this.recorder?.trace;
    if(!trace?.manifest.video){this.message('Import a trace with a camera video mapping first.');return;}
    if(trace.manifest.startTimeMs===undefined){this.message('This trace has no recording start time. Camera video cannot be aligned.');return;}
    this.clearReplayVideo();const generation=this.videoImportGeneration;
    try{await this.replayVideo.load(file,trace.manifest.video,trace.id);if(generation!==this.videoImportGeneration)return;
      this.message(trace.manifest.video.sha256?'Camera video matches the trace. Select Replay.':'Camera video loaded without a recorded hash. Verify that it belongs to this trace.');
    }catch(error){if(generation===this.videoImportGeneration)this.message(String(error));}
  }
  private stopRecord(){clearTimeout(this.recordingTimer);this.recording=false;this.recordingSolver=null;this.video.stop();this.setDemand();if(this.recorder)this.message(this.recorder.stoppedReason||'Trace stopped. Export the trace to keep it.');}
  private resetSolver(){if(this.avatarViewer?.vrm)this.avatarSolver=new MotionSolver(this.avatarViewer.vrm);this.rig=createCanonicalRig();this.solver=new MotionSolver(this.rig);this.solver.setCalibration(this.calibration());}
  private seek(index:number){if(!this.replay)return;this.replaying=true;this.paused=false;this.get('pause-inspector').textContent='Pause inspector';for(const id of ['inspector-task','inspector-hand','dense-face','align-hands'])this.get<HTMLInputElement>(id).disabled=false;this.setDemand();this.images.clear();const target=Math.max(0,Math.min(this.replay.events.length-1,index));this.get<HTMLInputElement>('trace-position').value=String(target);let settings=this.replay.manifest.settings,calibration=this.replay.manifest.calibration;
    replayTrace(this.replay,{reset:()=>{this.resetSolver();this.shown=null;this.outcomes=[];},settings:value=>{settings=value;},calibration:value=>{calibration=value;this.solver.setCalibration(value);this.avatarSolver?.setCalibration(value);},sample:(frame,diagnostics)=>{this.shown={frame,diagnostics};this.solver.sampleIds=Object.fromEntries(Object.entries(diagnostics.tasks).map(([name,task])=>[name,task.sampleSequence]));},apply:(frame,dt,now,diagnostics)=>{this.shown={frame,diagnostics};this.solver.sampleIds=Object.fromEntries(Object.entries(diagnostics.tasks).map(([name,task])=>[name,task.sampleSequence]));this.outcomes=[];this.solver.diagnosticSink=outcome=>this.outcomes.push(outcome);this.solver.update(frame,settings,dt,now);this.avatarSolver?.update(frame,settings,dt,now);}},target);
    this.replaySettings=settings;this.showComparisonDetails(settings,calibration);
    const stored=this.replay.events.slice(0,target+1).reverse().find(event=>event.kind==='apply');this.get('recorded-outcomes').textContent=JSON.stringify(stored?.kind==='apply'?stored.reasons??[]:[],null,2);
    this.message(`${this.replay.manifest.solverVersion===solverVersion?'Replay':'Comparison'} · Event ${target} · ${(this.replay.events[target]?.timeMs??0).toFixed(1)} ms. Import its camera video to show recorded images.`);
  }
  private worldPoints(frame:TrackingFrame):Landmark[]{if(this.layer==='estimated'&&this.task==='hands'&&this.get<HTMLInputElement>('align-hands').checked)return calculatedWristAlignment(frame,this.get<HTMLSelectElement>('inspector-hand').value as 'left'|'right')?.raw??[];return this.task==='pose'?frame.pose:this.task==='hands'?frame.hands.find(x=>x.side.toLowerCase()===this.get<HTMLSelectElement>('inspector-hand').value)?.world??[]:[];}
  private points(sample:{frame:TrackingFrame;diagnostics:DiagnosticEnvelope}):Landmark[]{if(this.task==='face')return sample.diagnostics.tasks.face.observations?.[0]??[];if(this.task==='pose')return sample.frame.poseImage;return sample.frame.hands.find(x=>x.side.toLowerCase()===this.get<HTMLSelectElement>('inspector-hand').value)?.landmarks??[];}
  private connections(){return this.task==='pose'?PoseLandmarker.POSE_CONNECTIONS:this.task==='hands'?HandLandmarker.HAND_CONNECTIONS:FaceLandmarker.FACE_LANDMARKS_CONTOURS;}
  private draw(now:number){
    let sample=this.shown;
    if(this.layer==='combined'&&!this.paused){
      if(!this.replaying)sample=this.combinedLatest;
      else if(this.replay){const index=Number(this.get<HTMLInputElement>('trace-position').value);const event=this.replay.events.slice(0,index+1).reverse().find(event=>event.kind==='sample'&&isCombinedCapture(event.diagnostics));sample=event?.kind==='sample'?event:null;}
    }
    this.announce('inspector-state',this.recording?(this.video.active?'Recording trace and camera video':'Recording trace'):this.replaying?'Replay':this.paused?'Inspector paused':this.stream()?'Camera active':'Camera stopped');
    if(this.replaying&&this.replay&&sample)this.replayVideo.seek(replayVideoTime(this.replay,sample.diagnostics,this.layer==='combined'?'face':this.task));
    this.element.classList.toggle('combined-view',this.layer==='combined');
    const observation=this.layer==='observations'||this.layer==='combined';this.canvas.hidden=!observation;this.get('estimated-view').hidden=!['estimated','accepted'].includes(this.layer);this.get('inspector-avatar').hidden=!this.hasAvatar;this.get('inspector-3d-controls').hidden=!['estimated','accepted'].includes(this.layer);
    this.get('inspector-hand').closest('label')!.hidden=this.task!=='hands'||!['observations','estimated','combined'].includes(this.layer);
    this.get('dense-face').closest('label')!.hidden=this.task!=='face'||this.layer!=='observations';
    this.get('align-hands').closest('label')!.hidden=this.task!=='hands'||this.layer!=='estimated';
    this.get('comparison-model').closest('label')!.hidden=!this.hasAvatar;
    for(const id of ['rig-control','focus-control','rig-coverage','mapping-guide'])this.get(id).hidden=!this.hasAvatar;
    this.get('comparison-details').hidden=!this.hasAvatar;this.get('comparison-load-state').hidden=!this.hasAvatar;
    if(observation){const context=this.canvas.getContext('2d')!;context.fillStyle='#101827';context.fillRect(0,0,800,600);
      if(this.paused&&this.frozen)context.drawImage(this.frozen,0,0);
      else if(sample){const task=sample.diagnostics.tasks[this.layer==='combined'?'face':this.task],image=this.replaying?this.replayVideo.frame:this.images.get(task);if(this.layer!=='combined')this.announce('observation-state',image?'Matched camera image.':'No matching image. Points use a plain background.');if(image){const width=image instanceof HTMLVideoElement?image.videoWidth:image.width,height=image instanceof HTMLVideoElement?image.videoHeight:image.height;const scale=Math.min(800/width,600/height),w=width*scale,h=height*scale;context.save();if(this.displaySettings().mirror){context.translate(800,0);context.scale(-1,1);}context.drawImage(image,(800-w)/2,(600-h)/2,w,h);context.restore();}else{context.fillStyle='#E4EAF5';context.fillText('No matching image. Points use a plain background.',16,24);}
        const age=performance.timeOrigin+now-this.clock().anchor-task.sampleTimeMs;const stale=!this.replaying&&age>=500;
        const groups=this.layer==='combined'?combinedObservations(sample.frame,sample.diagnostics):[{task:this.task,points:this.points(sample),edges:this.connections()}];
        for(const group of groups){
          const points=group.points,mapped=points.map(p=>containedPoint(p,sample.diagnostics.inputSize,800,600,this.displaySettings().mirror));
          if(group.task==='face'&&this.layer==='combined'){
            context.save();context.strokeStyle=stale?'#879B99':'#E4EAF5';context.lineWidth=.6;context.beginPath();
            for(const edge of group.edges){const a=mapped[edge.start],b=mapped[edge.end];if(a&&b&&[a.x,a.y,b.x,b.y].every(Number.isFinite)){context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);}}
            context.stroke();context.restore();
          }else{
            for(const edge of group.edges){const a=mapped[edge.start],b=mapped[edge.end];if(!a||!b||![a.x,a.y,b.x,b.y].every(Number.isFinite))continue;const rejected=[points[edge.start],points[edge.end]].some(p=>(p.visibility??1)<=.55||(p.presence??1)<=.55);drawObservationEdge(context,a,b,rejected,stale);}
            context.setLineDash([]);
            if(group.task!=='face'||this.get<HTMLInputElement>('dense-face').checked)for(const [index,p]of mapped.entries())if(Number.isFinite(p.x+p.y))drawObservationPoint(context,p,group.task===this.task&&index===this.selectedJoint,stale);
          }
        }
        if(this.layer==='combined')this.announce('observation-state',`${image?'Matched camera image.':'No matching image.'} Face: ${groups.find(g=>g.task==='face')?.points.length??0} points. Body: ${groups.find(g=>g.task==='pose')?.points.length??0} points. Hands: ${groups.filter(g=>g.task==='hands').length}. ${stale?'Sample is stale.':''}`);

      }
      context.globalAlpha=1;
    }else if(this.layer==='estimated'||this.layer==='accepted')this.draw3D();
    if(this.hasAvatar){this.avatarViewer?.draw(this.paused?0:1/30);this.get('mapping-guide').dataset.capture=String(sample?.diagnostics.captureSequence??0);}
    if(!sample){this.showChannelSummary([]);this.announce('observation-state','No camera sample.');this.announce('joint-selection','No joint sample.');this.get('joint-detail').textContent='Missing · No camera sample';this.get('tracking-metrics').textContent='Face: unavailable\nBody: unavailable\nLeft hand: unavailable\nRight hand: unavailable';}
    if(sample&&now-this.lastSummary>=250){this.lastSummary=now;this.showChannelSummary(this.outcomes);sample.diagnostics.displayTimeMs=this.replaying?sample.diagnostics.captureTimeMs:performance.timeOrigin+now-this.clock().anchor;const point=(this.layer==='estimated'?this.worldPoints(sample.frame):this.points(sample))[this.selectedJoint];const jointLabel=`${this.task} · ${this.task==='pose' ? ({11:'Left shoulder',12:'Right shoulder',13:'Left elbow',14:'Right elbow',15:'Left wrist',16:'Right wrist',23:'Left hip',24:'Right hip',25:'Left knee',26:'Right knee',27:'Left ankle',28:'Right ankle'} as Record<number,string>)[this.selectedJoint]??'Joint' : this.task==='hands'?this.get<HTMLSelectElement>('inspector-hand').value+' hand joint':'Joint'} ${this.selectedJoint}`;this.announce('joint-selection',jointLabel);this.get('joint-detail').textContent=`${jointLabel}\n${this.layer==='estimated'?'Raw world coordinates · meters':'Raw image coordinates'}\n${point?JSON.stringify(point,null,2):'Missing'}\nConfidence defaults to 1 only inside the solver. Missing values remain unavailable here.`;this.get('tracking-metrics').textContent=this.replaying?'Live metrics are unavailable during replay.':(['face','pose','hands']as const).map(task=>{
      const m=this.metrics.summary(task,performance.timeOrigin+now-this.clock().anchor);
      const line=(label:string,values:typeof m.steady)=>`${label}: ${values.hz===null?'Unavailable':values.hz.toFixed(1)+' Hz'} · ${values.count} samples / ${(values.durationMs/1000).toFixed(1)} s\nReceipt age p50 / p95: ${values.p50?.toFixed(1)??'—'} / ${values.p95?.toFixed(1)??'—'} ms`;
      return `${task} · rolling 10-second window\n${line('Warm-up (first 10 seconds)',m.warmup)}\n${line('After warm-up',m.steady)}`;
    }).join('\n')+(()=>{const counts=this.metrics.rejections();return `\nRejected channel uses: ${counts.uses}\nDistinct rejected channel samples: ${counts.uniqueSamples}`;})();this.get('solver-outcomes').textContent=this.outcomes.map(x=>`${x.channel}: ${x.accepted?'Accepted':'Rejected'} · ${x.reason} · ${x.stage}\nSample ${x.sampleId??'Unavailable'}; joint ${x.jointIndex??'Unavailable'}; value ${x.value??'Unavailable'}; threshold ${x.threshold??'Unavailable'}${x.defaultApplied===undefined?'':`; runtime default ${x.defaultApplied}`}`).join('\n')||'No solver result';if(this.solver.headDiagnostic)this.get('solver-outcomes').textContent+='\nHead orientations (quaternions):\n'+JSON.stringify(this.solver.headDiagnostic,null,2);}
    if(this.recording&&performance.now()-this.recordingStart>60000){if(this.recorder)this.recorder.stoppedReason='Trace reached 60 seconds.';this.stopRecord();}
  }
  private announce(id:string,text:string){const element=this.get(id);if(element.textContent!==text)element.textContent=text;}
  private reset3DView(){const center=this.layer==='accepted'?1:0;this.camera?.position.set(0,center+.2,3.5);this.controls?.target.set(0,center,0);this.controls?.update();}
  private draw3D(){
    if(!this.renderer){const container=this.get('estimated-view');this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setSize(640,480,false);container.append(this.renderer.domElement);this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#101827');this.camera=new THREE.PerspectiveCamera(45,4/3,.01,100);this.camera.position.set(0,1.2,3.5);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.reset3DView();this.scene.add(new THREE.AxesHelper(.5),new THREE.GridHelper(2,10));this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#7ce1be'}));this.scene.add(this.lines);}
    const positions:number[]=[];
    if(this.layer==='accepted'){for(const[a,b]of rigSegments(this.rig))positions.push(...a.toArray(),...b.toArray());}
    else if(this.shown){
      const alignment=this.task==='hands'&&this.get<HTMLInputElement>('align-hands').checked;
      const calculated=alignment?calculatedWristAlignment(this.shown.frame,this.get<HTMLSelectElement>('inspector-hand').value as 'left'|'right'):null;
      const points=alignment?calculated?.aligned??[]:this.worldPoints(this.shown.frame);
      if(calculated)positions.push(...estimatedSegments(this.shown.frame.pose,PoseLandmarker.POSE_CONNECTIONS));
      positions.push(...estimatedSegments(points,this.connections()));
      this.announce('alignment-state',alignment?calculated?'Calculated wrist alignment':'Calculated wrist alignment unavailable. No matched hand and pose wrist.':this.task==='hands'?'Separate hand estimate.':'');
    }
    this.lines!.geometry.dispose();this.lines!.geometry=new THREE.BufferGeometry();this.lines!.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.controls!.update();this.renderer.render(this.scene!,this.camera!);this.get('estimated-view').setAttribute('aria-label',this.layer==='accepted'?'Canonical skeleton in meters':'Estimated 3D in meters. X right, Y up, Z forward.');
  }
  private showChannelSummary(outcomes:readonly SolverOutcome[]){
    const summary=trackingSummary(outcomes);
    summary.rows.forEach((row,index)=>{const value=this.get('channel-summary').children[index].querySelector('span')!;if(value.textContent!==row.text)value.textContent=row.text;});
    this.announce('shared-hand-summary',summary.shared);
  }
  private showComparisonDetails(settings:StudioSettings,calibration:Calibration|null){
    if(!this.comparisonAsset||!this.avatarViewer)return;
    const key=JSON.stringify(settings);
    if(key!==this.comparisonSettings){this.avatarViewer.configure({...settings});this.avatarViewer.renderer.domElement.style.transform=settings.mirror?'scaleX(-1)':'';this.comparisonSettings=key;}
    this.announce('comparison-load-state',`${this.comparisonAsset.id==='current'?'Current model':this.comparisonAsset.id==='ene'?'Ene':'Rei'} is ready.`);
    this.announce('comparison-state',`${this.comparisonAsset.id} · SHA-256 ${this.comparisonAsset.hash} · ${JSON.stringify({settings,calibration})}`);
  }
  private async prepareAvatar(){
    this.avatarOperation.cancel();this.avatarViewer?.dispose();this.avatarViewer=null;this.avatarSolver=null;
    this.comparisonAsset=null;this.comparisonSettings='';this.get('comparison-state').setAttribute('role','status');this.get('comparison-state').setAttribute('aria-live','polite');this.get('comparison-state').textContent='Preparing comparison model';this.announce('comparison-load-state','Preparing comparison model');this.announce('rig-coverage','');
    const signal=this.avatarOperation.begin(),id=this.get<HTMLSelectElement>('comparison-model').value;
    let viewer:AvatarViewer|null=null;
    try{
      const blob=id==='current'?this.currentAvatar():await abortable(this.comparisonAvatar(id,signal),signal);
      signal.throwIfAborted();
      if(!blob)throw new Error('Select a model to use the Avatar layer. Other layers need no model.');
      const settings=this.displaySettings();
      viewer=new AvatarViewer(this.get('inspector-avatar'),settings);this.avatarViewer=viewer;
      const candidate=await prepareSelection(viewer,blob,signal);
      if(this.avatarViewer!==viewer){viewer.disposePreparedAvatar(candidate);return;}
      viewer.commitAvatar(candidate);viewer.setRigVisible(this.get<HTMLInputElement>('show-model-bones').checked);viewer.setDiagnosticFocus(this.get<HTMLSelectElement>('model-focus').value);
      const missing=trackedBones.filter(name=>name!=='upperChest'&&!candidate.vrm.humanoid.getNormalizedBoneNode(name));
      this.announce('rig-coverage',missing.length?`Missing model bones: ${missing.join(', ')}.`:'Model bones are available for the body, shoulders, arms, hands, ten fingers, head, and eyes.');
      this.avatarSolver=candidate.retarget;this.avatarSolver.setCalibration(this.calibration());this.avatarOperation.finish(signal);
      const hash=await sha256(blob);if(this.avatarViewer!==viewer||signal.aborted)return;
      this.comparisonAsset={id,hash};this.showComparisonDetails(settings,this.calibration());
      if(this.replaying)this.seek(Number(this.get<HTMLInputElement>('trace-position').value));
    }catch(e){
      viewer?.dispose();if(this.avatarViewer===viewer){this.avatarViewer=null;this.avatarSolver=null;}
      if(this.avatarOperation.isCurrent(signal)&&!this.disposed){
        this.avatarOperation.finish(signal);this.comparisonAsset=null;
        const status=this.get('comparison-state');status.setAttribute('role','alert');status.setAttribute('aria-live','assertive');
        status.textContent=`Comparison failed: ${String(e)}`;this.announce('comparison-load-state',status.textContent);this.message(status.textContent);
      }
    }
  }
  private dispose3D(){this.controls?.dispose();this.scene?.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry?.dispose();if(Array.isArray(mesh.material))mesh.material.forEach(material=>material.dispose());else mesh.material?.dispose();});this.renderer?.dispose();this.renderer?.forceContextLoss();this.renderer?.domElement.remove();this.renderer=null;this.scene=null;this.lines=null;this.controls=null;this.camera=null;}
  dispose(){this.disposed=true;this.traceImportGeneration++;this.clearReplayVideo();cancelAnimationFrame(this.frameHandle);this.stopRecord();this.recorder=null;this.replay=null;this.videoBlob=null;this.latest=null;this.combinedLatest=null;this.shown=null;this.frozen=null;this.images.clear();this.dispose3D();this.avatarOperation.cancel();this.avatarViewer?.dispose();this.demand('off');}
}
