/** Validate the isolated, complete website bundle and its declared media boundary. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
const root = process.cwd(), bundle = path.resolve(root, 'web-showcase/dist');
const report = { createdAt: new Date().toISOString(), pass: false, bundle: 'web-showcase/dist', files: [], codeGzipBytes: 0, mediaBytes: 0 };
try {
  const manifest = JSON.parse(await fs.readFile(path.join(bundle, 'ene/manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  const ids = ['home-greeting', 'desk-normal', 'desk-confused', 'desk-surprised', 'desk-excited'];
  assert.deepEqual(Object.keys(manifest.resources).sort(), [...ids].sort());
  const declared = new Map();
  const add = asset => {
    assert.match(asset.url, /^(?:alpha-probe\.webm|(?:home-greeting|desk-(?:normal|confused|surprised|excited))\/(?:small|large)(?:-poster)?\.(?:webm|webp|png))$/);
    assert.match(asset.sha256, /^[0-9a-f]{64}$/);
    assert.equal(declared.has(`ene/${asset.url}`), false, `duplicate media declaration: ${asset.url}`);
    declared.set(`ene/${asset.url}`, asset);
  };
  add(manifest.probes.webmAlpha);
  for (const id of ids) {
    const resource = manifest.resources[id];
    assert.equal(resource.fps, 24); assert.equal(resource.loop, true);
    for (const size of ['small', 'large']) {
      add(resource.renditions[size].webm); add(resource.renditions[size].webp);
      add(resource.posters[size].webp); add(resource.posters[size].png);
    }
  }
  const realRoot = await fs.realpath(bundle);
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name), real = await fs.realpath(file), relativeReal = path.relative(realRoot, real);
      assert.equal(path.isAbsolute(relativeReal) || relativeReal.startsWith('..'), false, 'bundle symlink escapes its root');
      if (entry.isDirectory()) { await walk(file); continue; }
      const relative = path.relative(bundle, file).replaceAll('\\', '/');
      const data = await fs.readFile(file), sha256 = crypto.createHash('sha256').update(data).digest('hex');
      const code = /^assets\/[^/]+\.(?:js|css)$/.test(relative);
      assert.ok(relative === 'index.html' || relative === 'ene/manifest.json' || code || declared.has(relative), `undeclared bundle file: ${relative}`);
      if (declared.has(relative)) {
        const expected = declared.get(relative);
        assert.equal(data.length, expected.bytes, `${relative} byte count`); assert.equal(sha256, expected.sha256, `${relative} SHA-256`);
        report.mediaBytes += data.length; declared.delete(relative);
      }
      if (code) {
        report.codeGzipBytes += gzipSync(data).length;
        assert.doesNotMatch(data.toString(), /@mediapipe|@pixiv\/three-vrm|WebGLRenderer|face_landmarker\.task|ene\.vrm|assets\/voice\//);
      }
      report.files.push({ path: relative, bytes: data.length, sha256 });
    }
  }
  await walk(bundle); assert.equal(declared.size, 0, 'declared media missing from build');
  assert.ok(report.codeGzipBytes <= 150 * 1024, 'initial JS/CSS exceeds 150 KiB gzip');
  report.pass = true;
} catch (error) { report.error = String(error); process.exitCode = 1; }
await fs.writeFile(path.join(root, 'ops/reports/web-bundle-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, files: report.files.length }, null, 2));
