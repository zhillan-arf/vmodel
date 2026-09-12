import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({create:vi.fn(),resolve:vi.fn()}));
vi.mock('@mediapipe/tasks-vision',()=>({
  FilesetResolver:{forVisionTasks:mocks.resolve},
  FaceLandmarker:{createFromOptions:(files:unknown,options:unknown)=>mocks.create('face',files,options)},
  PoseLandmarker:{createFromOptions:(files:unknown,options:unknown)=>mocks.create('pose',files,options)},
  HandLandmarker:{createFromOptions:(files:unknown,options:unknown)=>mocks.create('hands',files,options)},
}));
let scope:{onmessage?:(event:{data:any})=>Promise<void>;postMessage:ReturnType<typeof vi.fn>};
const tasks=new Map<string,{detectForVideo:ReturnType<typeof vi.fn>;close:ReturnType<typeof vi.fn>}>();
beforeEach(async()=>{
  vi.resetModules();mocks.create.mockReset();mocks.resolve.mockReset();tasks.clear();
  scope={postMessage:vi.fn()};vi.stubGlobal('self',scope);
  mocks.resolve.mockResolvedValue({wasmLoaderPath:'/runtime/wasm/vision_wasm_internal.js',wasmBinaryPath:'/runtime/wasm/vision_wasm_internal.wasm'});
  mocks.create.mockImplementation(async(name,_files,options)=>{
    const result=name==='face'?{faceLandmarks:[],faceBlendshapes:[],facialTransformationMatrixes:[]}:
      name==='pose'?{worldLandmarks:[],landmarks:[]}:{landmarks:[],worldLandmarks:[],handedness:[]};
    const task={detectForVideo:vi.fn(()=>result),close:vi.fn()};tasks.set(`${name}-${options.baseOptions.delegate}`,task);return task;
  });
  await import('../src/tracking.worker');
});
afterEach(()=>vi.unstubAllGlobals());
it('releases partially created GPU tasks and initializes all CPU tasks after GPU failure',async()=>{
  const original=mocks.create.getMockImplementation()!;
  mocks.create.mockImplementation((name,files,options)=>{
    if(name==='pose'&&options.baseOptions.delegate==='GPU')throw new Error('GPU unavailable');
    return original(name,files,options);
  });
  await scope.onmessage!({data:{type:'init'}});
  expect(tasks.get('face-GPU')!.close).toHaveBeenCalledOnce();
  expect(['face','pose','hands'].every(name=>tasks.has(name+'-CPU'))).toBe(true);
  expect(scope.postMessage).toHaveBeenLastCalledWith({type:'ready',delegate:'CPU'});
  const loaders=mocks.create.mock.calls.map(([,files])=>files.wasmLoaderPath);
  expect(new Set(loaders).size).toBe(loaders.length);
});
it('reports a useful failure when both delegates cannot initialize',async()=>{
  mocks.create.mockRejectedValue(new Error('model file missing'));
  await scope.onmessage!({data:{type:'init'}});
  expect(scope.postMessage).toHaveBeenLastCalledWith({type:'error',message:expect.stringContaining('model file missing')});
});
it('can initialize and infer with every CPU task explicitly without attempting GPU',async()=>{
  await scope.onmessage!({data:{type:'init',delegate:'CPU'}});
  expect(mocks.create.mock.calls.map(([name,,options])=>[name,options.baseOptions.delegate])).toEqual([
    ['face','CPU'],['pose','CPU'],['hands','CPU'],
  ]);
  expect(scope.postMessage).toHaveBeenLastCalledWith({type:'ready',delegate:'CPU'});
  const close=vi.fn(),bitmap={width:320,height:240,close};
  await scope.onmessage!({data:{type:'frame',timestamp:100,bitmap,quality:'balanced',hands:true}});
  for(const name of ['face','pose','hands'])expect(tasks.get(name+'-CPU')!.detectForVideo).toHaveBeenCalledWith(bitmap,1);
  expect(scope.postMessage).toHaveBeenLastCalledWith({type:'result',frame:expect.objectContaining({
    sequence:1,inputSize:{width:320,height:240},samples:expect.objectContaining({
      face:expect.objectContaining({timestamp:100}),pose:expect.objectContaining({timestamp:100}),hands:expect.objectContaining({timestamp:100}),
    }),
  })});
  expect(close).toHaveBeenCalledOnce();
});
it('cleans up a partial explicit CPU initialization without retrying another delegate',async()=>{
  const original=mocks.create.getMockImplementation()!;
  mocks.create.mockImplementation((name,files,options)=>{
    if(name==='pose')throw new Error('CPU model failed');
    return original(name,files,options);
  });
  await scope.onmessage!({data:{type:'init',delegate:'CPU'}});
  expect(mocks.create.mock.calls.map(([name,,options])=>[name,options.baseOptions.delegate])).toEqual([['face','CPU'],['pose','CPU']]);
  expect(tasks.get('face-CPU')!.close).toHaveBeenCalledOnce();
  expect(scope.postMessage).toHaveBeenLastCalledWith({type:'error',message:expect.stringContaining('CPU model failed')});
});
it('keeps epoch freshness timestamps outside the SDK while all task clocks advance within its range',async()=>{
  await scope.onmessage!({data:{type:'init'}});
  for(const name of ['face','pose','hands']){
    const task=tasks.get(name+'-GPU')!,original=task.detectForVideo.getMockImplementation() as (...args:unknown[])=>unknown;
    task.detectForVideo.mockImplementation((bitmap,timestamp)=>{
      // The installed positive-photo run failed when epoch milliseconds saturated
      // its graph's clock; reject that input at the mocked SDK boundary here.
      if(timestamp>=2**31)throw new Error('Positive-landmark timestamp overflow');
      return original(bitmap,timestamp);
    });
  }
  const epoch=1_800_000_000_000,close=vi.fn(),timestamps=[epoch,epoch+100,epoch+200];
  for(const timestamp of timestamps)await scope.onmessage!({data:{type:'frame',timestamp,bitmap:{close},quality:'balanced',hands:true}});
  expect(tasks.get('face-GPU')!.detectForVideo.mock.calls.map(([,timestamp])=>timestamp)).toEqual([1,101,201]);
  for(const name of ['pose','hands'])expect(tasks.get(name+'-GPU')!.detectForVideo.mock.calls.map(([,timestamp])=>timestamp)).toEqual([1,201]);
  const messages=scope.postMessage.mock.calls.map(([message])=>message),frames=messages.filter(message=>message.type==='result').map(message=>message.frame);
  expect(messages.some(message=>message.type==='error')).toBe(false);
  expect(frames.map(frame=>frame.timestamp)).toEqual(timestamps);
  expect(frames.map(frame=>frame.samples.face.timestamp)).toEqual(timestamps);
  for(const name of ['pose','hands'])expect(frames.map(frame=>frame.samples[name].timestamp)).toEqual([epoch,epoch,epoch+200]);
  expect(close).toHaveBeenCalledTimes(3);
});
it('closes every frame and preserves separate sampling timestamps at reduced cadence',async()=>{
  await scope.onmessage!({data:{type:'init'}});
  const close=vi.fn();
  for(const timestamp of [100,200,300])await scope.onmessage!({data:{type:'frame',timestamp,bitmap:{close},quality:'balanced',hands:true}});
  expect(close).toHaveBeenCalledTimes(3);
  expect(tasks.get('face-GPU')!.detectForVideo).toHaveBeenCalledTimes(3);
  expect(tasks.get('pose-GPU')!.detectForVideo).toHaveBeenCalledTimes(2);
  expect(tasks.get('hands-GPU')!.detectForVideo).toHaveBeenCalledTimes(2);
  const frames=scope.postMessage.mock.calls.filter(([message])=>message.type==='result').map(([message])=>message.frame);
  expect(frames.map(f=>f.version)).toEqual([1,1,1]);expect(frames.map(f=>f.sequence)).toEqual([1,2,3]);
  expect(frames.map(f=>f.samples.pose.timestamp)).toEqual([100,100,300]);
  expect(frames.map(f=>f.samples.face.timestamp)).toEqual([100,200,300]);
  tasks.get('face-GPU')!.detectForVideo.mockImplementation(()=>{throw new Error('inference failure');});
  await scope.onmessage!({data:{type:'frame',timestamp:400,bitmap:{close},quality:'balanced',hands:true}});
  expect(close).toHaveBeenCalledTimes(4);
  expect(scope.postMessage).toHaveBeenLastCalledWith({type:'error',message:expect.stringContaining('inference failure')});
});
