import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const base = 'ops/001-zhil/sprint-002';
const names = ['ene_body.json', 'human_body.json', 'human_hand.json'];
const traces = await Promise.all(names.map(async name => ({ name, trace: JSON.parse(await readFile(`${base}/research/trace/${name}`, 'utf8')) })));
const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0] + 'tests/browser-host.html');
  const result = await page.evaluate(async traces => {
    const { MotionSolver } = await import('/src/motion-solver.ts');
    const { AvatarViewer } = await import('/src/viewer.ts');
    const { createCanonicalRig } = await import('/src/canonical-rig.ts');
    const { importTrace, replayTrace } = await import('/src/tracking-recording.ts');
    const { defaults } = await import('/src/types.ts');
    const { Quaternion, Vector3 } = await import('/node_modules/three/build/three.module.js');
    const { trackedBones } = await import('/src/rig-overlay.ts');
    const fingerNames = trackedBones.filter(name => /Thumb|Index|Middle|Ring|Little/.test(name));
    const models = [], screenshots = [];
    for (const id of ['canonical', 'ene', 'rei']) {
      let viewer;
      const container = document.createElement('div');
      container.style.cssText = 'position:relative;width:1000px;height:800px';
      document.body.append(container);
      if (id !== 'canonical') {
        viewer = new AvatarViewer(container, { ...defaults, framing: 'bust', springMotion: 'off' });
        viewer.commitAvatar(await viewer.prepareAvatar(await (await fetch('/avatars/' + id + '.vrm')).blob()));
      }
      const rig = viewer?.vrm ?? createCanonicalRig();
      const node = name => rig.humanoid.getNormalizedBoneNode(name);
      const update = () => { rig.update?.(0); rig.scene.updateMatrixWorld(true); rig.scene.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.skeleton.update(); }); };
      const direct = [];
      if (viewer) {
        const referenceSolver = new MotionSolver(rig);
        for (const name of ['spine', 'chest', ...fingerNames]) {
          rig.humanoid.resetNormalizedPose(); update();
          const raw = rig.humanoid.getRawBoneNode(name);
          const samples = [];
          rig.scene.traverse(mesh => {
            if (!mesh.isSkinnedMesh) return;
            const index = mesh.geometry.attributes.skinIndex, weight = mesh.geometry.attributes.skinWeight;
            if (!index || !weight) return;
            const affected = new Set();
            mesh.skeleton.bones.forEach((bone, i) => { for (let p = bone; p; p = p.parent) if (p === raw) { affected.add(i); break; } });
            let count = 0;
            for (let v = 0; v < index.count && count < 32; v++) {
              if (![0, 1, 2, 3].some(j => affected.has(index.getComponent(v, j)) && weight.getComponent(v, j) > .01)) continue;
              samples.push({ mesh, v, before: mesh.getVertexPosition(v, new Vector3()).applyMatrix4(mesh.matrixWorld) }); count++;
            }
          });
          const rawBefore = raw.quaternion.clone();
          const axis = referenceSolver.fingerAxes.get(name) ?? new Vector3(0, 0, name.startsWith('left') ? -1 : 1);
          node(name).quaternion.multiply(new Quaternion().setFromAxisAngle(axis, .4)); update();
          direct.push({ name, raw_angle_rad: rawBefore.angleTo(raw.quaternion), surface_samples: samples.length,
            max_surface_displacement_m: Math.max(0, ...samples.map(s => s.before.distanceTo(s.mesh.getVertexPosition(s.v, new Vector3()).applyMatrix4(s.mesh.matrixWorld)))) });
        }
      }
      const replays = [];
      for (const input of traces) {
        const trace = await importTrace(new Blob([JSON.stringify(input.trace)], { type: 'application/json' }));
        for (const variant of ['current', 'hand_xyz_only']) {
          let solver, settings;
          const counts = {}, steps = {}, last = new Map(), spineAngles = [];
          const set = new Set();
          let maxAccepted = -1, bestEvent = null, applyIndex = -1, currentAccepted = 0;
          const transform = frame => variant === 'current' ? frame : { ...frame, hands: frame.hands.map(hand => ({ ...hand, world: hand.world.map(({ x, y, z }) => ({ x, y, z })) })) };
          const target = {
            reset() { solver = new MotionSolver(rig); solver.diagnosticSink = r => {
              const key = [r.stage, r.channel, r.reason].join('|'); counts[key] = (counts[key] ?? 0) + 1;
              if (r.stage === 'solver' && r.reason === 'accepted' && fingerNames.includes(r.channel)) { set.add(r.channel); currentAccepted++; }
            }; },
            settings(value) { settings = value; }, calibration(value) { solver.setCalibration(value); }, sample() {},
            apply(frame, dt, now, diagnostics) {
              applyIndex++; currentAccepted = 0;
              solver.sampleIds = Object.fromEntries(Object.entries(diagnostics.tasks).map(([key, value]) => [key, value.sampleSequence]));
              solver.update(transform(frame), settings, dt, now); update();
              spineAngles.push(new Quaternion().angleTo(node('spine').quaternion));
              for (const name of ['leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm']) {
                const q = node(name).getWorldQuaternion(new Quaternion());
                if (last.has(name)) (steps[name] ??= []).push(last.get(name).angleTo(q)); last.set(name, q);
              }
              if (currentAccepted > maxAccepted) { maxAccepted = currentAccepted; bestEvent = { applyIndex, frameSequence: frame.sequence, now }; }
            },
          };
          replayTrace(trace, target);
          const summary = values => { values.sort((a, b) => a - b); return { p95: values[Math.ceil(values.length * .95) - 1], max: values.at(-1) }; };
          replays.push({ trace: input.name, variant, counts, accepted_finger_bones: [...set], max_spine_angle_rad: Math.max(...spineAngles), arm_step_rad: Object.fromEntries(Object.entries(steps).map(([key, values]) => [key, summary(values)])), bestEvent });
        }
      }
      if (viewer && id === 'ene') {
        const input = traces.find(item => item.name === 'human_hand.json');
        const trace = await importTrace(new Blob([JSON.stringify(input.trace)]));
        const best = replays.find(r => r.trace === input.name && r.variant === 'hand_xyz_only').bestEvent;
        const through = trace.events.find(e => e.kind === 'apply' && e.solverTimeMs >= best.now + 300)?.sequence ?? trace.events.length - 1;
        for (const variant of ['current', 'hand_xyz_only']) {
          let solver, settings;
          replayTrace(trace, { reset() { solver = new MotionSolver(rig); }, settings(v) { settings = v; }, calibration(v) { solver.setCalibration(v); }, sample() {},
            apply(frame, dt, now) {
              if (variant === 'hand_xyz_only') frame = { ...frame, hands: frame.hands.map(hand => ({ ...hand, world: hand.world.map(({ x, y, z }) => ({ x, y, z })) })) };
              solver.update(frame, settings, dt, now); update();
            } }, through);
          viewer.setDiagnosticFocus('leftHand'); viewer.draw(0);
          screenshots.push({ name: `ene-implementation-${variant}.png`, event_sequence: through, data: viewer.renderer.domElement.toDataURL('image/png') });
        }
      }
      models.push({ id, mapped_bones: trackedBones.filter(name => node(name)), direct, replays });
      viewer?.dispose(); container.remove();
    }
    return { models, screenshots };
  }, traces);
  await mkdir(`${base}/reports/local`, { recursive: true });
  const screenshots = [];
  for (const capture of result.screenshots) {
    await writeFile(`${base}/reports/local/${capture.name}`, Buffer.from(capture.data.split(',')[1], 'base64'));
    screenshots.push({ name: capture.name, event_sequence: capture.event_sequence });
  }
  const hashes = {};
  for (const id of ['ene', 'rei']) hashes[id] = createHash('sha256').update(await readFile(`assets/avatars/${id}.vrm`)).digest('hex');
  const report = { source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), model_hashes: hashes, errors, screenshots, models: result.models };
  await writeFile(`${base}/reports/implementation-replay.json`, JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(errors, []);
  for (const model of result.models) {
    for (const direct of model.direct) { assert(direct.raw_angle_rad > .39); assert(direct.max_surface_displacement_m > 1e-5); }
    for (const replay of model.replays) {
      assert(replay.max_spine_angle_rad > .001);
      assert.equal(replay.accepted_finger_bones.length, replay.trace === 'ene_body.json' ? 15 : 30);
    }
    console.log(model.id, model.direct.length, model.replays.map(r => [r.trace, r.variant, r.accepted_finger_bones.length]));
  }
} finally { await browser?.close(); await server.close(); }
