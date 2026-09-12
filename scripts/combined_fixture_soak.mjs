// Prepared TASK-020 combined workload check. Run only after the coordinated quiet window.
// Actual production app/worker/Ene + native OBS recording; still photos are private fake-camera input.
import { chromium } from '@playwright/test';
import { readFile, readdir, mkdir, writeFile, appendFile, stat, statfs, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import { connectOBS } from './obs-client.mjs';
import { captureCrop } from './output-layout.mjs';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';
import { installPositiveCameraFixture } from './positive-camera-fixture.mjs';
import { summarizePhase, withinOwnedDirectory } from './soak-metrics.mjs';
import { createDrawHealthGuard, inspectCapturePNG } from './soak-health.mjs';
import { installCaptureAnimationProbe } from './capture-animation-probe.mjs';

const run = promisify(execFile), delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const WARMUP_MS = 60000, PHASE_MS = 900000, TICK_MS = 5000;
const STOP_BYTES = 512 * 1024 ** 2, FINAL_MAX_BYTES = 600 * 1024 ** 2, TRACE_MAX_BYTES = 50 * 1024 ** 2;
const args = process.argv.slice(2);
assert(args.every(arg => ['--run', '--quiet-window', '--plan'].includes(arg) || arg.startsWith('--phase=')),
  'Usage: node scripts/combined_fixture_soak.mjs --plan OR --run --quiet-window [--phase=<id>]');
const usage = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';
const fixtures = [
  { id: 'portrait', file: 'assets/testing/jsc2021e037768_alt.jpg', sha256: '7a7536821783691d1c7b58f5ee7cb601abbeaaa2f4703e755a15c5dbb4271b78',
    url: 'https://images-assets.nasa.gov/image/jsc2021e037768_alt/jsc2021e037768_alt~orig.jpg', credit: 'NASA/Josh Valcarcel', usage },
  { id: 'body', file: 'assets/testing/jsc2026e002116.jpg', sha256: '194f6ba51f7bdeb090c9a47e7ab69d3fa191fbb6240cd4b6f118a215bc27caf0',
    url: 'https://images-assets.nasa.gov/image/jsc2026e002116/jsc2026e002116~medium.jpg', credit: 'NASA/Robert Markowitz', usage },
];
const phases = [
  { id: 'seated-no-hands', fixture: 'portrait', mode: 'seated', hands: false, framing: 'body',
    input: 'Whole permitted portrait, aspect fitted and letterboxed into 640×480. Repeated still frames.' },
  { id: 'standing-hands', fixture: 'body', mode: 'standing', hands: true, framing: 'body', crop: { x: 150, y: 75, width: 520, height: 400 },
    input: 'Proven face/pose/hand-positive upper-body crop of the permitted full-body photo, letterboxed into 640×480. Feet are outside this crop; standing is a settings/workload label, not full-body tracking acceptance.' },
];
const selectedPhaseId = (args.find(arg => arg.startsWith('--phase=')) ?? '').slice('--phase='.length);
if (selectedPhaseId) assert(phases.some(phase => phase.id === selectedPhaseId),
  'Unknown --phase id; expected one of: ' + phases.map(phase => phase.id).join(', '));
const activePhases = selectedPhaseId ? phases.filter(phase => phase.id === selectedPhaseId) : phases;
const plan = { phases: activePhases, selectedPhaseId: selectedPhaseId || null,
  singlePhaseDiagnostic: Boolean(selectedPhaseId),
  singlePhaseBoundary: selectedPhaseId ? 'One phase only: this reproduces that workload with fresh browser state and does not constitute the full combined soak.' : null,
  warmupSecondsPerPhase: 60, measuredSecondsPerPhase: 900, expectedWallMinutes: '32–35 including setup/cleanup',
  inputSize: { width: 640, height: 480 }, requestedCaptureFps: 30, outputSize: { width: 1280, height: 720, fps: 30 },
  quality: 'balanced', springMotion: 'gentle', delegate: 'default GPU; abort if actual initialization falls back to CPU',
  recording: 'Existing Ene Landscape encoder/profile, uniquely owned recording directory; video-only source; existing silent audio track may remain.',
  fileBounds: { recordingStopThresholdBytes: STOP_BYTES, finalMaximumBytesPerRecording: FINAL_MAX_BYTES, traceMaximumBytesPerPhase: TRACE_MAX_BYTES, maximumRecordingSeconds: 975 },
  failFast: { drawIntervalThresholdMs: 500, consecutiveSlowDraws: 3, noCompletedDrawMs: 2500, timingPollMs: TICK_MS,
    obsThumbnail: { width: 160, height: 90, pollMs: 30000 }, evidenceTimeoutMs: 10000,
    action: 'Persist triggering timing/thumbnail, collect bounded paired canvas/OBS/native/GL evidence, stop this owned recording and restore; do not start the next phase.' },
  passiveBoundary: 'One main viewer in Clean mode; unchanged five-second timing and thirty-second memory samples. No extra rAF observer, periodic canvas/native/GL readbacks or activation. Small OBS-only thumbnails are an explicitly added observer.',
  powerBoundary: 'Current power before and after the workload is retained. These endpoint observations do not prove continuous AC or browser Energy Saver state; no power/browser settings are changed.',
  acceptanceBoundary: 'Positive still-fixture workload evidence only. No live movement, physical media, subjective quality, temperature sensors, thermal attribution or end-to-end latency acceptance.' };
if (args.includes('--plan')) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
assert(args.includes('--run') && args.includes('--quiet-window'), 'Review --plan and coordinate the quiet window before using --run --quiet-window.');

const root = process.cwd(), runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8);
const localRoot = path.resolve('ops/reports/local/combined-soak'), directory = path.join(localRoot, runId);
const lockPath = path.join(localRoot, 'active.lock');
const sceneName = 'Ene Fixture Soak ' + runId, inputName = sceneName + ' Window', title = 'Ene Output Soak ' + runId;
const ffprobe = path.resolve('.tools/web/ffmpeg-9.0.1-essentials_build/bin/ffprobe.exe');
const ffmpeg = path.resolve('.tools/web/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe');
const report = { startedAt: new Date().toISOString(), runId, plan, fixtures, phases: [], errors: [], cleanupErrors: [], externalRequests: [], externalResponses: [], browserMessages: [],
  layoutNetworkEvents: [], diagnosticErrors: [],
  forbiddenPhysicalMedia: true, noPublicStream: true, noVoiceInput: true, measuredTemperature: false, measuredEndToEndLatency: false, completed: false, taskAcceptance: false };
