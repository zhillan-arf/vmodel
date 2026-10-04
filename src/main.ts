import './style.css';
import { LocalModelRepository } from './model-repository';
import { LibraryPanel } from './library-panel';
import { createNavigation } from './studio-navigation';
import { ModelOperation, prepareSelection, abortable } from './model-selection';
import { TrackingInspector } from './tracking-inspector';
import { bundledAvatars, savedAvatar } from './avatars';
import { AvatarViewer } from './viewer';
import { CameraTracker } from './camera';
import { defaults, normalizeSettings, readSettings, type Calibration, type TrackingFrame } from './types';
import { createFreezeNotice } from './freeze-notice';
import { describeLoadFailure, readableError } from './load-failure';
import { confidence, Retargeter } from './retarget';
import { compositionSize } from './composition';
import { OutputLink, type OutputSnapshot } from './output-link';
import { publishOutputLayout } from './output-layout';
import { watchLocalServer } from './server-watch';
import { avatarSettingsKey, clearAvatarCalibration, parseSettingsFile, readCalibration, saveCalibration, saveLocal, validCalibration, type CalibrationScope } from './profiles';

const output = new URLSearchParams(location.search).has('output');
let session = new URLSearchParams(location.search).get('session');
if (!session) { try { session = sessionStorage.getItem('vmodel-session'); } catch { /* session remains local to this tab */ } }
session ??= crypto.randomUUID();
if (!output) { try { sessionStorage.setItem('vmodel-session', session); } catch { /* no persistence available */ } }
let settings = readSettings();
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = output ? '<main id="stage" class="output-stage"></main>' : `
  <aside class="sidebar">
    <a class="brand" href="/">V<span>Model</span></a>
    <div class="section-heading">YOUR AVATAR <span>01</span></div>
    <h1 id="avatar-name">Choose your avatar</h1>
    <label>Model<select id="avatar-select">${bundledAvatars.map(avatar => `<option value="${avatar.id}">${avatar.label}</option>`).join('')}<option value="custom" hidden>Loaded VRM</option></select></label>
    <p class="muted">A little more you. A little more virtual.</p>
    <label class="file-button">Load another VRM<input id="avatar-file" type="file" accept=".vrm" /></label>
    <div class="section-heading">PERFORMANCE <span>02</span></div>
    <label>Camera<select id="camera"><option value="">Laptop camera</option></select></label>
    <label>Camera size<select id="captureResolution"><option value="640x480">640 × 480 · lighter</option><option value="1280x720">1280 × 720 · more detail</option></select></label>
    <div class="pair"><button id="start" class="primary">Start camera</button><button id="stop">Stop</button></div>
    <label>Movement<select id="mode"><option value="seated">Seated · face and gestures</option><option value="standing">Standing · visible full body</option></select></label>
    <button id="calibrate" class="wide">Recenter & calibrate</button>
    <p class="hint">Look forward and relax your shoulders. In standing mode, keep your head and feet in frame.</p>
    <label class="check"><input id="hands" type="checkbox" /> Follow hands and fingers</label>
    <label>Head movement range<input id="headRange" type="range" min="0.5" max="1.3" step="0.05" /></label>
    <label>Mouth sensitivity<input id="mouthGain" type="range" min="0.8" max="3" step="0.1" /></label>
    <label>Response speed<input id="smoothing" type="range" min="4" max="30" step="1" /></label>
    <label class="check"><input id="preview" type="checkbox" /> Show camera preview</label>
    <video id="camera-video" autoplay playsinline muted hidden></video>
    <div class="section-heading">THE LOOK <span>03</span></div>
    <div class="pair"><label>Frame<select id="framing"><option value="body">Full avatar</option><option value="bust">Close-up</option></select></label><label>Canvas<select id="orientation"><option value="landscape">16:9</option><option value="portrait">9:16</option></select></label></div>
    <div class="pair"><label>Background<input id="background" type="color" /></label><label>Quality<select id="quality"><option value="balanced">Balanced</option><option value="low">Low power</option></select></label></div>
    <label>Zoom<input id="zoom" type="range" min="0.65" max="1.6" step="0.05" /></label>
    <label class="check"><input id="mirror" type="checkbox" /> Mirror my performance</label>
    <div class="pair"><button id="key-color">Green screen</button><button id="default-color">Stage color</button></div>
    <div class="expressions"><button data-expression="neutral">Neutral</button><button data-expression="happy">Smile</button><button data-expression="surprised">Surprise</button></div>
    <label>Hair & accessory motion<select id="springMotion"><option value="gentle">Gentle</option><option value="full">Full</option><option value="off">Off</option></select></label>
    <button id="reset" class="text-button">Reset settings</button>
    <div class="pair"><button id="save-settings">Save settings</button><label class="file-button compact">Load settings<input id="settings-file" type="file" accept=".json" /></label></div>
  </aside>
  <main class="workspace" data-studio-panel="studio">
    <header><div><span class="eyebrow">YOUR VIRTUAL STAGE</span><h2>Make yourself seen.</h2></div><span class="local-badge"><i></i> Runs on your laptop</span></header>
    <div class="stage-wrap"><div id="stage"></div><div id="loading" class="loading">Preparing avatar…</div><span class="stage-label">VMODEL</span></div>
    <footer><div><span id="status-dot" class="status-dot"></span><span id="status" role="status" aria-live="polite">Loading avatar…</span><small id="stats"></small><small id="tracking-hint"></small><small id="output-status">Output closed · Escape returns from Clean view</small></div><div class="pair"><button id="clean">Clean view</button><button id="output" class="primary">Open output ↗</button></div></footer>
    <div class="bottom-note"><span>Made for your next hello.</span><span>Capture the output window in OBS · Camera preview stays here.</span></div>
  </main>`;
