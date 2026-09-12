import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

export interface LimbRest {
  /** Rest segment directions and bone rotations, all in the same world space. */
  upperDirection: Vector3;
  lowerDirection: Vector3;
  upperWorld: Quaternion;
  lowerWorld: Quaternion;
  /** Anatomical positive-flexion plane normal, expressed in rest world space. */
  bendNormal: Vector3;
}
export interface LimbOptions {
  /** Last reliable world-space bend normal; it is projected onto the new upper axis. */
  previousNormal?: Vector3;
  /** Radians; defaults to 155 degrees. Zero denotes an extended limb. */
  maxFlexion?: number;
  /** Below this measured bend, retain the prior/rest plane. Defaults to 6 degrees. */
  straightThreshold?: number;
  /** Reject a larger observed plane change when bent. Defaults to 120 degrees. */
  maxPlaneChange?: number;
}
export interface LimbSolution {
  upperWorld: Quaternion;
  lowerWorld: Quaternion;
  planeNormal: Vector3;
  /** Applied flexion in radians: zero is straight, pi is fully folded. */
  flexion: number;
}

const EPSILON_SQ = 1e-12;
const finiteVector = (v: Vector3) => [v.x, v.y, v.z].every(Number.isFinite);
function unitVector(v: Vector3): Vector3 | null {
  const lengthSq = v.lengthSq();
  return finiteVector(v) && Number.isFinite(lengthSq) && lengthSq > EPSILON_SQ ? v.clone().multiplyScalar(1 / Math.sqrt(lengthSq)) : null;
}
function unitQuaternion(q: Quaternion): Quaternion | null {
  const lengthSq = q.lengthSq();
  return q.toArray().every(Number.isFinite) && Number.isFinite(lengthSq) && lengthSq > EPSILON_SQ ? q.clone().normalize() : null;
}
function projectNormal(normal: Vector3, direction: Vector3): Vector3 | null {
  const n = unitVector(normal);
  return n ? unitVector(n.addScaledVector(direction, -n.dot(direction))) : null;
}
function frameRotation(direction: Vector3, planeNormal: Vector3): Quaternion | null {
  const z = projectNormal(planeNormal, direction);
  if (!z) return null;
  const y = z.clone().cross(direction).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(direction, y, z)).normalize();
}
function transportedRestNormal(restDirection: Vector3, direction: Vector3, restNormal: Vector3): Vector3 | null {
  // The shortest arc is ambiguous at 180 degrees. The anatomical rest normal
  // supplies a deterministic axis instead of an arbitrary quaternion branch.
  const transport = restDirection.dot(direction) < -1 + 1e-6
    ? new Quaternion().setFromAxisAngle(restNormal, Math.PI)
    : new Quaternion().setFromUnitVectors(restDirection, direction);
  return projectNormal(restNormal.clone().applyQuaternion(transport), direction);
}

/** Solve world orientations only. Measurements determine direction and bend, never
 * bone lengths or translations. Apply returned rotations with parent-first world
 * smoothing. A null result should enter the caller's limb-loss fallback. */
export function solveLimbWorld(start: Vector3, joint: Vector3, end: Vector3, rest: LimbRest, options: LimbOptions = {}): LimbSolution | null {
  const maxFlexion = options.maxFlexion ?? MathUtils.degToRad(155);
  const straightThreshold = options.straightThreshold ?? MathUtils.degToRad(6);
  const maxPlaneChange = options.maxPlaneChange ?? MathUtils.degToRad(120);
  if (![start, joint, end, rest.upperDirection, rest.lowerDirection, rest.bendNormal].every(finiteVector)) return null;
  if (options.previousNormal && !finiteVector(options.previousNormal)) return null;
  if (![maxFlexion, straightThreshold, maxPlaneChange].every(Number.isFinite) || maxFlexion < 0 || maxFlexion >= Math.PI || straightThreshold < 0 || straightThreshold > Math.PI / 4 || maxPlaneChange < 0 || maxPlaneChange > Math.PI) return null;

  const upper = unitVector(joint.clone().sub(start));
  const measuredLower = unitVector(end.clone().sub(joint));
  const restUpper = unitVector(rest.upperDirection), restLower = unitVector(rest.lowerDirection);
  const restUpperWorld = unitQuaternion(rest.upperWorld), restLowerWorld = unitQuaternion(rest.lowerWorld);
  if (!upper || !measuredLower || !restUpper || !restLower || !restUpperWorld || !restLowerWorld) return null;
  const restNormal = projectNormal(rest.bendNormal, restUpper);
  if (!restNormal) return null;

  const measuredFlexion = Math.acos(MathUtils.clamp(upper.dot(measuredLower), -1, 1));
  // Almost fully folded observations have the same unstable plane problem as
  // straight ones, but describe an implausible elbow/knee target. Decay safely.
  if (Math.PI - measuredFlexion < MathUtils.degToRad(2)) return null;
  const previous = options.previousNormal ? projectNormal(options.previousNormal, upper) : null;
  const fallback = previous ?? transportedRestNormal(restUpper, upper, restNormal);
  if (!fallback) return null;

  let planeNormal = fallback;
  if (measuredFlexion > straightThreshold) {
    const observed = unitVector(upper.clone().cross(measuredLower));
    if (!observed) return null;
    if (previous && Math.acos(MathUtils.clamp(previous.dot(observed), -1, 1)) > maxPlaneChange) return null;
    planeNormal = observed;
  }
  const flexion = Math.min(measuredFlexion, maxFlexion);
  // Reconstruction in the accepted plane enforces a hinge bend and preserves the
  // chosen normal when tiny straight-limb noise changes the raw cross-product sign.
  const lower = upper.clone().applyAxisAngle(planeNormal, flexion).normalize();
  const restUpperFrame = frameRotation(restUpper, restNormal), restLowerFrame = frameRotation(restLower, restNormal);
  const upperFrame = frameRotation(upper, planeNormal), lowerFrame = frameRotation(lower, planeNormal);
  if (!restUpperFrame || !restLowerFrame || !upperFrame || !lowerFrame) return null;
  const upperWorld = upperFrame.multiply(restUpperFrame.invert()).multiply(restUpperWorld).normalize();
  const lowerWorld = lowerFrame.multiply(restLowerFrame.invert()).multiply(restLowerWorld).normalize();
  if (!unitQuaternion(upperWorld) || !unitQuaternion(lowerWorld)) return null;
  return { upperWorld, lowerWorld, planeNormal: planeNormal.clone(), flexion };
}
