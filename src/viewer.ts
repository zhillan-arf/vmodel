import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import type { VRMSpringBoneJoint } from '@pixiv/three-vrm';
import type { StudioSettings } from './types';
import { compositionSize, fitComposition } from './composition';

export class AvatarViewer {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(28, 1, 0.05, 30);
  vrm: VRM | null = null;
  private generation = 0;
  private center = new THREE.Vector3(0, 0.9, 0);
  private height = 1.7;
  private settings: StudioSettings;
  private observer: ResizeObserver;
  private springs: { joint: VRMSpringBoneJoint; stiffness: number; dragForce: number; gravityPower: number }[] = [];
  private contextLost = false;
  constructor(readonly container: HTMLElement, settings: StudioSettings, private outputMode = false) {
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    container.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.contextLost = true;
      container.dispatchEvent(new CustomEvent('vmodel-renderer-state', { detail: 'Graphics paused. Waiting for the browser to restore the display.' }));
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.contextLost = false; this.resize();
      container.dispatchEvent(new CustomEvent('vmodel-renderer-state', { detail: 'Graphics restored. The avatar is ready again.' }));
    });
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x91a2bf, 2));
    const key = new THREE.DirectionalLight(0xfff4e9, 2.1); key.position.set(1, 2, 3); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x92dcff, 0.7); fill.position.set(-2, 1, -1); this.scene.add(fill);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
    this.configure(settings);
  }
  async load(blob: Blob): Promise<VRM> {
    const generation = ++this.generation;
    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (String.fromCharCode(...header) !== 'glTF') throw new Error('Select a VRM avatar. PMX needs conversion; VMD is animation data.');
    const loader = new GLTFLoader(); loader.register(parser => new VRMLoaderPlugin(parser));
    // Embedded resources only: the selected model must not fetch arbitrary external resources.
    loader.manager.setURLModifier(url => {
      if (/^(blob:|data:)/.test(url)) return url;
      throw new Error('Avatar contains external resources. Export a VRM with embedded textures.');
    });
    const gltf = await loader.parseAsync(await blob.arrayBuffer(), '');
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) { VRMUtils.deepDispose(gltf.scene); throw new Error('This file is glTF but has no supported VRM avatar data.'); }
    const missing = (['hips','spine','head','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot'] as const).filter(name => !vrm.humanoid.getNormalizedBoneNode(name));
    if (missing.length) { VRMUtils.deepDispose(vrm.scene); throw new Error(`Avatar is missing required humanoid controls: ${missing.join(', ')}. Use the prepared Ene avatar or repair its VRM rig.`); }
    if (generation !== this.generation) { VRMUtils.deepDispose(vrm.scene); throw new Error('Avatar load superseded.'); }
    if (this.vrm) { this.scene.remove(this.vrm.scene); VRMUtils.deepDispose(this.vrm.scene); }
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse(obj => { obj.frustumCulled = false; });
    this.vrm = vrm; this.scene.add(vrm.scene); vrm.update(0);
    this.springs = [...vrm.springBoneManager?.joints ?? []].map(joint => ({ joint, stiffness: joint.settings.stiffness, dragForce: joint.settings.dragForce, gravityPower: joint.settings.gravityPower }));
    this.configureSprings();
    const bounds = new THREE.Box3().setFromObject(vrm.scene);
    bounds.getCenter(this.center); this.height = bounds.max.y - bounds.min.y;
    this.resize();
    return vrm;
  }
  configure(settings: StudioSettings) {
    const changed = settings.springMotion !== this.settings.springMotion;
    this.settings = settings;
    if (changed) this.configureSprings();
    this.scene.background = new THREE.Color(settings.background);
    this.renderer.setPixelRatio(1);
    this.resize();
  }
  private configureSprings() {
    const manager = this.vrm?.springBoneManager; if (!manager) return;
    manager.reset();
    for (const original of this.springs) {
      const { joint } = original;
      if (this.settings.springMotion === 'off') { manager.deleteJoint(joint); continue; }
      manager.addJoint(joint);
      const gentle = this.settings.springMotion === 'gentle';
      joint.settings.stiffness = gentle ? Math.max(4, original.stiffness * 4 / 3) : original.stiffness;
      joint.settings.dragForce = gentle ? Math.max(0.85, original.dragForce) : original.dragForce;
      joint.settings.gravityPower = original.gravityPower * (gentle ? 0.5 : 1);
    }
    manager.reset();
  }
  resize() {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight);
    const targetSize = compositionSize(this.settings.orientation), fitted = fitComposition(width, height, this.settings.orientation);
    const ratio = Math.min(devicePixelRatio, this.settings.quality === 'low' ? 1 : 1.5);
    this.renderer.setSize(this.outputMode ? targetSize.width : Math.round(fitted.width * ratio), this.outputMode ? targetSize.height : Math.round(fitted.height * ratio), false);
    Object.assign(this.renderer.domElement.style, { position: 'absolute', width: `${fitted.width}px`, height: `${fitted.height}px`, left: `${fitted.left}px`, top: `${fitted.top}px` });
    this.camera.aspect = targetSize.width / targetSize.height;
    const bust = this.settings.framing === 'bust';
    const target = this.center.clone(); if (bust) target.y += this.height * 0.27;
    const viewHeight = this.height * (bust ? 0.50 : 1.3);
    const distance = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.settings.zoom;
    this.camera.position.set(target.x, target.y, this.center.z + distance * Math.max(1, 0.7 / this.camera.aspect));
    this.camera.lookAt(target); this.camera.updateProjectionMatrix();
  }
  setOutputMode(enabled: boolean) { this.outputMode = enabled; this.resize(); }
  draw(dt: number) {
    this.vrm?.update(Math.min(dt, 0.05)); if (!this.contextLost) this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.generation++; this.observer.disconnect();
    if (this.vrm) VRMUtils.deepDispose(this.vrm.scene);
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
