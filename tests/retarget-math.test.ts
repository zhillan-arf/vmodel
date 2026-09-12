import { describe, expect, it } from 'vitest';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { associateHands, calibratedHeadWorld, faceRotation, palmWorldRotation, type PalmPoints } from '../src/retarget-math';
import type { HandObservation, Landmark } from '../src/types';

const rotation = (x = 0, y = 0, z = 0) => new Quaternion().setFromEuler(new Euler(x, y, z, 'YXZ'));
const nearRotation = (actual: Quaternion | null, expected: Quaternion) => {
  expect(actual).not.toBeNull();
  expect(actual!.angleTo(expected)).toBeLessThan(1e-6);
  expect(actual!.length()).toBeCloseTo(1, 8);
};
const transform = (q: Quaternion, scale = 1) => new Matrix4().compose(new Vector3(2, -3, -40), q, new Vector3(scale, scale, scale)).toArray();

describe('face transform and calibrated world orientation', () => {
  it('preserves signed pitch, yaw and roll regardless of uniform face scale', () => {
    for (const angle of [-0.5, 0.5]) for (const q of [rotation(angle), rotation(0, angle), rotation(0, 0, angle)]) {
      for (const scale of [0.4, 1, 2.5]) nearRotation(faceRotation(transform(q, scale)), q);
    }
  });
  it('rejects incomplete, nonfinite, degenerate, reflected and sheared transforms', () => {
    expect(faceRotation(null)).toBeNull(); expect(faceRotation([1, 2])).toBeNull(); expect(faceRotation(new Array(16))).toBeNull();
    const nan = transform(rotation()); nan[4] = NaN;
    const zero = transform(rotation()); zero[0] = 0;
    const reflected = transform(rotation()); reflected[0] = -1;
    const shear = transform(rotation()); shear[4] = 0.3;
    const nonAffine = transform(rotation()); nonAffine[3] = 0.2;
    for (const value of [nan, zero, reflected, shear, nonAffine]) expect(faceRotation(value)).toBeNull();
  });
  it('neutralizes the calibrated head even with a nonidentity avatar rest rotation', () => {
    const neutral = rotation(0.2, -0.3, 0.1), rest = rotation(-0.1, 0.4, 0.2);
    nearRotation(calibratedHeadWorld(neutral, neutral, rest), rest);
  });
  it('uses a world delta for noncommuting neutral and current rotations', () => {
    const neutral = rotation(0.35), delta = rotation(0, 0.5), rest = rotation(0, 0, 0.25);
    const current = delta.clone().multiply(neutral);
    nearRotation(calibratedHeadWorld(current, neutral, rest), delta.clone().multiply(rest));
    expect(neutral.clone().invert().multiply(current).angleTo(delta)).toBeGreaterThan(0.1);
  });
  it('limits motion before applying the rest orientation and rejects invalid quaternions', () => {
    const rest = rotation(0.2, -0.3, 0.1);
    nearRotation(calibratedHeadWorld(rotation(1.0, 1.4, 0.8), rotation(), rest), rotation(0.65, 1.1, 0.5).multiply(rest));
    expect(calibratedHeadWorld(new Quaternion(0, 0, 0, 0), rotation(), rest)).toBeNull();
    expect(calibratedHeadWorld(new Quaternion(NaN, 0, 0, 1), rotation(), rest)).toBeNull();
  });
});

const palm: PalmPoints = { wrist: new Vector3(), middle: new Vector3(0, 0.1, 0), index: new Vector3(0.04, 0.08, 0), little: new Vector3(-0.04, 0.08, 0) };
const rotatePalm = (q: Quaternion): PalmPoints => Object.fromEntries(Object.entries(palm).map(([key, value]) => [key, value.clone().applyQuaternion(q)])) as unknown as PalmPoints;
describe('palm orientation', () => {
  it('captures pronation that leaves the wrist-to-middle direction unchanged', () => {
    const pronation = rotation(0, 0.8);
    expect(rotatePalm(pronation).middle.distanceTo(palm.middle)).toBeLessThan(1e-8);
    nearRotation(palmWorldRotation(palm, rotatePalm(pronation), rotation()), pronation);
  });
  it('accounts for the avatar rest palm basis and rest bone rotation', () => {
    const rest = rotation(0.3, 0.2, -0.25), target = rotation(-0.2, -0.5, 0.15);
    nearRotation(palmWorldRotation(rotatePalm(rest), rotatePalm(target), rest), target);
  });
  it('rejects observed edge-on and degenerate palms without rejecting a valid edge-on rest palm', () => {
    const edge = rotation(0, Math.PI / 2);
    expect(palmWorldRotation(palm, rotatePalm(edge), rotation())).toBeNull();
    nearRotation(palmWorldRotation(rotatePalm(edge), palm, edge), rotation());
    nearRotation(palmWorldRotation(palm, rotatePalm(edge), rotation(), { minFacingCos: 0 }), edge);
    expect(palmWorldRotation(palm, { ...palm, index: new Vector3(0, 0.06, 0), little: new Vector3(0, 0.03, 0) }, rotation())).toBeNull();
    expect(palmWorldRotation(palm, { ...palm, wrist: new Vector3(NaN, 0, 0) }, rotation())).toBeNull();
  });
});

