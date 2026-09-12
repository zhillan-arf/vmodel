// Pure fail-fast checks for the owned fixture harness; no browser/device access.
// PNG comes from the already pinned Playwright 1.63.0 test utility bundle.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');

export function inspectCapturePixels({ width, height, data }) {
  assert(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width * height <= 640 * 360);
  assert.equal(data.length, width * height * 4, 'Expected an RGBA capture.');
  const min = [255, 255, 255], max = [0, 0, 0], sum = [0, 0, 0];
  let nearWhite = 0, nearBlack = 0, transparent = 0;
  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      min[channel] = Math.min(min[channel], data[i + channel]);
      max[channel] = Math.max(max[channel], data[i + channel]);
      sum[channel] += data[i + channel];
    }
    if (data[i] >= 250 && data[i + 1] >= 250 && data[i + 2] >= 250) nearWhite++;
    if (data[i] <= 3 && data[i + 1] <= 3 && data[i + 2] <= 3) nearBlack++;
    if (data[i + 3] <= 3) transparent++;
  }
  const pixels = width * height;
  const reason = transparent / pixels >= .995 ? 'nearly-all-transparent'
    : nearWhite / pixels >= .995 ? 'nearly-all-white'
    : nearBlack / pixels >= .995 ? 'nearly-all-black'
    : max.every((value, channel) => value - min[channel] <= 3) ? 'nearly-uniform-color' : null;
  return { width, height, rgbMin: min, rgbMax: max, rgbMean: sum.map(value => value / pixels),
    nearWhiteFraction: nearWhite / pixels, nearBlackFraction: nearBlack / pixels,
    transparentFraction: transparent / pixels, blank: reason !== null, reason,
    boundary: 'Detects near-uniform blank output only; nonblank pixels do not prove Ene identity, pose quality or motion.' };
}

export function inspectCapturePNG(bytes, expectedWidth, expectedHeight) {
  assert(Buffer.isBuffer(bytes) && bytes.length >= 33 && bytes.length <= 2 * 1024 ** 2, 'Unexpected owned PNG size.');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
  assert.equal(bytes.readUInt32BE(16), expectedWidth, 'Unexpected owned PNG width.');
  assert.equal(bytes.readUInt32BE(20), expectedHeight, 'Unexpected owned PNG height.');
  assert(expectedWidth > 0 && expectedHeight > 0 && expectedWidth * expectedHeight <= 640 * 360, 'Capture exceeds the diagnostic pixel limit.');
  return inspectCapturePixels(PNG.sync.read(bytes));
}

// Feed each drained draw exactly once. A streak can span two five-second drains;
// sparse unrelated slow frames must not accumulate into a sustained-gap failure.
export function createDrawHealthGuard({ thresholdMs = 500, consecutive = 3, stalledMs = 2500 } = {}) {
  assert(thresholdMs > 0 && Number.isInteger(consecutive) && consecutive > 0 && stalledMs > thresholdMs);
  let slow = [], lastDrawAtMs = 0, failure = null;
  return {
    observe(renders, nowMs) {
      if (failure) return failure;
      assert(Number.isFinite(nowMs) && nowMs >= 0);
      for (const render of renders) {
        assert(Number.isFinite(render.atMs) && Number.isFinite(render.intervalMs) && render.atMs >= lastDrawAtMs && render.intervalMs >= 0, 'Invalid/nonmonotonic draw telemetry.');
        lastDrawAtMs = render.atMs;
        if (render.intervalMs > thresholdMs) slow.push({ atMs: render.atMs, intervalMs: render.intervalMs });
        else slow = [];
        if (slow.length >= consecutive) {
          failure = { kind: 'sustained-draw-gaps', thresholdMs, consecutive, observedAtMs: nowMs, drawIntervals: [...slow] };
          return failure;
        }
      }
      if (nowMs - lastDrawAtMs > stalledMs) {
        failure = { kind: 'no-completed-viewer-draw', stalledMs, lastDrawAtMs, observedAtMs: nowMs };
      }
      return failure;
    },
  };
}
