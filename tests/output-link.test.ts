import { afterEach, expect, it, vi } from 'vitest';
import { OutputLink } from '../src/output-link';
import { defaults } from '../src/types';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('ignores late frames and queued handshakes after output channel teardown', async () => {
  vi.useFakeTimers();
  const sent: unknown[] = [];
  vi.stubGlobal('BroadcastChannel', class {
    closed = false;
    postMessage(value: unknown) { if (this.closed) throw new Error('closed'); sent.push(value); }
    close() { this.closed = true; }
  });
  for (const output of [true, false]) {
    const link = new OutputLink(output, 'test', () => ({ avatarId: null, label: 'Ene', settings: defaults, calibration: null, expression: 'neutral', frame: null }), () => {}, () => {}, () => null, () => {});
    link.close(); link.close(); link.frame(null); link.publish();
    await Promise.resolve(); // Constructor's queued first handshake.
    await vi.advanceTimersByTimeAsync(10000);
  }
  expect(sent).toHaveLength(2);
  expect(sent.every((message: any) => message.type === 'bye')).toBe(true);
});
