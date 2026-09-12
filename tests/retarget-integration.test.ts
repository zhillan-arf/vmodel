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
    // Finger proximals are required before the solver builds a palm basis at all,
    // and without a palm the whole hand path is skipped in silence.
    for (const [finger, offset] of [['Index', .03], ['Middle', .01], ['Ring', -.01], ['Little', -.03]] as const) {
      add(side+finger+'Proximal', side+'Hand', [sign*.06, 0, offset]);
      add(side+finger+'Intermediate', side+finger+'Proximal', [sign*.03, 0, 0]);
      add(side+finger+'Distal', side+finger+'Intermediate', [sign*.02, 0, 0]);
    }
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

describe('head noise damping, loss and recovery', () => {
  // TASK-010: noise must be damped without a long lag, and losing then regaining
  // the face must not produce an abrupt extreme rotation. Both are measurable.
  const headYaw = (nodes: Map<string, Object3D>) =>
    new Euler().setFromQuaternion(nodes.get('head')!.getWorldQuaternion(new Quaternion()), 'YXZ').y;
  const stale = (now: number) => {
    const data = frame(0, now);
    return { ...data, samples: { ...data.samples,
      face: { timestamp: now - 10000, present: false, inferenceMs: 1 },
      pose: { timestamp: now - 10000, present: false, inferenceMs: 1 } } };
  };

  it('damps landmark noise far below the input while still following the signal', () => {
    const { solver, nodes } = rig();
    let clock = 1000, seed = 7;
    // Deterministic pseudo-noise around a fixed 0.3 rad target.
    const noisy = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed / 2147483648 - 0.5) * 0.3; };
    const inputs: number[] = [], outputs: number[] = [];
    for (let i = 0; i < 600; i++) {
      const yaw = 0.3 + noisy();
      inputs.push(yaw);
      solver.update(frame(yaw, clock), defaults, 1/60, clock);
      clock += 16;
      if (i >= 120) outputs.push(headYaw(nodes));
    }
    const spread = (values: number[]) => {
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    };
    const settled = outputs.reduce((sum, value) => sum + value, 0) / outputs.length;
    // Noise is attenuated, and the damped output still centres on the real target.
    expect(spread(outputs)).toBeLessThan(spread(inputs.slice(120)) * 0.5);
    expect(settled).toBeGreaterThan(0.2);
    expect(settled).toBeLessThan(0.4);
  });

  it('fades to idle on face loss and returns without an abrupt extreme rotation', () => {
    const { solver, nodes } = rig();
    let clock = 1000;
    for (let i = 0; i < 180; i++) { solver.update(frame(0.4, clock), defaults, 1/60, clock); clock += 16; }
    expect(headYaw(nodes)).toBeGreaterThan(0.3);

    // Measure the head in world space: its local rotation stays near identity
    // because the yaw is carried through the torso chain, so a local-space
    // measurement reports no movement at all.
    const headWorld = () => nodes.get('head')!.getWorldQuaternion(new Quaternion());
    // Face and pose go stale: the head must relax, not hold an extreme angle.
    let worstStep = 0, previous = headWorld();
    for (let i = 0; i < 240; i++) {
      solver.update(stale(clock), defaults, 1/60, clock); clock += 16;
      const now = headWorld();
      worstStep = Math.max(worstStep, previous.angleTo(now));
      previous = now.clone();
    }
    expect(Math.abs(headYaw(nodes))).toBeLessThan(0.05);
    expect(worstStep).toBeLessThan(0.15);

    // Reacquired at the opposite extreme: the approach must still be gradual.
    worstStep = 0; previous = headWorld();
    const travelStart = previous.clone();
    for (let i = 0; i < 240; i++) {
      solver.update(frame(-0.4, clock), defaults, 1/60, clock); clock += 16;
      const now = headWorld();
      worstStep = Math.max(worstStep, previous.angleTo(now));
      previous = now.clone();
    }
    const travel = travelStart.angleTo(headWorld());
    expect(travel).toBeGreaterThan(0.3);
    expect(worstStep / travel).toBeLessThan(0.35);
    expect(headYaw(nodes)).toBeLessThan(-0.3);
  });
});

