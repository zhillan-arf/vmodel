// Pure mocked OBS API: no OBS connection, hardware, audio or process launch.
import assert from 'node:assert/strict';
import {refreshOwnedReceivers,exactRoute} from './refresh_obs_receivers.mjs';
const routes={converted:{routeId:'converted-test-route',outputKey:'converted-test-key'},natural:{routeId:'natural-test-route',outputKey:'natural-test-key'}};
const names=['Ene Converted Voice Bridge','Ene Natural Voice Bridge'];
function fixture() {
  const calls=[],sources=new Map(names.map((name,i)=>[name,{settings:{url:`http://127.0.0.1:5082/${i?'obs-natural':'obs'}#route=${routes[i?'natural':'converted'].routeId}&key=${routes[i?'natural':'converted'].outputKey}`,reroute_audio:true,width:16,height:16},sync:123+i,monitor:'OBS_MONITORING_TYPE_NONE',kind:'browser_source'}]));
  const state={voiceIdle:true,record:false,stream:false,camera:false,collection:'Ene Studio',pressed:0};
  const obs={async request(method,data={}) {
    calls.push({method,data});const source=sources.get(data.inputName);
    if(method==='GetRecordStatus')return{outputActive:state.record};
    if(method==='GetStreamStatus')return{outputActive:state.stream};
    if(method==='GetVirtualCamStatus')return{outputActive:state.camera};
    if(method==='GetSceneCollectionList')return{currentSceneCollectionName:state.collection};
    if(method==='GetInputList')return{inputs:[...sources].map(([inputName,s])=>({inputName,inputKind:s.kind}))};
    if(method==='GetInputSettings')return{inputSettings:structuredClone(source.settings)};
    if(method==='GetInputAudioSyncOffset')return{inputAudioSyncOffset:source.sync};
    if(method==='GetInputAudioMonitorType')return{monitorType:source.monitor};
    if(method==='GetInputAudioTracks')return{inputAudioTracks:{'1':true,'2':false}};
    if(method==='GetInputMute')return{inputMuted:false};
    if(method==='GetInputVolume')return{inputVolumeMul:.8,inputVolumeDb:-1.9382};
    if(method==='GetCurrentProgramScene')return{currentProgramSceneName:'Ene Landscape'};
    if(method==='GetSceneItemList')return{sceneItems:[{sourceName:'Avatar',sceneItemEnabled:true,sceneItemTransform:{x:2}}]};
    if(method==='PressInputPropertiesButton'){assert(names.includes(data.inputName));assert.equal(data.propertyName,'refreshnocache');state.pressed++;return{};}
    throw Error('Unexpected mutation/API: '+method);
  }};
  return{obs,sources,calls,state,status:async()=>state.voiceIdle};
}
const results=[];
async function test(name,run){await run();results.push(name);}
await test('Both exact silent receivers refresh without settings/sync/scene writes',async()=>{
  const f=fixture(),before=structuredClone([...f.sources]);const result=await refreshOwnedReceivers(f.obs,routes,{status:f.status});
  assert.equal(result.refreshed,true);assert.deepEqual(result.sources,names);assert.deepEqual([...f.sources],before);
  assert.equal(f.state.pressed,2);assert(f.calls.every(c=>c.method.startsWith('Get')||c.method==='PressInputPropertiesButton'));
  assert(!JSON.stringify(result).includes('test-key'));assert.equal(result.settingsAndSyncPreserved,true);
});
await test('Active voice/output, other collection and enabled monitoring skip safely',async()=>{
  for(const flag of ['voiceIdle','record','stream','camera','collection','monitor']) {
    const f=fixture();if(flag==='monitor')f.sources.get(names[0]).monitor='OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT';
    else f.state[flag]=flag==='voiceIdle'?false:flag==='collection'?'Other':true;
    assert.equal((await refreshOwnedReceivers(f.obs,routes,{status:f.status})).refreshed,false);assert.equal(f.state.pressed,0);
  }
});
await test('Wrong URL/path/key/kind/local file rejects all targets before refresh',async()=>{
  for(const change of [s=>s.settings.url='http://example.invalid/obs',s=>s.settings.url=s.settings.url.replace('/obs-natural','/obs'),s=>s.settings.url+='&key=duplicate',s=>s.settings.url=s.settings.url.replace('natural-test-key','rotated'),s=>s.settings.is_local_file=true,s=>s.kind='other']) {
    const f=fixture();change(f.sources.get(names[1]));assert.equal((await refreshOwnedReceivers(f.obs,routes,{status:f.status})).refreshed,false);assert.equal(f.state.pressed,0);
  }
  const f=fixture();assert.equal(exactRoute(f.sources.get(names[0]).settings,'converted',routes.natural),false);
});
await test('State changing after first refresh stops further work',async()=>{
  const f=fixture();const status=async()=>f.state.pressed===0;
  const result=await refreshOwnedReceivers(f.obs,routes,{status});assert.equal(result.refreshed,false);assert.equal(f.state.pressed,1);assert.equal(result.reason,'state-changed-during-refresh');
});
await test('Response object key order does not produce false preservation failure',async()=>{
  const f=fixture(),original=f.obs.request;
  f.obs.request=async(method,data)=>{
    const response=await original(method,data);
    if(f.state.pressed&&method==='GetInputSettings')response.inputSettings=Object.fromEntries(Object.entries(response.inputSettings).reverse());
    return response;
  };
  assert.equal((await refreshOwnedReceivers(f.obs,routes,{status:f.status})).refreshed,true);
});
await test('Missing receiver is not created; unavailable virtual-camera status is accepted',async()=>{
  const f=fixture();f.sources.delete(names[1]);const original=f.obs.request;
  f.obs.request=async(method,data)=>{if(method==='GetVirtualCamStatus')throw Error('GetVirtualCamStatus: 604 unavailable');return original(method,data);};
  const result=await refreshOwnedReceivers(f.obs,routes,{status:f.status});assert.equal(result.refreshed,true);assert.deepEqual(result.sources,[names[0]]);assert.equal(f.sources.size,1);
});
console.log(JSON.stringify({passed:true,checks:results,actualOBSContacted:false,physicalMedia:false},null,2));
