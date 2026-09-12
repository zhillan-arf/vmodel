import { assetUrl, type Manifest, type ResourceId, type RenditionSize } from './manifest';
import { supportsWebmAlpha } from './alpha';

type Connection = EventTarget & { saveData?: boolean };
export interface PlayerState {
  resource: ResourceId; size: RenditionSize; format: 'poster' | 'webm' | 'webp';
  playing: boolean; requestedPlayback: boolean; message: string; userIntent: 'auto' | 'play' | 'pause'; visible: boolean;
}
export class ResourcePlayer extends EventTarget {
  private poster = new Image();
  private media: HTMLVideoElement | HTMLImageElement | null = null;
  private mediaReady = false;
  private posterReady = false;
  private placeholder = document.createElement('span');
  private token = 0;
  private playAttempt = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private transitionTimer?: ReturnType<typeof setTimeout>;
  private snapshot: HTMLCanvasElement | null = null;
  private snapshotResource: ResourceId | null = null;
  private observer?: IntersectionObserver;
  private inView = false;
  private disposed = false;
  private loading = false;
  private needsInteraction = false;
  private failed = false;
  private formatPreference: 'auto' | 'webp' = 'auto';
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private connection = (navigator as Navigator & { connection?: Connection }).connection;
  private state: Omit<PlayerState, 'requestedPlayback'> = { resource: 'home-greeting', size: 'small', format: 'poster', playing: false, message: 'Getting Ene ready…', userIntent: 'auto', visible: false };

