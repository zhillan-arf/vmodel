import type { StudioSettings, TrackingFrame } from './types';
import { clockTime, type DiagnosticDemand, type DiagnosticEnvelope } from './tracking-diagnostics';
export class CameraTracker {
  private demand: DiagnosticDemand = 'off';
  private sessionId = '';
  private anchor = 0;
  private captureSequence = 0;
  private pendingImage: ImageBitmap | null = null;
  setDiagnosticDemand(demand: DiagnosticDemand) { this.demand=demand; if(demand==='off'){this.pendingImage?.close();this.pendingImage=null;} }
  getSessionClock() { return {sessionId:this.sessionId,anchor:this.anchor}; }
  getStream() { return this.stream; }
  private worker: Worker | null = null;
  private stream: MediaStream | null = null;
  private inFlight = false;
  private running = false;
  private frameHandle = 0;
  private generation = 0;
  private lastSent = 0;
  private lastVideoTime = -1;
  private pendingTimestamp = 0;
  private receivedFirstResult = false;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private armWatchdog(generation: number, milliseconds: number, message: string) {
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      if (generation !== this.generation) return;
      this.stop(); this.onStatus(message);
    }, milliseconds);
  }
  constructor(readonly video: HTMLVideoElement, readonly onFrame: (frame: TrackingFrame) => void,
    readonly onStatus: (message: string) => void, readonly getSettings: () => StudioSettings, readonly onDiagnostic?: (frame:TrackingFrame,envelope:DiagnosticEnvelope,image:ImageBitmap|null)=>void) {}
  async devices() { return navigator.mediaDevices ? (await navigator.mediaDevices.enumerateDevices()).filter(x => x.kind === 'videoinput') : []; }
  getCameraInfo() { return this.stream?.getVideoTracks()[0]?.getSettings() ?? null; }
  async start(deviceId?: string) {
    this.stop(); const generation = this.generation;
    if (globalThis.isSecureContext === false) {
      this.onStatus('Camera access requires HTTPS or localhost. Open the server through trusted HTTPS.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.onStatus('This browser cannot access a camera. Use a browser with camera support.');
      return;
    }
    this.sessionId=crypto.randomUUID();this.anchor=performance.timeOrigin+performance.now();this.captureSequence=0;
    this.onStatus('Opening camera…');
    try {
      const [width,height] = this.getSettings().captureResolution.split('x').map(Number);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 30, max: 30 },
      } });
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream; this.video.srcObject = stream; await this.video.play();
      if (generation !== this.generation) return;
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (generation !== this.generation) return;
        this.stop(); this.onStatus('Camera disconnected. Reconnect it and press Start camera.');
      });
      this.onStatus('Loading local tracking models…');
      this.worker = new Worker(new URL('./tracking.worker.ts', import.meta.url), { type: 'module' });
      this.armWatchdog(generation, 60000, 'Tracking models took too long to start. Press Start camera to retry.');
      this.worker.onmessage = ({ data }) => {
        if (generation !== this.generation) return;
        if (data.type === 'ready' && !this.running) {
          clearTimeout(this.watchdog); this.running = true;
          this.onStatus(`Camera active · ${data.delegate} tracking`); this.schedule();
        }
        if (data.type === 'result') {
          // A duplicate or stale reply must not release a newer pending frame.
          if (!this.inFlight || data.frame.version !== 1 || data.frame.timestamp !== this.pendingTimestamp) return;
          if(data.diagnostics&&(data.diagnostics.sessionId!==this.sessionId||data.diagnostics.captureSequence!==this.captureSequence))return;
          clearTimeout(this.watchdog); this.inFlight = false; this.receivedFirstResult = true; this.onFrame(data.frame);
          const image=this.pendingImage;this.pendingImage=null;
          if(data.diagnostics&&this.demand!=='off'&&this.onDiagnostic){data.diagnostics.receivedAtMs=clockTime(this.anchor);this.onDiagnostic(data.frame,data.diagnostics,image);}else image?.close();
        }
        if (data.type === 'error') { this.stop(); this.onStatus(data.message); }
      };
      this.worker.onerror = e => {
        if (generation !== this.generation) return;
        this.stop(); this.onStatus(`Tracker stopped: ${e.message}`);
      };
      this.worker.postMessage({ type: 'init' });
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop();
      const name = error instanceof DOMException ? error.name : '';
      this.onStatus(name === 'NotAllowedError' ? 'Camera permission denied. Allow camera access for this local app, then retry.' :
        name === 'NotReadableError' ? 'Camera is busy. Close the other camera app, then retry.' :
        // A missing device otherwise fell through to the raw exception text.
        name === 'NotFoundError' ? 'No camera found. Connect a webcam, then press Start camera.' :
        name === 'OverconstrainedError' ? 'This camera cannot provide the selected resolution. Choose another resolution, then retry.' :
        `Camera unavailable: ${String(error)}`);
    }
  }
  private schedule() {
    if (!this.running) return;
    // A hidden camera preview may not receive video-presentation callbacks.
    // Poll decoded currentTime without sending duplicate or queued frames.
    this.frameHandle = requestAnimationFrame(async () => {
      this.schedule();
      const timestamp = performance.timeOrigin + performance.now();
      const interval = this.getSettings().quality === 'low' ? 100 : 1000/30;
      if (this.inFlight || this.video.readyState < 2 || this.video.currentTime === this.lastVideoTime || timestamp - this.lastSent < interval) return;
      this.inFlight = true; const generation = this.generation;
      let bitmap: ImageBitmap | undefined;
      let retainedImage: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(this.video);
        if (generation !== this.generation || !this.worker) { bitmap.close(); return; }
        this.lastSent = timestamp; this.pendingTimestamp = timestamp;
        this.lastVideoTime = this.video.currentTime;
        // A first positive detection can compile new graphs after empty frames:
        // the photo fixture took 18.79 s. Allow 30 s then, and 60 s initially.
        this.armWatchdog(generation, this.receivedFirstResult ? 30000 : 60000, 'Tracking stopped responding. Press Start camera to retry.');
        this.captureSequence++;
        const demand=this.demand;
        if(demand!=='off')retainedImage=await createImageBitmap(bitmap);
        if(generation!==this.generation||!this.worker){bitmap.close();retainedImage?.close();return;}
        if(this.demand==='off'){retainedImage?.close();retainedImage=null;}
        this.pendingImage=retainedImage;retainedImage=null;
        this.worker.postMessage({ type: 'frame', bitmap, timestamp, quality: this.getSettings().quality, hands: this.getSettings().hands,
          demand,sessionId:this.sessionId,anchor:this.anchor,captureSequence:this.captureSequence,videoTimeMs:this.lastVideoTime*1000 }, [bitmap]);
        bitmap = undefined;
      } catch {
        bitmap?.close();retainedImage?.close();
        if (generation !== this.generation) return;
        this.pendingImage?.close();this.pendingImage=null;
        clearTimeout(this.watchdog); this.inFlight = false;
      }
    });
  }
  stop() {
    this.pendingImage?.close();this.pendingImage=null;
    this.generation++; this.running = false; this.inFlight = false; this.receivedFirstResult = false;
    clearTimeout(this.watchdog);
    cancelAnimationFrame(this.frameHandle); this.lastVideoTime = -1; this.lastSent = 0; this.pendingTimestamp = 0;
    this.worker?.terminate(); this.worker = null;
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    this.video.srcObject = null; this.onStatus('Camera stopped');
  }
}