const stage = document.querySelector<HTMLElement>('#stage')!;
const viewer = new AvatarViewer(stage, settings, output);
const stopLayout = publishOutputLayout(viewer.renderer.domElement, () => ({ active: output || document.body.classList.contains('clean'), kind: output ? 'output' : 'clean', orientation: settings.orientation }));
let retarget: Retargeter | null = null, avatar: Blob | null = null, lastFrame: TrackingFrame | null = null;
let avatarId: string | null = null, loadingAvatarId: string | null = null, label: string = savedAvatar().label;
let selectedBundle: string | null = null;
let calibration: Calibration | null = null, appliedCalibration = '', expression = 'neutral', loadGeneration = 0;
let tracker: CameraTracker | null = null;
const repository = output ? null : new LocalModelRepository();
const modelOperation = new ModelOperation();
let libraryPanel: LibraryPanel | null = null, inspector: TrackingInspector | null = null;
let selectedModelId: string | null = null, requestedModelId: string | null = null;
let selectionRevision = 0, receivedRevision = -1;
const revisionKey = `vmodel-selection-revision:${session}`;
if (!output) {
  try {
    const savedRevision = Number(sessionStorage.getItem(revisionKey));
    if (Number.isSafeInteger(savedRevision) && savedRevision >= 0) selectionRevision = savedRevision;
  } catch { /* Storage can be unavailable. */ }
}
let outputLoadingRevision = -1;
let pendingOutputState: OutputSnapshot | null = null;
const stopServerWatch = output || import.meta.env.DEV ? () => {} : watchLocalServer(() => !!tracker?.getCameraInfo(), () => {
  tracker?.stop(); lastFrame = null; link.frame(null); status('Studio server disconnected. Camera stopped. Start the server, then reload this page.');
});
let lastTime = performance.now(), fps = 0, frames = 0, lastStats = performance.now();
const status = (message: string) => { const el = document.querySelector('#status'); if (el) el.textContent = message; const cameraMessage=document.querySelector('#camera-message');if(cameraMessage)cameraMessage.textContent=message; };
stage.addEventListener('vmodel-renderer-state', event => status((event as CustomEvent<string>).detail));
const scope = (): CalibrationScope | null => {
  const info = tracker?.getCameraInfo();
  return avatarId && info?.deviceId ? { avatar: avatarId, device: info.deviceId, mode: settings.mode, format: `${info.width}x${info.height}` } : null;
};
function applyPerformanceState() {
  const key = JSON.stringify(calibration);
  if (appliedCalibration !== key) { retarget?.setCalibration(calibration); appliedCalibration = key; }
  retarget?.setExpression(expression);
}
function restoreCalibration() { calibration = readCalibration(scope()); appliedCalibration = ''; applyPerformanceState(); }
const link = new OutputLink(output, session,
  known => ({ sessionId:session!, revision:selectionRevision, avatarId, label, ...(avatar && known !== avatarId ? { blob: avatar } : {}), settings, calibration, expression, frame: lastFrame }),
  state => { void receiveSnapshot(state); }, frame => { lastFrame = frame; }, () => loadingAvatarId ?? avatarId,
  count => {
    if (output) { document.title = count ? `VModel Output · ${settings.orientation}` : 'VModel Output · waiting for controls'; return; }
    const el = document.querySelector('#output-status'), size = compositionSize(settings.orientation);
    if (el) el.textContent = count ? `${count} output connected · ${size.width} × ${size.height}` : 'Output closed · Escape returns from Clean view';
  }, peers => { const el=document.querySelector('#output-peer-status');if(el)el.textContent=peers.map(peer=>`Output ${peer.state} · revision ${peer.revision}${peer.revision!==selectionRevision?' · Model mismatch':''}${peer.message?' · '+peer.message:''}`).join(' | '); });
