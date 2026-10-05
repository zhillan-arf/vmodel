import { FilesetResolver, FaceLandmarker, PoseLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';
import type { TrackingFrame, TrackingSample } from './types';
import type { TaskDiagnostic, DiagnosticEnvelope, TrackingTask } from './tracking-diagnostics';
import assets from '../config/runtime-assets.json';
let activeDelegate: 'GPU'|'CPU' = 'GPU';
const taskDiagnostics = {} as Record<TrackingTask,TaskDiagnostic>;
const modelHashes = Object.fromEntries(['face','pose','hands'].map((name,i) => [name,assets[i].sha256])) as Record<TrackingTask,string>;
const epochNow = () => performance.timeOrigin + performance.now();

let face: FaceLandmarker | undefined, pose: PoseLandmarker | undefined, hands: HandLandmarker | undefined;
let ready = false;
let count = 0;
let modelTimestampOrigin: number | undefined;
let lastPose: TrackingFrame['pose'] = [], lastHands: TrackingFrame['hands'] = [];
let lastPoseImage: TrackingFrame['poseImage'] = [];
let poseSample: TrackingSample = { timestamp: 0, inferenceMs: 0, present: false };
let handsSample: TrackingSample = { timestamp: 0, inferenceMs: 0, present: false };
async function initialize(delegate: 'GPU' | 'CPU') {
  const runtime = await FilesetResolver.forVisionTasks('/runtime/wasm', true);
  // Tasks Vision 1.0.1 clears global ModuleFactory after creating a task. ES module
  // caching would then skip its setup for the next task; give each task a stable
  // module URL while reusing the same local WASM binary.
  const files = (task: string) => ({ ...runtime, wasmLoaderPath: `${runtime.wasmLoaderPath}?task=${task}-${delegate}` });
  face = await FaceLandmarker.createFromOptions(files('face'), {
    baseOptions: { modelAssetPath: '/runtime/face_landmarker.task', delegate },
    runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
  });
  pose = await PoseLandmarker.createFromOptions(files('pose'), {
    baseOptions: { modelAssetPath: '/runtime/pose_landmarker_lite.task', delegate }, runningMode: 'VIDEO', numPoses: 1,
  });
  hands = await HandLandmarker.createFromOptions(files('hands'), {
    baseOptions: { modelAssetPath: '/runtime/hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 2,
  });
}
function release() { face?.close(); pose?.close(); hands?.close(); face = undefined; pose = undefined; hands = undefined; }
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      // Optional worker diagnostic: exercise the installed CPU delegate directly.
      // CameraTracker omits this field and retains automatic GPU -> CPU fallback.
      let delegate: 'GPU' | 'CPU' = data.delegate === 'CPU' ? 'CPU' : 'GPU';
      if (delegate === 'CPU') await initialize(delegate);
      else {
        try { await initialize(delegate); } catch { release(); delegate = 'CPU'; await initialize(delegate); }
      }
      activeDelegate = delegate; ready = true; self.postMessage({ type: 'ready', delegate });
    } catch (error) { release(); self.postMessage({ type: 'error', message: `Tracking could not start: ${String(error)}` }); }
    return;
  }
  if (data.type !== 'frame') return;
  const bitmap = data.bitmap as ImageBitmap;
  try {
    if (!ready || !face || !pose || !hands) throw new Error('Tracker is not initialized.');
    const start = performance.now(), timestamp = data.timestamp as number;
    if (!Number.isFinite(timestamp)) throw new Error('Tracking frame timestamp must be finite.');
    // Keep epoch milliseconds in the external freshness contract, but give the
    // SDK a short session clock. Positive-landmark graphs in Tasks Vision 1.0.1
    // clamp epoch timestamps and then reject the next frame as a duplicate.
    modelTimestampOrigin ??= timestamp;
    const modelTimestamp = timestamp - modelTimestampOrigin + 1;
    const diagnostic = data.demand === 'inspect' || data.demand === 'record';
    const anchor = data.anchor ?? timestamp, capture = data.captureSequence ?? count + 1;
    const stamp = (task:TrackingTask, started:number, present:boolean, observations?:TaskDiagnostic['observations']) => {
      const previous = taskDiagnostics[task];
      taskDiagnostics[task] = { sampleSequence:(previous?.sampleSequence??0)+1,captureSequence:capture,sampleTimeMs:timestamp-anchor,startedAtMs:started-anchor,finishedAtMs:epochNow()-anchor,state:'new',present,...(diagnostic&&observations?{observations}:{}) };
    };
    for(const task of ['face','pose','hands'] as const)if(taskDiagnostics[task])taskDiagnostics[task]={...taskDiagnostics[task],state:'cached'};
    const faceStarted=epochNow();
    const f = face.detectForVideo(bitmap, modelTimestamp);
    stamp('face',faceStarted,f.faceLandmarks.length>0,diagnostic?f.faceLandmarks:undefined);
    const faceSample: TrackingSample = { timestamp, inferenceMs: performance.now() - start, present: f.faceLandmarks.length > 0 };
    const interval = data.quality === 'low' ? 2 : 1;
    if (count % interval === 0) {
      const poseStarted=epochNow();
      const poseStart = performance.now(), p = pose.detectForVideo(bitmap, modelTimestamp);
      stamp('pose',poseStarted,p.worldLandmarks.length>0);
      lastPose = p.worldLandmarks[0] ?? []; lastPoseImage = p.landmarks[0] ?? [];
      poseSample = { timestamp, inferenceMs: performance.now() - poseStart, present: lastPose.length > 0 };
      if (data.hands) {
        const handsStarted=epochNow();
        const handStart = performance.now(), h = hands.detectForVideo(bitmap, modelTimestamp);
        stamp('hands',handsStarted,h.landmarks.length>0);
        lastHands = h.landmarks.map((landmarks, i) => ({ landmarks, world: h.worldLandmarks[i], side: h.handedness[i][0].categoryName, score: h.handedness[i][0].score }));
        handsSample = { timestamp, inferenceMs: performance.now() - handStart, present: lastHands.length > 0 };
      } else { lastHands = []; handsSample = { timestamp, inferenceMs: 0, present: false }; }
    }
    if(!data.hands){lastHands=[];handsSample={timestamp,inferenceMs:0,present:false};}
    count++;
    const frame: TrackingFrame = { version: 1, sequence: count, timestamp,
      ...(bitmap.width > 0 && bitmap.height > 0 ? { inputSize: { width: bitmap.width, height: bitmap.height } } : {}),
      face: Object.fromEntries((f.faceBlendshapes[0]?.categories ?? []).map(x => [x.categoryName, x.score])),
      faceMatrix: f.facialTransformationMatrixes[0]?.data ?? null, pose: lastPose, poseImage: lastPoseImage, hands: lastHands, inferenceMs: performance.now() - start,
      samples: { face: faceSample, pose: poseSample, hands: handsSample } };
    if (diagnostic) {
      const disabled:TaskDiagnostic={sampleSequence:taskDiagnostics.hands?.sampleSequence??0,captureSequence:capture,sampleTimeMs:timestamp-anchor,startedAtMs:0,finishedAtMs:0,state:'disabled',present:false};
      const diagnostics:DiagnosticEnvelope={version:1,sessionId:data.sessionId,captureSequence:capture,captureTimeMs:timestamp-anchor,videoTimeMs:data.videoTimeMs,inputSize:frame.inputSize??{width:0,height:0},runtimeVersion:'@mediapipe/tasks-vision@1.0.1',modelHashes,delegate:activeDelegate,tasks:{...taskDiagnostics,hands:data.hands?taskDiagnostics.hands??disabled:disabled}};
      self.postMessage({type:'result',frame,diagnostics});
    } else {
      for(const task of Object.values(taskDiagnostics))delete task.observations;
      self.postMessage({ type: 'result', frame });
    }
  } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
  finally { bitmap.close(); }
};
