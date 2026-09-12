// Best-effort warm/cold receiver recovery. Never writes source settings, starts
// OBS output, claims a voice producer or starts a voice mode.
import {connectOBS} from '../obs-client.mjs';
import {validateOwnedURL} from './configure_obs_voice.mjs';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const base='http://127.0.0.1:5082';
const receivers=[{name:'Ene Converted Voice Bridge',kind:'converted',file:'route.json'},{name:'Ene Natural Voice Bridge',kind:'natural',file:'natural-route.json'}];
const skipped=reason=>({refreshed:false,reason,startedMedia:false});
function stable(value) {
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
const digest=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
export async function idleVoice() {
  const health=await(await fetch(base+'/health',{signal:AbortSignal.timeout(2000)})).json();
  if(health.application!=='vmodel-voice')return false;
  const response=await fetch(base+'/api/status',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(2000)});
  if(!response.ok)return false;
  const state=await response.json();
  return state.mode==='idle'&&state.muted===true;
}
async function idleOBS(obs) {
  if((await obs.request('GetRecordStatus')).outputActive||(await obs.request('GetStreamStatus')).outputActive)return false;
  try {if((await obs.request('GetVirtualCamStatus')).outputActive)return false;}
  catch(error){if(!String(error.message).includes('GetVirtualCamStatus: 604'))throw error;}
  return true;
}
export function exactRoute(settings,kind,route) {
  validateOwnedURL(settings,kind);
  if(!route||typeof route.routeId!=='string'||typeof route.outputKey!=='string')return false;
  const fragment=new URLSearchParams(new URL(settings.url).hash.slice(1));
  return settings.reroute_audio===true&&[...fragment.keys()].length===2&&
    fragment.getAll('route').length===1&&fragment.getAll('key').length===1&&
    fragment.get('route')===route.routeId&&fragment.get('key')===route.outputKey;
}
async function sourceSnapshot(obs,inputName) {
  return{settings:await obs.request('GetInputSettings',{inputName}),sync:await obs.request('GetInputAudioSyncOffset',{inputName}),
    monitor:await obs.request('GetInputAudioMonitorType',{inputName}),tracks:await obs.request('GetInputAudioTracks',{inputName}),
    mute:await obs.request('GetInputMute',{inputName}),volume:await obs.request('GetInputVolume',{inputName})};
}
async function sceneSnapshot(obs) {
  return{current:await obs.request('GetCurrentProgramScene'),landscape:await obs.request('GetSceneItemList',{sceneName:'Ene Landscape'}),portrait:await obs.request('GetSceneItemList',{sceneName:'Ene Portrait'})};
}
export async function refreshOwnedReceivers(obs,routes,{status=idleVoice}={}) {
  if(!await status())return skipped('voice-active-or-unavailable');
  if(!await idleOBS(obs))return skipped('obs-output-active');
  if((await obs.request('GetSceneCollectionList')).currentSceneCollectionName!=='Ene Studio')return skipped('other-scene-collection');
  const inputs=(await obs.request('GetInputList')).inputs;
  const present=receivers.filter(r=>inputs.some(i=>i.inputName===r.name));
  if(!present.length)return skipped('owned-receivers-not-installed');
  const snapshots=new Map();
  // Review every present named source before refreshing any one of them.
  for(const receiver of present) {
    if(inputs.find(i=>i.inputName===receiver.name).inputKind!=='browser_source')return skipped('source-ownership-mismatch');
    const snapshot=await sourceSnapshot(obs,receiver.name);
    try{if(!exactRoute(snapshot.settings.inputSettings,receiver.kind,routes[receiver.kind]))return skipped('private-route-mismatch');}
    catch{return skipped('source-ownership-mismatch');}
    if(snapshot.monitor.monitorType!=='OBS_MONITORING_TYPE_NONE')return skipped('source-monitoring-enabled');
    snapshots.set(receiver.name,digest(snapshot));
  }
  const sceneBefore=digest(await sceneSnapshot(obs)),refreshed=[];
  for(const receiver of present) {
    if(!await status()||!await idleOBS(obs))return{...skipped('state-changed-during-refresh'),sources:refreshed};
    if((await obs.request('GetSceneCollectionList')).currentSceneCollectionName!=='Ene Studio'||
       snapshots.get(receiver.name)!==digest(await sourceSnapshot(obs,receiver.name)))return{...skipped('ownership-changed-during-refresh'),sources:refreshed};
    // The only OBS mutation: the documented Browser Source refresh callback.
    await obs.request('PressInputPropertiesButton',{inputName:receiver.name,propertyName:'refreshnocache'});
    refreshed.push(receiver.name);
  }
  for(const receiver of present)if(snapshots.get(receiver.name)!==digest(await sourceSnapshot(obs,receiver.name)))return{...skipped('source-state-changed-during-refresh'),sources:refreshed};
  if(sceneBefore!==digest(await sceneSnapshot(obs)))return{...skipped('scene-state-changed-during-refresh'),sources:refreshed};
  if(!await status()||!await idleOBS(obs))return{...skipped('state-changed-during-refresh'),sources:refreshed};
  return{refreshed:true,sources:refreshed,settingsAndSyncPreserved:true,sceneStatePreserved:true,startedMedia:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  let obs;
  const deadline=setTimeout(()=>{obs?.close();console.log(JSON.stringify(skipped('best-effort-timeout')));process.exit(0);},15000);
  deadline.unref();
  try {
    const routes={};
    for(const receiver of receivers) {
      try{routes[receiver.kind]=JSON.parse(await fs.readFile(new URL('../../assets/voice/studio/'+receiver.file,import.meta.url),'utf8'));}catch{}
    }
    if(!await idleVoice())console.log(JSON.stringify(skipped('voice-active-or-unavailable')));
    else{obs=await connectOBS();console.log(JSON.stringify(await refreshOwnedReceivers(obs,routes)));}
  }catch{console.log(JSON.stringify(skipped('obs-or-route-unavailable')));}
  finally{clearTimeout(deadline);obs?.close();}
}