  constructor(readonly host: HTMLElement, readonly manifest: Manifest, readonly base: URL, initial: ResourceId = 'home-greeting') {
    super();
    host.classList.add('ene-player'); host.setAttribute('role', 'img');
    this.poster.className = 'ene-poster'; this.poster.alt = ''; this.poster.decoding = 'async';
    this.placeholder.className = 'ene-placeholder'; this.placeholder.textContent = 'Ene will be right back.'; this.placeholder.hidden = true;
    host.append(this.poster, this.placeholder);
    document.addEventListener('visibilitychange', this.reconcile);
    this.reduced.addEventListener('change', this.reconcile);
    this.connection?.addEventListener('change', this.reconcile);
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(entries => {
        this.inView = entries.some(entry => entry.isIntersecting); void this.reconcile();
      });
      this.observer.observe(host);
    } else this.inView = true;
    this.select(initial);
  }
  get status(): Readonly<PlayerState> { return { ...this.state, requestedPlayback: this.eligible() && !this.failed && !this.needsInteraction }; }
  private emit(message = this.state.message) {
    if (this.disposed) return;
    this.state.message = message;
    this.state.visible = this.inView && document.visibilityState === 'visible';
    this.host.dataset.format = this.state.format; this.host.dataset.playing = String(this.state.playing);
    this.host.dataset.resource = this.state.resource;
    this.dispatchEvent(new CustomEvent('change', { detail: this.status }));
  }
  private eligible() {
    return !this.disposed && this.inView && document.visibilityState === 'visible' && this.state.userIntent !== 'pause' &&
      (this.state.userIntent === 'play' || (!this.reduced.matches && !this.connection?.saveData));
  }
  private release() {
    clearTimeout(this.timer); this.token++; this.playAttempt++; this.loading = false; this.mediaReady = false;
    if (this.media instanceof HTMLVideoElement) { this.media.pause(); this.media.removeAttribute('src'); this.media.load(); }
    else this.media?.removeAttribute('src');
    this.media?.remove(); this.media = null; this.state.playing = false; this.state.format = 'poster';
    this.poster.classList.remove('covered');
  }
  private clearSnapshot = () => {
    clearTimeout(this.transitionTimer); this.snapshot?.remove(); this.snapshot = null; this.snapshotResource = null;
  };
  private reveal() {
    this.placeholder.hidden = true;
    this.host.setAttribute('aria-label', `Ene: ${this.manifest.resources[this.state.resource].label}`);
    if (!this.snapshot) return;
    if (this.reduced.matches) { this.clearSnapshot(); return; }
    clearTimeout(this.transitionTimer);
    const snapshot = this.snapshot;
    requestAnimationFrame(() => { if (this.snapshot === snapshot) snapshot.classList.add('leaving'); });
    this.transitionTimer = setTimeout(this.clearSnapshot, 220);
  }
  private unavailable() {
    if (this.posterReady) return 'Animation unavailable. The still is here; try Replay to reconnect.';
    if (this.snapshot && this.snapshotResource) {
      clearTimeout(this.transitionTimer); this.snapshot.classList.remove('leaving');
      this.host.setAttribute('aria-label', `Ene: previous ${this.manifest.resources[this.snapshotResource].label} still`);
      return 'This expression is unavailable. Showing the previous still; try Replay.';
    }
    this.placeholder.hidden = false; this.host.setAttribute('aria-label', 'Ene is temporarily unavailable');
    return 'Ene’s files are unavailable. Restore the character package, then try Replay.';
  }
  private captureTransition() {
    const source = this.mediaReady && this.media ? this.media : this.posterReady ? this.poster : this.snapshot;
    if (!source) return;
    const sourceId = source === this.snapshot ? this.snapshotResource : this.state.resource;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = this.host.clientWidth; canvas.height = this.host.clientHeight;
      const context = canvas.getContext('2d'); if (!context || !canvas.width || !canvas.height) return;
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      this.clearSnapshot(); this.snapshotResource = sourceId;
      canvas.className = 'ene-snapshot'; this.snapshot = canvas; this.host.append(canvas);
    } catch { /* Keep any existing still if the new source cannot be drawn yet. */ }
  }
  select(id: ResourceId) {
    if (this.disposed || !this.manifest.resources[id]) return;
    this.captureTransition(); this.release(); this.failed = false; this.needsInteraction = false;
    this.posterReady = false; this.poster.style.visibility = 'hidden'; this.placeholder.hidden = true;
    this.state.resource = id;
    const resource = this.manifest.resources[id];
    this.host.style.aspectRatio = `${resource.renderSize.width} / ${resource.renderSize.height}`;
    this.host.style.setProperty('--anchor-y', `${resource.anchor.y * 100}%`);
    this.host.setAttribute('aria-label', `Ene: ${resource.label}`);
    this.state.size = this.connection?.saveData || this.host.clientWidth <= resource.renditions.small.width + 12 ? 'small' : 'large';
    const poster = resource.posters[this.state.size];
    let fallback = false;
    this.poster.onload = () => {
      if (this.disposed || this.state.resource !== id) return;
      this.posterReady = true; this.poster.style.visibility = ''; this.reveal();
      if (this.state.format === 'poster') this.emit(this.state.message);
    };
    this.poster.onerror = () => {
      if (this.disposed || this.state.resource !== id) return;
      if (!fallback) { fallback = true; this.poster.src = assetUrl(this.base, poster.png); }
      else if (!this.mediaReady) this.emit(this.unavailable());
    };
    this.poster.src = assetUrl(this.base, poster.webp);
    this.emit('Getting Ene ready…'); void this.reconcile();
  }
  play() { this.state.userIntent = 'play'; this.failed = false; this.needsInteraction = false; void this.reconcile(); }
  pause() { this.state.userIntent = 'pause'; void this.reconcile(); }
  replay() { this.state.userIntent = 'play'; this.select(this.state.resource); }
  setFormat(preference: 'auto' | 'webp') {
    if (preference === this.formatPreference) return;
    this.formatPreference = preference; this.select(this.state.resource);
  }
  private reconcile = async () => {
    if (this.disposed) return;
    if (!this.eligible()) {
      this.playAttempt++;
      if (this.media instanceof HTMLVideoElement && this.mediaReady) { this.media.pause(); this.state.playing = false; }
      else this.release();
      this.emit(this.state.userIntent === 'pause' ? (this.media instanceof HTMLVideoElement ? 'Paused' : 'Paused · Play starts the animation again') :
        this.reduced.matches || this.connection?.saveData ? 'Still view · select Play when you want movement' : 'Animation rests while it is out of view');
      return;
    }
    if (this.failed || this.needsInteraction) { this.emit(); return; }
    if (this.mediaReady && this.media) {
      if (this.media instanceof HTMLVideoElement) await this.startVideo(this.media, this.token);
      else { this.state.playing = true; this.emit('Playing'); }
      return;
    }
    if (this.loading) return;
    this.loading = true; const token = ++this.token;
    this.emit('Loading animation…');
    const webm = this.formatPreference !== 'webp' && await supportsWebmAlpha(this.base, this.manifest.probes.webmAlpha);
    if (token !== this.token || !this.eligible()) return;
    this.loadMedia(webm ? 'webm' : 'webp', token);
  };
  private loadMedia(format: 'webm' | 'webp', token: number) {
    const rendition = this.manifest.resources[this.state.resource].renditions[this.state.size];
    const media = format === 'webm' ? document.createElement('video') : new Image();
    media.className = 'ene-animation'; media.setAttribute('aria-hidden', 'true');
    this.media = media;
    let settled = false, failed = false;
    const fail = () => {
      if (failed || token !== this.token || this.disposed) return;
      failed = true; settled = true; clearTimeout(this.timer); this.release();
      if (format === 'webm' && this.eligible()) { this.loading = true; this.loadMedia('webp', this.token); }
      else { this.failed = true; this.emit(this.unavailable()); }
    };
    const ready = async () => {
      if (settled || token !== this.token || this.disposed) return;
      settled = true; clearTimeout(this.timer); this.loading = false;
      if (!this.eligible()) { this.release(); return; }
      this.mediaReady = true; this.state.format = format;
      if (media instanceof HTMLVideoElement) await this.startVideo(media, token);
      else { this.state.playing = true; media.classList.add('is-ready'); this.poster.classList.add('covered'); this.reveal(); this.emit('Playing'); }
    };
    media.addEventListener('error', fail);
    this.timer = setTimeout(fail, 8000);
    if (media instanceof HTMLVideoElement) {
      media.muted = true; media.playsInline = true; media.loop = this.manifest.resources[this.state.resource].loop;
      media.preload = 'auto'; media.crossOrigin = 'anonymous'; media.addEventListener('loadeddata', ready, { once: true });
    } else { media.alt = ''; media.decoding = 'async'; media.addEventListener('load', ready, { once: true }); }
    this.host.append(media); media.src = assetUrl(this.base, rendition[format]);
  }
  private async startVideo(media: HTMLVideoElement, token: number) {
    const attempt = ++this.playAttempt;
    try {
      await media.play();
      if (this.disposed || token !== this.token) { media.pause(); return; }
      if (attempt !== this.playAttempt) return;
      if (!this.eligible()) { media.pause(); return; }
      this.state.playing = true; media.classList.add('is-ready'); this.poster.classList.add('covered'); this.reveal(); this.emit('Playing');
    } catch {
      if (this.disposed || token !== this.token || attempt !== this.playAttempt || !this.eligible()) return;
      this.state.playing = false; this.needsInteraction = true; this.emit('Select Play to start Ene’s animation');
    }
  }
  dispose() {
    this.disposed = true; this.release(); this.clearSnapshot(); this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.reconcile); this.reduced.removeEventListener('change', this.reconcile);
    this.connection?.removeEventListener('change', this.reconcile);
    this.poster.onload = null; this.poster.onerror = null; this.poster.removeAttribute('src'); this.host.replaceChildren();
  }
}
