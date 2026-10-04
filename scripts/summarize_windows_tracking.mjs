import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const names = {
  initial: 'windows-tracking-chrome.json',
  paired: 'windows-tracking-chrome-alternating.json',
  optional: 'windows-tracking-chrome-optional.json',
  video: 'windows-tracking-chrome-video.json',
};
const sources = Object.fromEntries(await Promise.all(Object.entries(names).map(async ([key, name]) =>
  [key, JSON.parse(await readFile('ops/001-zhil/sprint-001/reports/' + name, 'utf8'))])));
assert(sources.paired.completed && sources.video.completed);
assert(sources.initial.errors.every(error => error.includes('Dense face points were not exercised.')));
assert(sources.optional.errors.every(error => error.includes('page.waitForFunction: Timeout')));
assert.deepEqual(sources.paired.errors, []);
assert.deepEqual(sources.video.errors, []);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const samples = (source, mode) => sources[source].modes.filter(value => value.mode === mode).flatMap(value => value.samples);
const selected = { baseline: 'paired', off: 'paired', overlay: 'initial', estimated: 'initial', record: 'optional', dense: 'optional', video: 'video' };
const modes = Object.entries(selected).map(([mode, source]) => {
  const values = samples(source, mode);
  assert.equal(values.length, 3);
  for (const value of values) {
    assert(value.seconds >= 60);
    assert.equal(value.cameraRequests, 1);
    assert.equal(value.maxInFlight, 1);
    assert.equal(value.powerBefore, true);
    assert.equal(value.powerAfter, true);
    assert.deepEqual(value.renderSize, { width: 752, height: 423 });
  }
  if (mode === 'dense') assert(values.every(value => value.maxFacePoints >= 468));
  if (mode === 'video') assert(values.every(value => value.video.bytes > 1024));
  return { mode, source: names[source], samples: values.length,
    medianFps: median(values.map(value => value.fps)),
    medianUsefulPoseHz: median(values.map(value => value.usefulPoseHz)),
    medianP95AgeMs: median(values.map(value => value.p95AgeMs)),
    privateMiB: values.map(value => value.privateBytes / 1048576),
    recordingSeconds: values.filter(value => value.recordingStates).map(value => {
      const start = value.recordingStates.find(state => state.state.startsWith('Recording trace'));
      const stop = value.recordingStates.find(state => start && state.time > start.time && !state.state.startsWith('Recording trace'));
      assert(start && stop);
      return (stop.time - start.time) / 1000;
    }),
  };
});
assert.equal(new Set(Object.values(sources).map(source => source.modelHash)).size, 1);
assert.equal(new Set(Object.values(sources).map(source => source.fixtureHash)).size, 1);
const value = (mode, key) => median(samples('initial', mode).map(sample => sample[key]));
const defaultComparison = { fpsRatio: value('overlay', 'fps') / value('off', 'fps'),
  usefulPoseRatio: value('overlay', 'usefulPoseHz') / value('off', 'usefulPoseHz'),
  additionalP95AgeMs: value('overlay', 'p95AgeMs') - value('off', 'p95AgeMs') };
const defaultLimitsPassed = defaultComparison.fpsRatio >= .9 && defaultComparison.usefulPoseRatio >= .9 && defaultComparison.additionalP95AgeMs <= 20;
const report = { date: new Date().toISOString(), modes, defaultComparison, defaultLimitsPassed,
  offComparison: sources.paired.offComparison, offLimitsPassed: sources.paired.offLimitsPassed,
  requiredLimitsPassed: defaultLimitsPassed && sources.paired.offLimitsPassed,
  sourceResults: Object.entries(sources).map(([key, source]) => ({ file: names[key], completed: source.completed, errors: source.errors })),
  limits: ['Static photo input and a headless Windows browser only.',
    'The initial and optional runs stopped on test errors. Only their completed modes are used.',
    'Recording costs include the automatic stop within each 60-second sample.',
    'Human review and physical motion acceptance remain open.'],
};
await writeFile('ops/001-zhil/sprint-001/reports/windows-tracking-summary.json', JSON.stringify(report, null, 2) + '\n');
assert(report.requiredLimitsPassed);
console.log(JSON.stringify(report, null, 2));
