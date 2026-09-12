import { describe, expect, it } from 'vitest';
import { describeLoadFailure, readableError } from '../src/load-failure';

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
  it('keeps actionable settings and avatar guidance, and falls back otherwise', () => {
    expect(readableError(new Error('Settings file is too large.'), 'fallback')).toBe('Settings file is too large.');
    expect(readableError(new Error('Prepared Ene avatar not found. Run the avatar preparation script or select a VRM.'), 'fallback'))
      .toMatch(/Prepared Ene avatar not found/);
    expect(readableError(new TypeError('Failed to fetch'), 'Run Setup VModel.cmd.')).toBe('Run Setup VModel.cmd.');
    expect(readableError(new Error(''), 'fallback')).toBe('fallback');
    // A malformed settings file throws a JSON SyntaxError, not guidance.
    let thrown: unknown;
    try { JSON.parse('{nope'); } catch (error) { thrown = error; }
    expect(readableError(thrown, 'Choose a file this app saved.')).toBe('Choose a file this app saved.');
    // The guard must stay narrow enough to reject a platform error mentioning a file.
    expect(readableError(new TypeError('Failed to fetch file'), 'fallback')).toBe('fallback');
  });
  it('never returns raw exception-looking text', () => {
    for (const thrown of [new TypeError('bad glb'), new RangeError('x'), 'TypeError: y']) {
      expect(describeLoadFailure(thrown)).not.toMatch(/^(Error|TypeError|RangeError):/);
    }
  });
});
