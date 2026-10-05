import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { validateBytes } from 'gltf-validator';

const base = 'ops/001-zhil/sprint-002/reports';
const output = `${base}/local/ene-v2`;
await mkdir(output, { recursive: true });
const hash = data => createHash('sha256').update(data).digest('hex');
const models = ['ene', 'ene-v2'];
const hashes = {}, validation = {};
for (const id of models) {
  const bytes = await readFile(`assets/avatars/${id}.vrm`);
  hashes[id] = hash(bytes);
  assert.equal(hash(await readFile(`public/avatars/${id}.vrm`)), hashes[id]);
  const result = await validateBytes(bytes, { maxIssues: 10000 });
  validation[id] = { errors: result.issues.numErrors, warnings: result.issues.numWarnings,
    messages: result.issues.messages.filter(message => message.severity < 2) };
}
assert.equal(validation['ene-v2'].errors, 0);
const poses = ['front', 'side', 'back', 'full', 'full-light', 'full-side', 'full-side-light', 'full-back', 'full-back-light', 'smile', 'blink', 'wink', 'mouth', 'ee', 'combined', 'brows', 'raised-arms', 'peace', 'lean',
  ...['open','fist','point','peace','wrist-bend','wrist-twist'].flatMap(gesture => ['left','right'].map(side => `hand-${gesture}-${side}`)),
  ...['full','gentle'].flatMap(mode => ['move','rest'].map(phase => `spring-${mode}-${phase}`))];
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
      lighting: 'studio', lightIntensity: .85, background: '#162637', mirror: false, springMotion: 'off', faceDetail: 'extended' };
    const viewer = new AvatarViewer(container, settings, true);
    let vrm;
    const node = name => vrm.humanoid.getNormalizedBoneNode(name);
    const update = () => {
      vrm.update(0); vrm.scene.updateMatrixWorld(true);
      vrm.scene.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.skeleton.update(); });
    };
    const reset = () => { vrm.humanoid.resetNormalizedPose(); vrm.lookAt?.reset(); vrm.expressionManager.resetValues(); update(); vrm.springBoneManager?.reset(); };
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
    window.eneV2 = {
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
          expressions.push({ name: expression.expressionName, bound: expression.binds.length > 0, maxDisplacement });
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
      gaze() {
        const directions = [];
        for (const [direction, x, y] of [['left', .5, 0], ['right', -.5, 0], ['up', 0, .4], ['down', 0, -.4]]) {
          reset();
          const eyes = ['leftEye', 'rightEye'].map(name => vrm.humanoid.getRawBoneNode(name));
          const before = eyes.map(eye => eye.quaternion.clone());
          const target = vrm.lookAt.getLookAtWorldPosition(new Vector3()).add(new Vector3(x, y, 1));
          vrm.lookAt.lookAt(target); vrm.lookAt.update(0);
          directions.push({ direction, yaw: vrm.lookAt.yaw, pitch: vrm.lookAt.pitch,
            anglesRadians: eyes.map((eye, index) => before[index].angleTo(eye.quaternion)),
            quaternions: eyes.map(eye => eye.quaternion.toArray()) });
        }
        reset(); return directions;
      },
      clearance() {
        const tests = [];
        for (const gesture of ['open', 'fist', 'point', 'peace', 'wrist-bend', 'wrist-twist']) {
          reset(); const motion = new MotionSolver(vrm), frame = motionSample(3, 1000).frame;
          frame.poseImage = []; frame.face = {}; frame.faceMatrix = null;
          frame.hands = ['left','right'].map(side => gestureHand(side, gesture.startsWith('wrist') ? 'open' : gesture));
          for (let i = 0; i < 90; i++) motion.update(frame, settings, 1 / 60, 1000);
          if (gesture === 'wrist-bend') { node('leftHand').rotation.x += .6; node('rightHand').rotation.x -= .6; }
          if (gesture === 'wrist-twist') { node('leftHand').rotation.y += .7; node('rightHand').rotation.y -= .7; }
          update();
          for (const side of ['left', 'right']) {
            const hand = vrm.humanoid.getRawBoneNode(side + 'Hand').getWorldPosition(new Vector3());
            const axis = vrm.humanoid.getRawBoneNode(side + 'MiddleProximal').getWorldPosition(new Vector3()).sub(hand).normalize();
            const fingerBones = trackedBones.filter(name => name.startsWith(side) && /Thumb|Index|Middle|Ring|Little/.test(name)).map(name => vrm.humanoid.getRawBoneNode(name));
            let cuffMaximum = -Infinity, fingerMinimum = Infinity, cuffVertices = 0, fingerVertices = 0;
            vrm.scene.traverse(mesh => {
              if (!mesh.isSkinnedMesh || mesh.material?.isOutline) return;
              const positions = mesh.geometry.attributes.position;
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              if (materials.some(material => !material.isOutline && ['材質2.001', '材質8.001'].includes(material.name))) {
                for (let vertex = 0; vertex < positions.count; vertex++) {
                  if (positions.getX(vertex) * (side === 'left' ? 1 : -1) <= 0) continue;
                  cuffMaximum = Math.max(cuffMaximum, mesh.getVertexPosition(vertex, new Vector3()).applyMatrix4(mesh.matrixWorld).sub(hand).dot(axis));
                  cuffVertices++;
                }
                return;
              }
              const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight, affected = new Set();
              mesh.skeleton.bones.forEach((bone, index) => {
                for (let parent = bone; parent; parent = parent.parent) if (fingerBones.includes(parent)) { affected.add(index); break; }
              });
              const selected = new Set();
              for (let vertex = 0; vertex < positions.count; vertex++) {
                if ([0,1,2,3].some(i => affected.has(indices.getComponent(vertex, i)) && weights.getComponent(vertex, i) > .001)) selected.add(vertex);
              }
              const triangles = mesh.geometry.index;
              const connected = new Set(selected);
              for (let index = 0; index < triangles.count; index += 3) {
                const vertices = [0,1,2].map(i => triangles.getX(index + i));
                if (vertices.some(vertex => selected.has(vertex))) vertices.forEach(vertex => connected.add(vertex));
              }
              for (const vertex of connected) {
                fingerMinimum = Math.min(fingerMinimum, mesh.getVertexPosition(vertex, new Vector3()).applyMatrix4(mesh.matrixWorld).sub(hand).dot(axis));
                fingerVertices++;
              }
            });
            tests.push({ gesture, side, cuffVertices, fingerVertices, cuffMaximum, fingerMinimum,
              planeGapMeters: fingerMinimum - cuffMaximum });
          }
        }
        reset(); return tests;
      },
      springs() {
        const modes = [];
        for (const springMotion of ['full', 'gentle', 'off']) {
          viewer.configure({ ...settings, springMotion }); reset();
          const joints = [...(vrm.springBoneManager?.joints ?? [])];
          const initial = joints.map(joint => joint.bone.quaternion.clone());
          let maximumAngle = 0, finite = true, finalStepMaximum = 0;
          for (let step = 0; step < 300; step++) {
            const angle = step < 60 ? (step % 20 < 10 ? .6 : -.6) : 0;
            node('head').rotation.y = angle; node('chest').rotation.z = angle * .3;
            node('leftUpperArm').rotation.z = angle * .7; node('rightUpperArm').rotation.z = -angle * .7;
            const previous = joints.map(joint => joint.bone.quaternion.clone());
            vrm.update(1 / 60);
            joints.forEach((joint, index) => {
              maximumAngle = Math.max(maximumAngle, initial[index].angleTo(joint.bone.quaternion));
              finite &&= joint.bone.quaternion.toArray().every(Number.isFinite);
              if (step >= 270) finalStepMaximum = Math.max(finalStepMaximum, previous[index].angleTo(joint.bone.quaternion));
            });
          }
          modes.push({ springMotion, joints: joints.length, maximumAngle, finalStepMaximum, finite });
        }
        viewer.configure(settings); reset(); return modes;
      },
      render(pose, lighting = 'studio') {
        viewer.setDiagnosticFocus('body');
        viewer.configure({ ...settings, framing: pose.startsWith('full') ? 'body' : ['raised-arms','peace','lean'].includes(pose) || pose.startsWith('hand-') || pose.startsWith('spring-') ? 'bust' : 'face', lighting });
        reset();
        const idle = new MotionSolver(vrm); for (let i = 0; i < 90; i++) idle.update(null, settings, 1 / 60, 1000);
        if (pose.endsWith('-light')) viewer.scene.background.set(0xdce5ef);
        if (pose === 'back' || pose.startsWith('full-back')) node('hips').rotation.y = Math.PI;
        if (pose === 'wink') vrm.expressionManager.setValue('blinkLeft', 1);
        if (pose === 'ee') vrm.expressionManager.setValue('ee', 1);
        if (pose === 'combined') { vrm.expressionManager.setValue('happy', .7); vrm.expressionManager.setValue('blinkLeft', .8); vrm.expressionManager.setValue('aa', .7); }
        if (pose === 'lean') node('chest').rotation.z = .3;
        if (pose === 'side' || pose.startsWith('full-side')) node('hips').rotation.y = Math.PI / 2;
        if (pose === 'smile') vrm.expressionManager.setValue('happy', .55);
        if (pose === 'blink') { vrm.expressionManager.setValue('blinkLeft', 1); vrm.expressionManager.setValue('blinkRight', 1); }
        if (pose === 'mouth') vrm.expressionManager.setValue('aa', .7);
        if (pose === 'brows') { vrm.expressionManager.setValue('vmodelBrowUpLeft', .7); vrm.expressionManager.setValue('vmodelBrowDownRight', .7); }
        if (pose === 'raised-arms') { node('leftUpperArm').rotation.z = .7; node('rightUpperArm').rotation.z = -.7; }
        if (pose === 'peace' || pose.startsWith('hand-')) {
          const solver = new MotionSolver(vrm), frame = motionSample(3, 1000).frame;
          frame.poseImage = []; const gesture = pose.startsWith('hand-') ? pose.slice(5).replace(/-(left|right)$/, '') : 'peace';
          frame.hands = [gestureHand('left', gesture.startsWith('wrist') ? 'open' : gesture), gestureHand('right', gesture.startsWith('wrist') ? 'open' : gesture)]; frame.face = {}; frame.faceMatrix = null;
          for (let i = 0; i < 90; i++) solver.update(frame, settings, 1 / 60, 1000);
        }
        if (pose.startsWith('hand-wrist-bend')) { node('leftHand').rotation.x += .6; node('rightHand').rotation.x -= .6; }
        if (pose.startsWith('hand-wrist-twist')) { node('leftHand').rotation.y += .7; node('rightHand').rotation.y -= .7; }
        if (pose.startsWith('hand-')) viewer.setDiagnosticFocus(pose.endsWith('left') ? 'leftHand' : 'rightHand');
        if (pose.startsWith('spring-')) {
          viewer.configure({ ...settings, framing: 'bust', springMotion: pose.split('-')[1] });
          vrm.springBoneManager.reset();
          const steps = pose.endsWith('move') ? 35 : 300;
          for (let step = 0; step < steps; step++) {
            const angle = step < 60 ? (step % 20 < 10 ? .6 : -.6) : 0;
            node('head').rotation.y = angle; node('chest').rotation.z = angle * .3;
            node('leftUpperArm').rotation.z = angle * .7; node('rightUpperArm').rotation.z = -angle * .7;
            vrm.update(1 / 60);
          }
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
    const model = await page.evaluate(id => window.eneV2.load(id), id);
    model.controls = await page.evaluate(() => window.eneV2.controls());
    model.gaze = await page.evaluate(() => window.eneV2.gaze());
    model.clearance = await page.evaluate(() => window.eneV2.clearance());
    model.springs = await page.evaluate(() => window.eneV2.springs());
    model.outputSizes = await page.evaluate(() => window.eneV2.outputSizes());
    model.renders = [];
    for (const pose of poses) {
      const render = await page.evaluate(pose => window.eneV2.render(pose), pose);
      const file = `${output}/${id}-${pose}.png`;
      await page.locator('canvas').screenshot({ path: file });
      model.renders.push({ ...render, image: file, imageSha256: hash(await readFile(file)) });
      console.log(`${id}: ${pose}`);
    }
    for (const lighting of ['warm', 'violet']) {
      const render = await page.evaluate(lighting => window.eneV2.render('front', lighting), lighting);
      const file = `${output}/${id}-${lighting}.png`;
      await page.locator('canvas').screenshot({ path: file });
      model.renders.push({ ...render, image: file, imageSha256: hash(await readFile(file)) });
    }
    results.push(model);
  }
  const sourceHashes = {};
  for (const file of ['src/viewer.ts', 'src/lighting.ts', 'src/types.ts', 'src/composition.ts', 'src/face-expressions.ts',
    'src/motion-solver.ts', 'src/profiles.ts', 'src/tracking-recording.ts', 'src/vrm-inspection.ts', 'config/avatars/ene-v2.json', 'scripts/build_ene_v2.py', 'scripts/vrm_asset.py', 'scripts/ene_v2_compare.mjs']) {
    sourceHashes[file] = hash(await readFile(file));
  }
  for (const model of results) {
    assert.equal(model.controls.direct.length, 32);
    for (const control of model.controls.direct) {
      assert(control.rawAngle > .39, control.name); assert(control.maxDisplacement > 1e-5, control.name);
    }
    for (const expression of model.controls.expressions.filter(expression => expression.name !== 'neutral' && expression.bound)) {
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
    assert(model.springs.every(mode => mode.finalStepMaximum < .001));
    for (const test of model.clearance) {
      assert.equal(test.cuffVertices, 106);
      assert(test.fingerVertices > 2000);
      assert(Number.isFinite(test.planeGapMeters));
      if (model.id === 'ene-v2') assert(test.planeGapMeters > .01, `${test.gesture}: ${test.side}`);
    }
    for (const test of model.gaze) for (const angle of test.anglesRadians) {
      assert(model.id === 'ene-v2' ? angle > .09 && angle < .27 : angle < 1e-6);
    }
    for (const size of model.outputSizes) {
      const expected = size.outputResolution === '1080p' ? [1920, 1080] : [1280, 720];
      assert.deepEqual([size.width, size.height], size.orientation === 'portrait' ? expected.reverse() : expected);
    }
  }
  const geometry = [];
  for (const original of results[0].renders) {
    const edited = results[1].renders.find(render => render.pose === original.pose && render.lighting === original.lighting);
    assert.deepEqual(edited.camera, original.camera);
    geometry.push({ pose: original.pose, lighting: original.lighting, sameCamera: true, originalSurfaceSamples: original.surface.length / 3, editedSurfaceSamples: edited.surface.length / 3 });
    delete original.surface; delete edited.surface;
  }
  assert.deepEqual(results[0].springs, results[1].springs);
  for (const id of models) assert.equal(hash(await readFile(`assets/avatars/${id}.vrm`)), hashes[id]);
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  const report = { date: new Date().toISOString(), hashes, sourceHashes, validation, results, geometry, errors, externalRequests,
    limits: ['Fixed synthetic controls and software graphics.', 'No live camera accuracy or target GPU timing measurement.', 'Appearance acceptance remains open.'] };
  await writeFile(`${base}/ene-v2-comparison.json`, JSON.stringify(report, null, 2) + '\n');
  const labels = { back: 'Back', full: 'Full body', 'full-light': 'Full body on a light background', wink: 'Wink', ee: 'Authored ee shape', combined: 'Combined expressions', lean: 'Seated lean', ...Object.fromEntries(poses.filter(pose => /^(hand|spring|full)-(?!light$)/.test(pose)).map(pose => [pose, pose.replaceAll('-', ' ')])), front: 'Front', side: 'Side', smile: 'Smile', blink: 'Blink', mouth: 'Mouth', brows: 'Brow controls', 'raised-arms': 'Raised arms', peace: 'Peace sign', warm: 'Warm light', violet: 'Violet light' };
  const sections = Object.entries(labels).map(([pose, label]) => `<section><h2>${label}</h2><div class="pair">${models.map(id => `<figure><img src="${id}-${pose}.png" alt="${id}: ${label}"><figcaption>${id === 'ene' ? 'Original Ene' : 'Ene v2 candidate'}</figcaption></figure>`).join('')}</div></section>`).join('\n');
  await writeFile(`${output}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ene v2 comparison</title><style>body{margin:24px;background:#161922;color:#eee;font:16px system-ui}h1,h2{font-weight:600}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}img{width:100%}figcaption{padding:8px}section{margin-bottom:28px}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style><h1>Ene v2 comparison</h1><p>Both models use the same camera and light settings. Ene v2 has new face controls and shorter cuffs.</p><p>The tests use software graphics. Physical performance and appearance acceptance remain open.</p>${sections}</html>\n`);
  console.log(JSON.stringify({ hashes, comparisons: geometry.length, directControls: results.map(model => model.controls.direct.length), errors }));
} finally {
  await browser?.close();
  await server.close();
}
