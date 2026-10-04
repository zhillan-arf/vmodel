// Run only after coordinating a quiet benchmark window with other work.
// Uses owned Chrome windows and OBS scene screenshots; never records or streams.
import { chromium } from '@playwright/test';
import { connectOBS } from './obs-client.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

if (!process.argv.includes('--quiet-window')) throw new Error('Coordinate a quiet benchmark window, then run with --quiet-window.');
const run = promisify(execFile), pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const directory = 'ops/reports/local/obs-window-lifecycle';
const token = randomUUID(), title = `VModel Output Lifecycle ${token}`;
const sceneName = 'Ene Landscape', inputName = `${sceneName} Window`;
const report = { date: new Date().toISOString(), input: 'Owned native-viewport Chrome windows; actual Ene with deterministic face frames plus synthetic magenta content. No physical camera, microphone, recording, virtual camera or stream.', title, snapshots: [], checks: {}, errors: [] };
let browser, obs, page, alternate, browserSession, browserPid, targetHandle, sceneItemId, initialProfile, initialScene;
const savedSources = [];

// Native changes are restricted to an HWND verified to belong to this launched
// Chrome's browser PID. Enumeration never emits unrelated window titles.
async function nativeWindow(mode, handle = targetHandle) {
  assert(Number.isInteger(browserPid) && browserPid > 0);
  assert(['find', 'inspect', 'hide', 'show', 'minimize', 'restore'].includes(mode));
  if (handle !== undefined) assert(/^\d+$/.test(String(handle)));
  const code = `
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class EneLifecycleWindow {
  public delegate bool EnumProc(IntPtr window, IntPtr parameter);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int length);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
  public static long Find(uint pid, string prefix) {
    var found = new List<long>();
    EnumWindows((window, unused) => { uint owner; GetWindowThreadProcessId(window, out owner);
      if (owner == pid) { var text = new StringBuilder(512); GetWindowText(window,text,512);
        if(text.ToString().StartsWith(prefix,StringComparison.Ordinal)) found.Add(window.ToInt64()); }
      return true;
    }, IntPtr.Zero);
    if(found.Count != 1) throw new Exception("Expected exactly one owned window, found " + found.Count);
    return found[0];
  }
}
'@
$ownedPid = [uint32]${browserPid}
$ownedHandle = [IntPtr]([Int64](${mode === 'find' ? `[EneLifecycleWindow]::Find($ownedPid, '${title}')` : handle}))
if (-not [EneLifecycleWindow]::IsWindow($ownedHandle)) { @{ exists=$false; handle=$ownedHandle.ToInt64().ToString() } | ConvertTo-Json -Compress; exit 0 }
$ownerPid = [uint32]0
[void][EneLifecycleWindow]::GetWindowThreadProcessId($ownedHandle, [ref]$ownerPid)
if ($ownerPid -ne $ownedPid) { throw 'Refusing a window owned by another process.' }
${({ hide: '[void][EneLifecycleWindow]::ShowWindow($ownedHandle, 0)', show: '[void][EneLifecycleWindow]::ShowWindow($ownedHandle, 5)', minimize: '[void][EneLifecycleWindow]::ShowWindow($ownedHandle, 6)', restore: '[void][EneLifecycleWindow]::ShowWindow($ownedHandle, 9)' })[mode] ?? ''}
@{ exists=$true; handle=$ownedHandle.ToInt64().ToString(); visible=[EneLifecycleWindow]::IsWindowVisible($ownedHandle); minimized=[EneLifecycleWindow]::IsIconic($ownedHandle); pid=$ownerPid } | ConvertTo-Json -Compress
`;
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', code], { windowsHide: true });
  return JSON.parse(stdout.trim());
}

async function syntheticMagenta(target, caption) {
  await target.setContent('<!doctype html><html><head><title></title></head><body style="margin:0;background:#ff00ff;color:#fff;min-height:100vh;display:grid;place-items:center;font:700 32px sans-serif"><main style="padding:30px;border:8px solid white;text-align:center">OWNED SYNTHETIC ALTERNATE<br>MAGENTA CAPTURE MARKER</main></body></html>');
  await target.evaluate(caption => { document.title = caption; }, caption);
}

