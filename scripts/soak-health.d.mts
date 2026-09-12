export type BlankReason = 'nearly-all-transparent' | 'nearly-all-white' | 'nearly-all-black' | 'nearly-uniform-color';
export interface CapturePixels { width: number; height: number; data: Uint8Array | Uint8ClampedArray | Buffer }
export interface CaptureInspection {
  width: number; height: number;
  rgbMin: number[]; rgbMax: number[]; rgbMean: number[];
  nearWhiteFraction: number; nearBlackFraction: number; transparentFraction: number;
  blank: boolean; reason: BlankReason | null; boundary: string;
}
interface Render { atMs: number; intervalMs: number; drawMs?: number }
export interface SustainedGapFailure { kind: 'sustained-draw-gaps'; thresholdMs: number; consecutive: number; observedAtMs: number; drawIntervals: { atMs: number; intervalMs: number }[] }
export interface StalledDrawFailure { kind: 'no-completed-viewer-draw'; stalledMs: number; lastDrawAtMs: number; observedAtMs: number }
export type DrawHealthFailure = SustainedGapFailure | StalledDrawFailure;
export interface DrawHealthGuard { observe(renders: Render[], nowMs: number): DrawHealthFailure | null }

export function inspectCapturePixels(capture: CapturePixels): CaptureInspection;
export function inspectCapturePNG(bytes: Buffer, expectedWidth: number, expectedHeight: number): CaptureInspection;
export function createDrawHealthGuard(options?: { thresholdMs?: number; consecutive?: number; stalledMs?: number }): DrawHealthGuard;
