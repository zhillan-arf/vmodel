// Measures animation-frame delivery in a real, non-automated Chrome window.
//
// Playwright keeps a debugger attached, which prevents Chrome from backgrounding
// a renderer, so an automated browser cannot reproduce what Start VModel.cmd
// actually launches. This probe starts Chrome the way the launcher does, serves
// one tiny page that reports its own frame counts back over HTTP, occludes the
// window with an opaque topmost form, and compares the rates.
//
// It owns its server, its Chrome user-data directory and its occluder. It never
// touches OBS, the user's Chrome profile, the app build or the served catalog.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const label = process.argv.includes('--run-label') ? process.argv[process.argv.indexOf('--run-label') + 1] : '';
if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(label)) { console.error('Supply a fresh simple --run-label'); process.exit(2); }

const CONDITIONS = [
  { name: 'launcher-default', args: [], intent: 'Exactly what Start VModel.cmd passes today: no flags.' },
  { name: 'hardened', intent: 'Proposed launcher flags for a window that must keep rendering while OBS captures it.',
    args: ['--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows',
           '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] },
];
const PHASE_MS = 10000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const PAGE = `<!doctype html><meta charset="utf-8"><title>VModel Frame Probe</title>
<style>html,body{margin:0;height:100%;background:#101018;color:#eee;font:16px system-ui;display:grid;place-items:center}</style>
<canvas id=c width=320 height=200></canvas>
<script>
const gl = document.getElementById('c').getContext('webgl2') || document.getElementById('c').getContext('webgl');
let frames = 0, hidden = 0;
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') hidden++; });
function tick() {
  frames++;
  if (gl) { gl.clearColor((frames % 60) / 60, 0.2, 0.5, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
setInterval(() => {
  navigator.sendBeacon('/frames', JSON.stringify({ at: Date.now(), frames, hidden, visibility: document.visibilityState }));
}, 500);
</script>`;

const beacons = [];
const server = createServer((request, response) => {
  if (request.url === '/frames' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => { try { beacons.push(JSON.parse(body)); } catch {} response.writeHead(204).end(); });
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(PAGE);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port + '/';

const chromePaths = [
  path.join(process.env.ProgramFiles ?? '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
];
const chrome = chromePaths.find(candidate => candidate && existsSync(candidate));

const report = {
  date: new Date().toISOString(), runLabel: label, passed: false, status: 'running',
  question: 'Does a real, non-automated Chrome window throttle frame delivery when occluded, and do launcher flags prevent it?',
  chromePath: chrome ?? null, phaseMs: PHASE_MS, automationAttached: false, obsInvolved: false,
  physicalMedia: false, liveAccepted: false, conditions: CONDITIONS, results: [],
  limits: [
    'A synthetic WebGL page, not the avatar runtime: it shows scheduler behaviour, not application performance.',
    'The occluder is an opaque topmost form; a user covering the window with another application is similar but not identical.',
    'Frame counts arrive by beacon every 500 ms and can be delayed by the same throttling being measured.',
    'No OBS capture output is inspected here, so the separate blank-white capture symptom is untested.',
    'One short run per condition on one host; ambient load is recorded, not controlled.',
  ],
};

function rate(from, to) {
  const window = beacons.filter(beacon => beacon.at >= from && beacon.at <= to);
  if (window.length < 2) return { samples: window.length, framesPerSecond: null, visibility: window.at(-1)?.visibility ?? null };
  const first = window[0], last = window.at(-1);
  const seconds = (last.at - first.at) / 1000;
  return {
    samples: window.length,
    framesPerSecond: seconds > 0 ? Number(((last.frames - first.frames) / seconds).toFixed(2)) : null,
    beaconGapMaxMs: Math.max(...window.slice(1).map((beacon, index) => beacon.at - window[index].at)),
    visibility: last.visibility,
    hiddenTransitions: last.hidden - first.hidden,
  };
}

let exit = 0;
try {
  if (!chrome) throw new Error('The tested Chrome browser is missing');
  for (const condition of CONDITIONS) {
    const profile = path.join(os.tmpdir(), 'vmodel-frame-probe-' + label + '-' + condition.name);
    await rm(profile, { recursive: true, force: true });
    const browser = spawn(chrome, ['--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
      '--new-window', '--window-size=1100,760', ...condition.args, base], { stdio: 'ignore', detached: false });
    let occluder;
    try {
      await sleep(6000); // load and settle before the first measured phase
      const beforeStart = Date.now(); await sleep(PHASE_MS); const beforeEnd = Date.now();
      occluder = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        path.join(ROOT, 'scripts', 'occluder_window.ps1'), '-Seconds', '40'], { stdio: 'ignore', detached: false });
      await sleep(4000); // Chrome recalculates native occlusion on a delay
      const duringStart = Date.now(); await sleep(PHASE_MS); const duringEnd = Date.now();
      occluder.kill(); occluder = null;
      await sleep(4000);
      const afterStart = Date.now(); await sleep(PHASE_MS); const afterEnd = Date.now();

      const before = rate(beforeStart, beforeEnd), during = rate(duringStart, duringEnd), after = rate(afterStart, afterEnd);
      report.results.push({
        condition: condition.name, intent: condition.intent, args: condition.args,
        before, during, after,
        duringToBeforeRatio: before.framesPerSecond ? Number((during.framesPerSecond / before.framesPerSecond).toFixed(3)) : null,
        throttledWhileOccluded: during.framesPerSecond !== null && during.framesPerSecond < 5,
        recovered: before.framesPerSecond && after.framesPerSecond ? after.framesPerSecond > before.framesPerSecond * 0.8 : null,
      });
      console.log(JSON.stringify({ condition: condition.name, before: before.framesPerSecond, during: during.framesPerSecond, after: after.framesPerSecond, duringVisibility: during.visibility }));
    } finally {
      if (occluder) occluder.kill();
      browser.kill();
      await sleep(1500);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    }
    beacons.length = 0;
  }
  const launcher = report.results.find(r => r.condition === 'launcher-default');
  const hardened = report.results.find(r => r.condition === 'hardened');
  report.comparison = launcher && hardened ? {
    launcherThrottledWhileOccluded: launcher.throttledWhileOccluded,
    hardenedThrottledWhileOccluded: hardened.throttledWhileOccluded,
    launcherDuringFps: launcher.during.framesPerSecond,
    hardenedDuringFps: hardened.during.framesPerSecond,
    flagsPreventThrottling: launcher.throttledWhileOccluded && !hardened.throttledWhileOccluded,
  } : null;
  report.passed = report.results.length === CONDITIONS.length;
  report.status = report.passed ? 'complete' : 'failed';
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  server.close();
  const file = path.join(ROOT, 'ops/reports', 'capture-raf-occlusion-' + label + '.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2), { flag: 'wx' }).catch(error => {
    if (error.code !== 'EEXIST') throw error;
    console.error('Previous evidence exists for this label; nothing was overwritten.'); exit = 2;
  });
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status, comparison: report.comparison ?? null }, null, 2));
}
process.exit(exit);
