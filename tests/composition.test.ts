import { describe, expect, it } from 'vitest';
import { compositionSize, fitComposition } from '../src/composition';
import { defaults, normalizeSettings } from '../src/types';

describe('capture composition', () => {
  it.each(['landscape', 'portrait'] as const)('keeps %s framing contained at every window shape', orientation => {
    const size = compositionSize(orientation);
    expect(size.width * size.height).toBe(1280 * 720);
    for (const [width, height] of [[1280, 720], [720, 1280], [1000, 500], [300, 700]]) {
      const fit = fitComposition(width, height, orientation);
      expect(fit.width / fit.height).toBeCloseTo(size.width / size.height);
      expect(fit.width).toBeLessThanOrEqual(width);
      expect(fit.height).toBeLessThanOrEqual(height);
      expect(fit.left).toBeCloseTo((width - fit.width) / 2);
      expect(fit.top).toBeCloseTo((height - fit.height) / 2);
    }
  });
});

it('sets the 1080p output dimensions in both orientations', () => {
  expect(compositionSize('landscape', '1080p')).toEqual({ width: 1920, height: 1080 });
  expect(compositionSize('portrait', '1080p')).toEqual({ width: 1080, height: 1920 });
  expect(normalizeSettings({ ...defaults, outputResolution: '1080p', lighting: 'warm', cameraFov: 42, faceDetail: 'extended' }))
    .toEqual({ ...defaults, outputResolution: '1080p', lighting: 'warm', cameraFov: 42, faceDetail: 'extended' });
  expect(normalizeSettings({ ...defaults, outputResolution: '4k', lighting: 'wrong', lightIntensity: Infinity, cameraFov: NaN })).toEqual(defaults);
});
