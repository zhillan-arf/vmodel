import { describe, expect, it } from 'vitest';
import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { solveLimbWorld, type LimbRest, type LimbSolution } from '../src/limb-solver';

const X = new Vector3(1, 0, 0), Z = new Vector3(0, 0, 1);
const rest: LimbRest = { upperDirection: X.clone(), lowerDirection: X.clone(), upperWorld: new Quaternion(), lowerWorld: new Quaternion(), bendNormal: Z.clone() };
const radians = MathUtils.degToRad;
const rotated = (v: Vector3, q: Quaternion) => v.clone().applyQuaternion(q);
const expectedDirection = (restDirection: Vector3, restWorld: Quaternion, world: Quaternion) => restDirection.clone().normalize().applyQuaternion(restWorld.clone().invert()).applyQuaternion(world).normalize();
const assertSolution = (result: LimbSolution | null): LimbSolution => {
  expect(result).not.toBeNull();
  for (const q of [result!.upperWorld, result!.lowerWorld]) {
    expect(q.toArray().every(Number.isFinite)).toBe(true); expect(q.length()).toBeCloseTo(1, 10);
  }
  expect(result!.planeNormal.length()).toBeCloseTo(1, 10);
  return result!;
};
const nearVector = (a: Vector3, b: Vector3) => expect(a.distanceTo(b)).toBeLessThan(1e-7);

