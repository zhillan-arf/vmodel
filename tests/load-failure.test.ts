import { describe, expect, it } from 'vitest';
import { describeLoadFailure } from '../src/load-failure';

describe('describing an avatar that could not be loaded', () => {
  it('keeps our own guidance and drops the Error prefix', () => {
    const message = describeLoadFailure(new Error('Select a VRM avatar. PMX needs conversion; VMD is animation data.'));
    expect(message).toBe('Select a VRM avatar. PMX needs conversion; VMD is animation data.');
    expect(message).not.toMatch(/^Error:/);
  });
  it('replaces a parser exception a beginner cannot act on', () => {
    const message = describeLoadFailure(new RangeError('Offset is outside the bounds of the DataView'));
    expect(message).not.toMatch(/DataView/);
    expect(message).toMatch(/could not be read as a VRM avatar/);
    expect(message).toMatch(/Load another VRM/);
  });
  it('handles non-Error throws and empty messages', () => {
    expect(describeLoadFailure('boom')).toMatch(/could not be read/);
    expect(describeLoadFailure(new Error(''))).toMatch(/could not be read/);
    expect(describeLoadFailure(undefined)).toMatch(/could not be read/);
  });
  it('never returns raw exception-looking text', () => {
    for (const thrown of [new TypeError('bad glb'), new RangeError('x'), 'TypeError: y']) {
      expect(describeLoadFailure(thrown)).not.toMatch(/^(Error|TypeError|RangeError):/);
    }
  });
});
