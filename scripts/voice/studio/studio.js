import {ConvertedPlayer} from './player.js';
const $=id=>document.getElementById(id);
let lease=null,route=null,naturalRoute=null,profiles=null,naturalProfile=null,state=null,control=null,player=null,microphone=null,liveRequested=false,openingMic=false,connected=false;
let saved={}; try{saved=JSON.parse(sessionStorage.getItem('ene-voice-owner')||'{}');}catch{}
let failureNotice=null;
function message(text){$('message').textContent=text;}
// Keep a microphone failure visible until the user acts again: the stop that
// failLive issues pushes state whose generic message would otherwise erase it.
function clearFailureNotice(){failureNotice=null;}
function controls(enabled){connected=enabled;document.querySelectorAll('.preset,#reference,#live,#natural,#save,#reset,#copy').forEach(b=>b.disabled=!enabled);}
async function api(path,data={}) {
  // A stopped or crashed service surfaces as "Failed to fetch", which tells the
  // user nothing. Name the service and the launcher instead.
  let response;
  try{response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
  catch{throw new Error('The local voice service is not responding. Start it with Start Voice Studio.cmd, then reload this page.');}
  let value;
  try{value=await response.json();}
  catch{throw new Error('The local voice service sent an unreadable reply. Restart it with Stop Voice Studio.cmd, then Start Voice Studio.cmd.');}
  if(!response.ok)throw new Error(value.error||'Local voice request failed');return value;
}
async function action(command,extra={}){
  if(!lease)throw new Error('Reconnect the voice controls first.');
  const result=await api('action',{...lease,action:command,...extra});
  profiles=result.profiles;naturalProfile=result.naturalProfile;applyState(result.state);return result;
}
function syncForm(){
  if(!profiles||!state)return;const p=profiles[state.selected];
  $('context').value=String(p.audio.contextMs);$('input-gain').value=p.inputGain;$('output-gain').value=p.outputGain;
  gainLabels();
  if(![...$('device').options].some(o=>o.value===p.inputDeviceId))$('device').add(new Option('Saved device · refresh to resolve',p.inputDeviceId));
  $('device').value=p.inputDeviceId;
  $('sync').textContent='Sync: unmeasured. No offset applied. Context or device changes invalidate calibration.';
}
function gainLabels(){$('input-value').textContent=Number($('input-gain').value).toFixed(2)+'×';$('output-value').textContent=Number($('output-gain').value).toFixed(2)+'×';}
function applyState(next){
  const old=state;state=next;
  $('badge').textContent=`${state.mode==='natural'?'NATURAL VOICE TO OBS':'LOCAL CPU'} / ${state.status.toUpperCase()}`;message(failureNotice??state.message);
  $('natural-state').textContent=state.mode==='natural'?'ON: your natural speech goes to OBS. Character conversion is stopped.':'Natural voice is off. It never starts as a fallback.';
  document.body.classList.toggle('natural-active',state.mode==='natural');
  $('output-label').textContent=state.mode==='natural'?'Natural output':'Converted output';
  $('input-meter').value=state.metrics.inputRms;$('output-meter').value=state.metrics.outputRms;
  $('metrics').textContent=`${state.metrics.processed} ${state.mode==='natural'?'natural':'converted'} blocks · ${state.metrics.late} late / muted · ${state.metrics.droppedInput} input blocks discarded${state.metrics.lastComputeMs==null?'':` · last processing ${state.metrics.lastComputeMs.toFixed(0)} ms`}`;
  document.querySelectorAll('.preset').forEach(b=>{b.classList.toggle('selected',b.dataset.voice===state.selected);b.setAttribute('aria-pressed',b.dataset.voice===state.selected?'true':'false');});
  if(old&&old.epoch!==state.epoch)closeMicrophone();
  if(!['loading','ready','converting','natural-ready','natural-speaking'].includes(state.status)){liveRequested=false;closeMicrophone();}
  if(liveRequested===state.mode&&['ready','natural-ready'].includes(state.status)&&!microphone&&!openingMic)openMicrophone().catch(failLive);
}
async function closeMicrophone(){
  if(!microphone)return;const mic=microphone;microphone=null;
  mic.stream?.getTracks().forEach(t=>t.stop());
  if(mic.ws){mic.ws.onclose=null;mic.ws.onerror=null;mic.ws.close();}mic.node?.disconnect();await mic.context?.close();
}
async function failLive(error){liveRequested=false;await closeMicrophone();
  failureNotice=`Microphone stopped and both routes muted: ${error.message}`;
  try{await action('stop');}catch{}message(failureNotice);}
async function openMicrophone(){
  openingMic=true;const epoch=state.epoch,mode=state.mode;
  try{
    if(liveRequested!==mode||!['live','natural'].includes(mode))return;
    if($('monitor').checked)await enableMonitor(mode==='natural'?'natural':'converted');
    const input=(mode==='natural'?naturalProfile:profiles[state.selected]).inputDeviceId;
    const stream=await navigator.mediaDevices.getUserMedia({video:false,audio:{deviceId:input==='default'?undefined:{exact:input},channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    if(liveRequested!==mode||epoch!==state.epoch){stream.getTracks().forEach(t=>t.stop());return;}
    const context=new AudioContext({sampleRate:16000,latencyHint:'interactive'});
    microphone={stream,context};
    if(context.sampleRate!==16000)throw new Error('This audio device did not accept the required 16 kHz input.');
    await context.audioWorklet.addModule('/pcm-input.js');await context.resume();
    if(liveRequested!==mode||epoch!==state.epoch){await closeMicrophone();return;}
    const mic=microphone;mic.node=new AudioWorkletNode(context,'voice-input',{outputChannelCount:[1]});
    mic.source=context.createMediaStreamSource(stream);mic.source.connect(mic.node).connect(context.destination);
    mic.ws=new WebSocket(`ws://${location.host}/ws/${mode==='natural'?'natural-input':'input'}`);let sequence=0;
    mic.ws.onopen=()=>mic.ws.send(JSON.stringify(lease));
    mic.ws.onclose=()=>{if(microphone===mic)failLive(new Error('The input connection closed.'));};
    mic.ws.onerror=()=>{if(microphone===mic)failLive(new Error('The local input connection failed.'));};
    mic.node.port.onmessage=({data})=>{
      if(microphone!==mic||epoch!==state.epoch||mic.ws.readyState!==WebSocket.OPEN)return;
      if(mic.ws.bufferedAmount>10256){failLive(new Error('Input fell behind.'));return;}
      const packet=new ArrayBuffer(16+data.byteLength),view=new DataView(packet);
      new Uint8Array(packet,0,4).set(mode==='natural'?[86,77,78,73]:[86,77,73,78]);view.setUint32(4,epoch,true);view.setUint32(8,sequence++,true);view.setUint32(12,16000,true);
      new Float32Array(packet,16).set(data);mic.ws.send(packet);
    };
    stream.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(microphone===mic)failLive(new Error('The microphone was removed or permission ended.'));}));
    refreshDevices().catch(()=>{});
  }catch(error){if(epoch===state.epoch)throw error;}finally{openingMic=false;}
}
async function refreshDevices(){
  const selected=$('device').value;const devices=await navigator.mediaDevices.enumerateDevices();
  $('device').replaceChildren(new Option('System default','default'));
  let n=0;for(const d of devices.filter(d=>d.kind==='audioinput'&&d.deviceId&&d.deviceId!=='default'))$('device').add(new Option(d.label||`Microphone ${++n} · label needs permission`,d.deviceId));
  if([...$('device').options].some(o=>o.value===selected))$('device').value=selected;
}
async function enableMonitor(kind=state?.mode==='natural'?'natural':'converted'){
  if(!$('monitor').checked){player?.setMonitoring(false);return;}
  if(player&&player.kind!==kind){await player.close();player=null;}
  if(!player){player=new ConvertedPlayer(kind==='natural'?naturalRoute:route,()=>{},message,kind);await player.connect();}else await player.context.resume();
  player.setMonitoring(true);
}
async function connect(){
  controls(false);liveRequested=false;await closeMicrophone();
  if(control){control.onclose=null;control.close();control=null;}await player?.close();player=null;
  $('monitor').checked=false;
  const result=await api('claim',saved);lease={sessionId:result.sessionId,controlKey:result.controlKey};saved=lease;
  sessionStorage.setItem('ene-voice-owner',JSON.stringify(lease));route=result.outputRoute;naturalRoute=result.naturalOutputRoute;profiles=result.profiles;naturalProfile=result.naturalProfile;applyState(result.state);syncForm();
  $('route').value=`${location.origin}/obs#route=${encodeURIComponent(route.routeId)}&key=${encodeURIComponent(route.outputKey)}`;
  control=new WebSocket(`ws://${location.host}/ws/control`);
  control.onopen=()=>control.send(JSON.stringify(lease));
  control.onmessage=({data})=>{applyState(JSON.parse(data));controls(true);};
  control.onclose=()=>{controls(false);liveRequested=false;closeMicrophone();player?.flush();message('Controls disconnected. Audio is muted. Reconnect, then start explicitly.');};
  control.onerror=()=>message('The local voice service is unavailable. Audio stays muted.');
}
function handle(button,operation){$(button).addEventListener('click',()=>{clearFailureNotice();return Promise.resolve().then(operation).catch(e=>message(e.message));});}
document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',async()=>{try{clearFailureNotice();liveRequested=false;await closeMicrophone();await action('select',{voice:b.dataset.voice});syncForm();}catch(e){message(e.message);}}));
handle('reference',async()=>{liveRequested=false;await closeMicrophone();if($('monitor').checked)await enableMonitor('converted');await action('reference');});
handle('live',async()=>{await closeMicrophone();await action('save',{changes:formChanges()});liveRequested='live';await action('start-live');liveRequested='live';if(state.status==='ready'&&!openingMic&&!microphone)await openMicrophone().catch(failLive);});
handle('natural',async()=>{liveRequested=false;await closeMicrophone();player?.flush();const changes={inputDeviceId:$('device').value,inputGain:Number($('input-gain').value),outputGain:Number($('output-gain').value)};await action('start-natural',{acknowledgeNaturalVoice:true,changes});liveRequested='natural';if(state.status==='natural-ready'&&!openingMic&&!microphone)await openMicrophone().catch(failLive);});
handle('stop',async()=>{liveRequested=false;await closeMicrophone();player?.flush();await action('stop');});
handle('save',async()=>{liveRequested=false;await closeMicrophone();await action('save',{changes:formChanges()});syncForm();message('Preset saved locally. Voice and English quality remain provisional.');});
handle('reset',async()=>{liveRequested=false;await closeMicrophone();await action('reset');syncForm();});
handle('devices',refreshDevices);handle('reconnect',connect);
handle('copy',async()=>{await navigator.clipboard.writeText($('route').value);message('Private OBS Browser Source URL copied. Enable Control audio via OBS.');});
$('monitor').addEventListener('change',()=>enableMonitor().catch(e=>{message(e.message);$('monitor').checked=false;player?.close();player=null;}));
for(const id of ['input-gain','output-gain'])$(id).addEventListener('input',gainLabels);
function formChanges(){return{contextMs:Number($('context').value),inputGain:Number($('input-gain').value),outputGain:Number($('output-gain').value),inputDeviceId:$('device').value,monitoring:$('monitor').checked};}
addEventListener('pagehide',()=>{liveRequested=false;closeMicrophone();control?.close();player?.close();});
controls(false);connect().catch(e=>message(e.message));
