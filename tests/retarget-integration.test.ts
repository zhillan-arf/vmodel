import { describe, expect, it } from 'vitest';
import { Euler, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { Retargeter } from '../src/retarget';
import { defaults, type TrackingFrame } from '../src/types';

function rig() {
  const scene = new Object3D(), nodes = new Map<string, Object3D>(), values = new Map<string, number>();
  const add = (name: string, parent: string | null, position: number[]) => {
    const bone = new Object3D(); bone.position.fromArray(position);
    (parent ? nodes.get(parent)! : scene).add(bone); nodes.set(name, bone);
  };
  add('hips', null, [0, 1, 0]); add('spine', 'hips', [0, .2, 0]); add('chest', 'spine', [0, .15, 0]);
  add('neck', 'chest', [0, .1, 0]); add('head', 'neck', [0, .1, 0]); add('leftEye', 'head', [.03, .05, .05]);
  for (const [side, sign] of [['left', 1], ['right', -1]] as const) {
    add(side+'Shoulder', 'chest', [sign*.1, .05, 0]); add(side+'UpperArm', side+'Shoulder', [sign*.1, 0, 0]);
    add(side+'LowerArm', side+'UpperArm', [sign*.3, 0, 0]); add(side+'Hand', side+'LowerArm', [sign*.25, 0, 0]);
    add(side+'UpperLeg', 'hips', [sign*.1, -.05, 0]); add(side+'LowerLeg', side+'UpperLeg', [0, -.4, 0]);
    add(side+'Foot', side+'LowerLeg', [0, -.4, 0]); add(side+'Toes', side+'Foot', [0, 0, .1]);
  }
  scene.updateMatrixWorld(true);
  const vrm = { scene, humanoid: { resetNormalizedPose() {}, getNormalizedBoneNode: (name: string) => nodes.get(name) ?? null },
    expressionManager: { getValue: (name: string) => values.get(name) ?? 0, setValue: (name: string, value: number) => values.set(name, value) } } as unknown as VRM;
  return { solver: new Retargeter(vrm), scene, nodes, values };
}
function frame(yaw = 0, now = 1000): TrackingFrame {
  const q = new Quaternion().setFromEuler(new Euler(0, yaw, 0));
  const pose = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  for (const [index, x, y] of [[11,.2,.5],[12,-.2,.5],[23,.1,0],[24,-.1,0],[13,.5,.5],[14,-.5,.5],[15,.75,.5],[16,-.75,.5]]) {
    const p = new Vector3(x, y, 0).applyQuaternion(q); pose[index] = { x: p.x, y: -p.y, z: -p.z, visibility: 1 };
  }
  return { version: 1, sequence: 1, timestamp: now, face: {}, faceMatrix: new Matrix4().makeRotationFromQuaternion(q).toArray(), pose, poseImage: [], hands: [], inferenceMs: 1,
    samples: { face: { timestamp: now, present: true, inferenceMs: 1 }, pose: { timestamp: now, present: true, inferenceMs: 1 }, hands: { timestamp: now, present: false, inferenceMs: 1 } } };
}
function settle(solver: Retargeter, data: TrackingFrame, seconds = 1) {
  for (let i = 0; i < seconds*60; i++) solver.update(data, defaults, 1/60, data.timestamp + i*3);
}

describe('retargeting a normalized bone hierarchy', () => {
  it('does not add a torso turn a second time to the tracked head', () => {
    const { solver, nodes } = rig(); const data = frame(.4);
    for (let i = 0; i < 60; i++) {
      solver.update(data, defaults, 1/60, 1000+i*3);
      const yaw = new Euler().setFromQuaternion(nodes.get('head')!.getWorldQuaternion(new Quaternion()), 'YXZ').y;
      expect(yaw).toBeGreaterThanOrEqual(-1e-6); expect(yaw).toBeLessThanOrEqual(.400001);
    }
    expect(new Euler().setFromQuaternion(nodes.get('head')!.getWorldQuaternion(new Quaternion()), 'YXZ').y).toBeCloseTo(.4, 4);
  });
  it('solves both arm segments against their updated ancestors without changing bone lengths', () => {
    const { solver, nodes } = rig(); const initial = new Map([...nodes].map(([name, bone]) => [name, bone.position.clone()]));
    const data = frame(.5); settle(solver, data);
    for (const [side, sign] of [['left', 1], ['right', -1]] as const) {
      const upper = nodes.get(side+'UpperArm')!, elbow = nodes.get(side+'LowerArm')!, wrist = nodes.get(side+'Hand')!;
      const expected = new Vector3(sign, 0, 0).applyQuaternion(new Quaternion().setFromEuler(new Euler(0,.5,0)));
      for (const [a,b] of [[upper,elbow],[elbow,wrist]]) {
        const direction = b.getWorldPosition(new Vector3()).sub(a.getWorldPosition(new Vector3())).normalize();
        expect(direction.dot(expected)).toBeGreaterThan(.9999);
      }
    }
    for (const [name, bone] of nodes) expect(bone.position.distanceTo(initial.get(name)!)).toBeLessThan(1e-8);
  });
  it('expires cached body observations even while face frames stay fresh', () => {
    const { solver, nodes } = rig(); const data = frame(0); settle(solver, data);
    data.timestamp = 2000; data.samples.face.timestamp = 2000;
    settle(solver, data);
    expect(nodes.get('leftUpperArm')!.quaternion.angleTo(new Quaternion())).toBeGreaterThan(1.1);
    expect(nodes.get('head')!.quaternion.angleTo(new Quaternion())).toBeLessThan(.01);
  });
  it('rejects malformed face values and future frames, then recovers without NaN transforms', () => {
    const { solver, nodes, values } = rig(); const data = frame(.3);
    data.face = { jawOpen: NaN, eyeBlinkLeft: Infinity, eyeBlinkRight: -4 };
    settle(solver, data);
    expect([...values.values()].every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
    data.faceMatrix![0] = NaN; settle(solver, data);
    const future = frame(1, 100000); solver.update(future, defaults, .1, 2000);
    settle(solver, frame(0, 3000));
    expect([...nodes.values()].every(b => b.quaternion.toArray().every(Number.isFinite))).toBe(true);
    expect(nodes.get('head')!.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeLessThan(.001);
  });
});
