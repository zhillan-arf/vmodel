// Does minimizing the output window reproduce the TASK-020 failure signature?
//
// A soak run was just interrupted with the owned Chrome window reporting
// minimized:true at rectangle -21333,-21333, and the run before it failed its
// clean-view check. A minimized window reports document.visibilityState
// 'hidden', which stops animation frames outright -- and a window with no new
// frames is exactly what produces a blank capture in OBS.
//
// That is the original failure's signature: draws collapsing toward 1 Hz and
// entirely white stills. The earlier occlusion probes tested *covering* the
// window, which Chrome never treated as occluded. This tests *minimizing* it.
//
// Real non-automated Chrome, as the launcher starts it. Owns its server, its
// Chrome user-data directory and the window it minimizes. No OBS, no recording.
import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const label = process.argv.includes('--run-label') ? process.argv[process.argv.indexOf('--run-label') + 1] : '';
if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(label)) { console.error('Supply a fresh simple --run-label'); process.exit(2); }

const PHASE_MS = 10000;
const TITLE = 'VModel Minimize Probe ' + label;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const PAGE = `<!doctype html><meta charset="utf-8"><title>${TITLE}</title>
<style>html,body{margin:0;height:100%;background:#101018;color:#eee;font:16px system-ui;display:grid;place-items:center}</style>
<canvas id=c width=320 height=200></canvas>
<script>
const gl = document.getElementById('c').getContext('webgl2') || document.getElementById('c').getContext('webgl');
let frames = 0, hiddenEvents = 0;
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') hiddenEvents++; });
function tick() { frames++; if (gl) { gl.clearColor((frames % 60) / 60, 0.2, 0.5, 1); gl.clear(gl.COLOR_BUFFER_BIT); } requestAnimationFrame(tick); }
requestAnimationFrame(tick);
// A timer, unlike rAF, keeps reporting while frames are stopped, so the beacon
// itself does not disappear along with the thing it is measuring.
setInterval(() => {
  navigator.sendBeacon('/frames', JSON.stringify({ at: Date.now(), frames, hiddenEvents, visibility: document.visibilityState }));
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

const chrome = [
  path.join(process.env.ProgramFiles ?? '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
].find(candidate => candidate && existsSync(candidate));

const WINDOW_PS = `
Add-Type @"
using System;using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
}
"@
$p = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*ACTION_TITLE*' } | Select-Object -First 1
if (-not $p) { '{"found":false}'; exit 0 }
$h = $p.MainWindowHandle
if ('ACTION_VERB' -eq 'minimize') { [void][W]::ShowWindow($h, 6) } elseif ('ACTION_VERB' -eq 'restore') { [void][W]::ShowWindow($h, 9) }
Start-Sleep -Milliseconds 400
[pscustomobject]@{found=$true;minimized=[W]::IsIconic($h);visible=[W]::IsWindowVisible($h)} | ConvertTo-Json -Compress
`;

async function windowAction(verb) {
  const script = WINDOW_PS.replaceAll('ACTION_TITLE', TITLE).replaceAll('ACTION_VERB', verb);
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 20000 });
  return JSON.parse(stdout.trim().replace(/^﻿/, ''));
}

function rate(from, to) {
  const window = beacons.filter(beacon => beacon.at >= from && beacon.at <= to);
  if (window.length < 2) return { samples: window.length, framesPerSecond: null, visibility: window.at(-1)?.visibility ?? null };
  const first = window[0], last = window.at(-1);
  const seconds = (last.at - first.at) / 1000;
  return { samples: window.length,
    framesPerSecond: seconds > 0 ? Number(((last.frames - first.frames) / seconds).toFixed(2)) : null,
    visibility: last.visibility, hiddenEvents: last.hiddenEvents - first.hiddenEvents };
}

const report = {
  date: new Date().toISOString(), runLabel: label, passed: false, status: 'running',
  question: 'Does minimizing the output window stop frame delivery and so reproduce the 1 Hz / blank-capture signature?',
  chromePath: chrome ?? null, phaseMs: PHASE_MS, automationAttached: false, obsInvolved: false,
  physicalMedia: false, liveAccepted: false,
  limits: [
    'A synthetic WebGL page, not the avatar runtime: it shows scheduler behaviour, not application performance.',
    'Programmatic ShowWindow minimize; a user minimising by hand or switching virtual desktops is similar but not identical.',
    'No OBS capture output is inspected, so the blank-capture link is inferred from frame delivery, not observed here.',
    'Frame counts arrive by beacon every 500 ms; timers continue while frames are stopped, which is why they remain readable.',
    'One short run on one host; ambient load is recorded, not controlled.',
  ],
};

let exit = 0, browser;
try {
  if (!chrome) throw new Error('The tested Chrome browser is missing');
  const profile = path.join(os.tmpdir(), 'vmodel-minimize-probe-' + label);
  await rm(profile, { recursive: true, force: true });
  browser = spawn(chrome, ['--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--new-window', '--window-size=1100,760', base], { stdio: 'ignore', detached: false });
  await sleep(7000);

  const beforeStart = Date.now(); await sleep(PHASE_MS); const beforeEnd = Date.now();
  report.minimizeResult = await windowAction('minimize');
  await sleep(2000);
  const duringStart = Date.now(); await sleep(PHASE_MS); const duringEnd = Date.now();
  report.restoreResult = await windowAction('restore');
  await sleep(2000);
  const afterStart = Date.now(); await sleep(PHASE_MS); const afterEnd = Date.now();

  report.before = rate(beforeStart, beforeEnd);
  report.during = rate(duringStart, duringEnd);
  report.after = rate(afterStart, afterEnd);
  report.comparison = {
    beforeFps: report.before.framesPerSecond, duringFps: report.during.framesPerSecond, afterFps: report.after.framesPerSecond,
    visibilityWhileMinimized: report.during.visibility,
    framesStoppedWhileMinimized: report.during.framesPerSecond !== null && report.during.framesPerSecond < 2,
    recovered: report.before.framesPerSecond && report.after.framesPerSecond
      ? report.after.framesPerSecond > report.before.framesPerSecond * 0.8 : null,
    reproducesSignature: report.during.visibility === 'hidden' && report.during.framesPerSecond !== null && report.during.framesPerSecond < 2,
  };
  report.passed = report.before.framesPerSecond !== null && report.during.framesPerSecond !== null;
  report.status = report.passed ? 'complete' : 'failed';
  console.log(JSON.stringify(report.comparison));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  if (browser) browser.kill();
  server.close();
  const file = path.join(ROOT, 'ops/reports', 'capture-raf-minimize-' + label + '.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2), { flag: 'wx' }).catch(error => {
    if (error.code !== 'EEXIST') throw error;
    console.error('Previous evidence exists for this label; nothing was overwritten.'); exit = 2;
  });
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status, comparison: report.comparison ?? null }, null, 2));
}
process.exit(exit);
