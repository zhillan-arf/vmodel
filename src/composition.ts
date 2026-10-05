import type { StudioSettings } from './types';
export function compositionSize(orientation: StudioSettings['orientation'], resolution: StudioSettings['outputResolution'] = '720p') {
  const [width, height] = resolution === '1080p' ? [1920, 1080] : [1280, 720];
  return orientation === 'portrait' ? { width: height, height: width } : { width, height };
}
export function fitComposition(width: number, height: number, orientation: StudioSettings['orientation']) {
  const target = compositionSize(orientation);
  const scale = Math.min(Math.max(1, width) / target.width, Math.max(1, height) / target.height);
  return { width: target.width * scale, height: target.height * scale,
    left: (width - target.width * scale) / 2, top: (height - target.height * scale) / 2 };
}
