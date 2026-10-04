import { MathUtils, Quaternion, Vector3 } from 'three';
import type { DiagnosticSink } from './tracking-diagnostics';

/** Limit relative phalanx motion around the avatar's rest-space flexion axis.
 * MCP joints permit modest spread; the remaining two joints act mostly as hinges. */
export function limitFingerRotation(delta: Quaternion, flexionAxis: Vector3, segment: 'proximal' | 'intermediate' | 'distal', diagnostic?: DiagnosticSink): Quaternion {
  if (![...delta.toArray(), ...flexionAxis.toArray()].every(Number.isFinite) || delta.lengthSq() < 1e-8 || flexionAxis.lengthSq() < 1e-8) {diagnostic?.({stage:'finger',channel:'finger',reason:'invalid_value',accepted:false});return new Quaternion();}
  const q = delta.clone().normalize(), axis = flexionAxis.clone().normalize();
  if (q.w < 0) q.set(-q.x,-q.y,-q.z,-q.w);
  const projection = q.x*axis.x + q.y*axis.y + q.z*axis.z;
  const twist = new Quaternion(axis.x*projection, axis.y*projection, axis.z*projection, q.w);
  if (twist.lengthSq() < 1e-8) {diagnostic?.({stage:'finger',channel:'finger',reason:'degenerate_segment',accepted:false,value:twist.lengthSq(),threshold:1e-8});return new Quaternion();}
  twist.normalize();
  const curl = 2*Math.atan2(twist.x*axis.x + twist.y*axis.y + twist.z*axis.z, twist.w);
  const maximum = segment === 'intermediate' ? 1.9 : segment === 'proximal' ? 1.65 : 1.55;
  if(curl<-.1||curl>maximum)diagnostic?.({stage:'finger.curl',channel:'finger',reason:'clamped',accepted:true,value:curl,threshold:curl<-.1?-.1:maximum});
  const constrained = new Quaternion().setFromAxisAngle(axis, MathUtils.clamp(curl, -.1, maximum));
  const spread = q.multiply(twist.invert()).normalize();
  const spreadAngle = new Quaternion().angleTo(spread), spreadLimit = segment === 'proximal' ? .3 : .08;
  if(spreadAngle>spreadLimit)diagnostic?.({stage:'finger.spread',channel:'finger',reason:'clamped',accepted:true,value:spreadAngle,threshold:spreadLimit});
  const limitedSpread = new Quaternion().slerp(spread, spreadAngle > spreadLimit ? spreadLimit/spreadAngle : 1);
  return limitedSpread.multiply(constrained).normalize();
}