function applySettings() {
  document.body.classList.toggle('portrait', settings.orientation === 'portrait');
  viewer.configure(settings);
  viewer.renderer.domElement.style.transform = settings.mirror ? 'scaleX(-1)' : '';
  if (!output) {
    for (const key of ['mode','quality','framing','orientation','background','springMotion','captureResolution','zoom','headRange','mouthGain','smoothing'] as const) (document.getElementById(key) as HTMLInputElement).value = String(settings[key]);
    for (const key of ['hands','mirror'] as const) (document.getElementById(key) as HTMLInputElement).checked = settings[key];
    saveLocal('vmodel-settings', settings); if (avatarId) saveLocal(avatarSettingsKey(avatarId), settings);
    link.publish();
  }
}
async function load(source: Blob | Promise<Blob>, nextLabel = label, bundleId: string | null = null, entryId: string | null = bundleId, expectedHash?: string) {
  libraryPanel?.cancel();
  const signal = modelOperation.begin(); requestedModelId = entryId;
  const generation = ++loadGeneration;
  viewer.cancelPendingLoad();
  const loading = document.querySelector('#loading');
  if (loading) { loading.textContent = `Preparing ${nextLabel}…`; loading.classList.toggle('hidden',!!avatar); }
  status(`Loading ${nextLabel}…`);
  try {
    const blob = await abortable(Promise.resolve(source),signal); signal.throwIfAborted();
    if (generation !== loadGeneration) return;
    const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const id = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (generation !== loadGeneration) return;
    if(expectedHash && expectedHash !== id) throw new Error('Model bytes failed the hash check. Restore a backup.');
    loadingAvatarId = id;
    const prepared = await prepareSelection(viewer, blob, signal);
    if (generation !== loadGeneration || signal.aborted) { viewer.disposePreparedAvatar(prepared);signal.throwIfAborted();return; }
    const nextSettings = output && pendingOutputState?.avatarId===id ? normalizeSettings(pendingOutputState.settings) : output ? settings : readSettings(avatarSettingsKey(id));
    viewer.commitAvatar(prepared);
    settings = nextSettings;
    avatar = blob; avatarId = id; loadingAvatarId = null; label = nextLabel; selectedBundle = bundleId; retarget = prepared.retarget; appliedCalibration = '';
    selectedModelId = entryId; requestedModelId = null; selectionRevision++; modelOperation.finish(signal);
    if (!output) {
      try { sessionStorage.setItem(revisionKey, String(selectionRevision)); } catch { /* Keep the current session active. */ }
    }
    if (!output) {
      restoreCalibration();
      (document.querySelector('#avatar-select') as HTMLSelectElement).value = bundleId ?? 'custom';
      try { if (bundleId) localStorage.setItem('vmodel-avatar', bundleId); } catch { /* optional persistence */ }
    }
    applySettings(); applyPerformanceState();
    document.querySelector('#loading')?.classList.add('hidden');
    const name = document.querySelector('#avatar-name'); if (name) name.textContent = label;
    const stageLabel = document.querySelector('.stage-label'); if (stageLabel) stageLabel.textContent = label.toUpperCase();
    status('Saving model selection…');
    let sessionOnly=false;
    if (!output) {
      link.publish();
      if(entryId){try{await repository!.select(entryId);}catch{sessionOnly=true;}}
      if(generation!==loadGeneration)return;
      void libraryPanel?.refresh();
    }
    status(sessionOnly?'Selected for this session only':`${label} is ready. Start your camera when you are.`);

    for(const button of document.querySelectorAll<HTMLButtonElement>('[data-expression]')){const name=button.dataset.expression!;button.disabled=name!=='neutral'&&!prepared.vrm.expressionManager?.getExpression(name)&&!(name==='surprised'&&prepared.vrm.expressionManager?.getExpression('びっくり'));button.title=button.disabled?'This expression is not available.':'';}
    // Read-only diagnostic access for automated rendering/rig verification.
    Object.assign(window, { __vmodel: { viewer, retarget, setFrame: (frame: TrackingFrame) => { lastFrame = frame; link.frame(frame); }, getState: () => ({ avatarId, label, selectedBundle, settings, calibration, expression }), getStats: () => ({ fps, inferenceMs: lastFrame?.inferenceMs ?? 0, sequence: lastFrame?.sequence ?? 0, samples: lastFrame?.samples ?? null, drawCalls: viewer.renderer.info.render.calls }) } });
  } catch (error) {
    if (generation !== loadGeneration) return;
    loadingAvatarId = null; requestedModelId = null; modelOperation.finish(signal);
    if(output) link.acknowledge(receivedRevision,'error',String(error));
    const message = describeLoadFailure(error); status(message);
    if (loading) { loading.textContent = `${message} Choose a model or load another VRM.`; loading.classList.toggle('hidden', !!avatar); }
    const select = document.querySelector<HTMLSelectElement>('#avatar-select'); if (select) select.value = selectedBundle ?? 'custom';
  }
}
function loadBundle(id: string) {
  const model = bundledAvatars.find(item => item.id === id); if (!model) return;
  return load(fetch(model.url).then(response => {
    if (!response.ok) throw new Error(`Prepared ${model.name} avatar not found. Run deploy/Setup VModel.cmd or load a VRM.`);
    return response.blob();
  }), model.label, model.id);
}
async function receiveSnapshot(state: OutputSnapshot) {
  if (!output || state.sessionId && state.sessionId !== session) return;
  const revision=state.revision??0;
  if(revision<receivedRevision)return;
  if(revision===receivedRevision&&pendingOutputState&&state.avatarId!==pendingOutputState.avatarId)return;
  if(revision>receivedRevision&&outputLoadingRevision>=0){
    ++loadGeneration;modelOperation.cancel();viewer.cancelPendingLoad();loadingAvatarId=null;outputLoadingRevision=-1;
  }
  receivedRevision=revision; pendingOutputState=state;
  if(state.avatarId!==avatarId){
    if(outputLoadingRevision===revision)return;
    if(!state.blob)return;
    outputLoadingRevision=revision; link.acknowledge(revision,'loading');
    try{await load(state.blob,state.label,null,null,state.avatarId??undefined);}
    finally{if(outputLoadingRevision===revision)outputLoadingRevision=-1;}
    if(revision!==receivedRevision || state.avatarId!==avatarId)return;
  }else if(outputLoadingRevision>=0){
    ++loadGeneration;modelOperation.cancel();viewer.cancelPendingLoad();loadingAvatarId=null;outputLoadingRevision=-1;
  }
  const current=pendingOutputState;
  if(!current || current.avatarId!==avatarId)return;
  settings=normalizeSettings(current.settings);
  calibration=validCalibration(current.calibration)?current.calibration:null;
  expression=['neutral','happy','surprised'].includes(current.expression)?current.expression:'neutral';
  lastFrame=current.frame;applySettings();applyPerformanceState();link.acknowledge(revision,'ready');
}