const landmark = (x: number, y = 0.5, visibility = 1): Landmark => ({ x, y, z: 0, visibility });
const pose = (left?: Landmark, right?: Landmark): Landmark[] => {
  const points = Array.from({ length: 33 }, () => landmark(0.5, 0.5, 0));
  if (left) points[15] = left; if (right) points[16] = right;
  return points;
};
const hand = (side: string, x: number, score = 0.95, y = 0.5): HandObservation => ({
  side, score, landmarks: Array.from({ length: 21 }, () => landmark(x, y)),
  world: Array.from({ length: 21 }, () => landmark(0)),
});
describe('hand identity association', () => {
  it('uses anatomical pose wrists instead of image-side sorting or an incorrect label', () => {
    const left = hand('Right', 0.31, 0.55), right = hand('Left', 0.69, 0.55);
    const result = associateHands([right, left], pose(landmark(0.3), landmark(0.7)));
    expect(result.left).toBe(left); expect(result.right).toBe(right);
  });
  it('preserves anatomical sides when wrists cross and detector ordering changes', () => {
    const leftBefore = hand('Left', 0.75), rightBefore = hand('Right', 0.25);
    expect(associateHands([leftBefore, rightBefore], pose(landmark(0.75), landmark(0.25))).left).toBe(leftBefore);
    const leftAfter = hand('Left', 0.3), rightAfter = hand('Right', 0.7);
    const result = associateHands([rightAfter, leftAfter], pose(landmark(0.3), landmark(0.7)), { previous: { left: landmark(0.75), right: landmark(0.25) } });
    expect(result.left).toBe(leftAfter); expect(result.right).toBe(rightAfter);
  });
  it('does not assign one detection to both wrists, or guess when hands overlap', () => {
    expect(associateHands([hand('Left', 0.5)], pose(landmark(0.45), landmark(0.55)))).toEqual({});
    expect(associateHands([hand('Left', 0.49), hand('Right', 0.51)], pose(landmark(0.5), landmark(0.5)))).toEqual({});
  });
  it('rejects a hand far from an available wrist even if its label agrees', () => {
    expect(associateHands([hand('Left', 0.8)], pose(landmark(0.2), landmark(0.35)))).toEqual({});
  });
  it('uses high-confidence unique labels only when the corresponding pose wrist is unavailable', () => {
    const left = hand('Left', 0.8), right = hand('Right', 0.2);
    expect(associateHands([left, right], pose())).toEqual({ left, right });
    expect(associateHands([hand('Left', 0.8, 0.6)], pose())).toEqual({});
    expect(associateHands([hand('Left', 0.8), hand('Left', 0.2)], pose())).toEqual({});
    expect(associateHands([hand('unknown', 0.8)], pose())).toEqual({});
  });
  it('combines one pose match with a distant missing-wrist fallback without duplicating an owner', () => {
    const left = hand('Left', 0.8), right = hand('Right', 0.2);
    expect(associateHands([right, left], pose(landmark(0.8)))).toEqual({ left, right });
    expect(associateHands([hand('Right', 0.81), left], pose(landmark(0.8)))).toEqual({});
  });
  it('uses capture aspect for distance gates and rejects malformed observations', () => {
    const observed = hand('Left', 0.65);
    expect(associateHands([observed], pose(landmark(0.5)), { imageAspect: 2 })).toEqual({});
    expect(associateHands([{ ...observed, world: [] }], pose())).toEqual({});
    expect(associateHands([hand('Left', NaN)], pose())).toEqual({});
    expect(associateHands([observed], pose(), { imageAspect: 0 })).toEqual({});
  });
});
