import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { SolverReason } from './tracking-diagnostics';

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
  diagnostic?: (reason: SolverReason, value?: number, threshold?: number) => void;
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
  const reject = (reason:SolverReason,value?:number,threshold?:number) => { options.diagnostic?.(reason,value,threshold); return null; };
  const maxFlexion = options.maxFlexion ?? MathUtils.degToRad(155);
  const straightThreshold = options.straightThreshold ?? MathUtils.degToRad(6);
  const maxPlaneChange = options.maxPlaneChange ?? MathUtils.degToRad(120);
  if (![start, joint, end, rest.upperDirection, rest.lowerDirection, rest.bendNormal].every(finiteVector)) return reject('invalid_value');
  if (options.previousNormal && !finiteVector(options.previousNormal)) return reject('invalid_value');
  if (![maxFlexion, straightThreshold, maxPlaneChange].every(Number.isFinite)) return reject('invalid_parameter');
  if(maxFlexion<0||maxFlexion>=Math.PI)return reject('invalid_parameter',maxFlexion,maxFlexion<0?0:Math.PI);
  if(straightThreshold<0||straightThreshold>Math.PI/4)return reject('invalid_parameter',straightThreshold,straightThreshold<0?0:Math.PI/4);
  if(maxPlaneChange<0||maxPlaneChange>Math.PI)return reject('invalid_parameter',maxPlaneChange,maxPlaneChange<0?0:Math.PI);

  const upper = unitVector(joint.clone().sub(start));
  const measuredLower = unitVector(end.clone().sub(joint));
  const restUpper = unitVector(rest.upperDirection), restLower = unitVector(rest.lowerDirection);
  const restUpperWorld = unitQuaternion(rest.upperWorld), restLowerWorld = unitQuaternion(rest.lowerWorld);
  if (!upper || !measuredLower) return reject('degenerate_segment');
  if (!restUpper || !restLower || !restUpperWorld || !restLowerWorld) return reject('invalid_rest');
  const restNormal = projectNormal(rest.bendNormal, restUpper);
  if (!restNormal) return reject('invalid_rest');

  const measuredFlexion = Math.acos(MathUtils.clamp(upper.dot(measuredLower), -1, 1));
  // Almost fully folded observations have the same unstable plane problem as
  // straight ones, but describe an implausible elbow/knee target. Decay safely.
  if (Math.PI - measuredFlexion < MathUtils.degToRad(2)) return reject('fully_folded',measuredFlexion,Math.PI-MathUtils.degToRad(2));
  const previous = options.previousNormal ? projectNormal(options.previousNormal, upper) : null;
  const fallback = previous ?? transportedRestNormal(restUpper, upper, restNormal);
  if (!fallback) return reject('invalid_rest');

  let planeNormal = fallback;
  if (measuredFlexion > straightThreshold) {
    const observed = unitVector(upper.clone().cross(measuredLower));
    if (!observed) return reject('degenerate_segment');
    if (previous && Math.acos(MathUtils.clamp(previous.dot(observed), -1, 1)) > maxPlaneChange) return reject('plane_jump',Math.acos(MathUtils.clamp(previous.dot(observed),-1,1)),maxPlaneChange);
    planeNormal = observed;
  }
  if(measuredFlexion>maxFlexion)options.diagnostic?.('clamped',measuredFlexion,maxFlexion);
  const flexion = Math.min(measuredFlexion, maxFlexion);
  // Reconstruction in the accepted plane enforces a hinge bend and preserves the
  // chosen normal when tiny straight-limb noise changes the raw cross-product sign.
  const lower = upper.clone().applyAxisAngle(planeNormal, flexion).normalize();
  const restUpperFrame = frameRotation(restUpper, restNormal), restLowerFrame = frameRotation(restLower, restNormal);
  const upperFrame = frameRotation(upper, planeNormal), lowerFrame = frameRotation(lower, planeNormal);
  if (!restUpperFrame || !restLowerFrame || !upperFrame || !lowerFrame) return reject('invalid_rest');
  const upperWorld = upperFrame.multiply(restUpperFrame.invert()).multiply(restUpperWorld).normalize();
  const lowerWorld = lowerFrame.multiply(restLowerFrame.invert()).multiply(restLowerWorld).normalize();
  if (!unitQuaternion(upperWorld) || !unitQuaternion(lowerWorld)) return reject('invalid_value');
  return { upperWorld, lowerWorld, planeNormal: planeNormal.clone(), flexion };
}