async function snapshot(label) {
  const { imageData } = await obs.request('GetSourceScreenshot', { sourceName: sceneName, imageFormat: 'png' });
  const bytes = Buffer.from(imageData.split(',')[1], 'base64');
  const path = `${directory}/${label}.png`; await writeFile(path, bytes);
  // Decode in an owned alternate page without changing its content or activation.
  const pixels = await alternate.evaluate(async imageData => {
    const image = await createImageBitmap(await (await fetch(imageData)).blob());
    const canvas = new OffscreenCanvas(image.width, image.height), context = canvas.getContext('2d');
    context.drawImage(image, 0, 0); image.close();
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let black = 0, magenta = 0, cyan = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 8 && data[index + 1] < 8 && data[index + 2] < 8) black++;
      if (data[index] > 220 && data[index + 1] < 45 && data[index + 2] > 220) magenta++;
      if (data[index] < 45 && data[index + 1] > 220 && data[index + 2] > 220) cyan++;
    }
    return { width: canvas.width, height: canvas.height, blackFraction: black / (data.length / 4), magentaFraction: magenta / (data.length / 4), cyanFraction: cyan / (data.length / 4) };
  }, imageData);
  const transform = (await obs.request('GetSceneItemTransform', { sceneName, sceneItemId })).sceneItemTransform;
  const value = { label, path, sha256: createHash('sha256').update(bytes).digest('hex'), ...pixels, sourceWidth: transform.sourceWidth, sourceHeight: transform.sourceHeight };
  report.snapshots.push(value);
  console.log(JSON.stringify({ label, blackFraction: value.blackFraction, magentaFraction: value.magentaFraction, cyanFraction: value.cyanFraction, sourceWidth: value.sourceWidth, sourceHeight: value.sourceHeight }));
  return value;
}
async function yaw(value) { await page.evaluate(value => { window.__poseYaw = value; }, value); }
async function windowFor(target) {
  const session = await target.context().newCDPSession(target);
  try {
    const info = (await session.send('Target.getTargetInfo')).targetInfo;
    return { ...await browserSession.send('Browser.getWindowForTarget', { targetId: info.targetId }), targetId: info.targetId, browserContextId: info.browserContextId };
  } finally { await session.detach(); }
}

