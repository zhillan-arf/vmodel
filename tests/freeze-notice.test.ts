import { describe, expect, it } from 'vitest';
import { createFreezeNotice, describeFreeze } from '../src/freeze-notice';

describe('reporting a hidden output window', () => {
  it('reports the duration once the window comes back', () => {
    const notice = createFreezeNotice();
    notice.hidden(1000);
    expect(notice.isHidden()).toBe(true);
    const message = notice.visible(9500);
    expect(message).toContain('8.5 s');
    expect(message).toContain('minimizing it is not');
    expect(notice.isHidden()).toBe(false);
  });
  it('keeps the earliest moment when hidden fires more than once', () => {
    const notice = createFreezeNotice();
    notice.hidden(1000); notice.hidden(4000);
    expect(notice.visible(6000)).toContain('5 s');
  });
  it('stays quiet for a flicker too short to break a stream', () => {
    const notice = createFreezeNotice();
    notice.hidden(1000);
    expect(notice.visible(1400)).toBeNull();
  });
  it('reports nothing when the window was never hidden, and does not repeat', () => {
    const notice = createFreezeNotice();
    expect(notice.visible(5000)).toBeNull();
    notice.hidden(1000);
    expect(notice.visible(5000)).not.toBeNull();
    expect(notice.visible(9000)).toBeNull();
  });
  it('ignores a clock that jumps backwards or is not finite', () => {
    const notice = createFreezeNotice();
    notice.hidden(5000);
    expect(notice.visible(1000)).toBeNull();
    notice.hidden(Number.NaN);
    expect(notice.isHidden()).toBe(false);
  });
  it('rounds long freezes to whole seconds and short ones to a tenth', () => {
    expect(describeFreeze(12.34)).toContain('12 s');
    expect(describeFreeze(2.36)).toContain('2.4 s');
  });
});
