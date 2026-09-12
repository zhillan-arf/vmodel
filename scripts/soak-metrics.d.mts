import type { PlatformPath } from 'node:path';
type Task = 'face' | 'pose' | 'hands';
export interface Distribution { count: number; min: number | null; p50: number | null; p95: number | null; p99: number | null; max: number | null; mean: number | null }
export interface MemoryTrend { count: number; slopeMiBPerMinute: number | null; firstMedianMiB: number | null; lastMedianMiB: number | null; changeMiB: number | null; interpretation?: string }
interface Render { atMs: number; intervalMs: number; drawMs: number }
interface Inference { atMs: number; inferenceMs: number; fresh: Record<Task, boolean>; present: Record<Task, boolean>; taskMs: Record<Task, number>; allEnabledTasksFresh: boolean; feetVisible: boolean }
interface Sample { atMs: number; obs?: Record<string, number>; memory?: Record<string, number | null> }
interface WindowSummary {
  durationMs: number; renderFrameIntervalMs: Distribution; renderDrawCpuWallMs: Distribution;
  medianCadenceFps: number | null; observedRenderHz: number; observedInferenceHz: number;
  inferenceMs: Distribution; fullTaskInferenceMs: Distribution; taskMs: Record<Task, Distribution>;
  positiveFreshResults: Record<Task, number>; simultaneousFacePoseHands: number; feetVisiblePoseResults: number;
}
export function distribution(values: number[]): Distribution;
export function counterDifference(first: Record<string, number> | undefined, last: Record<string, number> | undefined, key: string): number | null;
export function memoryTrend(samples: Sample[], key: string): MemoryTrend;
export function summarizePhase(input: { renders: Render[]; inferences: Inference[]; samples: Sample[]; durationMs: number }): WindowSummary & {
  firstFiveMinutes: WindowSummary; lastFiveMinutes: WindowSummary;
  lastVersusFirst: { renderIntervalP95Ratio: number | null; inferenceP95Ratio: number | null; fullTaskInferenceP95Ratio: number | null; renderRateRatio: number | null; inferenceRateRatio: number | null; interpretation: string };
  obs: { counters: Record<string, number | null>; countersValid: boolean; renderSkipFraction: number | null; encodeSkipFraction: number | null; sampledRenderMs: Distribution; sampledActiveFps: Distribution };
  memory: Record<string, MemoryTrend>; proposedRenderGatePassed: boolean; taskAcceptance: false;
};
export function withinOwnedDirectory(root: string, candidate: string, path: PlatformPath): boolean;
