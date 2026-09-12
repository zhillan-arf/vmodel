import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchLocalServer } from '../src/server-watch';
afterEach(() => { vi.useRealTimers(); });
describe('production server loss', () => {
  it('stops an active camera after consecutive failures, tolerating a recovered request', async () => {
    vi.useFakeTimers(); const stop = vi.fn(), check = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('Server gone')).mockResolvedValue(false);
    const close = watchLocalServer(() => true, stop, check);
    await vi.advanceTimersByTimeAsync(4500); expect(stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500); expect(stop).toHaveBeenCalledOnce(); close();
  });
  it('does not poll when idle or stop a later camera from an abandoned watcher', async () => {
    vi.useFakeTimers(); let active = false, resolve!: (value: boolean) => void;
    const stop = vi.fn(), check = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    const close = watchLocalServer(() => active, stop, check);
    await vi.advanceTimersByTimeAsync(3000); expect(check).not.toHaveBeenCalled(); active = true;
    await vi.advanceTimersByTimeAsync(4500); expect(check).toHaveBeenCalledOnce(); close(); resolve(false);
    await vi.advanceTimersByTimeAsync(10000); expect(stop).not.toHaveBeenCalled();
  });
});
