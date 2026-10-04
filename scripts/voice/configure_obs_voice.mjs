// Reversible local setup; never starts media, recording, streaming or a camera.
import {connectOBS} from '../obs-client.mjs';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const base='http://127.0.0.1:5082';
const voiceScene='Ene Voice Studio',convertedName='Ene Converted Voice Bridge',naturalName='Ene Natural Voice Bridge';
const avatarScenes=['Ene Landscape','Ene Portrait'];

export function validateOwnedURL(settings,kind='converted') {
  if(!['converted','natural'].includes(kind))throw new Error('Unknown voice receiver kind');
  let url;
  try { url=new URL(settings.url); } catch { throw new Error('The existing voice source URL is invalid; it was left unchanged.'); }
  if(url.origin!==base||url.pathname!==(kind==='natural'?'/obs-natural':'/obs')||url.search||url.username||url.password||settings.is_local_file===true)
    throw new Error('The same-name Browser Source is not the expected local /obs receiver; it was left unchanged.');
}
async function voiceStatus() {
  const response=await fetch(base+'/api/status',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw new Error('Start Voice Studio before configuring OBS.');
  const value=await response.json();
  if(value.mode!=='idle'||value.muted!==true)throw new Error('Stop voice playback/conversion before configuring its OBS source.');
  return {mode:value.mode,muted:value.muted,liveAccepted:value.liveAccepted};
}
async function outputs(obs) {
  const recording=(await obs.request('GetRecordStatus')).outputActive;
  const streaming=(await obs.request('GetStreamStatus')).outputActive;
  let virtualCamera;
  try { virtualCamera={available:true,active:(await obs.request('GetVirtualCamStatus')).outputActive}; }
  catch(error) { if(!String(error.message).includes('GetVirtualCamStatus: 604'))throw error;virtualCamera={available:false,active:false}; }
  if(recording||streaming||virtualCamera.active)throw new Error('OBS outputs must be stopped before configuring voice scenes.');
  return {recording,streaming,virtualCamera};
}
function stable(value) {
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
const digest=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
async function avatarSnapshot(obs) {
  const inputs=(await obs.request('GetInputList')).inputs;
  const captures=[];
  for(const source of inputs.filter(i=>i.inputKind==='window_capture'))captures.push({name:source.inputName,...await obs.request('GetInputSettings',{inputName:source.inputName})});
  const items={};
  for(const sceneName of avatarScenes) {
    const all=(await obs.request('GetSceneItemList',{sceneName})).sceneItems;
    // A new transparent item can shift indices; avatar identity, visibility and
    // transforms must remain unchanged.
    items[sceneName]=all.filter(i=>![convertedName,naturalName].includes(i.sourceName)).map(({sceneItemIndex,...item})=>item);
  }
  return {captureHash:digest(captures),itemHash:digest(items)};
}
async function otherVoiceSnapshot(obs,inputName) {
  const other=inputName===naturalName?convertedName:naturalName;
  if(!(await obs.request('GetInputList')).inputs.some(i=>i.inputName===other))return null;
  return digest({settings:await obs.request('GetInputSettings',{inputName:other}),sync:await obs.request('GetInputAudioSyncOffset',{inputName:other}),mute:await obs.request('GetInputMute',{inputName:other}),tracks:await obs.request('GetInputAudioTracks',{inputName:other}),monitor:await obs.request('GetInputAudioMonitorType',{inputName:other})});
}
export async function configure(obs,route,{attach=false,natural=false,status=voiceStatus}={}) {
  const inputName=natural?naturalName:convertedName,kind=natural?'natural':'converted',receiverPath=natural?'/obs-natural':'/obs';
  const beforeOutputs=await outputs(obs);
  if((await obs.request('GetSceneCollectionList')).currentSceneCollectionName!=='Ene Studio')throw new Error('Select the existing Ene Studio collection first.');
  const scenes=(await obs.request('GetSceneList')).scenes.map(s=>s.sceneName);
  if(!avatarScenes.every(name=>scenes.includes(name)))throw new Error('Reviewed Ene Landscape and Ene Portrait scenes must already exist.');
  const currentScene=(await obs.request('GetCurrentProgramScene')).currentProgramSceneName;
  const inputList=(await obs.request('GetInputList')).inputs;
  if(inputList.some(i=>/wasapi|pulse|coreaudio|audio_input|audio_output|process_audio/.test(i.inputKind)))throw new Error('A raw audio capture source is present; review it before converted-only setup. Existing sources were left unchanged.');
  const existing=inputList.find(i=>i.inputName===inputName);
  let previousSync=null;
  if(existing) {
    if(existing.inputKind!=='browser_source')throw new Error('The voice source name is occupied by another source type; it was left unchanged.');
    validateOwnedURL((await obs.request('GetInputSettings',{inputName})).inputSettings,kind);
    previousSync=(await obs.request('GetInputAudioSyncOffset',{inputName})).inputAudioSyncOffset;
  }
  const targets=attach?[voiceScene,...avatarScenes]:[voiceScene];
  for(const sceneName of targets.filter(name=>scenes.includes(name))) {
    const items=(await obs.request('GetSceneItemList',{sceneName})).sceneItems.filter(i=>i.sourceName===inputName);
    if(items.length>1)throw new Error('Duplicate voice items already exist; inspect them before setup.');
  }
  const beforeVoice=await status();
  const beforeAvatar=await avatarSnapshot(obs);
  const beforeOtherVoice=await otherVoiceSnapshot(obs,inputName);
  if(!scenes.includes(voiceScene))await obs.request('CreateScene',{sceneName:voiceScene});
  const inputSettings={url:base+receiverPath+'#route='+encodeURIComponent(route.routeId)+'&key='+encodeURIComponent(route.outputKey),width:16,height:16,fps:10,reroute_audio:true,shutdown:false,restart_when_active:false,webpage_control_level:0};
  if(existing)await obs.request('SetInputSettings',{inputName,inputSettings,overlay:true});
  else await obs.request('CreateInput',{sceneName:voiceScene,inputName,inputKind:'browser_source',inputSettings,sceneItemEnabled:true});
  for(const sceneName of targets) {
    const items=(await obs.request('GetSceneItemList',{sceneName})).sceneItems.filter(i=>i.sourceName===inputName);
    if(!items.length)await obs.request('CreateSceneItem',{sceneName,sourceName:inputName,sceneItemEnabled:true});
  }
  await obs.request('SetInputAudioMonitorType',{inputName,monitorType:'OBS_MONITORING_TYPE_NONE'});
  await obs.request('SetInputAudioTracks',{inputName,inputAudioTracks:{'1':true,'2':false,'3':false,'4':false,'5':false,'6':false}});
  // OBS supplies zero for a new source. Existing measured offsets are never reset.
  const sync=(await obs.request('GetInputAudioSyncOffset',{inputName})).inputAudioSyncOffset;
  if(existing&&sync!==previousSync)throw new Error('Existing voice sync changed unexpectedly.');
  const membership={};
  for(const sceneName of targets) {
    const items=(await obs.request('GetSceneItemList',{sceneName})).sceneItems.filter(i=>i.sourceName===inputName);
    if(items.length!==1)throw new Error('OBS did not retain exactly one voice item per requested scene.');
    membership[sceneName]={count:items.length,enabled:items[0].sceneItemEnabled};
  }
  const afterAvatar=await avatarSnapshot(obs);
  const unchangedScene=(await obs.request('GetCurrentProgramScene')).currentProgramSceneName===currentScene;
  if(!unchangedScene||beforeAvatar.captureHash!==afterAvatar.captureHash||beforeAvatar.itemHash!==afterAvatar.itemHash)throw new Error('Unexpected avatar or current-scene change during voice setup.');
  const afterInputs=(await obs.request('GetInputList')).inputs;
  const afterVoice=await status();
  const afterOutputs=await outputs(obs);
  const storedSettings=(await obs.request('GetInputSettings',{inputName})).inputSettings;
  validateOwnedURL(storedSettings,kind);
  const monitorType=(await obs.request('GetInputAudioMonitorType',{inputName})).monitorType;
  const audioTracks=(await obs.request('GetInputAudioTracks',{inputName})).inputAudioTracks;
  if(storedSettings.url!==inputSettings.url||storedSettings.reroute_audio!==true||monitorType!=='OBS_MONITORING_TYPE_NONE'||audioTracks['1']!==true||Object.entries(audioTracks).some(([track,enabled])=>track!=='1'&&enabled))throw new Error('OBS did not retain the requested converted-only route/monitor/track settings.');
  const otherVoicePreserved=beforeOtherVoice===await otherVoiceSnapshot(obs,inputName);
  if(!otherVoicePreserved)throw new Error('The other voice source changed unexpectedly.');
  return {date:new Date().toISOString(),passed:true,attach,collection:'Ene Studio',inputName,reusedSource:Boolean(existing),membership,
    sourceURL:{origin:base,path:receiverPath,privateFragmentOmitted:true},convertedOnly:!natural,explicitNaturalOnly:natural,expectedFrameKind:natural?'VMNA':'VMOA',rerouteAudio:true,otherVoicePreserved,
    monitorType,audioTracks,privateRouteMatchesLocalService:true,
    syncOffsetMs:sync,existingSyncPreserved:existing?sync===previousSync:null,syncCalibratedByThisSetup:false,
    currentScene,currentScenePreserved:unchangedScene,avatarCaptureSettingsPreserved:beforeAvatar.captureHash===afterAvatar.captureHash,avatarSceneItemsPreserved:beforeAvatar.itemHash===afterAvatar.itemHash,
    avatarCaptureHash:afterAvatar.captureHash,avatarItemsHash:afterAvatar.itemHash,
    sources:afterInputs.map(i=>({name:i.inputName,kind:i.inputKind})),
    rawAudioCaptureInputs:afterInputs.filter(i=>/wasapi|pulse|coreaudio|audio_input|audio_output|process_audio/.test(i.inputKind)).map(i=>i.inputName),
    beforeVoice,afterVoice,beforeOutputs,afterOutputs,startedMedia:false,
    note:'Installed without audio playback, physical media or OBS output. Reference transport was tested separately; live quality/latency and physical sync remain unaccepted.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const args=process.argv.slice(2);
  if(args.some(a=>!['--attach','--natural'].includes(a)))throw new Error('Usage: node scripts/voice/configure_obs_voice.mjs [--attach] [--natural]');
  const natural=args.includes('--natural');
  const route=JSON.parse(await fs.readFile(new URL('../../assets/voice/studio/'+(natural?'natural-route.json':'route.json'),import.meta.url),'utf8'));
  if(typeof route.routeId!=='string'||typeof route.outputKey!=='string')throw new Error('The local voice route identity is missing.');
  const obs=await connectOBS();
  try {
    const report=await configure(obs,route,{attach:args.includes('--attach'),natural});
    await fs.writeFile(new URL('../../ops/001-zhil/sprint-001/reports/'+(natural?'voice-obs-natural-setup.json':'voice-obs-setup.json'),import.meta.url),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  }finally{obs.close();}
}
