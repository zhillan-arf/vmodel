import { assetUrl, type Manifest } from './manifest';

const results = new Map<string, Promise<boolean>>();
/** Test decoded transparency; codec recognition alone cannot establish alpha support. */
export function supportsWebmAlpha(base: URL, probe: Manifest['probes']['webmAlpha']): Promise<boolean> {
  const url = assetUrl(base, probe);
  if (!results.has(url)) results.set(url, new Promise<boolean>(resolve => {
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto'; video.crossOrigin = 'anonymous';
    let finished = false;
    const finish = (result: boolean) => {
      if (finished) return;
      finished = true; clearTimeout(timer); video.pause(); video.removeAttribute('src'); video.load(); resolve(result);
    };
    const timer = setTimeout(() => finish(false), 1800);
    const inspect = () => {
      if (finished) return;
      try {
        const canvas = document.createElement('canvas'); canvas.width = probe.width; canvas.height = probe.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context || !video.videoWidth) return finish(false);
        context.drawImage(video, 0, 0, probe.width, probe.height);
        const alpha = ([x, y]: [number, number]) => context.getImageData(x, y, 1, 1).data[3];
        finish(alpha(probe.transparentPixel) <= 8 && alpha(probe.opaquePixel) >= 247);
      } catch { finish(false); }
    };
    video.addEventListener('error', () => finish(false), { once: true });
    video.addEventListener('loadeddata', () => {
      video.play().then(() => {
        if (finished) return;
        if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(inspect);
        else setTimeout(inspect, 60);
      }).catch(() => finish(false));
    }, { once: true });
    video.src = url;
  }));
  return results.get(url)!;
}
