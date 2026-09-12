import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { HandObservation, Landmark } from './types';

const EPSILON = 1e-8;
const finiteVector = (v: Vector3) => [v.x, v.y, v.z].every(Number.isFinite);
const unitQuaternion = (q: Quaternion): Quaternion | null =>
  q.toArray().every(Number.isFinite) && q.lengthSq() > EPSILON ? q.clone().normalize() : null;

/** MediaPipe face matrices are column-major metric-space transforms, already Y-up.
 * Accept a positive uniform scale, remove it, and reject invalid/reflected/sheared bases. */
export function faceRotation(matrix: readonly number[] | null | undefined): Quaternion | null {
  if (!matrix || matrix.length !== 16 || !Array.from(matrix).every(Number.isFinite)) return null;
  if ([matrix[3], matrix[7], matrix[11]].some(value => Math.abs(value) > 1e-5) || Math.abs(matrix[15] - 1) > 1e-5) return null;
  const axes = [0, 4, 8].map(offset => new Vector3(matrix[offset], matrix[offset + 1], matrix[offset + 2]));
  const lengths = axes.map(axis => axis.length());
  if (Math.min(...lengths) < EPSILON || Math.max(...lengths) > 1e8) return null;
  if ((Math.max(...lengths) - Math.min(...lengths)) / Math.max(...lengths) > 1e-3) return null;
  axes.forEach(axis => axis.normalize());
  if (Math.abs(axes[0].dot(axes[1])) > 1e-3 || Math.abs(axes[0].dot(axes[2])) > 1e-3 || Math.abs(axes[1].dot(axes[2])) > 1e-3) return null;
  if (axes[0].clone().cross(axes[1]).dot(axes[2]) < 0.999) return null;
  const rotation = new Matrix4().extractRotation(new Matrix4().fromArray([...matrix]));
  return new Quaternion().setFromRotationMatrix(rotation).normalize();
}

export interface HeadLimits { x: number; y: number; z: number }
const headLimits: HeadLimits = { x: 0.65, y: 1.1, z: 0.5 };

/** Camera/world-space delta; caller converts this world goal through the updated parent.
 * Clamp the delta before applying the avatar's rest rotation. No preview mirror here. */
export function calibratedHeadWorld(current: Quaternion, neutral: Quaternion, restWorld: Quaternion, limits: HeadLimits = headLimits): Quaternion | null {
  const rotation = unitQuaternion(current), reference = unitQuaternion(neutral), rest = unitQuaternion(restWorld);
  if (!rotation || !reference || !rest || ![limits.x, limits.y, limits.z].every(value => Number.isFinite(value) && value >= 0 && value <= Math.PI)) return null;
  const delta = rotation.multiply(reference.invert());
  const euler = new Euler().setFromQuaternion(delta, 'YXZ');
  euler.x = MathUtils.clamp(euler.x, -limits.x, limits.x);
  euler.y = MathUtils.clamp(euler.y, -limits.y, limits.y);
  euler.z = MathUtils.clamp(euler.z, -limits.z, limits.z);
  return new Quaternion().setFromEuler(euler).multiply(rest).normalize();
}

export interface PalmPoints { wrist: Vector3; middle: Vector3; index: Vector3; little: Vector3 }
export interface PalmOptions {
  /** Absolute palm-normal Z cosine. Zero allows a fully edge-on palm; default 0.06. */
  minFacingCos?: number;
}
function palmBasis(points: PalmPoints): { rotation: Quaternion; normal: Vector3 } | null {
  if (!Object.values(points).every(finiteVector)) return null;
  const along = points.middle.clone().sub(points.wrist);
  const across = points.index.clone().sub(points.little);
  if (along.lengthSq() < EPSILON || across.lengthSq() < EPSILON) return null;
  along.normalize(); across.normalize();
  const normal = across.clone().cross(along);
  // Nearly collinear MCP/longitudinal axes cannot determine a stable palm plane.
  if (normal.lengthSq() < 0.04) return null;
  normal.normalize(); across.crossVectors(along, normal).normalize();
  return { rotation: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(across, along, normal)).normalize(), normal };
}

/** Points must already share render coordinates (X-right, Y-up, camera toward -Z).
 * Use both palm axes so pronation changes the wrist even when wrist->middle is fixed. */
export function palmWorldRotation(restPoints: PalmPoints, observedPoints: PalmPoints, restWorld: Quaternion, options: PalmOptions = {}): Quaternion | null {
  const restBasis = palmBasis(restPoints), observed = palmBasis(observedPoints), rest = unitQuaternion(restWorld);
  const facing = options.minFacingCos ?? 0.06;
  if (!restBasis || !observed || !rest || !Number.isFinite(facing) || facing < 0 || facing > 1 || Math.abs(observed.normal.z) < facing) return null;
  return observed.rotation.multiply(restBasis.rotation.invert()).multiply(rest).normalize();
}

