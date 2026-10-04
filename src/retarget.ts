import { Euler, Matrix4, Object3D, Quaternion, Vector3, MathUtils } from 'three';
import { VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import type { Calibration, Landmark, StudioSettings, TrackingFrame } from './types';
import { validCalibration } from './profiles';
import { associateHands, calibratedHeadWorld, faceRotation, palmWorldRotation, type PalmPoints } from './retarget-math';
import { limitFingerRotation } from './finger-solver';
import { solveLimbWorld } from './limb-solver';

export const confidence = (p?: Landmark) => !!p && Number.isFinite(p.x + p.y + p.z) && (p.visibility ?? 1) > 0.55 && (p.presence ?? 1) > 0.55;
export const point = (p: Landmark) => new Vector3(p.x, -p.y, -p.z);
export const smoothingFactor = (speed: number, dt: number) => 1 - Math.exp(-Math.max(0, speed) * Math.max(0, dt));
export function segmentRotation(rest: Vector3, target: Vector3): Quaternion | null {
  if (rest.lengthSq() < 1e-8 || target.lengthSq() < 1e-8 || !Number.isFinite(target.lengthSq())) return null;
  return new Quaternion().setFromUnitVectors(rest.clone().normalize(), target.clone().normalize());
}
interface Rest { node: Object3D; local: Quaternion; world: Quaternion; direction: Vector3 }
const recent = (timestamp: number, now: number) => Number.isFinite(timestamp) && now - timestamp >= -50 && now - timestamp < 500;
const coefficient = (value: number | undefined) => Number.isFinite(value) ? MathUtils.clamp(value!, 0, 1) : 0;
export class Retargeter {
  private rests = new Map<string, Rest>();
  private idleArms = new Map<string, Quaternion>();
  private neutralHead = new Quaternion();
  private neutralRoot = new Vector3(0.5, -0.5, 0);
  private lastTimestamp = -1;
  private goals = new Map<string, { world: Quaternion; timestamp: number }>();
  private palms = new Map<string, PalmPoints>();
  private fingerAxes = new Map<string, Vector3>();
  private limbPlanes = new Map<string, { normal: Vector3; timestamp: number }>();
  private groundY = 0;
  private expressionGoals: Record<string, number> = {};
  private manual = 'neutral';
  private root: Object3D | null;
  private rootRest = new Vector3();
  constructor(readonly vrm: VRM) {
    vrm.humanoid.resetNormalizedPose(); vrm.scene.updateMatrixWorld(true);
    const childOf: Record<string, string> = { hips:'spine',spine:'chest',chest:'neck',neck:'head',head:'leftEye' };
    for (const side of ['left','right']) {
      Object.assign(childOf, { [side+'Shoulder']:side+'UpperArm', [side+'UpperArm']:side+'LowerArm', [side+'LowerArm']:side+'Hand',
        [side+'Hand']:side+'MiddleProximal', [side+'UpperLeg']:side+'LowerLeg',[side+'LowerLeg']:side+'Foot',[side+'Foot']:side+'Toes' });
      for (const finger of ['Thumb','Index','Middle','Ring','Little']) {
        const segments = finger === 'Thumb' ? ['Metacarpal','Proximal','Distal'] : ['Proximal','Intermediate','Distal'];
        segments.forEach((segment,i) => childOf[side+finger+segment] = side+finger+(segments[i+1] ?? segments[i]));
      }
    }
    for (const [name, childName] of Object.entries(childOf)) {
      const node = vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName);
      const child = vrm.humanoid.getNormalizedBoneNode(childName as VRMHumanBoneName);
      if (!node) continue;
      let direction = child ? child.getWorldPosition(new Vector3()).sub(node.getWorldPosition(new Vector3())) : new Vector3(0,1,0);
      if (direction.lengthSq() < 1e-8) direction = node.getWorldPosition(new Vector3()).sub(node.parent?.getWorldPosition(new Vector3()) ?? new Vector3());
      this.rests.set(name,{ node,local:node.quaternion.clone(),world:node.getWorldQuaternion(new Quaternion()),direction });
    }
    const depth = (node: Object3D): number => node.parent ? 1 + depth(node.parent) : 0;
    this.rests = new Map([...this.rests].sort(([, a], [, b]) => depth(a.node) - depth(b.node)));
    for (const name of ['leftUpperArm', 'rightUpperArm']) {
      const rest = this.rests.get(name); if (!rest) continue;
      // VRM0 and VRM1 can face opposite directions before normalization. Derive
      // the relaxed pose from this rig instead of assuming Ene's local Z signs.
      const lateral = rest.direction.clone().setY(0).normalize();
      const target = lateral.multiplyScalar(Math.cos(1.15)).add(new Vector3(0, -Math.sin(1.15), 0));
      const rotation = segmentRotation(rest.direction, target); if (!rotation) continue;
      this.idleArms.set(name, rest.local.clone().multiply(rest.world.clone().invert().multiply(rotation).multiply(rest.world)));
    }
    for (const side of ['left', 'right']) {
      const palm: Partial<PalmPoints> = {};
      for (const [key, bone] of [['wrist','Hand'], ['middle','MiddleProximal'], ['index','IndexProximal'], ['little','LittleProximal']] as const) {
        const node = vrm.humanoid.getNormalizedBoneNode((side + bone) as VRMHumanBoneName);
        if (node) palm[key] = node.getWorldPosition(new Vector3());
      }
      if (palm.wrist && palm.middle && palm.index && palm.little) {
        this.palms.set(side, palm as PalmPoints);
        const along = palm.middle.clone().sub(palm.wrist).normalize();
        const closing = palm.index.clone().sub(palm.little).cross(along).normalize().multiplyScalar(side === 'left' ? -1 : 1);
        for (const [name, rest] of this.rests) if (name.startsWith(side) && /Index|Middle|Ring|Little/.test(name)) {
          const axis = rest.direction.clone().normalize().cross(closing).normalize().applyQuaternion(rest.world.clone().invert());
          if (axis.lengthSq() > .5) this.fingerAxes.set(name, axis);
        }
      }
    }
    this.root = vrm.humanoid.getNormalizedBoneNode('hips');
    if (this.root) this.rootRest.copy(this.root.position);
    const feet = ['leftFoot','rightFoot','leftToes','rightToes'].map(name => vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName)).filter((node): node is Object3D => !!node);
    if (feet.length) this.groundY = Math.min(...feet.map(node => node.getWorldPosition(new Vector3()).y));
  }
  calibrate(frame: TrackingFrame | null) {
    const head = faceRotation(frame?.faceMatrix ?? null);
    if (head) this.neutralHead.copy(head);
    if (confidence(frame?.poseImage[23]) && confidence(frame?.poseImage[24])) this.neutralRoot.copy(point(frame!.poseImage[23])).add(point(frame!.poseImage[24])).multiplyScalar(0.5);
    this.lastTimestamp = -1; this.goals.clear(); this.limbPlanes.clear();
  }
  getCalibration(): Calibration { return { version: 1, head: this.neutralHead.toArray(), root: this.neutralRoot.toArray() }; }
  setCalibration(value: Calibration | null) {
    if (validCalibration(value)) { this.neutralHead.fromArray(value.head); this.neutralRoot.fromArray(value.root); }
    else { this.neutralHead.identity(); this.neutralRoot.set(0.5, -0.5, 0); }
    this.lastTimestamp = -1; this.goals.clear(); this.limbPlanes.clear();
  }
  setExpression(name: string) { this.manual = ['neutral','happy','surprised'].includes(name) ? name : 'neutral'; }
  private setGoal(name: string, world: Quaternion, timestamp: number) {
    if (world.toArray().every(Number.isFinite) && world.lengthSq() > 1e-8) this.goals.set(name, { world: world.normalize(), timestamp });
  }
  private aim(name: string, timestamp: number, a?: Landmark, b?: Landmark, referenceDelta?: Quaternion) {
    const rest = this.rests.get(name);
    if (!rest || !confidence(a) || !confidence(b)) return;
    const direction = rest.direction.clone();
    const reference = rest.world.clone();
    if (referenceDelta) { direction.applyQuaternion(referenceDelta); reference.premultiply(referenceDelta); }
    const delta = segmentRotation(direction, point(b!).sub(point(a!)));
    if (!delta) return;
    const world = delta.multiply(reference);
    this.setGoal(name, world, timestamp);
  }
  private limb(side: string, kind: 'Arm' | 'Leg', timestamp: number, a?: Landmark, b?: Landmark, c?: Landmark, pelvis?: Quaternion) {
    if (!confidence(a) || !confidence(b) || !confidence(c)) return;
    const upper = this.rests.get(side+'Upper'+kind), lower = this.rests.get(side+'Lower'+kind);
    if (!upper || !lower) return;
    const name = side+kind, previous = this.limbPlanes.get(name);
    const normal = kind === 'Arm' ? upper.direction.clone().cross(new Vector3(0,0,1)).normalize() : new Vector3(1,0,0);
    const history = previous && recent(previous.timestamp,timestamp) ? previous.normal : undefined;
    const solution = solveLimbWorld(point(a!), point(b!), point(c!), {
      upperDirection: upper.direction, lowerDirection: lower.direction, upperWorld: upper.world, lowerWorld: lower.world, bendNormal: normal,
    }, { previousNormal: history ?? (kind === 'Leg' && pelvis ? normal.clone().applyQuaternion(pelvis) : undefined) });
    if (!solution) return;
    this.setGoal(side+'Upper'+kind,solution.upperWorld,timestamp);
    this.setGoal(side+'Lower'+kind,solution.lowerWorld,timestamp);
    // Do not seed persistent continuity from an arbitrary first straight pose.
    if (solution.flexion > MathUtils.degToRad(6) || history) this.limbPlanes.set(name,{normal:solution.planeNormal,timestamp});
  }
  private body(frame: TrackingFrame, settings: StudioSettings, now: number) {
    const poseTime = frame.samples.pose.timestamp;
    const p = frame.samples.pose.present && recent(poseTime, now) ? frame.pose : [];
    let pelvis: Quaternion | undefined;
    if (confidence(p[11]) && confidence(p[12]) && confidence(p[23]) && confidence(p[24])) {
      const up = point(p[11]).add(point(p[12])).sub(point(p[23])).sub(point(p[24])).normalize();
      const left = point(p[11]).sub(point(p[12])).normalize();
      const forward = new Vector3().crossVectors(left,up).normalize(); left.crossVectors(up,forward).normalize();
      if (forward.lengthSq() > 0.5) {
        const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(left,up,forward));
        const e = new Euler().setFromQuaternion(q, 'YXZ');
        e.x=MathUtils.clamp(e.x,-0.45,0.45);e.y=MathUtils.clamp(e.y,-0.8,0.8);e.z=MathUtils.clamp(e.z,-0.5,0.5);
        const rest = this.rests.get('spine');
        if (rest) this.setGoal('spine',new Quaternion().setFromEuler(e).multiply(rest.world), poseTime);
        if (settings.mode === 'standing') {
          const hipLine = point(p[23]).sub(point(p[24])).normalize();
          const hipYaw = MathUtils.clamp(Math.atan2(-hipLine.z,hipLine.x),-.8,.8);
          const hipRoll = MathUtils.clamp(Math.asin(MathUtils.clamp(hipLine.y,-1,1)),-.25,.25);
          pelvis = new Quaternion().setFromEuler(new Euler(0,hipYaw,hipRoll,'YXZ'));
          const hips = this.rests.get('hips'); if (hips) this.setGoal('hips',pelvis.clone().multiply(hips.world),poseTime);
        }
      }
    }
    for (const [side,s,e,w,h,k,a,t] of [['left',11,13,15,23,25,27,31],['right',12,14,16,24,26,28,32]] as const) {
      this.limb(side,'Arm',poseTime,p[s],p[e],p[w]);
      // Pose's wrist-to-index direction supplies a fallback when detailed hands disappear.
      this.aim(side+'Hand',poseTime,p[w],p[side === 'left' ? 19 : 20]);
      if (settings.mode==='standing') { this.limb(side,'Leg',poseTime,p[h],p[k],p[a],pelvis);this.aim(side+'Foot',poseTime,p[a],p[t]); }
    }
    if (settings.hands && frame.samples.hands.present && recent(frame.samples.hands.timestamp, now)) for (const [side, hand] of Object.entries(associateHands(frame.hands, p.length ? frame.poseImage : [], { imageAspect: frame.inputSize ? frame.inputSize.width / frame.inputSize.height : 1 }))) {
      if (hand.world.length !== 21) continue;
      const rest = this.rests.get(side+'Hand'), palm = this.palms.get(side);
      const rotation = rest && palm && palmWorldRotation(palm, { wrist: point(hand.world[0]), middle: point(hand.world[9]), index: point(hand.world[5]), little: point(hand.world[17]) }, rest.world);
      if (!rotation) continue;
      this.setGoal(side+'Hand', rotation, frame.samples.hands.timestamp);
      const palmDelta = rotation.clone().multiply(rest!.world.clone().invert());
      for (const [finger,start] of [['Thumb',1],['Index',5],['Middle',9],['Ring',13],['Little',17]] as const) {
        const segments = finger === 'Thumb' ? ['Metacarpal','Proximal','Distal'] : ['Proximal','Intermediate','Distal'];
        segments.forEach((part,i) => this.aim(side+finger+part,frame.samples.hands.timestamp,hand.world[start+i],hand.world[start+i+1],palmDelta));
      }
    }
  }
  update(frame: TrackingFrame | null, settings: StudioSettings, dt: number, now: number) {
    const fresh = frame !== null && frame.version === 1 && recent(frame.timestamp, now);
    const faceFresh = fresh && frame.samples.face.present && recent(frame.samples.face.timestamp, now);
    if (fresh && frame.timestamp !== this.lastTimestamp) {
      this.lastTimestamp = frame.timestamp; this.goals.clear(); this.expressionGoals = {};
      this.body(frame,settings,now);
      const face = faceFresh ? faceRotation(frame.faceMatrix) : null;
      if (face) {
        const rest = this.rests.get('head');
        const head = rest && calibratedHeadWorld(face, this.neutralHead, rest.world, { x: .65*settings.headRange, y: 1.1*settings.headRange, z: .5*settings.headRange });
        if (head) {
          this.setGoal('head',head,frame.samples.face.timestamp);
          const neck = this.rests.get('neck'), spine = this.rests.get('spine'), torso = this.goals.get('spine');
          if (neck) {
            const torsoDelta = torso && spine ? torso.world.clone().multiply(spine.world.clone().invert()) : new Quaternion();
            const headDelta = head.clone().multiply(rest!.world.clone().invert());
            this.setGoal('neck',torsoDelta.slerp(headDelta,.25).multiply(neck.world),frame.samples.face.timestamp);
          }
        }
      }
      if (faceFresh) this.expressionGoals = { blinkLeft:coefficient(frame.face.eyeBlinkLeft),blinkRight:coefficient(frame.face.eyeBlinkRight),
        aa:Math.min(coefficient(frame.face.jawOpen)*settings.mouthGain,1),happy:Math.min(coefficient(frame.face.mouthSmileLeft),coefficient(frame.face.mouthSmileRight))*0.55 };
    }
    const alpha = smoothingFactor(settings.smoothing,dt);
    // Snapshot before moving any parent. Smooth in world space, then convert through
    // the updated parent so torso motion is not added a second time to tracked limbs.
    this.vrm.scene.updateMatrixWorld(true);
    const currentWorlds = new Map([...this.rests].map(([name,rest]) => [name,rest.node.getWorldQuaternion(new Quaternion())]));
    for (const [name,rest] of this.rests) {
      const measured = fresh ? this.goals.get(name) : undefined;
      const parent = rest.node.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
      let goal = measured && recent(measured.timestamp,now) ? measured.world : undefined;
      if (!goal) {
        goal = (this.idleArms.get(name) ?? rest.local).clone();
        goal.premultiply(parent);
      }
      rest.node.quaternion.copy(parent.invert().multiply(currentWorlds.get(name)!.slerp(goal,alpha))).normalize();
      const fingerAxis = this.fingerAxes.get(name);
      if (fingerAxis) {
        const delta = rest.local.clone().invert().multiply(rest.node.quaternion);
        const limited = limitFingerRotation(delta, fingerAxis, name.endsWith('Proximal') ? 'proximal' : name.endsWith('Intermediate') ? 'intermediate' : 'distal');
        rest.node.quaternion.copy(rest.local).multiply(limited);
      } else if (name.includes('Thumb')) {
        // Thumb opposition uses multiple axes; bound the total excursion separately.
        const delta = rest.local.clone().invert().multiply(rest.node.quaternion);
        const limit = name.endsWith('Metacarpal') ? 1.0 : 1.55;
        const angle = new Quaternion().angleTo(delta);
        if (angle > limit) rest.node.quaternion.copy(rest.local).multiply(new Quaternion().slerp(delta, limit / angle));
      }
      rest.node.updateWorldMatrix(false,false);
    }
    if (this.root) {
      const target = this.rootRest.clone();
      if (fresh && frame.samples.pose.present && recent(frame.samples.pose.timestamp,now) && settings.mode==='standing' && confidence(frame.poseImage[23]) && confidence(frame.poseImage[24])) {
        const center=point(frame.poseImage[23]).add(point(frame.poseImage[24])).multiplyScalar(0.5);
        target.x+=MathUtils.clamp((center.x-this.neutralRoot.x)*0.5,-0.2,0.2);
        target.y+=MathUtils.clamp((center.y-this.neutralRoot.y)*0.3,-0.12,0.12);
        const inFrame = (p: Landmark | undefined) => confidence(p) && p!.x >= 0 && p!.x <= 1 && p!.y >= 0 && p!.y <= 1;
        if ([27,28].every(index => inFrame(frame.poseImage[index]))) {
          const feet = ['leftFoot','rightFoot','leftToes','rightToes'].map(name => this.vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName)).filter((node): node is Object3D => !!node);
          if (feet.length) {
            const lowest = Math.min(...feet.map(node => node.getWorldPosition(new Vector3()).y));
            const scale = this.root.parent?.getWorldScale(new Vector3()).y ?? 1;
            if (Math.abs(scale) > 1e-5) target.y = this.rootRest.y + MathUtils.clamp(this.root.position.y-this.rootRest.y + (this.groundY-lowest)/scale,-.35,.12);
          }
        }
      }
      this.root.position.lerp(target,alpha);
    }
    for (const name of ['blinkLeft','blinkRight','aa','happy','surprised']) {
      const manual = this.manual === name ? 0.75 : 0;
      const target = Math.max(manual,faceFresh ? this.expressionGoals[name] ?? 0 : 0);
      const manager = this.vrm.expressionManager;
      // Rei supplies the surprise morph as a custom Japanese expression.
      const expression = name === 'surprised' && !manager?.getExpression(name) && manager?.getExpression('びっくり') ? 'びっくり' : name;
      const current = manager?.getValue(expression) ?? 0;
      manager?.setValue(expression,MathUtils.lerp(current,MathUtils.clamp(target,0,1),alpha));
    }
  }
}