if (output) document.body.classList.add('output');
else {
  const video = document.querySelector<HTMLVideoElement>('#camera-video')!;
  tracker = new CameraTracker(video, frame => { lastFrame = frame; link.frame(frame); }, status, () => settings, (frame,envelope,image) => inspector?.receive(frame,envelope,image));
  libraryPanel = new LibraryPanel(repository!, async asset => { await load(asset.blob,asset.label,bundledAvatars.some(x=>x.id===asset.entryId)?asset.entryId:null,asset.entryId,asset.hash); }, () => ({id:selectedModelId,requested:requestedModelId,temporaryLabel:avatarId&&!selectedModelId?label:null}), modelOperation);
  inspector = new TrackingInspector(demand=>tracker!.setDiagnosticDemand(demand),()=>settings,()=>calibration,()=>tracker!.getStream(),()=>tracker!.getSessionClock(),()=>avatar,async(id,signal)=>(await repository!.resolve(id,signal)).blob);
  app.append(libraryPanel.element,inspector.element);
  const navigation=createNavigation(view=>{libraryPanel?.setVisible(view==='library');inspector?.setVisible(view==='tracking');viewer.resize();});
  const peerStatus=document.createElement('p');peerStatus.id='output-peer-status';peerStatus.setAttribute('role','status');navigation.element.append(peerStatus);
  app.prepend(navigation.element);
  const updateDevices = async () => {
    const select = document.querySelector<HTMLSelectElement>('#camera')!; const previous = select.value;
    const devices = await tracker!.devices().catch(() => []);
    select.replaceChildren(new Option('Laptop camera', ''), ...devices.map((d,i) => new Option(d.label || `Camera ${i+1}`, d.deviceId)));
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
  };
  void updateDevices(); navigator.mediaDevices?.addEventListener('devicechange', updateDevices);
  document.querySelector('#start')!.addEventListener('click', async () => { await tracker!.start((document.querySelector('#camera') as HTMLSelectElement).value); restoreCalibration(); link.publish(); await updateDevices(); });
  const stop = () => { tracker!.stop(); lastFrame = null; link.frame(null); };
  document.querySelector('#stop')!.addEventListener('click', stop);
  document.querySelector('#calibrate')!.addEventListener('click', () => {
    if (!lastFrame || performance.timeOrigin + performance.now() - lastFrame.timestamp > 500 || (!lastFrame.faceMatrix && !lastFrame.pose.length)) { status('Start the camera and face it before calibrating.'); return; }
    retarget?.calibrate(lastFrame); calibration = retarget?.getCalibration() ?? null; appliedCalibration = JSON.stringify(calibration);
    const saved = calibration && saveCalibration(scope(), calibration); link.publish(); status(saved ? 'Neutral pose saved for this avatar and camera.' : 'Neutral pose applied for this session.');
  });
  document.querySelector('#avatar-select')!.addEventListener('change', e => { void loadBundle((e.target as HTMLSelectElement).value); });
  document.querySelector('#avatar-file')!.addEventListener('change', e => { const file = (e.target as HTMLInputElement).files?.[0]; (e.target as HTMLInputElement).value=''; if (file) { navigation.select('library'); libraryPanel!.importFile(file); } });
  for (const key of ['mode','quality','framing','orientation','background','hands','springMotion','captureResolution','zoom','mirror','headRange','mouthGain','smoothing'] as const) document.getElementById(key)!.addEventListener('change', e => {
    const input = e.target as HTMLInputElement;
    settings = { ...settings, [key]: key === 'hands' || key === 'mirror' ? input.checked : ['zoom','headRange','mouthGain','smoothing'].includes(key) ? Number(input.value) : input.value };
    if (key === 'mode') restoreCalibration();
    applySettings();
    if (key === 'captureResolution') status('Camera size saved. Press Start camera to apply it.');
  });
  document.querySelector('#preview')!.addEventListener('change', e => { video.hidden = !(e.target as HTMLInputElement).checked; });
  document.querySelectorAll<HTMLButtonElement>('[data-expression]').forEach(button => button.addEventListener('click', () => {
    expression = button.dataset.expression!; applyPerformanceState(); link.publish();
  }));
  document.querySelector('#output')!.addEventListener('click', () => {
    const size = compositionSize(settings.orientation);
    const child = window.open(`/?output=1&session=${encodeURIComponent(session!)}`, `vmodel-output-${session}`, `width=${size.width},height=${size.height}`);
    if (!child) status('Allow this local site to open its output window, then retry.');
  });
  document.querySelector('#clean')!.addEventListener('click', () => { document.title = 'VModel Output · clean'; document.body.classList.add('clean'); viewer.setOutputMode(true); });
  document.querySelector('#reset')!.addEventListener('click', () => {
    const cleared = !avatarId || clearAvatarCalibration(avatarId);
    settings = { ...defaults }; calibration = null; retarget?.setCalibration(null); expression = 'neutral'; applyPerformanceState(); applySettings();
    status(cleared ? 'Avatar settings and saved neutral poses reset.' : 'Settings reset for this session; browser storage is unavailable.');
  });
  document.querySelector('#key-color')!.addEventListener('click', () => { settings.background = '#00ff00'; applySettings(); });
  document.querySelector('#default-color')!.addEventListener('click', () => { settings.background = defaults.background; applySettings(); });
  document.querySelector('#save-settings')!.addEventListener('click', () => {
    if (!avatarId) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ type: 'vmodel-settings', version: 1, avatar: avatarId, settings }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'vmodel-settings.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.querySelector('#settings-file')!.addEventListener('change', async e => {
    const file = (e.target as HTMLInputElement).files?.[0]; if (!file || !avatarId) return;
    try { if (file.size > 65536) throw new Error('Settings file is too large.'); settings = parseSettingsFile(await file.text(), avatarId); restoreCalibration(); applySettings(); status('Avatar settings loaded.'); }
    catch (error) { status(readableError(error,
      'That settings file could not be used. Choose a file this app saved with Save settings.')); }
  });
  // A hidden window delivers no animation frames, so the avatar stops and any OBS
  // capture of it goes blank. The warning cannot be read while hidden; report it
  // on return, with how long the stream was dead.
  const freeze = createFreezeNotice();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const notice = freeze.visible(performance.now());
      if (notice) status(notice);
    } else freeze.hidden(performance.now());
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { document.title = 'VModel'; document.body.classList.remove('clean'); viewer.setOutputMode(false); }
    if (e.code === 'Space' && document.body.classList.contains('clean')) { e.preventDefault(); stop(); }
    if (e.code === 'KeyC' && document.body.classList.contains('clean')) (document.querySelector('#calibrate') as HTMLButtonElement).click();
  });
}
applySettings();
if (!output) {
  void (async()=>{
    let saved:string|undefined;try{saved=await repository!.selected();}catch(error){status(`Saved entries are unavailable. ${String(error)}`);}
    if(saved){try{const asset=await repository!.resolve(saved,new AbortController().signal);await load(asset.blob,asset.label,bundledAvatars.some(x=>x.id===saved)?saved:null,saved,asset.hash);if(avatar)return;}catch(error){status(`Saved model is unavailable. ${String(error)}`);}
      await loadBundle('ene');status('Saved model is missing or invalid. Ene is active. Restore a backup to recover the saved model.');
    }else{const model=savedAvatar();(document.querySelector('#avatar-select')as HTMLSelectElement).value=model.id;await loadBundle(model.id);}
  })();
}
function animate(now: number) {
  const dt = Math.min(0.1, (now - lastTime) / 1000); lastTime = now;
  retarget?.update(lastFrame, settings, dt, performance.timeOrigin + now); viewer.draw(dt);
  inspector?.apply(lastFrame,dt,performance.timeOrigin+now);
  frames++;
  if (now - lastStats > 1000) {
    fps = frames * 1000 / (now - lastStats); frames = 0; lastStats = now;
    const stats = document.querySelector('#stats'); if (stats) stats.textContent = `${Math.round(fps)} fps${lastFrame ? ` · tracking ${Math.round(lastFrame.inferenceMs)} ms` : ''}`;
    const hint = document.querySelector('#tracking-hint');
    if (hint) {
      const current = performance.timeOrigin + now;
      const seen = (task: 'face' | 'pose' | 'hands') => !!lastFrame?.samples[task].present && current - lastFrame.samples[task].timestamp >= -50 && current - lastFrame.samples[task].timestamp < 500;
      const feetVisible = seen('pose') && [27, 28].every(index => { const p = lastFrame?.poseImage[index]; return confidence(p) && p!.x >= 0 && p!.x <= 1 && p!.y >= 0 && p!.y <= 1; });
      hint.textContent = !tracker?.getCameraInfo() ? '' : !lastFrame ? 'Preparing tracking…' :
        !seen('face') ? 'Face not found. Face the camera in good light.' :
        settings.mode === 'standing' && !feetVisible ? 'Face found. Move back until both feet are visible.' :
        !seen('pose') ? 'Face found. Keep your shoulders and arms in view.' :
        settings.hands && !seen('hands') ? 'Face and body found. Show your hands to follow fingers.' :
        `Face and body found${settings.hands ? ` · ${lastFrame.hands.length} hand${lastFrame.hands.length === 1 ? '' : 's'} visible` : ''}`;
    }
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
addEventListener('beforeunload', () => { stopServerWatch(); stopLayout(); tracker?.stop(); modelOperation.cancel();libraryPanel?.dispose();inspector?.dispose();repository?.close(); viewer.dispose(); link.close(); });
