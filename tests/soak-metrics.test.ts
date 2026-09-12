import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { counterDifference, distribution, memoryTrend, summarizePhase, withinOwnedDirectory } from '../scripts/soak-metrics.mjs';

describe('fixture soak evidence', () => {
  it('uses nearest-rank percentiles and leaves absent measurements absent', () => {
    expect(distribution([NaN, ...Array.from({ length: 100 }, (_, i) => i + 1), Infinity])).toMatchObject({ count: 100, p50: 50, p95: 95, p99: 99, max: 100 });
    expect(distribution([])).toMatchObject({ count: 0, p50: null, p95: null });
  });
  it('does not turn reset or absent OBS counters into successful zero skips', () => {
    expect(counterDifference({ frames: 100 }, { frames: 90 }, 'frames')).toBeNull();
    expect(counterDifference({}, { frames: 90 }, 'frames')).toBeNull();
    expect(counterDifference({ frames: 10 }, { frames: 15 }, 'frames')).toBe(5);
  });
  it('reports memory slopes in MiB/minute using actual sample times', () => {
    expect(memoryTrend([0, 60_000, 180_000].map(atMs => ({ atMs, memory: { heap: 200 + atMs / 60000 * 4 } })), 'heap')).toMatchObject({ count: 3, slopeMiBPerMinute: 4, changeMiB: 12 });
    expect(memoryTrend([{ atMs: 0, memory: { heap: null } }], 'heap').slopeMiBPerMinute).toBeNull();
  });
  it('rejects an intermediate OBS counter reset even when final counts exceed the original values', () => {
    const samples = [100, 150, 10, 200].map((frames, index) => ({ atMs: index * 5000, obs: { renderTotalFrames: frames, outputTotalFrames: frames, renderSkippedFrames: 0, outputSkippedFrames: 0 } }));
    const result = summarizePhase({ renders: [], inferences: [], samples, durationMs: 900000 });
    expect(result.obs.counters.outputTotalFrames).toBe(100);
    expect(result.obs.countersValid).toBe(false);
    expect(result.obs.renderSkipFraction).toBeNull();
    expect(result.obs.encodeSkipFraction).toBeNull();
  });
  it('compares equal first/last windows, excludes data outside measurement, and counts only fresh task work', () => {
    const make = (atMs: number, inferenceMs: number) => ({ atMs, inferenceMs, fresh: { face: true, pose: false, hands: false }, present: { face: true, pose: true, hands: true }, taskMs: { face: inferenceMs, pose: 999, hands: 999 }, allEnabledTasksFresh: false, feetVisible: false });
    const result = summarizePhase({ durationMs: 900000,
      renders: [{ atMs: -1, intervalMs: 999, drawMs: 999 }, { atMs: 100, intervalMs: 20, drawMs: 5 }, { atMs: 600100, intervalMs: 40, drawMs: 10 }, { atMs: 900001, intervalMs: 999, drawMs: 999 }],
      inferences: [make(100, 25), make(600100, 50)], samples: [] });
    expect(result.renderFrameIntervalMs.count).toBe(2);
    expect(result.lastVersusFirst.renderIntervalP95Ratio).toBe(2);
    expect(result.lastVersusFirst.inferenceP95Ratio).toBe(2);
    expect(result.taskMs.pose.count).toBe(0);
    expect(result.taskMs.hands.count).toBe(0);
    expect(result.obs.countersValid).toBe(false);
    expect(result.taskAcceptance).toBe(false);
  });
  it('rejects sibling-prefix and traversal recording paths on Windows', () => {
    const root = 'C:\\workspace\\reports\\owned';
    expect(withinOwnedDirectory(root, root + '\\phase.mkv', path.win32)).toBe(true);
    expect(withinOwnedDirectory(root, root + '-other\\phase.mkv', path.win32)).toBe(false);
    expect(withinOwnedDirectory(root, root + '\\..\\other.mkv', path.win32)).toBe(false);
    expect(withinOwnedDirectory(root, root, path.win32)).toBe(false);
  });
});