describe('two-segment world orientation solver', () => {
  it('aligns both observed segment directions for an ordinary bent limb', () => {
    const upper = new Vector3(0.6, -0.5, 0.2).normalize();
    const normal = new Vector3(0.2, 0.3, 1).addScaledVector(upper, -new Vector3(0.2, 0.3, 1).dot(upper)).normalize();
    const lower = upper.clone().applyAxisAngle(normal, radians(75));
    const start = new Vector3(2, -3, 5), joint = start.clone().addScaledVector(upper, 0.3), end = joint.clone().addScaledVector(lower, 0.25);
    const result = assertSolution(solveLimbWorld(start, joint, end, rest));
    nearVector(expectedDirection(rest.upperDirection, rest.upperWorld, result.upperWorld), upper);
    nearVector(expectedDirection(rest.lowerDirection, rest.lowerWorld, result.lowerWorld), lower);
    nearVector(result.planeNormal, normal); expect(result.flexion).toBeCloseTo(radians(75), 10);
  });
  it('caps excessive flexion while leaving the upper segment direction unchanged', () => {
    const measuredLower = X.clone().applyAxisAngle(Z, radians(170));
    const result = assertSolution(solveLimbWorld(new Vector3(), X, X.clone().add(measuredLower), rest));
    nearVector(expectedDirection(rest.upperDirection, rest.upperWorld, result.upperWorld), X);
    nearVector(expectedDirection(rest.lowerDirection, rest.lowerWorld, result.lowerWorld), X.clone().applyAxisAngle(Z, radians(155)));
    expect(result.flexion).toBeCloseTo(radians(155), 10);
    const custom = assertSolution(solveLimbWorld(new Vector3(), X, X.clone().add(measuredLower), rest, { maxFlexion: radians(100) }));
    expect(custom.flexion).toBeCloseTo(radians(100), 10);
  });
  it('retains the previous plane through alternating almost-straight landmark noise', () => {
    let normal = Z.clone();
    for (let index = 0; index < 40; index++) {
      const noise = index % 2 ? 0.002 : -0.002;
      const result = assertSolution(solveLimbWorld(new Vector3(), X, new Vector3(2, noise, 0), rest, { previousNormal: normal }));
      nearVector(result.planeNormal, Z);
      expect(result.upperWorld.angleTo(new Quaternion())).toBeLessThan(1e-7);
      expect(expectedDirection(rest.lowerDirection, rest.lowerWorld, result.lowerWorld).y).toBeGreaterThanOrEqual(0);
      normal = result.planeNormal;
    }
  });
  it('projects the previous plane perpendicular to a changed upper direction', () => {
    const upper = new Vector3(Math.cos(0.3), 0, Math.sin(0.3));
    const expectedNormal = Z.clone().addScaledVector(upper, -Z.dot(upper)).normalize();
    const result = assertSolution(solveLimbWorld(new Vector3(), upper, upper.clone().multiplyScalar(2), rest, { previousNormal: Z }));
    nearVector(result.planeNormal, expectedNormal);
    expect(Math.abs(result.planeNormal.dot(upper))).toBeLessThan(1e-10);
    nearVector(expectedDirection(rest.upperDirection, rest.upperWorld, result.upperWorld), upper);
  });
  it('uses minimal rest-plane transport for a straight limb without history', () => {
    const upper = new Vector3(1, 1, 0).normalize();
    const result = assertSolution(solveLimbWorld(new Vector3(), upper, upper.clone().multiplyScalar(2), rest));
    nearVector(result.planeNormal, Z);
    const expected = new Quaternion().setFromUnitVectors(X, upper);
    expect(result.upperWorld.angleTo(expected)).toBeLessThan(1e-7);
    expect(result.lowerWorld.angleTo(expected)).toBeLessThan(1e-7);
  });
  it('captures bend-plane roll even when the upper direction is unchanged', () => {
    const roll = new Quaternion().setFromAxisAngle(X, radians(60));
    const bend = new Quaternion().setFromAxisAngle(Z, radians(70));
    const lower = rotated(rotated(X, bend), roll);
    const result = assertSolution(solveLimbWorld(new Vector3(), X, X.clone().add(lower), rest));
    expect(result.upperWorld.angleTo(roll)).toBeLessThan(1e-7);
    expect(result.lowerWorld.angleTo(roll.clone().multiply(bend))).toBeLessThan(1e-7);
  });
  it('preserves arbitrary rest-world and ancestor rotations without applying them twice', () => {
    const ancestor = new Quaternion().setFromEuler(new Euler(0.25, -0.4, 0.3));
    const observed = new Quaternion().setFromEuler(new Euler(-0.2, 0.5, -0.1));
    const bend = new Quaternion().setFromAxisAngle(Z, radians(80));
    const customRest: LimbRest = { upperDirection: rotated(X, ancestor), lowerDirection: rotated(X, ancestor), upperWorld: ancestor.clone(), lowerWorld: ancestor.clone(), bendNormal: rotated(Z, ancestor) };
    const upper = rotated(X, observed), lower = rotated(rotated(X, bend), observed), offset = new Vector3(-4, 2, 1);
    const result = assertSolution(solveLimbWorld(offset, offset.clone().add(upper), offset.clone().add(upper).add(lower), customRest));
    expect(result.upperWorld.angleTo(observed)).toBeLessThan(1e-7);
    expect(result.lowerWorld.angleTo(observed.clone().multiply(bend))).toBeLessThan(1e-7);
  });
  it('rejects a strong unexpected plane reversal instead of inventing a reflected bend', () => {
    const lower = X.clone().applyAxisAngle(Z, radians(-70));
    expect(solveLimbWorld(new Vector3(), X, X.clone().add(lower), rest, { previousNormal: Z })).toBeNull();
    const accepted = assertSolution(solveLimbWorld(new Vector3(), X, X.clone().add(lower), rest));
    nearVector(expectedDirection(rest.lowerDirection, rest.lowerWorld, accepted.lowerWorld), lower);
  });
  it('handles an upper axis opposite its rest axis deterministically, but rejects a fully folded joint', () => {
    const opposite = X.clone().negate();
    const result = assertSolution(solveLimbWorld(new Vector3(), opposite, opposite.clone().multiplyScalar(2), rest));
    nearVector(result.planeNormal, Z); nearVector(expectedDirection(rest.upperDirection, rest.upperWorld, result.upperWorld), opposite);
    expect(solveLimbWorld(new Vector3(), X, new Vector3(), rest)).toBeNull();
  });
  it('rejects invalid observations, rest frames and options without nonfinite outputs', () => {
    const end = new Vector3(1, 1, 0);
    expect(solveLimbWorld(new Vector3(NaN, 0, 0), X, end, rest)).toBeNull();
    expect(solveLimbWorld(new Vector3(), new Vector3(), end, rest)).toBeNull();
    expect(solveLimbWorld(new Vector3(), X, X, rest)).toBeNull();
    expect(solveLimbWorld(new Vector3(), X, end, { ...rest, bendNormal: X })).toBeNull();
    expect(solveLimbWorld(new Vector3(), X, end, { ...rest, upperWorld: new Quaternion(0, 0, 0, 0) })).toBeNull();
    expect(solveLimbWorld(new Vector3(), X, end, rest, { previousNormal: new Vector3(Infinity, 0, 0) })).toBeNull();
    expect(solveLimbWorld(new Vector3(), X, end, rest, { maxFlexion: NaN })).toBeNull();
    expect(solveLimbWorld(new Vector3(), X, end, rest, { maxFlexion: Math.PI })).toBeNull();
  });
  it('does not mutate inputs or depend on measured segment length or root translation', () => {
    const start = new Vector3(3, 4, 5), joint = new Vector3(5, 4, 5), end = new Vector3(5, 7, 5);
    const before = [start, joint, end, rest.upperDirection, rest.lowerDirection, rest.bendNormal].map(v => v.toArray());
    const first = assertSolution(solveLimbWorld(start, joint, end, rest));
    const second = assertSolution(solveLimbWorld(new Vector3(), X.clone().multiplyScalar(0.2), new Vector3(0.2, 0.1, 0), rest));
    expect(first.upperWorld.angleTo(second.upperWorld)).toBeLessThan(1e-7);
    expect(first.lowerWorld.angleTo(second.lowerWorld)).toBeLessThan(1e-7);
    expect([start, joint, end, rest.upperDirection, rest.lowerDirection, rest.bendNormal].map(v => v.toArray())).toEqual(before);
  });
});