try {
  await mkdir(directory, { recursive: true });
  obs = await connectOBS();
  for (const request of ['GetRecordStatus', 'GetStreamStatus']) assert.equal((await obs.request(request)).outputActive, false, `${request} must be inactive before this isolated test.`);
  try { assert.equal((await obs.request('GetVirtualCamStatus')).outputActive, false, 'Virtual camera must be inactive.'); report.virtualCamera = 'inactive'; }
  catch (error) { if (!String(error).includes('GetVirtualCamStatus: 604 VirtualCam is not available.')) throw error; report.virtualCamera = 'unavailable'; }
  const inputs = (await obs.request('GetInputList')).inputs;
  assert(inputs.every(input => ['Ene Landscape Window', 'Ene Portrait Window'].includes(input.inputName) && input.inputKind === 'window_capture'), 'This check requires the isolated project video-only OBS collection.');
  initialProfile = (await obs.request('GetProfileList')).currentProfileName;
  initialScene = (await obs.request('GetCurrentProgramScene')).sceneName;
  for (const orientation of ['Landscape', 'Portrait']) {
    const source = `Ene ${orientation} Window`, scene = `Ene ${orientation}`;
    const item = await obs.request('GetSceneItemId', { sceneName: scene, sourceName: source });
    assert.equal((await obs.request('GetSceneItemEnabled', { sceneName: scene, sceneItemId: item.sceneItemId })).sceneItemEnabled, false, 'Project capture sources must start disabled.');
    savedSources.push({ inputName: source, sceneName: scene, sceneItemId: item.sceneItemId, settings: (await obs.request('GetInputSettings', { inputName: source })).inputSettings, transform: (await obs.request('GetSceneItemTransform', { sceneName: scene, sceneItemId: item.sceneItemId })).sceneItemTransform });
  }
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1100,680'], ignoreDefaultArgs: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  report.chromeVersion = browser.version();
  browserSession = await browser.newBrowserCDPSession();
  browserPid = (await browserSession.send('SystemInfo.getProcessInfo')).processInfo.find(process => process.type === 'browser').id;
  const context = await browser.newContext({ viewport: null });
  await context.addInitScript(() => {
    window.__mediaRequests = 0;
    if (navigator.mediaDevices) for (const method of ['getUserMedia', 'getDisplayMedia']) navigator.mediaDevices[method] = async () => { window.__mediaRequests++; throw new Error('Physical/display media capture is disabled in this fixture.'); };
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:', 'about:'].includes(url.protocol) ? route.continue() : route.abort('blockedbyclient');
  });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(process.env.VMODEL_TEST_URL ?? 'http://127.0.0.1:4173/');
  await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
  await page.evaluate(() => {
    for (const [id, value] of [['orientation', 'landscape'], ['springMotion', 'off']]) { const field = document.getElementById(id); field.value = value; field.dispatchEvent(new Event('change')); }
    window.__poseYaw = 0.35;
    const update = () => {
      const timestamp = performance.timeOrigin + performance.now(), angle = window.__poseYaw, c = Math.cos(angle), s = Math.sin(angle);
      window.__vmodel.setFrame({ version: 1, sequence: 1, timestamp, face: { jawOpen: 0.2 }, faceMatrix: [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1], pose: [], poseImage: [], hands: [], inferenceMs: 0, samples: Object.fromEntries(['face', 'pose', 'hands'].map(name => [name, { timestamp, inferenceMs: 0, present: name === 'face' }])) });
    };
    update(); window.__poseTimer = setInterval(update, 33);
  });
  await page.locator('#clean').click(); await page.evaluate(title => { document.title = title; }, title);
  report.targetWindow = await windowFor(page);
  targetHandle = (await nativeWindow('find')).handle;
  const newWindow = context.waitForEvent('page');
  await browserSession.send('Target.createTarget', { url: 'about:blank', newWindow: true, browserContextId: report.targetWindow.browserContextId });
  alternate = await newWindow; await syntheticMagenta(alternate, `Owned Magenta Alternate ${token}`);
  const alternateWindow = await windowFor(alternate);
  assert.notEqual(alternateWindow.windowId, report.targetWindow.windowId);
  await browserSession.send('Browser.setWindowBounds', { windowId: alternateWindow.windowId, bounds: { left: report.targetWindow.bounds.left, top: report.targetWindow.bounds.top, width: report.targetWindow.bounds.width, height: report.targetWindow.bounds.height } });
  await page.bringToFront();
  await page.waitForFunction(async title => { const { layouts } = await (await fetch('/api/output-layout')).json(); return layouts.some(layout => layout.title === title && layout.viewport.width === innerWidth && layout.viewport.height === innerHeight); }, title, { timeout: 15000 });
  const { stdout } = await run(process.execPath, ['scripts/configure_obs.mjs', '--attach', '--title', title], { windowsHide: true });
  report.attachment = JSON.parse(stdout);
  ({ sceneItemId } = await obs.request('GetSceneItemId', { sceneName, sourceName: inputName }));
  await pause(1500); const baselineA = await snapshot('01-baseline-a');
  await yaw(-0.35); await pause(1500); const baselineB = await snapshot('02-baseline-b');
  assert.notEqual(baselineA.sha256, baselineB.sha256, 'Real avatar capture must change under deterministic animation.');
  assert(baselineB.blackFraction < 0.95 && baselineB.magentaFraction < 0.01);
  report.checks.initialAnimation = true;

  await alternate.bringToFront(); await yaw(0.2); await pause(1500);
  const covered = await snapshot('03-covered-by-owned-magenta');
  report.checks.coveredShowsAlternate = covered.magentaFraction > 0.5;
  assert.equal(report.checks.coveredShowsAlternate, false, 'A separate covering window must not enter WGC capture.');

  await page.bringToFront(); await page.evaluate(token => { document.title = `Owned Changed Title ${token}`; }, token); await yaw(-0.6); await pause(1500);
  const changedTitle = await snapshot('04-title-changed-same-window');
  report.checks.titleChangeContinuesCapture = changedTitle.blackFraction < 0.95 && changedTitle.sha256 !== covered.sha256;
  await page.evaluate(title => { document.title = title; }, title);

  // window.open without popup features normally creates a tab. Confirm the native
  // window ID; if Chromium chooses a new window, record that limitation explicitly.
  await page.bringToFront();
  const tabEvent = context.waitForEvent('page'); await page.evaluate(() => { window.open('about:blank', '_blank'); });
  const tab = await tabEvent; await syntheticMagenta(tab, `Owned Magenta Tab ${token}`);
  const tabWindow = await windowFor(tab);
  report.checks.sameWindowTabCreated = tabWindow.windowId === report.targetWindow.windowId;
  if (report.checks.sameWindowTabCreated) {
    await tab.bringToFront(); await pause(1500);
    const tabCapture = await snapshot('05-other-tab-same-window');
    report.checks.otherTabCaptured = tabCapture.magentaFraction > 0.5;
  }
  await tab.close(); await page.bringToFront(); await yaw(0.3); await pause(1500);
  const restoredTab = await snapshot('06-original-tab-restored');
  assert(restoredTab.magentaFraction < 0.01 && restoredTab.blackFraction < 0.95);

  report.minimizedWindow = await nativeWindow('minimize'); assert.equal(report.minimizedWindow.minimized, true);
  await pause(1500); const minimizedA = await snapshot('07-minimized-a');
  await yaw(-0.5); await pause(1500); const minimizedB = await snapshot('08-minimized-b');
  report.checks.minimized = minimizedA.blackFraction > 0.995 && minimizedB.blackFraction > 0.995 ? 'blank' : minimizedA.sha256 === minimizedB.sha256 ? 'frozen-nonblank' : 'changing-nonblank';
  await nativeWindow('restore'); await page.bringToFront(); await pause(1500); const restored = await snapshot('09-restored-after-minimize');
  assert(restored.blackFraction < 0.95 && restored.magentaFraction < 0.01);

  report.hiddenWindow = await nativeWindow('hide'); assert.equal(report.hiddenWindow.visible, false); assert.equal(report.hiddenWindow.minimized, false);
  await pause(1500); const hiddenA = await snapshot('10-hidden-a');
  await yaw(0.5); await pause(1500); const hiddenB = await snapshot('11-hidden-b');
  report.checks.hidden = hiddenA.blackFraction > 0.995 && hiddenB.blackFraction > 0.995 ? 'blank' : hiddenA.sha256 === hiddenB.sha256 ? 'frozen-nonblank' : 'changing-nonblank';
  await nativeWindow('show'); await page.bringToFront(); await pause(1500);
  const shown = await snapshot('12-shown-again'); assert(shown.blackFraction < 0.95 && shown.magentaFraction < 0.01);

  report.checks.mediaRequests = await page.evaluate(() => window.__mediaRequests);
  assert.equal(report.checks.mediaRequests, 0);
  // Changing the document inside the already acquired HWND must be observed
  // independently of whether this browser's window.open chose a tab or popup.
  await page.goto('data:text/html,' + encodeURIComponent('<!doctype html><title>Owned Synthetic Navigation</title><body style="margin:0;background:#00ffff;color:#000;min-height:100vh;display:grid;place-items:center;font:700 32px sans-serif">OWNED SYNTHETIC NAVIGATION — CYAN</body>'));
  assert.equal((await windowFor(page)).windowId, report.targetWindow.windowId);
  assert.equal((await nativeWindow('inspect')).exists, true);
  await pause(1500); const navigation = await snapshot('12b-synthetic-navigation-same-window');
  report.checks.sameWindowNavigationCaptured = navigation.cyanFraction > 0.5;
  await page.close(); report.closedWindow = await nativeWindow('inspect'); assert.equal(report.closedWindow.exists, false);
  await alternate.bringToFront(); await pause(2000); const closedA = await snapshot('13-closed-unmatched-alternate-a');
  await pause(1500); const closedB = await snapshot('14-closed-unmatched-alternate-b');
  report.checks.closed = closedA.blackFraction > 0.995 && closedB.blackFraction > 0.995 ? 'blank' : closedA.sha256 === closedB.sha256 ? 'frozen-nonblank' : 'changing-nonblank';
  report.checks.closedShowsUnmatchedAlternate = closedB.magentaFraction > 0.5;
  assert.equal(report.checks.closedShowsUnmatchedAlternate, false);

  await alternate.evaluate(title => { document.title = title; }, title);
  await pause(2500); const replacement = await snapshot('15-same-title-owned-replacement');
  report.checks.sameTitleReplacementCaptured = replacement.magentaFraction > 0.5;
  assert.equal(await alternate.evaluate(() => window.__mediaRequests), 0);
  report.obsVersion = await obs.request('GetVersion');
} catch (error) { report.errors.push(String(error)); console.error(error); process.exitCode = 1; }
finally {
  if (obs) {
    for (const saved of savedSources) {
      try {
        await obs.request('SetSceneItemEnabled', { sceneName: saved.sceneName, sceneItemId: saved.sceneItemId, sceneItemEnabled: false });
        await obs.request('SetInputSettings', { inputName: saved.inputName, inputSettings: saved.settings, overlay: false });
        await obs.request('SetSceneItemTransform', { sceneName: saved.sceneName, sceneItemId: saved.sceneItemId, sceneItemTransform: saved.transform });
      } catch (error) { report.errors.push(`Cleanup: ${error}`); process.exitCode = 1; }
    }
    try { if (initialProfile) await obs.request('SetCurrentProfile', { profileName: initialProfile }); if (initialScene) await obs.request('SetCurrentProgramScene', { sceneName: initialScene }); } catch (error) { report.errors.push(`Restore: ${error}`); process.exitCode = 1; }
    report.sourcesDisabledAfterward = [];
    for (const saved of savedSources) {
      try {
        const disabled = !(await obs.request('GetSceneItemEnabled', { sceneName: saved.sceneName, sceneItemId: saved.sceneItemId })).sceneItemEnabled;
        report.sourcesDisabledAfterward.push({ source: saved.inputName, disabled });
        assert(disabled, `${saved.inputName} must be disabled after this test.`);
      } catch (error) { report.errors.push(`Final verification: ${error}`); process.exitCode = 1; }
    }
    obs.close();
  }
  await browser?.close();
  await mkdir('ops/reports', { recursive: true });
  await writeFile('ops/reports/obs-window-lifecycle.json', JSON.stringify(report, null, 2) + '\n');
}
