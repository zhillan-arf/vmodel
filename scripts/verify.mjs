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

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const VOICE_PYTHON = path.join(ROOT, '.tools/voice/venv/Scripts/python.exe');

const quote = value => (/[\s]/.test(value) ? `"${value}"` : value);
const CHECKS = [
  { name: 'unit tests', command: 'npm test --silent' },
  { name: 'production build and typecheck', command: 'npm run build --silent' },
  { name: 'runtime bundle audit', command: 'node scripts/audit_bundle.mjs' },
  { name: 'beginner documentation', command: 'node scripts/audit_docs.mjs' },
  { name: 'task register', command: 'python scripts/task_audit.py' },
  { name: 'acceptance claims', command: 'python scripts/audit_acceptance_claims.py' },
  { name: 'voice OBS route licences', command: `${quote(VOICE_PYTHON)} scripts/voice/audit_obs_route.py`, optional: true },
  { name: 'voice studio tests', command: `${quote(VOICE_PYTHON)} scripts/voice/test_studio.py`, optional: true },
  { name: 'voice paced LLVC tests', command: `${quote(VOICE_PYTHON)} scripts/voice/test_llvc_paced.py`, optional: true },
  { name: 'voice LLVC chunker tests', command: `${quote(VOICE_PYTHON)} scripts/voice/test_llvc_chunker.py`, optional: true },
];

const NOT_COVERED = [
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
  const child = spawn(check.command, { cwd: ROOT, shell: true, stdio: 'ignore' });
  child.on('error', () => resolve({ ...check, code: null, failed: !check.optional, skipped: check.optional, ms: Date.now() - started }));
  child.on('close', code => resolve({ ...check, code, failed: code !== 0, skipped: false, ms: Date.now() - started }));
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
console.log('');
if (skipped.length) console.log(`${skipped.length} optional check(s) skipped: ${skipped.map(s => s.name).join(', ')}`);
console.log(failed.length ? `${failed.length} check(s) FAILED: ${failed.map(f => f.name).join(', ')}`
  : `All ${results.length - skipped.length} checks passed.`);
console.log('\nNot covered here, and still required for delivery:');
for (const item of NOT_COVERED) console.log(`  - ${item}`);
process.exit(failed.length ? 1 : 0);
