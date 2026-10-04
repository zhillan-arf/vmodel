// Do the beginner instructions still match what is installed?
//
// The guides tell a non-developer to run named .cmd files, open specific local
// addresses and use particular OBS scenes. Any of those can drift out of date
// silently, and the person who discovers it is the user, mid-recording.
//
// Checks every relative link, every named launcher, and every loopback address
// against the actual repository and configuration. Reads only.
//
// Reports and specifications are included, not just the user guides: they carry
// several hundred cross-links that nothing else verified, and a report whose
// evidence link has rotted is a record that cannot be checked.
import { readFile, readdir, access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const SCANNED = [
  { label: 'docs', dir: path.join(ROOT, 'docs'), userFacing: true },
  { label: 'ops/001-zhil/sprint-001/reports', dir: path.join(ROOT, 'ops/001-zhil/sprint-001/reports'), userFacing: false },
  { label: 'ops/001-zhil/sprint-001/specs', dir: path.join(ROOT, 'ops/001-zhil/sprint-001/specs'), userFacing: false },
];
const exists = async file => access(file).then(() => true).catch(() => false);

// Addresses the guides may legitimately name, and where each is defined.
const KNOWN_PORTS = {
  4173: 'Studio server (scripts/start.ps1, scripts/server.mjs)',
  5081: 'Audition listening room (scripts/voice/serve_auditions.py)',
  5082: 'Voice Studio (scripts/voice/studio_server.py default)',
  4180: 'Website showcase production preview',
  5173: 'Vite dev server (npm run dev)',
  5180: 'Website showcase dev server (web-showcase/vite.config.ts, strictPort)',
};

const report = {
  date: new Date().toISOString(), passed: false, status: 'running',
  question: 'Do the beginner guides reference launchers, links and local addresses that actually exist?',
  readOnly: true, files: [], brokenLinks: [], missingLaunchers: [], unknownPorts: [],
  limits: [
    'Checks that referenced targets exist, not that the instructions are correct or complete.',
    'A person following the guide end to end is a separate check this cannot replace.',
    'A link can resolve to a file whose contents no longer support the claim made around it.',
    'Only relative links are resolved; external URLs are listed, not fetched.',
  ],
};

let exit = 0;
try {
  const externalLinks = new Set();
  const launchers = new Set();
  const ports = new Set();

  for (const area of SCANNED) {
    const names = (await readdir(area.dir)).filter(name => name.endsWith('.md'));
    for (const name of names) {
      const file = path.join(area.dir, name);
      const text = await readFile(file, 'utf8');
      const label = area.label + '/' + name;
      const entry = { file: label, links: 0, launchers: [], ports: [] };

      for (const match of text.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
        const target = decodeURIComponent(match[2].split('#')[0]);
        if (!target || target.startsWith('http')) { if (target) externalLinks.add(target); continue; }
        entry.links++;
        if (!(await exists(path.resolve(path.dirname(file), target)))) {
          report.brokenLinks.push({ file: label, text: match[1], target });
        }
      }

      // Launchers and addresses are only promises to the user in the guides.
      if (area.userFacing) {
        for (const match of text.matchAll(/\*\*([A-Za-z][A-Za-z0-9 ]*\.cmd)\*\*/g)) {
          entry.launchers.push(match[1]); launchers.add(match[1]);
        }
        for (const match of text.matchAll(/127\.0\.0\.1:(\d{4,5})/g)) {
          entry.ports.push(Number(match[1])); ports.add(Number(match[1]));
        }
      }
      report.files.push(entry);
    }
  }

  for (const launcher of [...launchers].sort()) {
    if (!(await exists(path.join(ROOT, 'deploy', launcher)))) report.missingLaunchers.push(launcher);
  }
  report.unknownPorts = [...ports].filter(port => !KNOWN_PORTS[port]).sort();
  report.referencedLaunchers = [...launchers].sort();
  report.referencedPorts = [...ports].sort().map(port => ({ port, purpose: KNOWN_PORTS[port] ?? 'unknown' }));
  report.externalLinks = [...externalLinks].sort();
  report.checks = {
    everyRelativeLinkResolves: report.brokenLinks.length === 0,
    everyNamedLauncherExists: report.missingLaunchers.length === 0,
    everyLocalAddressIsKnown: report.unknownPorts.length === 0,
  };
  report.passed = Object.values(report.checks).every(Boolean);
  report.status = report.passed ? 'complete' : 'failed';
  if (!report.passed) exit = 1;
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  const file = path.join(ROOT, 'ops/001-zhil/sprint-001/reports', 'docs-audit.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status,
    checks: report.checks ?? null, brokenLinks: report.brokenLinks, missingLaunchers: report.missingLaunchers,
    unknownPorts: report.unknownPorts, documents: report.files.length }, null, 2));
}
process.exit(exit);
