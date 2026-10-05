import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { validateBytes } from 'gltf-validator';

const base = 'ops/001-zhil/sprint-002/reports';
const output = `${base}/local/rei-v2`;
await mkdir(output, { recursive: true });
const hash = data => createHash('sha256').update(data).digest('hex');
const models = ['rei', 'rei-v2'];
const hashes = {}, validation = {};
for (const id of models) {
  const bytes = await readFile(`assets/avatars/${id}.vrm`);
  hashes[id] = hash(bytes);
  assert.equal(hash(await readFile(`public/avatars/${id}.vrm`)), hashes[id]);
  const result = await validateBytes(bytes, { maxIssues: 1000 });
  validation[id] = { errors: result.issues.numErrors, warnings: result.issues.numWarnings,
    messages: result.issues.messages.filter(message => message.severity < 2) };
}
assert.equal(validation['rei-v2'].errors, 0);
const poses = ['front', 'side', 'smile', 'blink', 'mouth', 'brows', 'raised-arms', 'peace'];
const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [], externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') externalRequests.push(request.url());
  });
  await page.goto(server.resolvedUrls.local[0] + 'tests/browser-host.html');
  await page.evaluate(async () => {
    const { AvatarViewer } = await import('/src/viewer.ts');
    const { MotionSolver } = await import('/src/motion-solver.ts');
    const { defaults } = await import('/src/types.ts');
    const { inspectVRM } = await import('/src/vrm-inspection.ts');
    const { trackedBones } = await import('/src/rig-overlay.ts');
    const { motionSample } = await import('/tests/fixtures/tracking-motion.ts');
    const { gestureHand } = await import('/tests/fixtures/hand-gestures.ts');
    const { Vector3, Quaternion } = await import('/node_modules/three/build/three.module.js');
    document.body.style.cssText = 'margin:0;background:#252936;overflow:hidden';
    const container = document.createElement('div');
    container.style.cssText = 'position:relative;width:1920px;height:1080px';
    document.body.append(container);
    const settings = { ...defaults, framing: 'face', cameraFov: 42, outputResolution: '1080p',
      lighting: 'warm', lightIntensity: 1, background: '#342117', mirror: false, springMotion: 'off', faceDetail: 'extended' };
    const viewer = new AvatarViewer(container, settings, true);
    let vrm;
    const node = name => vrm.humanoid.getNormalizedBoneNode(name);
    const update = () => {
      vrm.update(0); vrm.scene.updateMatrixWorld(true);
      vrm.scene.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.skeleton.update(); });
    };
    const reset = () => { vrm.humanoid.resetNormalizedPose(); vrm.expressionManager.resetValues(); update(); vrm.springBoneManager?.reset(); };
    const vertexSamples = new WeakMap();
    const skinSnapshot = () => {
      const values = [];
      vrm.scene.traverse(mesh => {
        if (!mesh.isSkinnedMesh || mesh.material?.isOutline) return;
        let indices = vertexSamples.get(mesh.geometry);
        if (!indices) {
          const selected = new Set();
          for (let i = 0; i < mesh.geometry.attributes.position.count; i += 100) selected.add(i);
          for (const morph of mesh.geometry.morphAttributes.position ?? []) {
            let count = 0;
            for (let i = 0; i < morph.count && count < 4; i++) {
              if (Math.hypot(morph.getX(i), morph.getY(i), morph.getZ(i)) > 1e-8) { selected.add(i); count++; }
            }
          }
          indices = [...selected].sort((a, b) => a - b); vertexSamples.set(mesh.geometry, indices);
        }
        for (const i of indices) {
          values.push(...mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld).toArray());
        }
      });
      return values;
    };
    window.reiV2 = {
      viewer, settings,
      async load(id) {
        const blob = await (await fetch(`/avatars/${id}.vrm`)).blob();
        const inspected = await inspectVRM(blob);
        const candidate = await viewer.prepareAvatar(blob); viewer.commitAvatar(candidate); vrm = viewer.vrm;
        const gl = viewer.renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
        return { id, capabilities: candidate.capabilities, resources: inspected.resources,
          graphics: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
      },
      controls() {
        reset();
        const expressions = [];
        for (const expression of vrm.expressionManager.expressions) {
          reset(); const before = skinSnapshot();
          vrm.expressionManager.setValue(expression.expressionName, 1); update();
          const after = skinSnapshot();
          let maxDisplacement = 0;
          for (let i = 0; i < before.length; i += 3) maxDisplacement = Math.max(maxDisplacement,
            Math.hypot(after[i] - before[i], after[i + 1] - before[i + 1], after[i + 2] - before[i + 2]));
          expressions.push({ name: expression.expressionName, maxDisplacement });
        }
        const direct = [], solver = new MotionSolver(vrm);
        for (const name of ['spine', 'chest', ...trackedBones.filter(name => /Thumb|Index|Middle|Ring|Little/.test(name))]) {
          reset();
          const raw = vrm.humanoid.getRawBoneNode(name), samples = [];
          vrm.scene.traverse(mesh => {
            if (!mesh.isSkinnedMesh || mesh.material?.isOutline) return;
            const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
            const affected = new Set();
            mesh.skeleton.bones.forEach((bone, i) => { for (let parent = bone; parent; parent = parent.parent) if (parent === raw) { affected.add(i); break; } });
            let count = 0;
            for (let vertex = 0; vertex < indices.count && count < 16; vertex++) {
              if (![0, 1, 2, 3].some(i => affected.has(indices.getComponent(vertex, i)) && weights.getComponent(vertex, i) > .01)) continue;
              samples.push({ mesh, vertex, before: mesh.getVertexPosition(vertex, new Vector3()).applyMatrix4(mesh.matrixWorld) }); count++;
            }
          });
          const rawBefore = raw.quaternion.clone();
          const axis = solver.fingerAxes.get(name) ?? new Vector3(0, 0, name.startsWith('left') ? -1 : 1);
          node(name).quaternion.multiply(new Quaternion().setFromAxisAngle(axis, .4)); update();
          direct.push({ name, rawAngle: rawBefore.angleTo(raw.quaternion), surfaceSamples: samples.length,
            maxDisplacement: Math.max(0, ...samples.map(sample => sample.before.distanceTo(
              sample.mesh.getVertexPosition(sample.vertex, new Vector3()).applyMatrix4(sample.mesh.matrixWorld)))) });
        }
        const gestures = [];
        for (const gesture of ['open', 'fist', 'point', 'peace']) {
          reset(); const motion = new MotionSolver(vrm), frame = motionSample(3, 1000).frame;
          frame.poseImage = []; frame.hands = [gestureHand('left', gesture), gestureHand('right', gesture)];
          for (let i = 0; i < 90; i++) motion.update(frame, settings, 1 / 60, 1000);
          update();
          const fingers = Object.fromEntries([...motion.rests].filter(([name]) => /Thumb|Index|Middle|Ring|Little/.test(name))
            .map(([name, rest]) => [name, rest.local.angleTo(node(name).quaternion)]));
          gestures.push({ gesture, fingers });
        }
        reset(); return { expressions, direct, gestures };
      },
      springs() {
        const modes = [];
        for (const springMotion of ['full', 'gentle', 'off']) {
          viewer.configure({ ...settings, springMotion }); reset();
          const joints = [...(vrm.springBoneManager?.joints ?? [])];
          const initial = joints.map(joint => joint.bone.quaternion.clone());
          let maximumAngle = 0, finite = true;
          for (let step = 0; step < 120; step++) {
            const angle = step < 60 ? Math.sin(step * Math.PI / 30) * .3 : 0;
            node('head').rotation.y = angle; node('chest').rotation.z = angle * .3;
            vrm.update(1 / 60);
            joints.forEach((joint, index) => {
              maximumAngle = Math.max(maximumAngle, initial[index].angleTo(joint.bone.quaternion));
              finite &&= joint.bone.quaternion.toArray().every(Number.isFinite);
            });
          }
          modes.push({ springMotion, joints: joints.length, maximumAngle, finite });
        }
        viewer.configure(settings); reset(); return modes;
      },
      render(pose, lighting = 'warm') {
        viewer.configure({ ...settings, framing: ['raised-arms', 'peace'].includes(pose) ? 'bust' : 'face', lighting });
        reset(); node('leftUpperArm').rotation.z = 1.15; node('rightUpperArm').rotation.z = -1.15;
        if (pose === 'side') node('hips').rotation.y = Math.PI / 2;
        if (pose === 'smile') vrm.expressionManager.setValue('happy', .55);
        if (pose === 'blink') { vrm.expressionManager.setValue('blinkLeft', 1); vrm.expressionManager.setValue('blinkRight', 1); }
        if (pose === 'mouth') vrm.expressionManager.setValue('aa', .7);
        if (pose === 'brows') { vrm.expressionManager.setValue('vmodelBrowUpLeft', .7); vrm.expressionManager.setValue('vmodelBrowDownRight', .7); }
        if (pose === 'raised-arms') { node('leftUpperArm').rotation.z = -.7; node('rightUpperArm').rotation.z = .7; }
        if (pose === 'peace') {
          const solver = new MotionSolver(vrm), frame = motionSample(3, 1000).frame;
          frame.poseImage = []; frame.hands = [gestureHand('left', 'peace'), gestureHand('right', 'peace')]; frame.face = {};
          for (let i = 0; i < 90; i++) solver.update(frame, settings, 1 / 60, 1000);
        }
        update(); viewer.resize(); viewer.draw(0);
        const stats = viewer.renderer.info.render;
        return { pose, lighting, width: viewer.renderer.domElement.width, height: viewer.renderer.domElement.height,
          drawCalls: stats.calls, triangles: stats.triangles, camera: viewer.camera.position.toArray(), fov: viewer.camera.fov,
          surface: skinSnapshot() };
      },
      outputSizes() {
        const sizes = [];
        for (const outputResolution of ['720p', '1080p']) for (const orientation of ['landscape', 'portrait']) {
          viewer.configure({ ...settings, orientation, outputResolution }); viewer.draw(0);
          sizes.push({ outputResolution, orientation, width: viewer.renderer.domElement.width, height: viewer.renderer.domElement.height });
        }
        viewer.configure(settings); return sizes;
      },
    };
  });
  const results = [];
  for (const id of models) {
    console.log(`${id}: load and control checks`);
    const model = await page.evaluate(id => window.reiV2.load(id), id);
    model.controls = await page.evaluate(() => window.reiV2.controls());
    model.springs = await page.evaluate(() => window.reiV2.springs());
    model.outputSizes = await page.evaluate(() => window.reiV2.outputSizes());
    model.renders = [];
    for (const pose of poses) {
      const render = await page.evaluate(pose => window.reiV2.render(pose), pose);
      const file = `${output}/${id}-${pose}.png`;
      await page.locator('canvas').screenshot({ path: file });
      model.renders.push({ ...render, image: file, imageSha256: hash(await readFile(file)) });
      console.log(`${id}: ${pose}`);
    }
    for (const lighting of ['studio', 'violet']) {
      const render = await page.evaluate(lighting => window.reiV2.render('front', lighting), lighting);
      const file = `${output}/${id}-${lighting}.png`;
      await page.locator('canvas').screenshot({ path: file });
      model.renders.push({ ...render, image: file, imageSha256: hash(await readFile(file)) });
    }
    results.push(model);
  }
  const sourceHashes = {};
  for (const file of ['src/viewer.ts', 'src/lighting.ts', 'src/types.ts', 'src/composition.ts', 'src/face-expressions.ts',
    'src/motion-solver.ts', 'src/profiles.ts', 'src/tracking-recording.ts', 'config/avatars/rei-v2.json', 'scripts/build_rei_v2.py', 'scripts/rei_v2_compare.mjs']) {
    sourceHashes[file] = hash(await readFile(file));
  }
  for (const model of results) {
    assert.equal(model.controls.direct.length, 32);
    for (const control of model.controls.direct) {
      assert(control.rawAngle > .39, control.name); assert(control.maxDisplacement > 1e-5, control.name);
    }
    for (const expression of model.controls.expressions.filter(expression => expression.name !== 'neutral')) {
      assert(expression.maxDisplacement > 1e-7, expression.name);
    }
    for (const { gesture, fingers } of model.controls.gestures) {
      assert.equal(Object.keys(fingers).length, 30);
      for (const [name, angle] of Object.entries(fingers)) {
        assert(Number.isFinite(angle)); if (name.includes('Thumb')) continue;
        const bent = gesture === 'fist' || gesture === 'point' && !name.includes('Index') || gesture === 'peace' && /Ring|Little/.test(name);
        assert(bent ? angle > .25 : angle < .32, `${model.id}: ${gesture}: ${name}`);
      }
    }
    assert(model.springs.every(mode => mode.finite));
    for (const size of model.outputSizes) {
      const expected = size.outputResolution === '1080p' ? [1920, 1080] : [1280, 720];
      assert.deepEqual([size.width, size.height], size.orientation === 'portrait' ? expected.reverse() : expected);
    }
  }
  const geometry = [];
  for (const original of results[0].renders) {
    const edited = results[1].renders.find(render => render.pose === original.pose && render.lighting === original.lighting);
    assert.deepEqual(edited.camera, original.camera);
    let maximum = 0;
    assert.equal(edited.surface.length, original.surface.length);
    for (let i = 0; i < original.surface.length; i++) maximum = Math.max(maximum, Math.abs(edited.surface[i] - original.surface[i]));
    if (original.pose !== 'brows') assert(maximum < 1e-7, original.pose);
    else assert(maximum > 1e-5);
    geometry.push({ pose: original.pose, lighting: original.lighting, maximumCoordinateChange: maximum });
    delete original.surface; delete edited.surface;
  }
  assert.deepEqual(results[0].springs, results[1].springs);
  for (const id of models) assert.equal(hash(await readFile(`assets/avatars/${id}.vrm`)), hashes[id]);
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  const report = { date: new Date().toISOString(), hashes, sourceHashes, validation, results, geometry, errors, externalRequests,
    limits: ['Fixed synthetic controls and software graphics.', 'No live camera accuracy or target GPU timing measurement.', 'Appearance acceptance remains open.'] };
  await writeFile(`${base}/rei-v2-comparison.json`, JSON.stringify(report, null, 2) + '\n');
  const labels = { front: 'Front', side: 'Side', smile: 'Smile', blink: 'Blink', mouth: 'Mouth', brows: 'Brow controls', 'raised-arms': 'Raised arms', peace: 'Peace sign', studio: 'Studio light', violet: 'Violet light' };
  const sections = Object.entries(labels).map(([pose, label]) => `<section><h2>${label}</h2><div class="pair">${models.map(id => `<figure><img src="${id}-${pose}.png" alt="${id}: ${label}"><figcaption>${id === 'rei' ? 'Original Rei' : 'Rei v2 candidate'}</figcaption></figure>`).join('')}</div></section>`).join('\n');
  await writeFile(`${output}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Rei v2 comparison</title><style>body{margin:24px;background:#161922;color:#eee;font:16px system-ui}h1,h2{font-weight:600}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}img{width:100%}figcaption{padding:8px}section{margin-bottom:28px}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style><h1>Rei v2 comparison</h1><p>Both models use the same camera, lights, and direct poses. Only Rei v2 has the added brow controls.</p><p>The tests use software graphics. Physical performance and appearance acceptance remain open.</p>${sections}</html>\n`);
  console.log(JSON.stringify({ hashes, comparisons: geometry.length, directControls: results.map(model => model.controls.direct.length), errors }));
} finally {
  await browser?.close();
  await server.close();
}
