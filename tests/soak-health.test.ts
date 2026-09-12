import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createDrawHealthGuard, inspectCapturePixels, inspectCapturePNG } from '../scripts/soak-health.mjs';
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');

const rgba = (pixel: number[], count = 100) => ({ width: 10, height: count / 10, data: Uint8Array.from(Array.from({ length: count }, () => pixel).flat()) });
describe('owned soak failure evidence', () => {
  it('detects the observed white/253 capture and blank black, transparent and constant-color output', () => {
    expect(inspectCapturePixels(rgba([253, 253, 253, 255]))).toMatchObject({ blank: true, reason: 'nearly-all-white' });
    expect(inspectCapturePixels(rgba([0, 0, 0, 255]))).toMatchObject({ blank: true, reason: 'nearly-all-black' });
    expect(inspectCapturePixels(rgba([20, 40, 60, 0]))).toMatchObject({ blank: true, reason: 'nearly-all-transparent' });
    expect(inspectCapturePixels(rgba([20, 40, 60, 255]))).toMatchObject({ blank: true, reason: 'nearly-uniform-color' });
  });
  it('retains visibly varied content and does not infer tracking quality from nonblank pixels', () => {
    const image = rgba([12, 24, 40, 255]);
    for (let i = 20; i < 40; i++) image.data.set([90, 190, 220, 255], i * 4);
    const result = inspectCapturePixels(image);
    expect(result.blank).toBe(false);
    expect(result.rgbMin).toEqual([12, 24, 40]);
    expect(result.rgbMax).toEqual([90, 190, 220]);
    expect(result.boundary).toContain('do not prove');
  });
  it('decodes a bounded owned PNG and rejects mismatched dimensions before decode', () => {
    const bytes = PNG.sync.write(rgba([253, 253, 253, 255]));
    expect(inspectCapturePNG(bytes, 10, 10).blank).toBe(true);
    expect(() => inspectCapturePNG(bytes, 20, 10)).toThrow('width');
    expect(() => inspectCapturePNG(Buffer.from('not a PNG'), 10, 10)).toThrow();
  });
  it('detects a slow streak across drains and keeps the first triggering evidence', () => {
    const guard = createDrawHealthGuard();
    expect(guard.observe([{ atMs: 510, intervalMs: 510 }, { atMs: 1020, intervalMs: 510 }], 1100)).toBeNull();
    const failure = guard.observe([{ atMs: 1530, intervalMs: 510 }, { atMs: 1546, intervalMs: 16 }], 1600);
    expect(failure).toMatchObject({ kind: 'sustained-draw-gaps', consecutive: 3, observedAtMs: 1600 });
    if (failure?.kind !== 'sustained-draw-gaps') throw new Error('Expected a sustained-draw-gaps failure.');
    expect(failure.drawIntervals).toHaveLength(3);
    expect(guard.observe([], 5000)).toBe(failure);
  });
  it('does not accumulate isolated slow frames or classify an exact 500 ms interval as >500', () => {
    const guard = createDrawHealthGuard();
    expect(guard.observe([
      { atMs: 600, intervalMs: 600 }, { atMs: 616, intervalMs: 16 },
      { atMs: 1216, intervalMs: 600 }, { atMs: 1816, intervalMs: 600 },
      { atMs: 2316, intervalMs: 500 }, { atMs: 2916, intervalMs: 600 },
    ], 3000)).toBeNull();
  });
  it('detects a complete draw stall without requiring another completed frame', () => {
    const guard = createDrawHealthGuard();
    expect(guard.observe([{ atMs: 100, intervalMs: 16 }], 100)).toBeNull();
    expect(guard.observe([], 2601)).toMatchObject({ kind: 'no-completed-viewer-draw', lastDrawAtMs: 100 });
    expect(createDrawHealthGuard().observe([], 5000)).toMatchObject({ kind: 'no-completed-viewer-draw', lastDrawAtMs: 0 });
  });
});
