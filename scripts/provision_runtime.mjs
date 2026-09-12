import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'public/runtime');
await mkdir(folder, { recursive: true });
const specifications = [
  ['face_landmarker.task', 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'],
  ['pose_landmarker_lite.task', 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'],
  ['hand_landmarker.task', 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'],
];
const manifestPath = path.join(root, 'config/runtime-assets.json');
const previous = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => []);
const manifest = [];
for (const [name, url] of specifications) {
  const target = path.join(folder, name);
  let bytes = await readFile(target).catch(() => null);
  if (!bytes) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const expected = previous.find(entry => entry.name === name);
  if (expected && expected.sha256 !== sha256) throw new Error(`Runtime checksum mismatch: ${name}`);
  await writeFile(target, bytes);
  manifest.push({ name, url, sha256, bytes: bytes.length, checksumSource: 'Recorded on first retrieval from versioned upstream URL' });
  console.log(`Runtime ready: ${name}`);
}
const wasm = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
await mkdir(path.join(folder, 'wasm'), { recursive: true });
for (const name of await readdir(wasm)) {
  await copyFile(path.join(wasm, name), path.join(folder, 'wasm', name));
  const bytes = await readFile(path.join(wasm, name));
  manifest.push({ name: `wasm/${name}`, source: '@mediapipe/tasks-vision@1.0.1', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
}
await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