export type HandSide = 'left' | 'right';
export interface HandAssociationOptions {
  /** Capture width / height; distances below are measured in image-height units. */
  imageAspect?: number;
  maxDistance?: number;
  ambiguityMargin?: number;
  minFallbackScore?: number;
  /** Previous matched image wrist positions are a weak continuity hint, never an override. */
  previous?: Partial<Record<HandSide, Pick<Landmark, 'x' | 'y'>>>;
}
const sides: readonly HandSide[] = ['left', 'right'];
const inImage = (p: Pick<Landmark, 'x' | 'y'> | undefined): p is Pick<Landmark, 'x' | 'y'> =>
  !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
function poseWrist(p: Landmark | undefined): p is Landmark {
  const presence = (p as (Landmark & { presence?: number }) | undefined)?.presence;
  return inImage(p) && Number.isFinite(p!.z) && (p!.visibility ?? 1) > 0.55 && (presence ?? 1) > 0.55;
}

/** Associate using the shared image coordinates, never independent hand/pose world origins.
 * Tasks labels are used unchanged as a fallback only for an unavailable pose wrist;
 * do not apply the legacy Hands blanket swap. Ambiguous matches return no owner. */
export function associateHands(hands: readonly HandObservation[], poseImage: readonly Landmark[], options: HandAssociationOptions = {}): Partial<Record<HandSide, HandObservation>> {
  const aspect = options.imageAspect ?? 1;
  const maxDistance = options.maxDistance ?? 0.18;
  const margin = options.ambiguityMargin ?? 0.035;
  const fallbackScore = options.minFallbackScore ?? 0.85;
  if (![aspect, maxDistance, margin, fallbackScore].every(Number.isFinite) || aspect <= 0 || maxDistance <= 0 || margin < 0 || fallbackScore < 0.5 || fallbackScore > 1) return {};
  const candidates = hands.filter(hand => hand.landmarks?.length === 21 && hand.world?.length === 21 && inImage(hand.landmarks[0]) && Number.isFinite(hand.score) && hand.score >= 0.5 && hand.score <= 1);
  // The configured detector emits at most two hands. Unexpected over-count is ambiguous.
  if (candidates.length > 2) return {};
  const distance = (a: Pick<Landmark, 'x' | 'y'>, b: Pick<Landmark, 'x' | 'y'>) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const wrists: Partial<Record<HandSide, Landmark>> = {};
  if (poseWrist(poseImage[15])) wrists.left = poseImage[15];
  if (poseWrist(poseImage[16])) wrists.right = poseImage[16];
  const available = sides.filter(side => wrists[side]);
  interface Assignment { indices: Partial<Record<HandSide, number>>; count: number; cost: number }
  const assignments: Assignment[] = [];
  const enumerate = (index: number, assignment: Assignment) => {
    if (index === available.length) { assignments.push(assignment); return; }
    const side = available[index];
    enumerate(index + 1, { indices: { ...assignment.indices }, count: assignment.count, cost: assignment.cost });
    candidates.forEach((hand, candidate) => {
      if (Object.values(assignment.indices).includes(candidate)) return;
      const poseDistance = distance(hand.landmarks[0], wrists[side]!);
      if (poseDistance > maxDistance) return;
      const previous = options.previous?.[side];
      const continuity = inImage(previous) ? Math.min(margin * 0.2, distance(hand.landmarks[0], previous) * 0.15) : 0;
      enumerate(index + 1, { indices: { ...assignment.indices, [side]: candidate }, count: assignment.count + 1, cost: assignment.cost + poseDistance + continuity });
    });
  };
  enumerate(0, { indices: {}, count: 0, cost: 0 });
  assignments.sort((a, b) => b.count - a.count || a.cost - b.cost);
  const best = assignments[0];
  const nearby = assignments.filter(value => value.count === best.count && value.cost <= best.cost + margin);
  const result: Partial<Record<HandSide, HandObservation>> = {};
  const used = new Set<number>();
  for (const side of available) {
    const candidate = best.indices[side];
    if (candidate === undefined || nearby.some(value => value.indices[side] !== candidate)) continue;
    result[side] = candidates[candidate]; used.add(candidate);
  }
  for (const side of sides) {
    if (wrists[side]) continue;
    const eligible = candidates.map((hand, index) => ({ hand, index })).filter(({ hand, index }) =>
      !used.has(index) && typeof hand.side === 'string' && hand.side.toLowerCase() === side && hand.score >= fallbackScore &&
      available.every(knownSide => distance(hand.landmarks[0], wrists[knownSide]!) > maxDistance));
    if (eligible.length !== 1) continue;
    result[side] = eligible[0].hand; used.add(eligible[0].index);
  }
  return result;
}
