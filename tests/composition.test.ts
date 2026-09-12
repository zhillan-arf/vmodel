import { describe, expect, it } from 'vitest';
import { compositionSize, fitComposition } from '../src/composition';

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
