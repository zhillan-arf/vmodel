import {chromium} from 'playwright';
import {connectOBS} from '../obs-client.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {validateOwnedURL} from './configure_obs_voice.mjs';
const run=promisify(execFile),pause=ms=>new Promise(r=>setTimeout(r,ms));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base='http://127.0.0.1:5084';
const directory=path.join(root,'ops/001-zhil/sprint-001/reports/local/voice/obs');await fs.mkdir(directory,{recursive:true});
const cache=await fs.mkdtemp(path.join(root,'.cache/voice/studio-obs-'));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k.toUpperCase())));
const server=spawn(path.join(root,'.tools/voice/venv/Scripts/python.exe'),['-I',path.join(root,'scripts/voice/studio_server.py'),'--port','5084','--state-dir',cache],{cwd:root,env,windowsHide:true,stdio:['ignore','ignore','ignore']});
const ffprobe=path.join(root,'.tools/web/ffmpeg-9.0.1-essentials_build/bin/ffprobe.exe'),ffmpeg=path.join(root,'.tools/web/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe');
let obs,browser,recording=false,originalScene,originalDirectory,createdScene=false;const createdInputs=[];
const sceneName='Ene Voice Bridge Test '+Date.now(),inputName=sceneName+' Audio',imageName=sceneName+' Image';
let report={date:new Date().toISOString(),passed:false,physicalMediaRequests:0,boundary:'Preconverted public-domain English sample over the local PCM Browser Source bridge, with a still Ene image. No live conversion, lip sync, physical device isolation challenge or livestream acceptance.'};
try{
  for(let i=0;i<60;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await pause(100);}
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext();await context.addInitScript(()=>{window.mediaRequests=0;navigator.mediaDevices.getUserMedia=async()=>{window.mediaRequests++;throw new Error('Physical media disabled');};});
  const page=await context.newPage();await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#reference').disabled);
  const routeURL=await page.locator('#route').inputValue();
  obs=await connectOBS();
  if((await obs.request('GetRecordStatus')).outputActive||(await obs.request('GetStreamStatus')).outputActive)throw new Error('Another recording or stream is active.');
  assert.equal((await obs.request('GetSceneCollectionList')).currentSceneCollectionName,'Ene Studio');
  const beforeInputs=(await obs.request('GetInputList')).inputs;
  for(const input of beforeInputs) {
    if(input.inputKind==='window_capture')continue;
    assert(['Ene Converted Voice Bridge','Ene Natural Voice Bridge'].includes(input.inputName)&&input.inputKind==='browser_source','Unexpected existing audio/input; inspect before isolated recording.');
    validateOwnedURL((await obs.request('GetInputSettings',{inputName:input.inputName})).inputSettings,input.inputName==='Ene Natural Voice Bridge'?'natural':'converted');
    const production=await(await fetch('http://127.0.0.1:5082/api/status',{method:'POST',headers:{Origin:'http://127.0.0.1:5082','Content-Type':'application/json'},body:'{}'})).json();
    assert(production.muted&&production.mode==='idle','Production voice must remain stopped during a separate fixture recording.');
  }
  originalScene=(await obs.request('GetCurrentProgramScene')).currentProgramSceneName;originalDirectory=(await obs.request('GetRecordDirectory')).recordDirectory;
  await obs.request('CreateScene',{sceneName});createdScene=true;
  await obs.request('CreateInput',{sceneName,inputName:imageName,inputKind:'image_source',inputSettings:{file:path.join(root,'ops/001-zhil/sprint-001/reports/local/obs/landscape-a.png')},sceneItemEnabled:true});createdInputs.push(imageName);
  const video=await obs.request('GetVideoSettings'),{sceneItemId}=await obs.request('GetSceneItemId',{sceneName,sourceName:imageName});
  await obs.request('SetSceneItemTransform',{sceneName,sceneItemId,sceneItemTransform:{positionX:0,positionY:0,alignment:5,boundsType:'OBS_BOUNDS_SCALE_INNER',boundsWidth:video.baseWidth,boundsHeight:video.baseHeight}});
  await obs.request('CreateInput',{sceneName,inputName,inputKind:'browser_source',inputSettings:{url:routeURL,width:16,height:16,fps:10,reroute_audio:true,shutdown:false,restart_when_active:false,webpage_control_level:0},sceneItemEnabled:true});createdInputs.push(inputName);
  await obs.request('SetInputAudioMonitorType',{inputName,monitorType:'OBS_MONITORING_TYPE_NONE'});
  await obs.request('SetInputAudioTracks',{inputName,inputAudioTracks:{'1':true,'2':false,'3':false,'4':false,'5':false,'6':false}});
  await obs.request('SetCurrentProgramScene',{sceneName});await obs.request('SetRecordDirectory',{recordDirectory:directory});
  await page.waitForFunction(async()=>{const s=await(await fetch('/api/status',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();return s.outputListeners>=1;});
  await pause(1000);const before=await obs.request('GetStats');await obs.request('StartRecord');recording=true;await pause(2000);
  assert((await obs.request('GetRecordStatus')).outputActive);await page.locator('#reference').click();
  await page.waitForFunction(()=>document.querySelector('#badge').textContent.includes('REFERENCE'));
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Reference finished'),undefined,{timeout:15000});
  await pause(2000);const after=await obs.request('GetStats');const stopped=await obs.request('StopRecord');
  assert(stopped.outputPath&&path.resolve(stopped.outputPath).startsWith(directory+path.sep));let probe;
  for(let i=0;i<40;i++){await pause(250);if((await obs.request('GetRecordStatus')).outputActive)continue;try{probe=JSON.parse((await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',stopped.outputPath])).stdout);}catch{continue;}if(Number(probe.format.duration)>11)break;}
  recording=false;assert(Number(probe.format.duration)>11);assert(probe.streams.some(s=>s.codec_type==='audio'));
  const wav=path.join(directory,'bridge-recording.wav');await run(ffmpeg,['-v','error','-y','-i',stopped.outputPath,'-map','0:a:0','-ac','1','-ar','40000',wav]);
  report={...report,passed:true,recording:path.relative(root,stopped.outputPath).replaceAll('\\','/'),wav:path.relative(root,wav).replaceAll('\\','/'),durationSeconds:Number(probe.format.duration),video:probe.streams.filter(s=>s.codec_type==='video').map(s=>({width:s.width,height:s.height,codec:s.codec_name})),audio:probe.streams.filter(s=>s.codec_type==='audio').map(s=>({rate:s.sample_rate,channels:s.channels,codec:s.codec_name})),browserRerouteAudio:true,OBSMonitoring:'none',laptopMonitoring:false,rawMicrophoneAndDesktopInputs:0,physicalMediaRequests:await page.evaluate(()=>window.mediaRequests),renderSkipped:after.renderSkippedFrames-before.renderSkippedFrames,encodeSkipped:after.outputSkippedFrames-before.outputSkippedFrames};
  assert.equal(report.physicalMediaRequests,0);
}catch(error){report.error=String(error);process.exitCode=1;console.error(error.message);}
finally{
  if(obs){
    if(recording)try{await obs.request('StopRecord');}catch{}
    if(originalScene)try{await obs.request('SetCurrentProgramScene',{sceneName:originalScene});}catch{}
    for(const inputName of createdInputs.reverse())try{await obs.request('RemoveInput',{inputName});}catch{}
    if(createdScene)try{await obs.request('RemoveScene',{sceneName});}catch{}
    if(originalDirectory)try{await obs.request('SetRecordDirectory',{recordDirectory:originalDirectory});}catch{}
    let remaining;for(let i=0;i<20;i++){await pause(100);remaining=(await obs.request('GetInputList')).inputs;if(remaining.every(i=>!i.inputName.startsWith(sceneName)))break;}
    report.testInputsRemoved=remaining.every(i=>!i.inputName.startsWith(sceneName));report.remainingAudioInputs=remaining.filter(i=>i.inputKind!=='window_capture').length;obs.close();
  }
  await browser?.close();
  try{const route=JSON.parse(await fs.readFile(path.join(cache,'route.json'),'utf8'));await fetch(base+'/api/shutdown',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({adminKey:route.adminKey})});}catch{}
  await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(()=>{server.kill();resolve();},3000).unref();});
  await fs.writeFile(path.join(root,'ops/001-zhil/sprint-001/reports/voice-obs-bridge-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
