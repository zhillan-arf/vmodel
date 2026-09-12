// Injected only into an owned test context before the production application loads.
// The real CameraTracker and worker are unchanged. No native media method is called.
export function installPositiveCameraFixture() {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
  const drawing = canvas.getContext('2d', { alpha: false });
  const bitmaps = new Map(), streams = [], workers = new Set();
  let selected, paintTimer, painted = 0, acquisitions = 0, blockedMediaRequests = 0;
  let active = false, epoch = 0, previousDraw = null, renders = [], inferences = [], overflow = false;
  let lastResult = null, lastResultAt = 0, delegate = null, workerErrors = [], settings, restoreDraw;
  const viewEvents = [];
  const viewState = () => ({ width: innerWidth, height: innerHeight, outerWidth, outerHeight, dpr: devicePixelRatio, visibility: document.visibilityState, focused: document.hasFocus(), screen: { width: screen.width, height: screen.height, availWidth: screen.availWidth, availHeight: screen.availHeight } });
  const observeView = event => { viewEvents.push({ event: event.type, atMs: performance.now(), ...viewState() }); if (viewEvents.length > 30) viewEvents.shift(); };
  for (const name of ['resize', 'focus', 'blur']) window.addEventListener(name, observeView);
  document.addEventListener('visibilitychange', observeView);
  const round = value => Math.round(value * 1000) / 1000;
  const push = (array, value) => { if (array.length < 20000) array.push(value); else overflow = true; };
  const paint = () => { if (selected) { drawing.drawImage(selected, 0, 0); painted++; } };
  Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { configurable: true, value: async () => [{ kind: 'videoinput', deviceId: 'ene-owned-photo-fixture', groupId: 'ene-owned-fixture', label: 'Owned still-photo fixture' }] });
  navigator.mediaDevices.getUserMedia = async constraints => {
    acquisitions++;
    if (constraints.audio !== false || !constraints.video || !selected || constraints.video.width?.ideal !== 640 || constraints.video.height?.ideal !== 480) {
      blockedMediaRequests++; throw new Error('This owned fixture permits only prepared 640×480 synthetic video without audio.');
    }
    paint();
    const stream = canvas.captureStream(30); streams.push(stream);
    if (!paintTimer) paintTimer = setInterval(paint, 1000 / 30);
    return stream;
  };
  navigator.mediaDevices.getDisplayMedia = async () => { blockedMediaRequests++; throw new Error('Display media is prohibited in the fixture.'); };
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options); workers.add(this);
      const isTracker = new URL(url, location.href).pathname.includes('tracking.worker-');
      if (!isTracker) return;
      this.addEventListener('message', ({ data }) => {
        if (data.type === 'ready') delegate = data.delegate;
        if (data.type === 'error') workerErrors.push(data.message);
        if (data.type !== 'result') return;
        const frame = data.frame;
        lastResultAt = performance.now();
        const visible = point => point && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 && (point.visibility ?? 1) >= .5 && (point.presence ?? 1) >= .5;
        const fresh = Object.fromEntries(['face', 'pose', 'hands'].map(task => [task, frame.samples[task].timestamp === frame.timestamp]));
        lastResult = { sequence: frame.sequence, inferenceMs: frame.inferenceMs, inputSize: frame.inputSize,
          fresh, present: Object.fromEntries(['face', 'pose', 'hands'].map(task => [task, frame.samples[task].present])),
          taskMs: Object.fromEntries(['face', 'pose', 'hands'].map(task => [task, frame.samples[task].inferenceMs])),
          handCount: frame.hands.length, poseCount: frame.pose.length, faceMatrixCount: frame.faceMatrix?.length ?? 0,
          feetVisible: [27, 28].every(index => visible(frame.poseImage[index])),
          allEnabledTasksFresh: fresh.face && fresh.pose && (!settings?.hands || fresh.hands) };
        if (active) push(inferences, { atMs: round(lastResultAt - epoch), ...lastResult });
      });
      this.addEventListener('error', event => workerErrors.push(event.message));
    }
    terminate() { workers.delete(this); return super.terminate(); }
  };
  window.__soak = {
    async prepare(variants) {
      for (const variant of variants) {
        const response = await fetch(variant.url); if (!response.ok) throw new Error('Owned photo fixture unavailable.');
        const image = await createImageBitmap(await response.blob());
        const crop = variant.crop ?? { x: 0, y: 0, width: image.width, height: image.height };
        const prepared = new OffscreenCanvas(640, 480), context = prepared.getContext('2d', { alpha: false });
        const scale = Math.min(640 / crop.width, 480 / crop.height), width = crop.width * scale, height = crop.height * scale;
        context.fillStyle = '#000'; context.fillRect(0, 0, 640, 480);
        context.drawImage(image, crop.x, crop.y, crop.width, crop.height, (640 - width) / 2, (480 - height) / 2, width, height);
        bitmaps.set(variant.id, await createImageBitmap(prepared)); image.close();
      }
    },
    select(id, nextSettings) {
      if (!bitmaps.has(id)) throw new Error('Unknown owned photo fixture.');
      selected = bitmaps.get(id); settings = nextSettings; paint();
    },
    instrument(viewer) {
      const original = viewer.draw;
      viewer.draw = function (...args) {
        const before = performance.now();
        const result = original.apply(this, args), after = performance.now();
        if (active && previousDraw !== null) push(renders, { atMs: round(before - epoch), intervalMs: round(before - previousDraw), drawMs: round(after - before) });
        previousDraw = before;
        return result;
      };
      restoreDraw = () => { viewer.draw = original; };
    },
    begin() { active = true; epoch = performance.now(); previousDraw = null; renders = []; inferences = []; overflow = false; return epoch; },
    drain() { const result = { renders, inferences, atMs: performance.now() - epoch }; renders = []; inferences = []; return result; },
    status() {
      return { acquisitions, blockedMediaRequests, painted, delegate, workers: workers.size, workerErrors: [...workerErrors], overflow,
        lastResultAgeMs: lastResultAt ? performance.now() - lastResultAt : null, lastResult,
        visibility: document.visibilityState, clean: document.body.classList.contains('clean'), previewHidden: document.querySelector('#camera-video')?.hidden,
        view: viewState(), viewEvents: [...viewEvents],
        tracks: streams.flatMap(stream => stream.getTracks().map(track => ({ kind: track.kind, state: track.readyState, settings: track.getSettings() }))) };
    },
    dispose() { active = false; clearInterval(paintTimer); for (const stream of streams) stream.getTracks().forEach(track => track.stop()); for (const bitmap of bitmaps.values()) bitmap.close(); bitmaps.clear(); selected = null; restoreDraw?.(); for (const name of ['resize', 'focus', 'blur']) window.removeEventListener(name, observeView); document.removeEventListener('visibilitychange', observeView); },
  };
}
