import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import type { VRMSpringBoneJoint } from '@pixiv/three-vrm';
import type { StudioSettings } from './types';
import { Retargeter } from './retarget';
import { AvatarResources } from './avatar-resources';
import type { CapabilityReport } from './model-types';
import { requiredBones } from './vrm-inspection';
import { RigOverlay, trackedBones } from './rig-overlay';

export interface PreparedAvatar { capabilities: CapabilityReport; vrm: VRM; retarget: Retargeter; generation: number; disposed: boolean; committed: boolean }
import { compositionSize, fitComposition } from './composition';

export class AvatarViewer {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(28, 1, 0.05, 30);
  vrm: VRM | null = null;
  private generation = 0;
  private resources = new WeakMap<THREE.Object3D,AvatarResources>();
  private releaseScene(scene:THREE.Object3D){const resources=this.resources.get(scene);if(resources)resources.dispose(scene);else disposeAvatarScene(scene);}
  private center = new THREE.Vector3(0, 0.9, 0);
  private height = 1.7;
  private settings: StudioSettings;
  private observer: ResizeObserver;
  private springs: { joint: VRMSpringBoneJoint; stiffness: number; dragForce: number; gravityPower: number }[] = [];
  private contextLost = false;
  private rigOverlay: RigOverlay | null = null;
  private diagnosticFocus='body';
  setDiagnosticFocus(value:string){this.diagnosticFocus=value;this.resize();}
  setRigVisible(visible:boolean) {
    if(visible&&!this.rigOverlay){this.rigOverlay=new RigOverlay();this.scene.add(this.rigOverlay.lines,this.rigOverlay.points);}
    if(!visible){this.rigOverlay?.dispose();this.rigOverlay=null;}
  }
  constructor(readonly container: HTMLElement, settings: StudioSettings, private outputMode = false) {
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    container.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      if(this.disposed)return;
      event.preventDefault(); this.contextLost = true;
      container.dispatchEvent(new CustomEvent('vmodel-renderer-state', { detail: 'Graphics paused. Waiting for the browser to restore the display.' }));
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      if(this.disposed)return;
      this.contextLost = false; this.resize();
      container.dispatchEvent(new CustomEvent('vmodel-renderer-state', { detail: 'Graphics restored. The avatar is ready again.' }));
    });
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x91a2bf, 2));
    const key = new THREE.DirectionalLight(0xfff4e9, 2.1); key.position.set(1, 2, 3); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x92dcff, 0.7); fill.position.set(-2, 1, -1); this.scene.add(fill);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
    this.configure(settings);
  }
  private disposed = false;
  private ownedCandidates = new WeakSet<PreparedAvatar>();
  private pendingCandidates = new Set<PreparedAvatar>();
  cancelPendingLoad() {
    this.generation++;
    for(const candidate of this.pendingCandidates)this.disposePreparedAvatar(candidate);
  }
  async prepareAvatar(blob: Blob, signal?: AbortSignal): Promise<PreparedAvatar> {
    signal?.throwIfAborted();
    if(this.disposed)throw new Error('Viewer is closed.');
    this.cancelPendingLoad();
    const generation = this.generation;
    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (String.fromCharCode(...header) !== 'glTF') throw new Error('Select a VRM avatar. PMX needs conversion; VMD is animation data.');
    const resources=new AvatarResources();
    const loader = new GLTFLoader(); loader.register(parser => {
      resources.watch(parser);
      const plugin=new VRMLoaderPlugin(parser),afterRoot=plugin.afterRoot.bind(plugin);
      plugin.afterRoot=async result=>{try{await afterRoot(result);}finally{for(const scene of result.scenes)resources.track(scene);}};
      return plugin;
    });
    // Embedded resources only: the selected model must not fetch arbitrary external resources.
    loader.manager.setURLModifier(url => {
      if (/^(blob:|data:)/.test(url)) return url;
      throw new Error('Avatar contains external resources. Export a VRM with embedded textures.');
    });
    try {
    const bytes=await blob.arrayBuffer();signal?.throwIfAborted();
    if(generation!==this.generation)throw new Error('Avatar load superseded.');
    const gltf = await loader.parseAsync(bytes, '');
    resources.track(gltf.scene);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('This file is glTF but has no supported VRM avatar data.');
    resources.track(vrm.scene);this.resources.set(vrm.scene,resources);
    const missing = requiredBones.filter(name => !vrm.humanoid.getNormalizedBoneNode(name));
    if (missing.length) throw new Error(`Avatar is missing required humanoid controls: ${missing.join(', ')}. Choose a bundled avatar or repair its VRM rig.`);
      signal?.throwIfAborted();
      if (generation !== this.generation) throw new Error('Avatar load superseded.');
      VRMUtils.rotateVRM0(vrm);
      if(vrm.lookAt)vrm.lookAt.autoUpdate=false;
      vrm.scene.traverse(obj => { obj.frustumCulled = false; });
      vrm.update(0);
      const bounds = new THREE.Box3().setFromObject(vrm.scene);
      if(bounds.isEmpty()||!Number.isFinite(bounds.max.y-bounds.min.y)||bounds.max.y-bounds.min.y<=0)throw new Error('The model has no visible geometry.');
      const retarget = new Retargeter(vrm);
      const expressions=Object.keys(vrm.expressionManager?.expressionMap??{});
      const aliases:Record<string,string>={};if(!expressions.includes('surprised')&&expressions.includes('びっくり'))aliases.surprised='びっくり';
      const capabilities:CapabilityReport={validationVersion:1,vrmVersion:vrm.meta.metaVersion==='1'?'1':'0',expressions,aliases,missingOptionalBones:(['neck','chest','upperChest','leftToes','rightToes']as const).filter(name=>!vrm.humanoid.getNormalizedBoneNode(name)),springs:!!vrm.springBoneManager,warnings:[]};
      const prepared={ capabilities,vrm, retarget, generation, disposed: false, committed: false };
      this.ownedCandidates.add(prepared);this.pendingCandidates.add(prepared);
      return prepared;
    } catch (error) { resources.dispose(); throw error; }
  }
  disposePreparedAvatar(prepared: PreparedAvatar) {
    if (!this.ownedCandidates.has(prepared) || prepared.disposed || prepared.committed) return;
    prepared.disposed = true;this.pendingCandidates.delete(prepared);this.releaseScene(prepared.vrm.scene);
  }
  commitAvatar(prepared: PreparedAvatar): VRM {
    if(!this.ownedCandidates.has(prepared))throw new Error('This model belongs to another viewer.');
    if (prepared.disposed || prepared.committed || prepared.generation !== this.generation) {
      this.disposePreparedAvatar(prepared); throw new Error('Avatar preparation is no longer current.');
    }
    const vrm = prepared.vrm, old = this.vrm;
    const oldSprings=this.springs,oldCenter=this.center.clone(),oldHeight=this.height;
    try {
      this.vrm=vrm;this.scene.add(vrm.scene);
      this.springs=[...vrm.springBoneManager?.joints??[]].map(joint=>({joint,stiffness:joint.settings.stiffness,dragForce:joint.settings.dragForce,gravityPower:joint.settings.gravityPower}));
      this.configureSprings();
      const bounds=new THREE.Box3().setFromObject(vrm.scene);bounds.getCenter(this.center);this.height=bounds.max.y-bounds.min.y;
      this.resize();prepared.committed=true;this.pendingCandidates.delete(prepared);
    }catch(error){
      this.scene.remove(vrm.scene);this.vrm=old;this.springs=oldSprings;this.center.copy(oldCenter);this.height=oldHeight;
      this.disposePreparedAvatar(prepared);throw error;
    }
    if(old){this.scene.remove(old.scene);this.releaseScene(old.scene);}
    return vrm;
  }
  async load(blob: Blob): Promise<VRM> {
    return this.commitAvatar(await this.prepareAvatar(blob));
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
    this.vrm?.update(Math.min(dt, 0.05));
    if(this.vrm)this.rigOverlay?.update(this.vrm);
    if(this.vrm&&this.diagnosticFocus!=='body'){
      const names=trackedBones.filter(name=>this.diagnosticFocus==='face'?['head','leftEye','rightEye'].includes(name):name.startsWith(this.diagnosticFocus.startsWith('left')?'left':'right')&&/Hand|Thumb|Index|Middle|Ring|Little/.test(name));
      const points=names.flatMap(name=>{const bone=this.vrm!.humanoid.getRawBoneNode(name);return bone?[bone.getWorldPosition(new THREE.Vector3())]:[];});
      if(points.length){
        const bounds=new THREE.Box3().setFromPoints(points),target=bounds.getCenter(new THREE.Vector3());
        const span=Math.max(bounds.getSize(new THREE.Vector3()).length()*1.5,this.diagnosticFocus==='face'?.38:.25);
        const distance=span/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)))*Math.max(1,1/this.camera.aspect);
        this.camera.position.set(target.x,target.y,target.z+distance);this.camera.lookAt(target);
      }
    }
    if (!this.contextLost) this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;
    this.setRigVisible(false);
    this.cancelPendingLoad(); this.observer.disconnect();
    if (this.vrm) { this.scene.remove(this.vrm.scene);this.releaseScene(this.vrm.scene);this.vrm=null; }
    this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();
  }
}

export function disposeAvatarScene(scene:THREE.Object3D){new AvatarResources().dispose(scene);}