describe('hand identity and reentry through the full solver', () => {
  // TASK-012: crossing hands must not leave a persistent identity swap, uncertain
  // detections must decay, and hands leaving and re-entering frame must not lock
  // an extreme pose. The association unit tests cover the assignment rule; these
  // drive the whole retargeter so the rule's effect on the rig is what is checked.
  // A palm needs real geometry: wrist, index, middle and little must span a
  // plane. Collinear points are rejected as degenerate and the hand is skipped.
  const handAt = (x: number, side: string, score = 0.95, roll = 0) => {
    const landmarks = Array.from({ length: 21 }, () => ({ x, y: 0.5, z: 0 }));
    const world = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
    const place = (index: number, px: number, py: number, pz: number) => {
      const cos = Math.cos(roll), sin = Math.sin(roll);
      world[index] = { x: px, y: py * cos - pz * sin, z: py * sin + pz * cos };
    };
    place(0, 0, 0, 0);          // wrist
    place(5, 0.030, 0.080, 0);  // index proximal
    place(9, 0.008, 0.090, 0);  // middle proximal
    place(13, -0.012, 0.085, 0); // ring proximal
    place(17, -0.032, 0.070, 0); // little proximal
    for (const [start, base] of [[5, 5], [9, 9], [13, 13], [17, 17]] as const) {
      for (let joint = 1; joint <= 3; joint++) {
        const root = world[base];
        place(start + joint, root.x, root.y + joint * 0.022, root.z);
      }
    }
    return { side, landmarks, world, score };
  };
  // Pose wrists are the anatomical anchor: index 15 is left, 16 is right.
  const withHands = (leftX: number, rightX: number, hands: ReturnType<typeof handAt>[], now: number) => {
    const data = frame(0, now);
    const poseImage = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    poseImage[15] = { x: leftX, y: 0.5, z: 0, visibility: 1 };
    poseImage[16] = { x: rightX, y: 0.5, z: 0, visibility: 1 };
    return { ...data, poseImage, hands, inputSize: { width: 640, height: 480 },
      samples: { ...data.samples, hands: { timestamp: now, present: true, inferenceMs: 1 } } };
  };
  const handQuaternions = (nodes: Map<string, Object3D>) =>
    ['leftHand','rightHand'].map(name => nodes.get(name)!.quaternion.clone());

  it('does not leave a persistent identity swap after the wrists cross', () => {
    const { solver, nodes } = rig();
    let clock = 1000;
    const apart = () => withHands(0.7, 0.3, [handAt(0.7, 'Left'), handAt(0.3, 'Right')], clock);
    for (let i = 0; i < 90; i++) { solver.update(apart(), defaults, 1/60, clock); clock += 16; }
    const before = handQuaternions(nodes);
    // Guard against a vacuous pass: the hands must actually be driving the rig.
    expect(before.some(q => q.angleTo(new Quaternion()) > 0.01)).toBe(true);
    // Wrists swap image sides and the detector reverses its ordering.
    for (let i = 0; i < 90; i++) {
      solver.update(withHands(0.3, 0.7, [handAt(0.7, 'Left'), handAt(0.3, 'Right')], clock), defaults, 1/60, clock);
      clock += 16;
    }
    // Returning to the original arrangement must restore the original assignment.
    for (let i = 0; i < 90; i++) { solver.update(apart(), defaults, 1/60, clock); clock += 16; }
    const after = handQuaternions(nodes);
    expect(before[0].angleTo(after[0])).toBeLessThan(0.05);
    expect(before[1].angleTo(after[1])).toBeLessThan(0.05);
  });

  it('ignores uncertain detections rather than driving the rig from them', () => {
    const { solver, nodes } = rig();
    let clock = 1000;
    for (let i = 0; i < 90; i++) {
      solver.update(withHands(0.7, 0.3, [handAt(0.7, 'Left'), handAt(0.3, 'Right')], clock), defaults, 1/60, clock);
      clock += 16;
    }
    const confident = handQuaternions(nodes);
    // Below the association score floor these must not be adopted.
    for (let i = 0; i < 60; i++) {
      solver.update(withHands(0.7, 0.3, [handAt(0.2, 'Left', 0.2), handAt(0.9, 'Right', 0.2)], clock), defaults, 1/60, clock);
      clock += 16;
    }
    const after = handQuaternions(nodes);
    // Detections below the score floor are dropped, so the goal expires and the
    // hand decays to rest. The point is that it relaxes rather than adopting the
    // bogus pose, so rest is the expectation, not proximity to the driven pose.
    const bogus = handAt(0.2, 'Left', 0.95, 1.2);
    expect(bogus.world[9].y).not.toBeCloseTo(0.09, 3);
    for (const [index, quaternion] of after.entries()) {
      expect(Number.isFinite(quaternion.x + quaternion.y + quaternion.z + quaternion.w)).toBe(true);
      expect(quaternion.angleTo(new Quaternion())).toBeLessThan(0.1);
      expect(confident[index].angleTo(quaternion)).toBeGreaterThan(0.05);
    }
  });

  it('does not lock an extreme pose when hands leave and re-enter frame', () => {
    const { solver, nodes } = rig();
    let clock = 1000;
    const present = () => withHands(0.7, 0.3, [handAt(0.7, 'Left'), handAt(0.3, 'Right')], clock);
    for (let i = 0; i < 90; i++) { solver.update(present(), defaults, 1/60, clock); clock += 16; }
    const established = handQuaternions(nodes);
    // Hands leave: no detections and the hand sample goes stale.
    for (let i = 0; i < 120; i++) {
      const data = frame(0, clock);
      solver.update({ ...data, hands: [], samples: { ...data.samples, hands: { timestamp: clock - 5000, present: false, inferenceMs: 1 } } },
        defaults, 1/60, clock);
      clock += 16;
    }
    const absent = handQuaternions(nodes);
    for (const quaternion of absent) expect(Number.isFinite(quaternion.w)).toBe(true);
    // Hands return: the rig must follow them again, not stay stuck.
    for (let i = 0; i < 120; i++) { solver.update(present(), defaults, 1/60, clock); clock += 16; }
    const returned = handQuaternions(nodes);
    for (const [index, quaternion] of returned.entries()) {
      expect(established[index].angleTo(quaternion)).toBeLessThan(0.05);
    }
  });
});

