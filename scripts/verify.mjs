// One entry point for every check that does not need a device or a person.
//
// Checks added one at a time during investigation tend to be run once and then
// forgotten, which is how a passing repository quietly stops being verified.
// This runs the whole non-physical set in dependency order and reports a single
// verdict, so the routine cannot silently shrink.
//
// Deliberately excluded: anything needing OBS, a camera, a microphone, a
// listener or a long soak. Those are listed at the end so their absence is
// visible rather than forgotten.
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { mkdirSync, writeFileSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const VOICE_PYTHON = path.join(ROOT, '.tools/voice/venv/Scripts/python.exe');

const quote = value => (/[\s]/.test(value) ? `"${value}"` : value);
const CHECKS = [
  { name: 'unit tests', command: 'npm test --silent' },
  { name: 'native avatar replay and baseline comparison', command: 'node scripts/avatar_replay_smoke.mjs' },
  { name: 'solver baseline comparison', command: 'node scripts/solver_baseline_check.mjs' },
  { name: 'production build and typecheck', command: 'npm run build --silent' },
  { name: 'synthetic library and inspector checks', command: 'node scripts/studio_features_smoke.mjs' },
  { name: 'combined tracking library and output checks', command: 'node scripts/combined_studio_smoke.mjs' },
  { name: 'bundled model navigation with live output', command: 'node scripts/bundled_navigation_smoke.mjs' },
  { name: 'inspector pause with live output', command: 'node scripts/inspector_live_smoke.mjs' },
  { name: 'tracking visual states', command: 'node scripts/tracking_states_smoke.mjs' },
  { name: 'tracking overlay coordinates and labels', command: 'node scripts/tracking_overlay_smoke.mjs' },
  { name: 'import cancellation and timeout checks', command: 'node scripts/import_lifecycle_smoke.mjs' },
  { name: 'pinned public VRM fixture', command: 'python scripts/provision_import_fixture.py' },
  { name: 'licensed VRM import check', command: 'node scripts/licensed_import_smoke.mjs' },
  { name: 'import metadata and version checks', command: 'node scripts/import_metadata_smoke.mjs' },
  { name: 'decoder failure cleanup', command: 'node scripts/avatar_decoder_failure_smoke.mjs' },
  { name: 'rebuilt Ene library checks', command: 'node scripts/rei_library_smoke.mjs --ene' },
  { name: 'native Rei library checks', command: 'node scripts/rei_library_smoke.mjs' },
  { name: 'bundled library thumbnails', command: 'node scripts/library_thumbnail_smoke.mjs' },
  { name: 'studio text contrast and scaled layout', command: 'node scripts/studio_accessibility_smoke.mjs' },
  { name: 'library management across tabs', command: 'node scripts/library_management_smoke.mjs' },
  { name: 'browser storage checks', command: 'node scripts/library_storage_smoke.mjs' },
  { name: 'output failure and recovery checks', command: 'node scripts/output_failure_smoke.mjs' },
  { name: 'replay isolation and video checks', command: 'node scripts/replay_video_smoke.mjs' },
  { name: 'installed tracking worker function checks', command: 'node scripts/tracking_positive_fixture_smoke.mjs --functional' },
  { name: 'diagnostic camera recovery', command: 'node scripts/diagnostic_camera_smoke.mjs' },
  { name: 'recording lifecycle checks', command: 'node scripts/recording_lifecycle_smoke.mjs' },
  { name: 'runtime bundle audit', command: 'node scripts/audit_bundle.mjs' },
  { name: 'model selection and output synchronization', command: 'node scripts/model_selection_smoke.mjs' },
  { name: 'avatar load failure handling', command: 'node scripts/avatar_load_failure_smoke.mjs' },
  { name: 'beginner documentation', command: 'node scripts/audit_docs.mjs' },
  { name: 'evidence reports readable', command: 'node scripts/audit_reports_readable.mjs' },
  { name: 'task register', command: 'python scripts/task_audit.py' },
  { name: 'acceptance claims', command: 'python scripts/audit_acceptance_claims.py' },
  { name: 'voice OBS route licences', command: `${quote(VOICE_PYTHON)} scripts/voice/audit_obs_route.py`, optional: true },
  { name: 'voice service-down message', command: 'node scripts/voice/service_down_smoke.mjs', optional: true },
  { name: 'voice studio tests', command: `${quote(VOICE_PYTHON)} scripts/voice/test_studio.py`, optional: true },
  { name: 'voice paced LLVC tests', command: `${quote(VOICE_PYTHON)} scripts/voice/test_llvc_paced.py`, optional: true },
  { name: 'voice LLVC chunker tests', command: `${quote(VOICE_PYTHON)} scripts/voice/test_llvc_chunker.py`, optional: true },
];

const NOT_COVERED = [
  'Model appearance, diagnostic clarity, native zoom, and screen-reader review (TASK-061).',
  'Windows memory and inspector performance (separate measurement scripts).',
  'Live camera quality, gestures and standing movement (needs a person).',
  'Voice preference and listening acceptance (needs the user).',
  'OBS Virtual Camera registration and consumer test (needs an administrator prompt).',
  'Final landscape and portrait recordings with audio (needs the operator).',
  'Combined OBS soaks and physical audio latency or sync (needs devices and time).',
];

// A single command string with shell:true, rather than an args array: passing
// args alongside shell concatenates instead of escaping them, and Node refuses
// to spawn a .cmd shim without a shell at all. Every command here is static.
const run = (check) => new Promise(resolve => {
  const started = Date.now();
  let output = '';
  const child = spawn(check.command, { cwd: ROOT, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-200000); });
  child.on('error', () => resolve({ ...check, code: null, failed: !check.optional, skipped: check.optional, ms: Date.now() - started }));
  child.on('close', code => {
    mkdirSync(path.join(ROOT, 'ops/reports/local/verify'), { recursive: true });
    writeFileSync(path.join(ROOT, 'ops/reports/local/verify', check.name.replaceAll(' ', '-') + '.log'), output);
    if (code !== 0) console.error(output.slice(-4000));
    resolve({ ...check, code, failed: code !== 0, skipped: false, ms: Date.now() - started });
  });
});

const results = [];
for (const check of CHECKS) {
  const result = await run(check);
  results.push(result);
  const mark = result.skipped ? 'skipped' : result.failed ? 'FAILED' : 'ok';
  console.log(`${mark.padEnd(7)} ${check.name} (${(result.ms / 1000).toFixed(1)}s)`);
}

const failed = results.filter(result => result.failed && !result.skipped);
const skipped = results.filter(result => result.skipped);
mkdirSync(path.join(ROOT, 'ops/reports'), { recursive: true });
writeFileSync(path.join(ROOT, `ops/reports/verify-${process.env.VMODEL_BROWSER ?? process.platform}.json`),
  JSON.stringify({ date: new Date().toISOString(), platform: process.platform,
    browserChannel: process.env.VMODEL_BROWSER ?? null, results, failed: failed.length,
    notCovered: NOT_COVERED }, null, 2) + '\n');
console.log('');
if (skipped.length) console.log(`${skipped.length} optional check(s) skipped: ${skipped.map(s => s.name).join(', ')}`);
console.log(failed.length ? `${failed.length} check(s) FAILED: ${failed.map(f => f.name).join(', ')}`
  : `All ${results.length - skipped.length} checks passed.`);
console.log('\nNot covered here, and still required for delivery:');
for (const item of NOT_COVERED) console.log(`  - ${item}`);
process.exit(failed.length ? 1 : 0);
