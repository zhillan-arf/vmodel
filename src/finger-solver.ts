import { MathUtils, Quaternion, Vector3 } from 'three';

/** Limit relative phalanx motion around the avatar's rest-space flexion axis.
 * MCP joints permit modest spread; the remaining two joints act mostly as hinges. */
export function limitFingerRotation(delta: Quaternion, flexionAxis: Vector3, segment: 'proximal' | 'intermediate' | 'distal'): Quaternion {
  if (![...delta.toArray(), ...flexionAxis.toArray()].every(Number.isFinite) || delta.lengthSq() < 1e-8 || flexionAxis.lengthSq() < 1e-8) return new Quaternion();
  const q = delta.clone().normalize(), axis = flexionAxis.clone().normalize();
  if (q.w < 0) q.set(-q.x,-q.y,-q.z,-q.w);
  const projection = q.x*axis.x + q.y*axis.y + q.z*axis.z;
  const twist = new Quaternion(axis.x*projection, axis.y*projection, axis.z*projection, q.w);
  if (twist.lengthSq() < 1e-8) return new Quaternion();
  twist.normalize();
  const curl = 2*Math.atan2(twist.x*axis.x + twist.y*axis.y + twist.z*axis.z, twist.w);
  const maximum = segment === 'intermediate' ? 1.9 : segment === 'proximal' ? 1.65 : 1.55;
  const constrained = new Quaternion().setFromAxisAngle(axis, MathUtils.clamp(curl, -.1, maximum));
  const spread = q.multiply(twist.invert()).normalize();
  const spreadAngle = new Quaternion().angleTo(spread), spreadLimit = segment === 'proximal' ? .3 : .08;
  const limitedSpread = new Quaternion().slerp(spread, spreadAngle > spreadLimit ? spreadLimit/spreadAngle : 1);
  return limitedSpread.multiply(constrained).normalize();
}
