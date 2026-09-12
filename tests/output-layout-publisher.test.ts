import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishOutputLayout } from '../src/output-layout';

let resized: () => void;
let disconnect = vi.fn<() => void>();
const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) } as HTMLCanvasElement;
const active = () => ({ active: true, kind: 'clean' as const, orientation: 'landscape' as const });
beforeEach(() => {
  vi.useFakeTimers(); disconnect = vi.fn<() => void>();
  vi.stubGlobal('document', { title: 'Ene Output publisher regression' });
  vi.stubGlobal('innerWidth', 1280); vi.stubGlobal('innerHeight', 720);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resized = callback; }
    observe() {} disconnect() { disconnect(); }
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('output layout publisher lifecycle', () => {
  it('finishes ordinary periodic bodies and reserves keepalive for one final inactive notice', async () => {
    const consumed = vi.fn(async () => '');
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => ({ text: consumed })); vi.stubGlobal('fetch', fetchMock);
    const stop = publishOutputLayout(canvas, active); resized(); await flush();
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(consumed).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const options = call[1] as RequestInit;
      expect(options.keepalive).not.toBe(true); expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(JSON.parse(String(options.body))).toMatchObject({ active: true, viewport: { width: 1280, height: 720 } });
    }
    stop(); stop(); resized(); await vi.advanceTimersByTimeAsync(6000);
    expect(disconnect).toHaveBeenCalledOnce(); expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ keepalive: true });
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({ active: false });
    expect(consumed).toHaveBeenCalledTimes(3);
  });

  it('allows only one request while its response body is pending, then publishes the latest layout', async () => {
    let finishBody!: () => void;
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => ({ text: () => new Promise<void>(resolve => { finishBody = resolve; }) }));
    vi.stubGlobal('fetch', fetchMock);
    const stop = publishOutputLayout(canvas, active); resized(); await flush();
    resized(); resized(); await vi.advanceTimersByTimeAsync(1500);
    expect(fetchMock).toHaveBeenCalledOnce();
    finishBody(); await flush();
    document.title = 'Ene Output latest layout'; resized(); await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).title).toBe(document.title);
    stop();
  });

  it('aborts a hung request and retries on the next heartbeat without accumulating requests', async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((_url: string, options: RequestInit) => {
      const signal = options.signal as AbortSignal;
      if (!signal) return Promise.resolve({ text: async () => '' });
      signals.push(signal);
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const stop = publishOutputLayout(canvas, active); resized(); await flush();
    await vi.advanceTimersByTimeAsync(2499); expect(signals).toHaveLength(1); expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect(signals[0].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(500); expect(signals).toHaveLength(2);
    stop(); expect(signals[1].aborted).toBe(true); await flush();
    expect(disconnect).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(6000); expect(signals).toHaveLength(2);
  });
});
