// Every evidence report must be machine-readable.
//
// One file of 170 carried a UTF-8 byte-order mark from a PowerShell writer and
// was rejected by strict JSON parsers - and it was the evidence for the Virtual
// Camera gate. Evidence nothing can read is not evidence.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const DIR = path.join(ROOT, 'ops/reports');

const report = {
  date: new Date().toISOString(), passed: false, status: 'running', readOnly: true,
  question: 'Can every evidence report be parsed, and is any carrying a byte-order mark?',
  limits: [
    'Checks that each file parses, not that its contents are correct or current.',
    'Deliberately does not verify that path fields point at existing files. Of 1028 such fields, '
      + 'the ones that do not resolve are URL routes, bundle-relative paths, and absences that are '
      + 'themselves the finding - the two sphere maps recorded as unavailable, for instance. A check '
      + 'flagging those would be noise, and would pressure someone to "fix" an accurate record.',
  ],
};

let exit = 0;
try {
  const names = (await readdir(DIR)).filter(name => name.endsWith('.json'));
  const withBom = [], unparseable = [];
  for (const name of names) {
    const bytes = await readFile(path.join(DIR, name));
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) withBom.push(name);
    try { JSON.parse(bytes.toString('utf8')); }
    catch (error) { unparseable.push({ name, error: String(error.message).slice(0, 120) }); }
  }
  Object.assign(report, { scanned: names.length, withBom, unparseable });
  report.checks = { everyReportParses: unparseable.length === 0, noByteOrderMarks: withBom.length === 0 };
  report.passed = Object.values(report.checks).every(Boolean);
  report.status = report.passed ? 'complete' : 'failed';
  if (!report.passed) exit = 1;
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  const file = path.join(ROOT, 'ops/reports', 'reports-readable-audit.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status,
    scanned: report.scanned ?? null, checks: report.checks ?? null,
    withBom: report.withBom ?? null, unparseable: report.unparseable ?? null }, null, 2));
}
process.exit(exit);
