// Read only already-owned recorded files; no browser, OBS outputs or media devices.
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import { withinOwnedDirectory } from './soak-metrics.mjs';
assert(process.argv.slice(2).every(value => value === '--passive'), 'Only the default soak or --passive owned report is accepted.');
const passive = process.argv.includes('--passive');
const run = promisify(execFile), report = JSON.parse(await readFile(passive ? 'ops/reports/capture-passive-control.json' : 'ops/reports/combined-fixture-soak.json', 'utf8'));
const ownedRoot = path.resolve('ops/reports/local', passive ? 'capture-passive' : 'combined-soak');
const directory = path.join(ownedRoot, report.runId);
assert(withinOwnedDirectory(ownedRoot, directory, path));
const ffmpeg = path.resolve('.tools/web/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe');
const analysis = { runId: report.runId, analyzedAtUTC: new Date().toISOString(), noMedia: true, noOBS: true,
  method: 'Accurate seek of saved H.264, one frame at each stated file time, ordinary 160x90 resize and RGB pixel statistics. No timing benchmark.', phases: [] };
for (const phase of report.phases) {
  assert(phase.recording?.file); const file = path.resolve(phase.recording.file); assert(withinOwnedDirectory(directory, file, path));
  const rows = [];
  for (const seconds of passive ? [0, 60, 90, 120, 175] : phase.id === 'seated-no-hands' ? [0, 60, 90, 92, 94, 96, 120, 600, 950] : [0, 60, 450, 950]) {
    const { stdout } = await run(ffmpeg, ['-v', 'error', '-ss', String(seconds), '-threads', '1', '-i', file, '-map', '0:v:0', '-an', '-sn', '-dn',
      '-filter_threads', '1', '-vf', 'scale=160:90', '-frames:v', '1', '-threads', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    { windowsHide: true, timeout: 8000, maxBuffer: 512 * 1024, encoding: 'buffer' });
    assert.equal(stdout.length, 160 * 90 * 3);
    const min = [255, 255, 255], max = [0, 0, 0], sum = [0, 0, 0]; let nearWhitePixels = 0;
    for (let i = 0; i < stdout.length; i += 3) {
      if (stdout[i] >= 250 && stdout[i + 1] >= 250 && stdout[i + 2] >= 250) nearWhitePixels++;
      for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], stdout[i + c]); max[c] = Math.max(max[c], stdout[i + c]); sum[c] += stdout[i + c]; }
    }
    rows.push({ fileTimeSeconds: seconds, rgbMin: min, rgbMax: max, rgbMean: sum.map(value => value / 14400), nearWhiteFraction: nearWhitePixels / 14400 });
  }
  analysis.phases.push({ id: phase.id, file: phase.recording.file, samples: rows });
}
await writeFile(path.join(directory, 'recording-pixel-analysis.json'), JSON.stringify(analysis, null, 2) + '\n');
console.log(JSON.stringify(analysis));
