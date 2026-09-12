import { chromium } from '@playwright/test';
import { connectOBS } from './obs-client.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
const run=promisify(execFile), pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ffmpeg=path.resolve('.tools/web/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe');
const ffprobe=path.resolve('.tools/web/ffmpeg-9.0.1-essentials_build/bin/ffprobe.exe');
const obs=await connectOBS(), results=[], errors=[], directories=new Map();
const audioName='Ene reference audio check '+Date.now();
let browser, page, ownRecording=false, addedAudio=false, originalProfile, originalScene;
try {
  if((await obs.request('GetRecordStatus')).outputActive || (await obs.request('GetStreamStatus')).outputActive)throw new Error('Stop the existing OBS recording/stream before this check.');
  originalProfile=(await obs.request('GetProfileList')).currentProfileName;
  originalScene=(await obs.request('GetCurrentProgramScene')).currentProgramSceneName;
  // Require the reviewed project collection and no physical/default audio inputs.
  const currentCollection=(await obs.request('GetSceneCollectionList')).currentSceneCollectionName;
  assert.equal(currentCollection,'Ene Studio');
  const initialInputs=(await obs.request('GetInputList')).inputs;
  assert(initialInputs.every(input=>input.inputKind==='window_capture'),'Unexpected input: inspect the project collection before recording.');
  browser=await chromium.launch({channel:'chrome',headless:false,args:['--window-size=1100,680']});
  const context=await browser.newContext({viewport:null});
  await context.addInitScript(()=>{window.__cameraRequests=0;navigator.mediaDevices.getUserMedia=async()=>{window.__cameraRequests++;throw new Error('Physical media access is disabled in this recording fixture.');};});
  page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(()=>!!window.__vmodel,undefined,{timeout:90000});
  await page.locator('#clean').click();
  const title='Ene Output Recording Check '+Date.now();
  await page.evaluate(title=>{
    document.title=title;
    window.__poseTimer=setInterval(()=>{
      const now=performance.timeOrigin+performance.now(),a=.4*Math.sin(now/450),c=Math.cos(a),s=Math.sin(a);
      window.__vmodel.setFrame({version:1,sequence:Math.floor(now/33),timestamp:now,face:{jawOpen:.3+.2*Math.sin(now/180)},faceMatrix:[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1],pose:[],poseImage:[],hands:[],inferenceMs:0,
        samples:Object.fromEntries(['face','pose','hands'].map(name=>[name,{timestamp:now,inferenceMs:0,present:name==='face'}]))});
    },33);
  },title);
  const recordingDir=path.resolve('ops/reports/local/obs/recordings');await mkdir(recordingDir,{recursive:true});
  await obs.request('CreateInput',{sceneName:'Ene Landscape',inputName:audioName,inputKind:'ffmpeg_source',inputSettings:{is_local_file:true,local_file:path.resolve('assets/voice/auditions/reference-v1/bright.wav'),looping:true,restart_on_activate:true,close_when_inactive:false},sceneItemEnabled:true});addedAudio=true;
  await obs.request('SetInputAudioMonitorType',{inputName:audioName,monitorType:'OBS_MONITORING_TYPE_NONE'});
  await obs.request('SetInputAudioTracks',{inputName:audioName,inputAudioTracks:{'1':true,'2':false,'3':false,'4':false,'5':false,'6':false}});
  await obs.request('CreateSceneItem',{sceneName:'Ene Portrait',sourceName:audioName,sceneItemEnabled:true});
  for(const orientation of ['Landscape','Portrait']) {
    await page.evaluate(orientation=>{const select=document.querySelector('#orientation');select.value=orientation.toLowerCase();select.dispatchEvent(new Event('change'));},orientation);
    let ready=false;
    for(let i=0;i<30;i++) {
      ready=await page.evaluate(async({title,orientation})=>{const {layouts}=await(await fetch('/api/output-layout')).json();return layouts.some(layout=>layout.title===title&&layout.orientation===orientation.toLowerCase());},{title,orientation});
      if(ready)break;await pause(250);
    }
    assert(ready);
    await run(process.execPath,['scripts/configure_obs.mjs','--attach','--title',title,...(orientation==='Portrait'?['--portrait']:[])]);
    directories.set('Ene '+orientation,(await obs.request('GetRecordDirectory')).recordDirectory);
    await obs.request('SetRecordDirectory',{recordDirectory:recordingDir});
    await obs.request('TriggerMediaInputAction',{inputName:audioName,mediaAction:'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART'});
    await pause(500);
    const before=await obs.request('GetStats');
    await obs.request('StartRecord');ownRecording=true;
    await pause(500);
    assert((await obs.request('GetRecordStatus')).outputActive,'OBS did not start recording. Dismiss its setup wizard or inspect its recording error.');
    await pause(10000);
    const after=await obs.request('GetStats');
    const stopped=await obs.request('StopRecord');
    const recordedPath=stopped.outputPath;
    assert(recordedPath&&path.resolve(recordedPath).startsWith(recordingDir+path.sep));
    let probe;
    // StopRecord acknowledges the request before the muxer necessarily flushes
    // its index. Do not inspect or switch profiles until finalization completes.
    for(let i=0;i<40;i++) {
      await pause(250);
      if((await obs.request('GetRecordStatus')).outputActive)continue;
      try { probe=JSON.parse((await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',recordedPath])).stdout); }catch{continue;}
      if(Number(probe.format.duration)>=9)break;
    }
    assert(probe&&Number(probe.format.duration)>=9,'OBS did not finish the recorded file.');ownRecording=false;
    const video=probe.streams.find(stream=>stream.codec_type==='video'),audio=probe.streams.find(stream=>stream.codec_type==='audio');
    assert.equal(video.width,orientation==='Landscape'?1280:720);assert.equal(video.height,orientation==='Landscape'?720:1280);
    assert.equal(video.avg_frame_rate,'30/1');assert.equal(video.codec_name,'h264');assert.equal(audio.codec_name,'aac');assert(Number(probe.format.duration)>=9);
    const frameHashes=(await run(ffmpeg,['-v','error','-i',recordedPath,'-map','0:v:0','-vf','fps=5,scale=32:32','-f','framemd5','-'])).stdout.split('\n').filter(line=>line&&!line.startsWith('#')).map(line=>line.split(',').at(-1).trim());
    const changedFrames=new Set(frameHashes).size;assert(changedFrames>10,'Recording must contain sustained moving frames.');
    const statsText=(await run(ffmpeg,['-hide_banner','-i',recordedPath,'-map','0:a:0','-af','astats=metadata=1:reset=0','-f','null','-'])).stderr;
    const rms=[...statsText.matchAll(/RMS level dB:\s*(-?[\d.]+)/g)].map(match=>Number(match[1]));assert(rms.length&&rms.every(value=>Number.isFinite(value)&&value>-70));
    const mp4=recordedPath.replace(/\.mkv$/i,'.mp4');assert.notEqual(mp4,recordedPath);
    await run(ffmpeg,['-v','error','-n','-i',recordedPath,'-map','0:v:0','-map','0:a:0','-c','copy','-movflags','+faststart',mp4]);
    results.push({orientation,file:path.relative(process.cwd(),recordedPath).replaceAll('\\','/'),mp4:path.relative(process.cwd(),mp4).replaceAll('\\','/'),video:{width:video.width,height:video.height,codec:video.codec_name,frameRate:video.avg_frame_rate},audio:{codec:audio.codec_name,sampleRate:audio.sample_rate,channels:audio.channels,rmsDb:rms},durationSeconds:Number(probe.format.duration),changedFrames,
      renderSkipped:after.renderSkippedFrames-before.renderSkippedFrames,renderFrames:after.renderTotalFrames-before.renderTotalFrames,encodeSkipped:after.outputSkippedFrames-before.outputSkippedFrames,encodeFrames:after.outputTotalFrames-before.outputTotalFrames,obsCpuPercent:after.cpuUsage,renderMs:after.averageFrameRenderTime});
    console.log(JSON.stringify(results.at(-1)));
    const sceneName='Ene '+orientation;const {sceneItemId}=await obs.request('GetSceneItemId',{sceneName,sourceName:sceneName+' Window'});await obs.request('SetSceneItemEnabled',{sceneName,sceneItemId,sceneItemEnabled:false});
  }
  assert.equal(await page.evaluate(()=>window.__cameraRequests),0);
  // Sources are disabled and both recordings have finished. Serve only each
  // fixture file through this test's route; private recordings stay off the app server.
  for(const result of results) {
    const url='http://127.0.0.1:4173/__recording-check-'+result.orientation.toLowerCase()+'.mp4';
    await page.route(url,route=>route.fulfill({path:path.resolve(result.mp4),contentType:'video/mp4'}));
    await page.evaluate(url=>{clearInterval(window.__poseTimer);const video=document.createElement('video');video.id='recording-player';video.muted=true;video.src=url;document.body.replaceChildren(video);},url);
    await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
    await page.evaluate(()=>document.querySelector('video').play());await pause(2500);
    result.browserPlayback=await page.evaluate(()=>{const v=document.querySelector('video'),q=v.getVideoPlaybackQuality();v.pause();return{currentTime:v.currentTime,width:v.videoWidth,height:v.videoHeight,decodedFrames:q.totalVideoFrames,droppedFrames:q.droppedVideoFrames};});
    assert(result.browserPlayback.currentTime>1&&result.browserPlayback.decodedFrames>20);
  }
  assert.deepEqual(errors,[]);
} catch(error) { errors.push(String(error));console.error(error);process.exitCode=1; }
finally {
  if(ownRecording)try{await obs.request('StopRecord');}catch{}
  if(addedAudio)try{await obs.request('RemoveInput',{inputName:audioName});}catch{}
  for(const orientation of ['Landscape','Portrait']) {
    const sceneName='Ene '+orientation;
    try { const {sceneItemId}=await obs.request('GetSceneItemId',{sceneName,sourceName:sceneName+' Window'});await obs.request('SetSceneItemEnabled',{sceneName,sceneItemId,sceneItemEnabled:false}); }catch{}
    if(directories.has(sceneName))try{await obs.request('SetCurrentProfile',{profileName:sceneName});await obs.request('SetRecordDirectory',{recordDirectory:directories.get(sceneName)});}catch{}
  }
  if(originalProfile)try{await obs.request('SetCurrentProfile',{profileName:originalProfile});}catch{}
  if(originalScene)try{await obs.request('SetCurrentProgramScene',{sceneName:originalScene});}catch{}
  await browser?.close();obs.close();
  await writeFile('ops/reports/obs-record-smoke.json',JSON.stringify({date:new Date().toISOString(),input:'Actual Ene with deterministic face animation and the locally converted public-domain English reference WAV. No physical camera/microphone, live voice conversion or public stream.',results,errors},null,2));
}