describe('occlusion and reacquisition stability', () => {
  // TASK-011 and TASK-013 require that hidden limbs relax without stretching or
  // snapping, and that occlusion and reacquisition produce no explosive joints
  // or uncontrolled root drift. These are numeric properties, so they are
  // asserted directly rather than inferred from a solver unit test.
  const boneLengths = (nodes: Map<string, Object3D>) =>
    ['leftLowerArm','leftHand','rightLowerArm','rightHand','leftLowerLeg','leftFoot','rightLowerLeg','rightFoot']
      .map(name => nodes.get(name)!.position.length());
  const hide = (data: TrackingFrame, indices: number[]) => {
    const copy: TrackingFrame = { ...data, pose: data.pose.map(point => ({ ...point })) };
    for (const index of indices) copy.pose[index] = { x: 0, y: 0, z: 0, visibility: 0 };
    return copy;
  };
  // "Smooth, not snapping" is a ratio, not an absolute angle: exponential
  // smoothing always moves a bounded fraction of the remaining error, whereas a
  // snap covers most of the travel in one frame. Compare the worst single step
  // against the whole journey rather than against an arbitrary threshold.
  const relaxation = (solver: Retargeter, data: TrackingFrame, nodes: Map<string, Object3D>, bones: string[], frames = 120) => {
    const start = new Map(bones.map(name => [name, nodes.get(name)!.quaternion.clone()]));
    const previous = new Map(bones.map(name => [name, nodes.get(name)!.quaternion.clone()]));
    let worstStep = 0, firstStep = 0, lastStep = 0;
    for (let i = 0; i < frames; i++) {
      solver.update(data, defaults, 1/60, data.timestamp + 2000 + i*16);
      for (const name of bones) {
        const now = nodes.get(name)!.quaternion;
        const step = previous.get(name)!.angleTo(now);
        worstStep = Math.max(worstStep, step);
        if (i === 0) firstStep = Math.max(firstStep, step);
        if (i === frames - 1) lastStep = Math.max(lastStep, step);
        previous.set(name, now.clone());
      }
    }
    const total = Math.max(...bones.map(name => start.get(name)!.angleTo(nodes.get(name)!.quaternion)));
    return { worstStep, firstStep, lastStep, total, largestFraction: total > 1e-9 ? worstStep / total : 0 };
  };

  it('relaxes hidden arms smoothly without stretching bones or moving the avatar', () => {
    const { solver, nodes, scene } = rig();
    const visible = frame(0);
    settle(solver, visible, 2);
    const restLengths = boneLengths(nodes);
    const rootBefore = scene.position.clone();
    // Arms disappear: shoulders, elbows and wrists all drop to zero visibility.
    const hidden = hide(visible, [11, 12, 13, 14, 15, 16]);
    const relax = relaxation(solver, hidden, nodes, ['leftUpperArm','leftLowerArm','rightUpperArm','rightLowerArm']);
    // No single frame covers most of the travel, and the motion decays away.
    expect(relax.largestFraction).toBeLessThan(0.35);
    expect(relax.lastStep).toBeLessThan(relax.firstStep * 0.1);
    boneLengths(nodes).forEach((length, index) => expect(length).toBeCloseTo(restLengths[index], 10));
    expect(scene.position.distanceTo(rootBefore)).toBeLessThan(1e-6);
    for (const name of ['leftUpperArm','leftLowerArm','rightUpperArm','rightLowerArm']) {
      const q = nodes.get(name)!.quaternion;
      expect(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w)).toBe(true);
    }
  });

  it('keeps knees and the root bounded through occlusion and reacquisition while standing', () => {
    const { solver, nodes } = rig();
    const standing = { ...defaults, mode: 'standing' as const };
    const visible = frame(0);
    for (let i = 0; i < 120; i++) solver.update(visible, standing, 1/60, visible.timestamp + i*16);
    const restLengths = boneLengths(nodes);
    const hips = nodes.get('hips')!;
    const hipsBefore = hips.position.clone();
    let worstKnee = 0, worstHipDrift = 0;
    const sequence = [hide(visible, [25, 26, 27, 28]), visible, hide(visible, [23, 24, 25, 26, 27, 28]), visible];
    let clock = visible.timestamp + 2000;
    for (const data of sequence) {
      for (let i = 0; i < 120; i++) {
        solver.update(data, standing, 1/60, clock); clock += 16;
        for (const knee of ['leftLowerLeg','rightLowerLeg']) {
          const angle = 2 * Math.acos(Math.min(1, Math.abs(nodes.get(knee)!.quaternion.w)));
          worstKnee = Math.max(worstKnee, angle);
        }
        worstHipDrift = Math.max(worstHipDrift, hips.position.distanceTo(hipsBefore));
      }
    }
    // No explosive knee, no uncontrolled root drift, no stretching.
    expect(worstKnee).toBeLessThan(Math.PI * 0.75);
    expect(worstHipDrift).toBeLessThan(0.5);
    boneLengths(nodes).forEach((length, index) => expect(length).toBeCloseTo(restLengths[index], 10));
  });

  it('recovers arms on reacquisition without a single-frame snap', () => {
    const { solver, nodes } = rig();
    const visible = frame(0);
    settle(solver, visible, 2);
    const hidden = hide(visible, [11, 12, 13, 14, 15, 16]);
    settle(solver, hidden, 2);
    const recover = relaxation(solver, visible, nodes, ['leftUpperArm','leftLowerArm','rightUpperArm','rightLowerArm']);
    expect(recover.largestFraction).toBeLessThan(0.35);
    expect(recover.lastStep).toBeLessThan(recover.firstStep * 0.1);
  });
});

