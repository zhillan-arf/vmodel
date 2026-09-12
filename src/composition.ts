import type { StudioSettings } from './types';
export function compositionSize(orientation: StudioSettings['orientation']) {
  return orientation === 'portrait' ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
}
export function fitComposition(width: number, height: number, orientation: StudioSettings['orientation']) {
  const target = compositionSize(orientation);
  const scale = Math.min(Math.max(1, width) / target.width, Math.max(1, height) / target.height);
  return { width: target.width * scale, height: target.height * scale,
    left: (width - target.width * scale) / 2, top: (height - target.height * scale) / 2 };
}
