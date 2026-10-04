import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { CameraTracker } from '../src/camera';
import { defaults, type TrackingFrame } from '../src/types';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: { data: any }) => void;
  onerror?: (event: { message: string }) => void;
  postMessage = vi.fn(); terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  emit(data: any) { this.onmessage?.({ data }); }
}
function fakeStream() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  return { stream, track };
}
describe('camera session ownership and backpressure', () => {
  let getUserMedia: ReturnType<typeof vi.fn>, tracker: CameraTracker;
  let video: HTMLVideoElement;
  let onFrame = vi.fn<(frame: TrackingFrame) => void>(), status = vi.fn<(message: string) => void>();
  let callbacks: Map<number, FrameRequestCallback>, nextHandle: number;
  beforeEach(() => {
    vi.useFakeTimers(); FakeWorker.instances = []; callbacks = new Map(); nextHandle = 0;
    getUserMedia = vi.fn(); onFrame = vi.fn(); status = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callbacks.set(++nextHandle, cb); return nextHandle; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close: vi.fn() })));
    video = { srcObject: null, play: vi.fn(async () => {}), readyState: 4, currentTime: 1 } as unknown as HTMLVideoElement;
    tracker = new CameraTracker(video, onFrame, status, () => defaults);
  });
  afterEach(() => { tracker.stop(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  async function tick() {
    const queued = [...callbacks.values()]; callbacks.clear();
    for (const cb of queued) cb(performance.now());
    await Promise.resolve(); await Promise.resolve();
  }
  it.each(['completes', 'fails'])('keeps a new session image when an old image copy %s', async outcome => {
    const diagnostic = vi.fn();
    tracker = new CameraTracker(video, onFrame, status, () => defaults, diagnostic);
    tracker.setDiagnosticDemand('inspect');
    const oldCopy = deferred<ImageBitmap>();
    const oldInput = { close: vi.fn() }, oldImage = { close: vi.fn() };
    const newInput = { close: vi.fn() }, newImage = { close: vi.fn() };
    vi.mocked(createImageBitmap).mockResolvedValueOnce(oldInput as unknown as ImageBitmap)
      .mockReturnValueOnce(oldCopy.promise)
      .mockResolvedValueOnce(newInput as unknown as ImageBitmap)
      .mockResolvedValueOnce(newImage as unknown as ImageBitmap);
    getUserMedia.mockResolvedValue(fakeStream().stream);
    await tracker.start();
    const oldSession = tracker.getSessionClock().sessionId;
    const oldWorker = FakeWorker.instances[0];
    oldWorker.emit({ type: 'ready', delegate: 'CPU' }); await tick();
    await tracker.start();
    const newSession = tracker.getSessionClock().sessionId;
    expect(newSession).not.toBe(oldSession);
    const worker = FakeWorker.instances[1];
    worker.emit({ type: 'ready', delegate: 'CPU' }); await tick();
    const sent = worker.postMessage.mock.calls.find(([data]) => data.type === 'frame')![0];
    if (outcome === 'completes') oldCopy.resolve(oldImage as unknown as ImageBitmap);
    else oldCopy.reject(new Error('Old image copy failed'));
    await tick();
    expect(oldInput.close).toHaveBeenCalledOnce();
    expect(oldImage.close).toHaveBeenCalledTimes(outcome === 'completes' ? 1 : 0);
    expect(newImage.close).not.toHaveBeenCalled();
    const frame = { version: 1, timestamp: sent.timestamp };
    oldWorker.emit({ type: 'result', frame });
    worker.emit({ type: 'result', frame, diagnostics: { sessionId: oldSession, captureSequence: sent.captureSequence } });
    expect(onFrame).not.toHaveBeenCalled();
    worker.emit({ type: 'result', frame, diagnostics: { sessionId: newSession, captureSequence: sent.captureSequence } });
    expect(diagnostic).toHaveBeenCalledWith(frame, expect.objectContaining({ sessionId: newSession }), newImage);
    expect(onFrame).toHaveBeenCalledOnce();
  });
  it('releases a stream that arrives after Stop without starting a worker', async () => {
    const request = deferred<MediaStream>(), { stream, track } = fakeStream();
    getUserMedia.mockReturnValue(request.promise);
    const start = tracker.start(); tracker.stop(); request.resolve(stream); await start;
    expect(track.stop).toHaveBeenCalledOnce(); expect(video.srcObject).toBeNull();
    expect(FakeWorker.instances).toHaveLength(0);
    expect(getUserMedia.mock.calls[0][0].audio).toBe(false);
  });
  it('ignores an old play rejection after a replacement camera starts', async () => {
    const oldPlay = deferred<void>(), first = fakeStream(), second = fakeStream();
    vi.mocked(video.play).mockReturnValueOnce(oldPlay.promise);
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    const oldStart = tracker.start(); await Promise.resolve(); await tracker.start();
    oldPlay.reject(new Error('old video was interrupted')); await oldStart;
    expect(first.track.stop).toHaveBeenCalledOnce(); expect(second.track.stop).not.toHaveBeenCalled();
    expect(video.srcObject).toBe(second.stream); expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].terminate).not.toHaveBeenCalled();
  });
  it('does not create a late worker when Stop interrupts video.play', async () => {
    const play = deferred<void>(), { stream, track } = fakeStream();
    vi.mocked(video.play).mockReturnValueOnce(play.promise); getUserMedia.mockResolvedValue(stream);
    const start = tracker.start(); await Promise.resolve(); tracker.stop(); play.resolve(); await start;
    expect(track.stop).toHaveBeenCalledOnce(); expect(FakeWorker.instances).toHaveLength(0);
  });
  it('permits one pending frame and rejects stale/duplicate responses', async () => {
    getUserMedia.mockResolvedValue(fakeStream().stream); await tracker.start();
    const worker = FakeWorker.instances[0]; worker.emit({ type: 'ready', delegate: 'CPU' });
    await tick(); video.currentTime = 2; await tick();
    const sent = worker.postMessage.mock.calls.filter(([data]) => data.type === 'frame');
    expect(sent).toHaveLength(1);
    const timestamp = sent[0][0].timestamp;
    worker.emit({ type: 'result', frame: { version: 1, timestamp: timestamp - 1 } });
    await tick(); expect(onFrame).not.toHaveBeenCalled();
    expect(worker.postMessage.mock.calls.filter(([data]) => data.type === 'frame')).toHaveLength(1);
    worker.emit({ type: 'result', frame: { version: 1, timestamp } });
    worker.emit({ type: 'result', frame: { version: 1, timestamp } });
    expect(onFrame).toHaveBeenCalledOnce();
    tracker.stop(); expect(worker.terminate).toHaveBeenCalledOnce(); expect(callbacks.size).toBe(0);
  });
  it('closes an asynchronously created bitmap after Stop', async () => {
    const pending = deferred<ImageBitmap>(), close = vi.fn();
    vi.mocked(createImageBitmap).mockReturnValueOnce(pending.promise);
    getUserMedia.mockResolvedValue(fakeStream().stream); await tracker.start();
    const worker = FakeWorker.instances[0]; worker.emit({ type: 'ready', delegate: 'CPU' });
    await tick(); tracker.stop(); pending.resolve({ close } as unknown as ImageBitmap); await tick();
    expect(close).toHaveBeenCalledOnce();
    expect(worker.postMessage.mock.calls.filter(([data]) => data.type === 'frame')).toHaveLength(0);
  });
  it('recovers from permission denial and retires a hung worker', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
    await tracker.start(); expect(status).toHaveBeenLastCalledWith(expect.stringContaining('permission denied'));
    const { stream, track } = fakeStream(); getUserMedia.mockResolvedValue(stream); await tracker.start();
    await vi.advanceTimersByTimeAsync(60001);
    expect(track.stop).toHaveBeenCalledOnce(); expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith(expect.stringContaining('too long'));
    expect(video.srcObject).toBeNull();
  });
  it('allows cold positive inference after empty frames and stops a later hang at exactly 30 seconds', async () => {
    const { stream, track } = fakeStream(); getUserMedia.mockResolvedValue(stream); await tracker.start();
    const worker = FakeWorker.instances[0]; worker.emit({ type: 'ready', delegate: 'GPU' });
    const frames = () => worker.postMessage.mock.calls.filter(([data]) => data.type === 'frame').map(([data]) => data);
    await tick();
    await vi.advanceTimersByTimeAsync(59999);
    expect(track.stop).not.toHaveBeenCalled(); // The first-frame budget stays 60 s.
    worker.emit({ type: 'result', frame: { version: 1, timestamp: frames()[0].timestamp, faceMatrix: null, pose: [], hands: [] } });
    video.currentTime = 2; await vi.advanceTimersByTimeAsync(50); await tick();
    expect(frames()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(18790); // Measured cold positive-photo inference.
    expect(track.stop).not.toHaveBeenCalled(); expect(worker.terminate).not.toHaveBeenCalled();
    worker.emit({ type: 'result', frame: { version: 1, timestamp: frames()[1].timestamp, faceMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] } });
    expect(onFrame).toHaveBeenCalledTimes(2);
    video.currentTime = 3; await vi.advanceTimersByTimeAsync(50); await tick(); expect(frames()).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(29999);
    expect(track.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(track.stop).toHaveBeenCalledOnce(); expect(worker.terminate).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull(); expect(status).toHaveBeenLastCalledWith(expect.stringContaining('stopped responding'));
  });
  it('ignores disconnect/error callbacks from retired sessions', async () => {
    const first = fakeStream(), second = fakeStream();
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    await tracker.start(); const oldWorker = FakeWorker.instances[0]; await tracker.start();
    first.track.addEventListener.mock.calls[0][1](); oldWorker.onerror?.({ message: 'late failure' });
    expect(video.srcObject).toBe(second.stream); expect(second.track.stop).not.toHaveBeenCalled();
  });
});