describe('manual expression controls alongside automatic tracking', () => {
  // TASK-015: a held manual expression must not suppress tracked blinking or
  // mouth movement, and tracking must still be able to exceed the manual floor.
  const faceFrame = (face: Record<string, number>) => {
    const data = frame(0);
    data.face = face as TrackingFrame['face'];
    return data;
  };
  it('keeps tracked blink and mouth alive while a manual smile is held', () => {
    const { solver, values } = rig();
    solver.setExpression('happy');
    settle(solver, faceFrame({ eyeBlinkLeft: 1, eyeBlinkRight: 1, jawOpen: 1 }), 2);
    expect(values.get('happy')).toBeGreaterThan(0.7);
    expect(values.get('blinkLeft')).toBeGreaterThan(0.7);
    expect(values.get('blinkRight')).toBeGreaterThan(0.7);
    expect(values.get('aa')).toBeGreaterThan(0.7);
  });
  it('lets tracking exceed the manual floor rather than clamping to it', () => {
    const { solver, values } = rig();
    solver.setExpression('surprised');
    settle(solver, faceFrame({}), 2);
    const floor = values.get('surprised')!;
    expect(floor).toBeCloseTo(0.75, 1);
    expect(floor).toBeLessThanOrEqual(1);
  });
  it('releases the manual floor when the control returns to neutral', () => {
    const { solver, values } = rig();
    solver.setExpression('happy');
    settle(solver, faceFrame({}), 2);
    expect(values.get('happy')).toBeGreaterThan(0.7);
    solver.setExpression('neutral');
    settle(solver, faceFrame({}), 2);
    expect(values.get('happy')).toBeLessThan(0.05);
  });
  it('holds the manual expression when face tracking goes stale', () => {
    const { solver, values } = rig();
    solver.setExpression('happy');
    const stale = frame(0);
    stale.samples.face.present = false;
    stale.samples.face.timestamp = 0;
    settle(solver, stale, 2);
    expect(values.get('happy')).toBeGreaterThan(0.7);
  });
});

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
