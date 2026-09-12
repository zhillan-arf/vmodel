import { connectOBS } from './obs-client.mjs';
import { captureCrop } from './output-layout.mjs';
const orientation = process.argv.includes('--portrait') ? 'Portrait' : 'Landscape';
const attach = process.argv.includes('--attach');
const requestedTitle = process.argv.includes('--title') ? process.argv[process.argv.indexOf('--title') + 1] : null;
const width = orientation === 'Landscape' ? 1280 : 720, height = orientation === 'Landscape' ? 720 : 1280;
const obs = await connectOBS();
try {
  if ((await obs.request('GetRecordStatus')).outputActive || (await obs.request('GetStreamStatus')).outputActive) throw new Error('Stop the current OBS recording/stream before changing the profile.');
  await obs.request('SetCurrentProfile',{profileName:'Ene '+orientation});
  await obs.request('SetCurrentSceneCollection',{sceneCollectionName:'Ene Studio'});
  await obs.request('SetCurrentProgramScene',{sceneName:'Ene '+orientation});
  const inputs=(await obs.request('GetInputList')).inputs;
  for(const frame of ['Landscape','Portrait']) {
    const inputName='Ene '+frame+' Window',sceneName='Ene '+frame;
    if(!inputs.some(input=>input.inputName===inputName)) await obs.request('CreateInput',{sceneName,inputName,inputKind:'window_capture',inputSettings:{window:'Ene Output:Chrome_WidgetWin_1:chrome.exe',method:2,priority:1,cursor:false,client_area:true,capture_audio:false,force_sdr:true},sceneItemEnabled:false});
    else await obs.request('SetInputSettings',{inputName,inputSettings:{priority:1,cursor:false,capture_audio:false},overlay:true});
  }
  const inputName='Ene '+orientation+' Window',sceneName='Ene '+orientation;
  const {sceneItemId}=await obs.request('GetSceneItemId',{sceneName,sourceName:inputName});
  let crop={cropLeft:0,cropRight:0,cropTop:0,cropBottom:0};
  if(attach) {
    const origins=['http://127.0.0.1:4173','http://127.0.0.1:5173'];
    const layouts=[];
    for(const origin of origins) {
      try { const response=await fetch(origin+'/api/output-layout',{signal:AbortSignal.timeout(1500)}); if(response.ok)layouts.push(...(await response.json()).layouts); } catch { /* The other app server may not be running. */ }
    }
    const {propertyItems}=await obs.request('GetInputPropertiesListPropertyItems',{inputName,propertyName:'window'});
    const candidates=layouts.filter(layout=>layout.orientation===orientation.toLowerCase()&&(!requestedTitle||layout.title===requestedTitle)).flatMap(layout=>propertyItems.filter(item=>item.itemEnabled && item.itemName.includes(layout.title)).map(item=>({item,layout})));
    if(candidates.length!==1) {
      if(process.env.VMODEL_OBS_DEBUG==='1')console.error(JSON.stringify({layouts,eneWindows:propertyItems.filter(item=>item.itemName.includes('Ene Output')),candidates:candidates.length}));
      throw new Error(`Open one visible ${orientation.toLowerCase()} Ene output (or Clean view), wait two seconds, then retry. Close extra matching outputs.`);
    }
    const {item,layout}=candidates[0];
    await obs.request('SetInputSettings',{inputName,inputSettings:{window:item.itemValue,priority:1,method:2,cursor:false,client_area:true,capture_audio:false,force_sdr:true},overlay:true});
    await obs.request('SetSceneItemEnabled',{sceneName,sceneItemId,sceneItemEnabled:true});
    try {
      let transform;
      for(let i=0;i<30;i++) {
        await new Promise(resolve=>setTimeout(resolve,250));
        transform=(await obs.request('GetSceneItemTransform',{sceneName,sceneItemId})).sceneItemTransform;
        if(transform.sourceWidth>0&&transform.sourceHeight>0)break;
      }
      crop=captureCrop(transform.sourceWidth,transform.sourceHeight,layout);
    } catch(error) { await obs.request('SetSceneItemEnabled',{sceneName,sceneItemId,sceneItemEnabled:false});throw error; }
  }
  await obs.request('SetSceneItemTransform',{sceneName,sceneItemId,sceneItemTransform:{positionX:0,positionY:0,alignment:5,boundsType:'OBS_BOUNDS_SCALE_INNER',boundsAlignment:0,boundsWidth:width,boundsHeight:height,...crop}});
  console.log(JSON.stringify({profile:'Ene '+orientation,scene:sceneName,video:await obs.request('GetVideoSettings'),attached:attach,
    crop,capture:'Windows Graphics Capture; title used to attach, cursor/audio off. Keep this window on Ene. Reattach after resizing; stop recording and disable the source before changing or closing it.'}));
} catch(error) {
  // 'Local OBS connection closed.' is accurate but leaves the user nowhere.
  const unreachable = /connection closed|ECONNREFUSED|failed to connect|timed out/i.test(error.message);
  console.error(unreachable
    ? 'Could not reach OBS. Open Start OBS.cmd, leave it running, then try this again. Details: ' + error.message
    : error.message);
  process.exitCode=1;
}
finally { obs.close(); }