let obs, browser, context, page, server, original, snapshot, landscapeDirectory, filenameParameter;
let ownedScene = false, ownedInput = false, lockOwned = false, changedProfile = false, changedRecordingDirectory = false, changedFilename = false;
let recordPending = false, stopPromise, recordedPath, interrupted = false, initialInputsHash, obsPid;
let browserCDP, pageCDP, attachedLayout, captureItem, currentPhase;
let lastLayoutResponse, ownedBrowserPid, lastScreenshotContent;
const safeError = error => String(error).replace(/https?:\/\/[^\s"']+/g, raw => { try { const url = new URL(raw); return url.origin + url.pathname; } catch { return '[URL omitted]'; } });
const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const markInterrupted = () => { interrupted = true; };
process.on('SIGINT', markInterrupted); process.on('SIGTERM', markInterrupted);
function checkInterrupt() { if (interrupted) throw new Error('Soak interrupted; only the owned recording/window/server will be stopped.'); }
async function boundedWait(predicate, timeoutMs, message) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) { checkInterrupt(); const value = await predicate(); if (value) return value; await delay(250); }
  throw new Error(message);
}
async function boundedObservation(promise, timeoutMs, message) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
async function optionalOutput(method) {
  try { return await obs.request(method); }
  catch (error) { if (String(error).includes(`${method}: 604`)) return { outputActive: false, unavailable: true }; throw error; }
}
async function outputGuard({ allowOwnedRecording = false } = {}) {
  const [record, stream, virtual, replay] = await Promise.all([
    obs.request('GetRecordStatus'), obs.request('GetStreamStatus'), optionalOutput('GetVirtualCamStatus'), optionalOutput('GetReplayBufferStatus'),
  ]);
  assert(!stream.outputActive && !virtual.outputActive && !replay.outputActive, 'An unrelated OBS output is active; it is not stopped by this fixture.');
  assert(!record.outputActive || allowOwnedRecording && recordPending, 'An unrelated OBS recording is active.');
  return record;
}
async function voiceIdle() {
  const base = 'http://127.0.0.1:5082';
  const response = await fetch(base + '/api/status', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(3000) });
  assert(response.ok, 'The owned Voice Studio status is unavailable; cannot confirm idle/muted.');
  const status = await response.json(); assert(status.mode === 'idle' && status.muted === true, 'Voice must remain idle and muted throughout the camera-only fixture.');
  return { mode: status.mode, muted: status.muted };
}
async function inputSnapshot({ includeOwned = false } = {}) {
  const inputs = (await obs.request('GetInputList')).inputs;
  const routes = new Map([['Ene Converted Voice Bridge', '/obs'], ['Ene Natural Voice Bridge', '/obs-natural']]);
  const hashes = [];
  for (const input of inputs) {
    if (input.inputName === inputName && !includeOwned) continue;
    const settings = (await obs.request('GetInputSettings', { inputName: input.inputName })).inputSettings;
    if (input.inputKind !== 'window_capture') {
      assert(input.inputKind === 'browser_source' && routes.has(input.inputName), 'Unexpected OBS input; only existing window captures and the two exact owned voice routes are allowed.');
      const url = new URL(settings.url);
      assert(url.origin === 'http://127.0.0.1:5082' && url.pathname === routes.get(input.inputName) && !url.search && !url.username && !url.password && settings.is_local_file !== true, 'An owned voice source has an unexpected route.');
      assert.equal((await obs.request('GetInputAudioMonitorType', { inputName: input.inputName })).monitorType, 'OBS_MONITORING_TYPE_NONE');
    }
    // Record only a digest; browser source fragments and settings never enter the report.
    hashes.push({ name: input.inputName, kind: input.inputKind, hash: digest(stable(settings)) });
  }
  return hashes.sort((a, b) => a.name.localeCompare(b.name));
}
async function snapshotSceneItems() {
  const result = [];
  for (const scene of (await obs.request('GetSceneList')).scenes) {
    const items = (await obs.request('GetSceneItemList', { sceneName: scene.sceneName })).sceneItems;
    for (const item of items) result.push({ sceneName: scene.sceneName, sceneItemId: item.sceneItemId, sourceName: item.sourceName, sceneItemEnabled: item.sceneItemEnabled });
  }
  return result;
}
async function processMemory() {
  const { processInfo } = await browserCDP.send('SystemInfo.getProcessInfo');
  const ids = [...new Set([...processInfo.map(item => Number(item.id)), obsPid])];
  assert(ids.every(id => Number.isInteger(id) && id > 0));
  // Numeric PIDs originate only from this Chrome CDP session and the exact owned OBS executable.
  // One PowerShell invocation per sample. Host memory is gathered inside the same
  // call: a second spawn per tick pushed this sampler past its timeout under load.
  const command = `$soakIds=@(${ids.join(',')}); $soakRows=@(foreach($soakId in $soakIds){try{$soakProcess=[Diagnostics.Process]::GetProcessById($soakId);[pscustomobject]@{pid=$soakId;privateBytes=$soakProcess.PrivateMemorySize64;workingSetBytes=$soakProcess.WorkingSet64}}catch{}}); $soakOs=Get-CimInstance Win32_OperatingSystem; ConvertTo-Json -Depth 4 -Compress -InputObject ([pscustomobject]@{rows=$soakRows;system=[pscustomobject]@{freeMiB=[math]::Round($soakOs.FreePhysicalMemory/1KB,1);totalMiB=[math]::Round($soakOs.TotalVisibleMemorySize/1KB,1);committedMiB=[math]::Round(($soakOs.TotalVirtualMemorySize-$soakOs.FreeVirtualMemory)/1KB,1)}})`;
  const payload = JSON.parse((await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 15000 })).stdout.replace(/^\uFEFF/, ''));
  const rows = Array.isArray(payload.rows) ? payload.rows : [payload.rows].filter(Boolean);
  const system = payload.system ?? null;
  const obsRow = rows.find(row => row.pid === obsPid); assert(obsRow, 'Owned OBS process exited.');
  const chrome = rows.filter(row => row.pid !== obsPid);
  const metrics = Object.fromEntries((await pageCDP.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
  return { chromePrivateMiB: chrome.reduce((sum, row) => sum + row.privateBytes, 0) / 1024 ** 2,
    chromeWorkingSetMiB: chrome.reduce((sum, row) => sum + row.workingSetBytes, 0) / 1024 ** 2,
    obsPrivateMiB: obsRow.privateBytes / 1024 ** 2, obsWorkingSetMiB: obsRow.workingSetBytes / 1024 ** 2,
    jsHeapUsedMiB: Number.isFinite(metrics.JSHeapUsedSize) ? metrics.JSHeapUsedSize / 1024 ** 2 : null,
    systemFreeMiB: system?.freeMiB ?? null, systemTotalMiB: system?.totalMiB ?? null, systemCommittedMiB: system?.committedMiB ?? null,
    chromeProcesses: chrome.length, observedChromePids: chrome.map(row => row.pid),
    note: 'Main-page JS heap excludes worker heaps. Chrome process totals include this browser’s renderer/worker/GPU processes; working sets can count shared pages more than once.' };
}
async function readLayout() {
  const { layouts } = await (await fetch(server.base + '/api/output-layout', { signal: AbortSignal.timeout(3000) })).json();
  lastLayoutResponse = { receivedAtUTC: new Date().toISOString(), layouts };
  const candidates = layouts.filter(layout => layout.title === title && layout.kind === 'clean' && layout.orientation === 'landscape');
  return candidates.length === 1 ? candidates[0] : null;
}
async function attachOwnedWindow() {
  attachedLayout = await boundedWait(readLayout, 10000, 'The owned clean view did not publish its geometry.');
  const { propertyItems } = await obs.request('GetInputPropertiesListPropertyItems', { inputName, propertyName: 'window' });
  const matches = propertyItems.filter(item => item.itemEnabled && item.itemName.includes(title));
  assert.equal(matches.length, 1, 'Exactly one owned browser window must match the unique title.');
  await obs.request('SetInputSettings', { inputName, inputSettings: { window: matches[0].itemValue, priority: 1, method: 2, cursor: false, client_area: true, capture_audio: false, force_sdr: true }, overlay: true });
  await obs.request('SetSceneItemEnabled', { sceneName, sceneItemId: captureItem, sceneItemEnabled: true });
  const transform = await boundedWait(async () => { const value = (await obs.request('GetSceneItemTransform', { sceneName, sceneItemId: captureItem })).sceneItemTransform; return value.sourceWidth > 0 && value.sourceHeight > 0 ? value : null; }, 10000, 'Owned OBS window source stayed empty.');
  const crop = captureCrop(transform.sourceWidth, transform.sourceHeight, attachedLayout);
  await obs.request('SetSceneItemTransform', { sceneName, sceneItemId: captureItem, sceneItemTransform: { positionX: 0, positionY: 0, alignment: 5, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsAlignment: 0, boundsWidth: 1280, boundsHeight: 720, ...crop } });
  report.capture = { layout: attachedLayout, crop, nativeSourceSize: { width: transform.sourceWidth, height: transform.sourceHeight }, method: 'WGC method 2, exact title priority 1, cursor/audio disabled' };
}
async function stopOwnedRecord() {
  if (stopPromise) return stopPromise;
  if (!recordPending) return recordedPath;
  stopPromise = (async () => {
    const status = await obs.request('GetRecordStatus');
    if (status.outputActive) {
      const stopped = await obs.request('StopRecord'); recordedPath = stopped.outputPath;
      assert(recordedPath && withinOwnedDirectory(directory, recordedPath, path), 'OBS returned a recording outside the owned directory.');
    }
    const deadline = performance.now() + 20000;
    while ((await obs.request('GetRecordStatus')).outputActive) { assert(performance.now() < deadline, 'Owned recording did not stop.'); await delay(250); }
    recordPending = false; return recordedPath;
  })();
  try { return await stopPromise; } finally { stopPromise = undefined; }
}
async function screenshot(label) {
  const { imageData } = await obs.request('GetSourceScreenshot', { sourceName: sceneName, imageFormat: 'png', imageWidth: 640, imageHeight: 360 });
  assert(imageData.startsWith('data:image/png;base64,'));
  const bytes = Buffer.from(imageData.split(',')[1], 'base64'), file = path.join(directory, label + '.png');
  await writeFile(file, bytes);
  lastScreenshotContent = { observedAtUTC: new Date().toISOString(), file: relative(file), pixels: inspectCapturePNG(bytes, 640, 360) };
  return relative(file);
}
async function thumbnailContent(label) {
  const requestedAtUTC = new Date().toISOString();
  const { imageData } = await obs.request('GetSourceScreenshot', { sourceName: sceneName, imageFormat: 'png', imageWidth: 160, imageHeight: 90 });
  assert(imageData.startsWith('data:image/png;base64,'));
  const bytes = Buffer.from(imageData.split(',')[1], 'base64'), pixels = inspectCapturePNG(bytes, 160, 90);
  const observation = { requestedAtUTC, observedAtUTC: new Date().toISOString(), pixels };
  if (pixels.blank) {
    const file = path.join(directory, label + '-blank-thumbnail.png'); await writeFile(file, bytes); observation.file = relative(file);
  }
  return observation;
}
async function nativeState({ inspectOwnedCaptions = false } = {}) {
  const response = await run('powershell.exe', ['-NoProfile', '-File', path.resolve('scripts/read_owned_window.ps1'), '-Title', title, '-BrowserProcessId', String(ownedBrowserPid), ...(inspectOwnedCaptions ? ['-InspectOwnedCaptions'] : [])], { windowsHide: true, timeout: 10000 });
  return JSON.parse(response.stdout.trim());
}
async function currentPower() {
  return JSON.parse((await run('powershell.exe', ['-NoProfile', '-File', path.resolve('scripts/read_power_now.ps1')], { windowsHide: true, timeout: 10000 })).stdout.trim());
}
async function verifiedNativePreflight() {
  const native = await nativeState();
  if (native.matchingWindows.length !== 1) report.ownedCaptionInspection = await nativeState({ inspectOwnedCaptions: true });
  // Retain a failed observation before throwing; no recording has started yet.
  report.lastNativePreflight = native;
  assert.equal(native.matchingWindows.length, 1, 'Exactly one native window must match the owned Chrome PID and unique title before recording.');
  const match = native.matchingWindows[0];
  assert(match.visible && !match.minimized && match.cloaked === 0, 'The owned native capture window must be visible, unminimized and uncloaked before recording.');
  if (report.nativePreflight) assert.equal(match.handle, report.nativePreflight.matchingWindows[0].handle, 'The verified owned capture HWND changed between phases.');
  else report.nativePreflight = native;
  return native;
}
async function captureEvidence(label) {
  // Only called after a failure is logged or after all measured recordings stop.
  // Independent requests begin together so a stalled renderer does not delay OBS/native evidence.
  const evidence = { label, requestedAtUTC: new Date().toISOString(), intervention: true, errors: [] };
  const observe = async (key, operation) => {
    try { evidence[key] = await boundedObservation(operation(), 10000, key + ' evidence timed out'); }
    catch (error) { evidence.errors.push(key + ': ' + safeError(error)); }
  };
  await Promise.all([
    observe('canvas', async () => {
      await page.evaluate(installCaptureAnimationProbe, { observeRaf: false });
      const capture = await page.evaluate(() => window.__captureDiag.takeCanvas());
      const { png, ...canvas } = capture;
      if (png) { assert(png.startsWith('data:image/png;base64,')); const file = path.join(directory, label + '-canvas.png'); await writeFile(file, Buffer.from(png.split(',')[1], 'base64')); canvas.file = relative(file); }
      return canvas;
    }),
    observe('obs', async () => { const file = await screenshot(label + '-obs'); return { file, pixels: lastScreenshotContent.pixels }; }),
    observe('native', nativeState),
    observe('power', currentPower),
    observe('browserGPU', async () => (await browserCDP.send('SystemInfo.getInfo')).gpu),
    observe('browserState', async () => page.evaluate(() => window.__soak.status())),
  ]);
  evidence.completedAtUTC = new Date().toISOString();
  await writeFile(path.join(directory, label + '-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  return evidence;
}
async function failPhase(result, stage, failure) {
  if (!result.failure) {
    result.failure = { detectedAtUTC: new Date().toISOString(), stage, ...failure };
    report.stoppedEarlyForCaptureHealth = true;
    // Save the triggering facts before any diagnostic intervention can change scheduling/content.
    await writeFile(path.join(directory, result.id + '-failure-trigger.json'), JSON.stringify(result.failure, null, 2) + '\n');
    result.failureEvidence = await captureEvidence(result.id + '-' + stage + '-failure');
  }
  throw new Error('Fixture capture health failed during ' + stage + ': ' + result.failure.kind + '. Partial evidence retained; no next phase.');
}
async function checkCaptureHealth(result, stage, guard, collected, { thumbnail = false } = {}) {
  const timingFailure = guard.observe(collected.drain.renders, collected.drain.atMs);
  if (timingFailure) await failPhase(result, stage, timingFailure);
  if (thumbnail) {
    const observation = { stage, atMs: collected.drain.atMs, ...await thumbnailContent(result.id + '-' + stage + '-' + result.captureHealthSamples.length) };
    result.captureHealthSamples.push(observation);
    if (observation.pixels.blank) await failPhase(result, stage, { kind: 'blank-obs-capture', capture: observation });
  }
}
async function sample({ collectMemory = false, requireFresh = true } = {}) {
  checkInterrupt();
  const [drain, state, stats, recording, currentScene, currentCollection, currentProfile] = await Promise.all([
    page.evaluate(() => window.__soak.drain()), page.evaluate(() => window.__soak.status()), obs.request('GetStats'),
    outputGuard({ allowOwnedRecording: true }), obs.request('GetCurrentProgramScene'), obs.request('GetSceneCollectionList'), obs.request('GetProfileList'),
  ]);
  assert(recording.outputActive && !recording.outputPaused, 'The owned recording stopped or was paused during measurement.');
  assert(currentScene.currentProgramSceneName === sceneName && currentCollection.currentSceneCollectionName === 'Ene Studio' && currentProfile.currentProfileName === 'Ene Landscape', 'OBS selection changed during the fixture.');
  assert(recording.outputBytes < STOP_BYTES, 'Owned recording reached the 512 MiB stop threshold.');
  assert(recording.outputDuration < 975000, 'Owned recording reached its duration bound.');
  assert(state.clean && state.visibility === 'visible' && state.previewHidden, 'Keep the owned clean view visible with the camera preview hidden.');
  assert(state.delegate === 'GPU' && state.workers === 1 && state.acquisitions === 1 && state.blockedMediaRequests === 0 && !state.overflow, 'The real GPU/fake-camera workload changed or telemetry overflowed.');
  assert(state.tracks.length === 1 && state.tracks[0].state === 'live' && state.tracks[0].kind === 'video' && state.tracks[0].settings.width === 640 && state.tracks[0].settings.height === 480, 'Fixed 640×480 video track is unavailable.');
  assert.deepEqual(state.workerErrors, []);
  if (requireFresh) assert(state.lastResultAgeMs !== null && state.lastResultAgeMs < 10000, 'No new inference result for ten seconds after warm-up.');
  const memory = collectMemory ? await processMemory() : null;
  if (collectMemory) {
    await voiceIdle(); const layout = await readLayout();
    const same = layout && JSON.stringify(layout.canvas) === JSON.stringify(attachedLayout.canvas) && JSON.stringify(layout.viewport) === JSON.stringify(attachedLayout.viewport);
    if (!same) {
      report.geometryMismatch = { observedAtUTC: new Date().toISOString(), expected: attachedLayout, observed: layout, apiResponse: lastLayoutResponse,
        liveDOM: await page.evaluate(() => { const canvas = window.__vmodel.viewer.renderer.domElement, rect = canvas.getBoundingClientRect(); return { title: document.title, viewport: { width: innerWidth, height: innerHeight }, canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, backingBuffer: { width: canvas.width, height: canvas.height }, view: window.__soak.status().view, events: window.__soak.status().viewEvents }; }),
        nativeTransform: (await obs.request('GetSceneItemTransform', { sceneName, sceneItemId: captureItem })).sceneItemTransform };
      report.geometryMismatch.screenshot = await screenshot('geometry-mismatch');
      throw new Error(layout ? 'Capture geometry changed; strict invariant retained.' : 'Output geometry API has no matching live layout; strict invariant retained.');
    }
    const settings = await page.evaluate(() => window.__vmodel.getState().settings);
    assert(settings.mode === currentPhase.mode && settings.hands === currentPhase.hands && settings.captureResolution === '640x480' && settings.springMotion === 'gentle' && settings.orientation === 'landscape' && settings.quality === 'balanced');
  }
  return { drain, sample: { atMs: drain.atMs, obs: stats, recording: { durationMs: recording.outputDuration, bytes: recording.outputBytes }, ...(memory ? { memory } : {}), state } };
}
async function inspectRecording(file) {
  assert(file && withinOwnedDirectory(directory, file, path));
  let probe;
  await boundedWait(async () => {
    try { probe = JSON.parse((await run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { timeout: 10000, windowsHide: true })).stdout); return Number(probe.format.duration) >= 959; } catch { return false; }
  }, 20000, 'OBS recording did not finalize with the required duration.');
  const size = (await stat(file)).size, video = probe.streams.find(stream => stream.codec_type === 'video');
  assert(size <= FINAL_MAX_BYTES && Number(probe.format.duration) <= 975, 'Final recording exceeded its file/duration bound.');
  assert(video?.width === 1280 && video?.height === 720 && video?.avg_frame_rate === '30/1' && video?.codec_name === 'h264', 'Unexpected recorded video format.');
  const audio = probe.streams.filter(stream => stream.codec_type === 'audio');
  let silentAudio = { audioStreams: audio.length, maxVolumeDb: null, silent: audio.length === 0 };
  if (audio.length) {
    assert.equal(audio.length, 1, 'Unexpected extra audio track.');
    const result = await run(ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', 'volumedetect', '-f', 'null', '-'], { timeout: 120000, windowsHide: true, maxBuffer: 2 * 1024 ** 2 });
    const match = result.stderr.match(/max_volume:\s*(-?(?:inf|\d+(?:\.\d+)?))\s*dB/); assert(match, 'Could not verify recorded silence.');
    const maxVolume = Number(match[1].replace('-inf', '-Infinity'));
    silentAudio = { audioStreams: 1, maxVolumeDb: Number.isFinite(maxVolume) ? maxVolume : '-Infinity', silent: maxVolume <= -85 };
    assert(silentAudio.silent, 'Unexpected audible content in the camera-only recording.');
  }
  return { file: relative(file), bytes: size, durationSeconds: Number(probe.format.duration), video: { width: video.width, height: video.height, fps: video.avg_frame_rate, codec: video.codec_name }, silentAudio };
}

try {
  assert.equal(process.platform, 'win32', 'Native Windows OBS capture is required.');
  const fixtureBytes = new Map();
  for (const fixture of fixtures) { const bytes = await readFile(fixture.file); assert.equal(digest(bytes), fixture.sha256); fixtureBytes.set('/testing/soak-' + fixture.id + '.jpg', bytes); }
  const workerFiles = (await readdir('dist/assets')).filter(name => /^tracking\.worker-.*\.js$/.test(name)); assert.equal(workerFiles.length, 1);
  report.build = { worker: workerFiles[0], workerSha256: digest(await readFile(path.join('dist/assets', workerFiles[0]))), indexSha256: digest(await readFile('dist/index.html')), avatarSha256: digest(await readFile('dist/avatars/ene.vrm')), sdk: JSON.parse(await readFile('node_modules/@mediapipe/tasks-vision/package.json', 'utf8')).version };
  await stat(ffprobe); await stat(ffmpeg);
  await mkdir(localRoot, { recursive: true }); await writeFile(lockPath, JSON.stringify({ runId, pid: process.pid }), { flag: 'wx' }); lockOwned = true;
  await mkdir(directory); const disk = await statfs(directory); assert(disk.bavail * disk.bsize > 3 * 1024 ** 3, 'At least 3 GiB free space is required for bounded recordings and traces.');
  obs = await connectOBS(); await outputGuard(); report.voiceAtStart = await voiceIdle();
  const obsExecutable = path.resolve('.tools/obs/bin/64bit/obs64.exe');
  // Static executable path is properly PowerShell-quoted; command lines are never read or logged.
  const escaped = obsExecutable.replaceAll("'", "''");
  const pids = JSON.parse((await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$soakPids=@(Get-Process -Name obs64 -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '${escaped}' } | ForEach-Object { $_.Id }); ConvertTo-Json -InputObject $soakPids -Compress`], { windowsHide: true, timeout: 5000 })).stdout.replace(/^\uFEFF/, ''));
  assert.equal(pids.length, 1, 'Exactly one project-owned OBS instance is required.'); obsPid = pids[0];
  report.obs = { ...(await obs.request('GetVersion')), pid: obsPid }; delete report.obs.availableRequests;
  original = { collection: (await obs.request('GetSceneCollectionList')).currentSceneCollectionName, profile: (await obs.request('GetProfileList')).currentProfileName,
    scene: (await obs.request('GetCurrentProgramScene')).currentProgramSceneName, studioMode: (await obs.request('GetStudioModeEnabled')).studioModeEnabled };
  assert.equal(original.collection, 'Ene Studio', 'Select the known Ene Studio collection before this fixture; no other collection is modified.');
  if (original.studioMode) original.preview = (await obs.request('GetCurrentPreviewScene')).currentPreviewSceneName;
  assert(Object.values(await obs.request('GetSpecialInputs')).every(value => value === null), 'A global desktop/microphone input is configured.');
  initialInputsHash = digest(await inputSnapshot()); snapshot = await snapshotSceneItems();
  report.restoreSnapshot = { ...original, sceneItems: snapshot, inputSettingsHash: initialInputsHash };
  await writeFile(path.join(directory, 'restore-state.json'), JSON.stringify(report.restoreSnapshot, null, 2));
  for (const item of snapshot) if (item.sceneItemEnabled) await obs.request('SetSceneItemEnabled', { sceneName: item.sceneName, sceneItemId: item.sceneItemId, sceneItemEnabled: false });
  if (original.studioMode) await obs.request('SetStudioModeEnabled', { studioModeEnabled: false });
  changedProfile = true; await obs.request('SetCurrentProfile', { profileName: 'Ene Landscape' });
  report.video = await obs.request('GetVideoSettings');
  assert(report.video.baseWidth === 1280 && report.video.baseHeight === 720 && report.video.outputWidth === 1280 && report.video.outputHeight === 720 && report.video.fpsNumerator / report.video.fpsDenominator === 30, 'The existing Ene Landscape profile must be configured for 720p30.');
  landscapeDirectory = (await obs.request('GetRecordDirectory')).recordDirectory;
  filenameParameter = await obs.request('GetProfileParameter', { parameterCategory: 'Output', parameterName: 'FilenameFormatting' });
  changedRecordingDirectory = true; await obs.request('SetRecordDirectory', { recordDirectory: directory });
  changedFilename = true; await obs.request('SetProfileParameter', { parameterCategory: 'Output', parameterName: 'FilenameFormatting', parameterValue: 'Ene-Soak-' + runId + '-%CCYY-%MM-%DD_%hh-%mm-%ss' });
  report.recordingProfile = Object.fromEntries(await Promise.all([['Output', 'Mode'], ['AdvOut', 'RecEncoder'], ['AdvOut', 'RecFormat2'], ['AdvOut', 'RecTracks']].map(async ([parameterCategory, parameterName]) => [parameterCategory + '/' + parameterName, (await obs.request('GetProfileParameter', { parameterCategory, parameterName })).parameterValue])));
  assert.equal(report.recordingProfile['Output/Mode'], 'Advanced'); assert.equal(report.recordingProfile['AdvOut/RecEncoder'], 'obs_x264'); assert.equal(report.recordingProfile['AdvOut/RecFormat2'], 'mkv');
  ownedScene = true; await obs.request('CreateScene', { sceneName });
  ownedInput = true; captureItem = (await obs.request('CreateInput', { sceneName, inputName, inputKind: 'window_capture', inputSettings: { window: title + ':Chrome_WidgetWin_1:chrome.exe', method: 2, priority: 1, cursor: false, client_area: true, capture_audio: false, force_sdr: true }, sceneItemEnabled: false })).sceneItemId;
  await obs.request('SetCurrentProgramScene', { sceneName });
  server = await startIsolatedStudioServer(); report.server = { base: server.base, port: server.port, pid: server.pid, owned: true };
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1400,900', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  report.chromeVersion = browser.version(); context = await browser.newContext({ viewport: null });
  const external = value => { const url = new URL(value); return !['blob:', 'data:'].includes(url.protocol) && url.origin !== server.base; };
  const rememberLayout = event => { report.layoutNetworkEvents.push({ atUTC: new Date().toISOString(), ...event }); if (report.layoutNetworkEvents.length > 120) report.layoutNetworkEvents.shift(); };
  context.on('request', request => {
    const url = new URL(request.url());
    if (external(url.href) && report.externalRequests.length < 100) report.externalRequests.push(url.origin + url.pathname);
    if (url.origin === server.base && url.pathname === '/api/output-layout') { let payload; try { payload = request.postDataJSON(); } catch { payload = 'Unreadable layout payload'; } rememberLayout({ event: 'request', method: request.method(), payload }); }
  });
  context.on('response', response => {
    const url = new URL(response.url());
    if (external(url.href) && report.externalResponses.length < 100) report.externalResponses.push(url.origin + url.pathname);
    if (url.origin === server.base && url.pathname === '/api/output-layout') rememberLayout({ event: 'response', status: response.status() });
  });
  context.on('requestfailed', request => { const url = new URL(request.url()); if (url.origin === server.base && url.pathname === '/api/output-layout') rememberLayout({ event: 'failed', error: request.failure()?.errorText }); });
  await context.route('**/*', route => {
    const url = new URL(route.request().url()); if (external(url.href)) return route.abort('blockedbyclient');
    const bytes = fixtureBytes.get(url.pathname); return bytes ? route.fulfill({ status: 200, contentType: 'image/jpeg', body: bytes }) : route.continue();
  });
  await context.addInitScript(installPositiveCameraFixture);
  page = await context.newPage(); page.on('pageerror', error => report.errors.push(safeError(error)));
  page.on('console', message => { if (['warning', 'error'].includes(message.type()) && report.browserMessages.length < 100) report.browserMessages.push(safeError(message.text())); });
  await page.goto(server.base); await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
  assert.equal(await page.evaluate(() => window.__soak.status().acquisitions), 0);
  assert.equal(await page.evaluate(() => window.__vmodel.getState().avatarId), report.build.avatarSha256);
  await page.evaluate(async variants => { await window.__soak.prepare(variants); window.__soak.instrument(window.__vmodel.viewer); }, phases.map(phase => ({ id: phase.id, url: '/testing/soak-' + phase.fixture + '.jpg', ...(phase.crop ? { crop: phase.crop } : {}) })));
  browserCDP = await browser.newBrowserCDPSession(); pageCDP = await context.newCDPSession(page); await pageCDP.send('Performance.enable');
  // Query process support before committing to a long run.
  report.initialMemory = await processMemory();
  ownedBrowserPid = (await browserCDP.send('SystemInfo.getProcessInfo')).processInfo.find(value => value.type === 'browser')?.id;
  assert(Number.isInteger(ownedBrowserPid) && ownedBrowserPid > 0);
  report.powerBefore = await currentPower();
  try {
    report.chromeLaunchArguments = (await browserCDP.send('Browser.getBrowserCommandLine')).arguments.filter(value => !/https?:\/\//.test(value)).map(value => value.startsWith('--user-data-dir=') ? '--user-data-dir=[owned temporary profile]' : value);
  } catch (error) {
    report.chromeLaunchArgumentsCDPUnavailable = safeError(error);
    const command = `(Get-CimInstance Win32_Process -Filter 'ProcessId=${ownedBrowserPid}').CommandLine`;
    const processCommand = (await run('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true, timeout: 10000 })).stdout.trim();
    assert(!/https?:\/\//.test(processCommand), 'Unexpected URL in the owned browser command line; omit rather than log it.');
    report.chromeLaunchCommandLine = processCommand.replace(/--user-data-dir=(?:"[^"]+"|\S+)/g, '--user-data-dir=[owned temporary profile]');
  }
  await page.locator('#captureResolution').selectOption('640x480'); await page.locator('#quality').selectOption('balanced');
  await page.locator('#springMotion').selectOption('gentle'); await page.locator('#orientation').selectOption('landscape'); await page.locator('#preview').uncheck();
  await page.locator('#clean').click(); await page.evaluate(value => { document.title = value; }, title);
  assert.deepEqual(await page.evaluate(() => ({ width: window.__vmodel.viewer.renderer.domElement.width, height: window.__vmodel.viewer.renderer.domElement.height, canvasCount: document.querySelectorAll('canvas').length })), { width: 1280, height: 720, canvasCount: 1 });
  await attachOwnedWindow();
  for (const phase of activePhases) {
    currentPhase = phase; checkInterrupt();
    await page.evaluate(phase => {
      for (const key of ['mode', 'hands', 'framing']) { const input = document.getElementById(key); if (key === 'hands') input.checked = phase.hands; else input.value = phase[key]; input.dispatchEvent(new Event('change')); }
      window.__soak.select(phase.id, phase);
    }, phase);
    const sequenceBefore = await page.evaluate(() => window.__soak.status().lastResult?.sequence ?? 0);
    if (phase === activePhases[0]) await page.evaluate(() => document.querySelector('#start').click());
    await page.waitForFunction(({ sequenceBefore, hands }) => {
      const state = window.__soak.status(), result = state.lastResult;
      return state.workerErrors.length || result && result.sequence >= sequenceBefore + 4 && result.present.face && result.present.pose && (!hands || result.present.hands);
    }, { sequenceBefore, hands: phase.hands }, { timeout: 90000 });
    const prepared = await page.evaluate(() => window.__soak.status()); assert.deepEqual(prepared.workerErrors, []); assert.equal(prepared.delegate, 'GPU');
    assert(prepared.lastResult.present.face && prepared.lastResult.present.pose && (!phase.hands || prepared.lastResult.present.hands), 'Expected positive fixture detections were not established.');
    const nativeBeforeRecording = await verifiedNativePreflight();
    await outputGuard(); recordedPath = null; recordPending = true;
    await obs.request('StartRecord'); await boundedWait(async () => (await obs.request('GetRecordStatus')).outputActive, 10000, 'OBS did not start the owned recording.');
    const watchdog = setTimeout(() => { interrupted = true; void stopOwnedRecord().catch(error => report.cleanupErrors.push(safeError(error))); }, 975000);
    const result = { ...phase, warmupSeconds: 60, measuredSeconds: 900, prepared, nativeBeforeRecording, samples: [], screenshots: [], captureHealthSamples: [] };
    report.phases.push(result);
    try {
      await page.evaluate(() => window.__soak.begin());
      const warmUntil = performance.now() + WARMUP_MS;
      const warmGuard = createDrawHealthGuard(), warmTrace = path.join(directory, phase.id + '-warmup.ndjson'); let warmTick = 0, warmBytes = 0;
      result.warmupTrace = relative(warmTrace);
      while (performance.now() < warmUntil) {
        await delay(Math.min(TICK_MS, Math.max(1, warmUntil - performance.now())));
        const collected = await sample({ collectMemory: false, requireFresh: false });
        const data = JSON.stringify({ collectedAtMs: collected.sample.atMs, renders: collected.drain.renders, inferences: collected.drain.inferences, sample: collected.sample }) + '\n';
        warmBytes += Buffer.byteLength(data); assert(warmBytes <= TRACE_MAX_BYTES, 'Warm-up telemetry reached its file-size limit.'); await appendFile(warmTrace, data);
        await checkCaptureHealth(result, 'warmup', warmGuard, collected, { thumbnail: ++warmTick % 6 === 0 });
      }
      result.screenshots.push(await screenshot(phase.id + '-start'));
      result.captureHealthSamples.push({ stage: 'measurement-start', ...lastScreenshotContent });
      if (lastScreenshotContent.pixels.blank) await failPhase(result, 'measurement-start', { kind: 'blank-obs-capture', capture: lastScreenshotContent });
      result.measurementStartUTC = new Date().toISOString(); await page.evaluate(() => window.__soak.begin());
      const measurementStart = performance.now(), until = measurementStart + PHASE_MS;
      const rows = { renders: [], inferences: [] }, trace = path.join(directory, phase.id + '-frames.ndjson'); let traceBytes = 0, tick = 0;
      const drawGuard = createDrawHealthGuard();
      const persist = async collected => {
        rows.renders.push(...collected.drain.renders); rows.inferences.push(...collected.drain.inferences); result.samples.push(collected.sample);
        const data = JSON.stringify({ collectedAtMs: collected.sample.atMs, renders: collected.drain.renders, inferences: collected.drain.inferences }) + '\n';
        traceBytes += Buffer.byteLength(data); assert(traceBytes <= TRACE_MAX_BYTES, 'Telemetry reached its file-size limit.'); await appendFile(trace, data);
      };
      const initialCollected = await sample({ collectMemory: true }); await persist(initialCollected);
      await checkCaptureHealth(result, 'measurement', drawGuard, initialCollected);
      while (performance.now() < until) {
        await delay(Math.min(TICK_MS, Math.max(1, until - performance.now())));
        const collected = await sample({ collectMemory: ++tick % 6 === 0 });
        await persist(collected);
        await checkCaptureHealth(result, 'measurement', drawGuard, collected, { thumbnail: tick % 6 === 0 });
        if (tick % 6 === 0) console.log(JSON.stringify({ phase: phase.id, measuredSeconds: Math.floor((performance.now() - measurementStart) / 1000), targetSeconds: 900, inferenceMs: collected.sample.state.lastResult.inferenceMs, obsSkipped: collected.sample.obs.outputSkippedFrames, recordingMiB: Math.round(collected.sample.recording.bytes / 1024 ** 2) }));
      }
      const finalCollected = await sample({ collectMemory: true }); await persist(finalCollected);
      await checkCaptureHealth(result, 'measurement', drawGuard, finalCollected);
      result.measurementEndUTC = new Date().toISOString(); result.actualObservedMilliseconds = performance.now() - measurementStart;
      result.measurementWindowCompleted = true;
      result.summary = summarizePhase({ ...rows, samples: result.samples, durationMs: PHASE_MS }); result.trace = relative(trace); result.traceBytes = traceBytes;
      result.screenshots.push(await screenshot(phase.id + '-end'));
      result.captureHealthSamples.push({ stage: 'measurement-end', ...lastScreenshotContent });
      if (lastScreenshotContent.pixels.blank) await failPhase(result, 'measurement-end', { kind: 'blank-obs-capture', capture: lastScreenshotContent });
      const file = await stopOwnedRecord(); clearTimeout(watchdog);
      // Recording bounds apply to recording, not the subsequent audio-only
      // silence scan, which may legitimately finish after the recording deadline.
      result.recording = await inspectRecording(file);
      result.sampleCountGatePassed = result.summary.renderFrameIntervalMs.count > 1000 && result.summary.inferenceMs.count > 500;
      assert(result.sampleCountGatePassed, 'Too few real render/inference samples.');
      assert(result.summary.obs.countersValid && result.summary.obs.counters.outputTotalFrames > 25000, 'OBS counters did not cover the phase.');
      result.completed = true;
      console.log(JSON.stringify({ phase: phase.id, completed: true, medianCadenceFps: result.summary.medianCadenceFps, frameIntervalP95Ms: result.summary.renderFrameIntervalMs.p95, inferenceP95Ms: result.summary.inferenceMs.p95, renderGatePassed: result.summary.proposedRenderGatePassed }));
    } finally {
      clearTimeout(watchdog); const file = await stopOwnedRecord();
      if (!result.recording && file && withinOwnedDirectory(directory, file, path)) {
        const retained = { file: relative(file), bytes: (await stat(file)).size };
        if (!result.measurementWindowCompleted) result.interruptedRecording = retained;
        else result.recordingInspectionPending = { ...retained, note: 'Measured window ended, but a failure prevented final recording format/silence inspection.' };
      }
    }
  }
  assert.deepEqual(report.errors, []); assert.equal(report.externalResponses.length, 0);
  // Both recordings are stopped: these probes cannot perturb their measured cadence.
  report.endEvidence = await captureEvidence('after-completed-soak');
  report.completed = report.phases.length === 2 && report.phases.every(phase => phase.completed);
  report.renderGatesPassed = report.phases.every(phase => phase.summary.proposedRenderGatePassed);
} catch (error) { report.errors.push(safeError(error)); console.error(safeError(error)); process.exitCode = 1; }
finally {
  const clean = async (name, action) => { try { await action(); } catch (error) { report.cleanupErrors.push(name + ': ' + safeError(error)); process.exitCode = 1; } };
  if (obs && recordPending) await clean('Stop owned recording', stopOwnedRecord);
  // Best-effort read-only endpoint observations do not block owned cleanup or imply continuous power state.
  if (report.powerBefore) try { report.powerAfter = await currentPower(); } catch (error) { report.diagnosticErrors.push('Power after: ' + safeError(error)); }
  if (ownedBrowserPid && page && !page.isClosed()) try { report.nativeAfter = await nativeState(); } catch (error) { report.diagnosticErrors.push('Native after: ' + safeError(error)); }
  // Disable capture before touching/closing the browser, because WGC can freeze or reattach.
  if (obs && ownedInput) await clean('Disable owned window source', async () => {
    if (!(await obs.request('GetInputList')).inputs.some(input => input.inputName === inputName)) return;
    const sceneItemId = captureItem ?? (await obs.request('GetSceneItemId', { sceneName, sourceName: inputName })).sceneItemId;
    await obs.request('SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled: false });
  });
  if (page && !page.isClosed()) await clean('Stop owned fake camera', async () => {
    await page.evaluate(() => { document.querySelector('#stop')?.click(); window.__soak?.dispose(); });
    report.cameraAfterStop = await page.evaluate(() => window.__soak.status());
    assert(report.cameraAfterStop.workers === 0 && report.cameraAfterStop.tracks.every(track => track.state === 'ended'));
  });
  if (browser) await clean('Close owned Chrome', async () => { await browser.close(); report.browserClosed = true; });
  if (server) await clean('Stop owned production server', async () => { report.serverExit = await server.stop(); report.serverStopped = true; });
  if (obs && original && snapshot && !recordPending) {
    // Select only the known collection and restore only values this script changed.
    await clean('Select original collection', () => obs.request('SetCurrentSceneCollection', { sceneCollectionName: original.collection }));
    if (ownedInput) await clean('Remove owned window input', async () => { if ((await obs.request('GetInputList')).inputs.some(input => input.inputName === inputName)) await obs.request('RemoveInput', { inputName }); });
    await clean('Restore original program scene', () => obs.request('SetCurrentProgramScene', { sceneName: original.scene }));
    if (ownedScene) await clean('Remove owned scene', async () => { if ((await obs.request('GetSceneList')).scenes.some(scene => scene.sceneName === sceneName)) await obs.request('RemoveScene', { sceneName }); });
    if (changedRecordingDirectory || changedFilename) {
      await clean('Select recording profile to restore', () => obs.request('SetCurrentProfile', { profileName: 'Ene Landscape' }));
      if (changedRecordingDirectory) await clean('Restore recording directory', () => obs.request('SetRecordDirectory', { recordDirectory: landscapeDirectory }));
      if (changedFilename) await clean('Restore recording filename', () => obs.request('SetProfileParameter', { parameterCategory: 'Output', parameterName: 'FilenameFormatting', parameterValue: filenameParameter.parameterValue }));
      await clean('Verify restored recording destination', async () => {
        if (changedRecordingDirectory) assert.equal((await obs.request('GetRecordDirectory')).recordDirectory, landscapeDirectory);
        if (changedFilename) assert.equal((await obs.request('GetProfileParameter', { parameterCategory: 'Output', parameterName: 'FilenameFormatting' })).parameterValue, filenameParameter.parameterValue);
      });
    }
    if (changedProfile) await clean('Restore original profile', () => obs.request('SetCurrentProfile', { profileName: original.profile }));
    if (snapshot) for (const item of snapshot) await clean('Restore scene item ' + item.sceneName + '/' + item.sceneItemId, () => obs.request('SetSceneItemEnabled', { sceneName: item.sceneName, sceneItemId: item.sceneItemId, sceneItemEnabled: item.sceneItemEnabled }));
    await clean('Restore studio mode', () => obs.request('SetStudioModeEnabled', { studioModeEnabled: original.studioMode }));
    if (original.studioMode && original.preview) await clean('Restore preview scene', () => obs.request('SetCurrentPreviewScene', { sceneName: original.preview }));
    if (snapshot) await clean('Verify exact OBS restoration', async () => {
      const after = await snapshotSceneItems();
      const ordered = items => [...items].sort((a, b) => a.sceneName.localeCompare(b.sceneName) || a.sceneItemId - b.sceneItemId);
      assert.deepEqual(ordered(after), ordered(snapshot)); assert.equal(digest(await inputSnapshot()), initialInputsHash);
      assert.equal((await obs.request('GetSceneCollectionList')).currentSceneCollectionName, original.collection);
      assert.equal((await obs.request('GetProfileList')).currentProfileName, original.profile);
      assert.equal((await obs.request('GetCurrentProgramScene')).currentProgramSceneName, original.scene);
      await outputGuard(); report.obsRestored = true;
    });
  }
  obs?.close();
  for (const phase of report.phases.filter(value => !value.measurementWindowCompleted && !value.completed && value.samples.length > 1)) await clean('Summarize interrupted evidence', async () => {
    const file = path.join(directory, phase.id + '-frames.ndjson');
    const chunks = (await readFile(file, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const rows = { renders: chunks.flatMap(chunk => chunk.renders), inferences: chunks.flatMap(chunk => chunk.inferences) };
    const durationMs = phase.samples.at(-1).atMs;
    const { firstFiveMinutes, lastFiveMinutes, ...partial } = summarizePhase({ ...rows, samples: phase.samples, durationMs });
    phase.partialSummary = { ...partial, interrupted: true, firstThirdOfObservedWindow: firstFiveMinutes, lastThirdOfObservedWindow: lastFiveMinutes, note: 'Only the observed partial window; neither 15-minute phase nor full soak completed.' };
    phase.trace = relative(file);
  });
  report.finishedAt = new Date().toISOString();
  if (lockOwned) {
    if (!recordPending && report.cleanupErrors.length === 0) await clean('Release own diagnostic lock', async () => { assert.equal(JSON.parse(await readFile(lockPath, 'utf8')).runId, runId); await unlink(lockPath); });
    else report.retainedLock = relative(lockPath);
    report.cleanupPassed = report.cleanupErrors.length === 0;
    await clean('Write final owned report', async () => { await writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await writeFile('ops/reports/combined-fixture-soak.json', JSON.stringify(report, null, 2) + '\n'); });
  }
  report.cleanupPassed = report.cleanupErrors.length === 0;
  process.removeListener('SIGINT', markInterrupted); process.removeListener('SIGTERM', markInterrupted);
  console.log(JSON.stringify({ completed: report.completed, cleanupPassed: report.cleanupPassed, errors: report.errors, cleanupErrors: report.cleanupErrors, report: lockOwned ? relative(path.join(directory, 'report.json')) : null, taskAcceptance: false }));
}
