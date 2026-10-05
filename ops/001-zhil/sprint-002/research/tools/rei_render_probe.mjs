import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const output = 'ops/001-zhil/sprint-002/research/rei-vrchat-local';
await mkdir(output, { recursive: true });
const before = createHash('sha256').update(await readFile('assets/avatars/rei.vrm')).digest('hex');
const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0] + 'tests/browser-host.html');
  const inventory = await page.evaluate(async () => {
    const { AvatarViewer } = await import('/src/viewer.ts');
    const { defaults } = await import('/src/types.ts');
    document.body.style.cssText = 'margin:0;background:#252936;overflow:hidden';
    const container = document.createElement('div');
    container.style.cssText = 'position:relative;width:1920px;height:1080px';
    document.body.append(container);
    const viewer = new AvatarViewer(container, { ...defaults, framing: 'bust', orientation: 'landscape', springMotion: 'off' }, true);
    const sourceBlob = await (await fetch('/avatars/rei.vrm')).blob();
    const prepared = await viewer.prepareAvatar(sourceBlob);
    viewer.commitAvatar(prepared);
    let vrm = viewer.vrm;
    const pose = () => {
      vrm.humanoid.getNormalizedBoneNode('leftUpperArm').rotation.z = 1.15;
      vrm.humanoid.getNormalizedBoneNode('rightUpperArm').rotation.z = -1.15;
    };
    pose();
    viewer.draw(0);
    const stockCamera = viewer.camera.position.clone();
    const lights = viewer.scene.children.filter(o => o.isLight);
    const stockLights = lights.map(light => ({ light, color: light.color.clone(), intensity: light.intensity,
      ground: light.groundColor?.clone() }));
    const vector = (x = 0, y = 0, z = 0) => viewer.camera.position.clone().set(x, y, z);
    const head = vrm.humanoid.getRawBoneNode('head').getWorldPosition(vector());
    const target = head.clone().add(vector(0, .04, .02));
    const snapshots = [];
    window.reiProbe = {
      viewer,
      async addOutlines() {
        const bytes = new Uint8Array(await sourceBlob.arrayBuffer());
        const oldLength = new DataView(bytes.buffer).getUint32(12, true);
        const document = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + oldLength)));
        for (const material of document.extensions.VRM.materialProperties) {
          material.floatProperties._OutlineWidthMode = 1;
          material.floatProperties._OutlineWidth = .12;
        }
        const json = new TextEncoder().encode(JSON.stringify(document));
        const padded = Math.ceil(json.length / 4) * 4;
        const binary = bytes.slice(20 + oldLength);
        const result = new Uint8Array(20 + padded + binary.length);
        result.set(bytes.slice(0, 20));
        const header = new DataView(result.buffer);
        header.setUint32(8, result.length, true); header.setUint32(12, padded, true);
        result.fill(32, 20, 20 + padded); result.set(json, 20); result.set(binary, 20 + padded);
        const candidate = await viewer.prepareAvatar(new Blob([result]));
        viewer.commitAvatar(candidate); vrm = viewer.vrm; pose();
      },
      render(preset) {
        for (const entry of stockLights) {
          entry.light.color.copy(entry.color); entry.light.intensity = entry.intensity;
          if (entry.ground) entry.light.groundColor.copy(entry.ground);
        }
        vrm.expressionManager.resetValues();
        viewer.scene.background.set(0x252936);
        viewer.camera.fov = preset === 'studio' ? 28 : 42;
        viewer.camera.position.copy(preset === 'studio' ? stockCamera : target.clone().add(vector(0, .015, .43)));
        if (preset === 'studio') viewer.resize();
        else viewer.camera.lookAt(target);
        if (preset !== 'studio') viewer.renderer.setSize(1920, 1080, false);
        viewer.camera.updateProjectionMatrix();
        if (preset === 'warm' || preset === 'outline') {
          lights[0].color.set(0xf5d6a5); lights[0].groundColor.set(0x543722); lights[0].intensity = .85;
          lights[1].color.set(0xffdb9e); lights[1].intensity = 1.1;
          lights[2].color.set(0xe2a76d); lights[2].intensity = .15;
          viewer.scene.background.set(0x342117);
        }
        if (preset === 'violet') {
          lights[0].color.set(0xfc9de8); lights[0].groundColor.set(0x6940af); lights[0].intensity = 1;
          lights[1].color.set(0xf2a1ed); lights[1].intensity = 1;
          lights[2].color.set(0x9b72fa); lights[2].intensity = .4;
          viewer.scene.background.set(0x3d245c);
        }
        if (preset === 'expression') {
          vrm.expressionManager.setValue('happy', .35);
          vrm.expressionManager.setValue('blinkLeft', .9);
        }
        viewer.draw(0);
        const record = { preset, width: viewer.renderer.domElement.width, height: viewer.renderer.domElement.height,
          drawCalls: viewer.renderer.info.render.calls, triangles: viewer.renderer.info.render.triangles,
          cameraFov: viewer.camera.fov, cameraPosition: viewer.camera.position.toArray(),
          lights: lights.map(o => ({ color: o.color.getHexString(), intensity: o.intensity })) };
        snapshots.push(record);
        return record;
      },
      snapshots,
    };
    const expressions = [];
    for (const name of ['aa', 'ih', 'ou', 'ee', 'oh', 'blinkLeft', 'blinkRight', 'happy', 'angry', 'sad', 'びっくり']) {
      vrm.expressionManager.resetValues(); vrm.update(0);
      const neutral = [];
      vrm.scene.traverse(o => { if (o.morphTargetInfluences) neutral.push(...o.morphTargetInfluences); });
      vrm.expressionManager.setValue(name, 1); vrm.update(0);
      const active = [];
      vrm.scene.traverse(o => { if (o.morphTargetInfluences) active.push(...o.morphTargetInfluences); });
      expressions.push({ name, exists: !!vrm.expressionManager.getExpression(name),
        changedMorphWeights: active.filter((value, index) => Math.abs(value - neutral[index]) > 1e-5).length });
    }
    vrm.expressionManager.resetValues();
    const gl = viewer.renderer.getContext();
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { capabilities: prepared.capabilities, head: head.toArray(), expressions,
      activeSpringJoints: vrm.springBoneManager?.joints.size,
      springMode: 'off',
      graphics: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  const renders = [];
  for (const preset of ['studio', 'close', 'warm', 'violet', 'expression']) {
    renders.push(await page.evaluate(preset => window.reiProbe.render(preset), preset));
    await page.locator('canvas').screenshot({ path: `${output}/rei-${preset}.png` });
  }
  await page.evaluate(() => window.reiProbe.addOutlines());
  renders.push(await page.evaluate(() => window.reiProbe.render('outline')));
  await page.locator('canvas').screenshot({ path: `${output}/rei-outline.png` });
  assert.deepEqual(errors, []);
  assert(inventory.expressions.every(e => e.exists && e.changedMorphWeights > 0));
  const after = createHash('sha256').update(await readFile('assets/avatars/rei.vrm')).digest('hex');
  assert.equal(after, before);
  const report = { date: '2026-10-05', modelSha256: before, modelUnchanged: true, inventory, renders, errors,
    limits: 'Static render and expression tests. No webcam or target GPU measurement.' };
  await writeFile(`${output}/render-probe.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
