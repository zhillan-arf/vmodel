import type { VRM } from '@pixiv/three-vrm';
import { MotionSolver } from './motion-solver';
export { confidence, point, smoothingFactor, segmentRotation } from './motion-solver';
export class Retargeter extends MotionSolver { constructor(readonly vrm: VRM) { super(vrm); } }
