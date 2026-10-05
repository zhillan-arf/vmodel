export interface Landmark { x: number; y: number; z: number; visibility?: number; presence?: number }
export interface HandObservation { side: string; landmarks: Landmark[]; world: Landmark[]; score: number }
export interface TrackingSample { timestamp: number; inferenceMs: number; present: boolean }
export interface Calibration { version: 1; head: number[]; root: number[]; torsoRoll?: number }
export interface TrackingFrame {
  version: 1;
  sequence: number;
  timestamp: number;
  inputSize?: { width: number; height: number };
  face: Record<string, number>;
  faceMatrix: number[] | null;
  pose: Landmark[];
  poseImage: Landmark[];
  hands: HandObservation[];
  inferenceMs: number;
  samples: { face: TrackingSample; pose: TrackingSample; hands: TrackingSample };
}
export interface StudioSettings {
  version: 1;
  mode: 'seated' | 'standing';
  quality: 'balanced' | 'low';
  framing: 'body' | 'bust';
  orientation: 'landscape' | 'portrait';
  background: string;
  mirror: boolean;
  hands: boolean;
  smoothing: number;
  springMotion: 'full' | 'gentle' | 'off';
  captureResolution: '640x480' | '1280x720';
  zoom: number;
  headRange: number;
  mouthGain: number;
}
export const defaults: StudioSettings = {
  version: 1, mode: 'seated', quality: 'balanced', framing: 'body',
  orientation: 'landscape', background: '#182339', mirror: true, hands: true, smoothing: 14, springMotion: 'gentle', captureResolution: '640x480', zoom: 1, headRange: 1, mouthGain: 1.8,
};

export function normalizeSettings(input: unknown): StudioSettings {
    const value = (input && typeof input === 'object' ? input : {}) as Partial<StudioSettings>;
    if (value.version !== 1) return { ...defaults };
    return {
      ...defaults,
      mode: value.mode === 'standing' ? 'standing' : 'seated',
      quality: value.quality === 'low' ? 'low' : 'balanced',
      framing: value.framing === 'bust' ? 'bust' : 'body',
      orientation: value.orientation === 'portrait' ? 'portrait' : 'landscape',
      background: typeof value.background === 'string' && /^#[\da-f]{6}$/i.test(value.background) ? value.background : defaults.background,
      mirror: typeof value.mirror === 'boolean' ? value.mirror : defaults.mirror,
      hands: typeof value.hands === 'boolean' ? value.hands : defaults.hands,
      smoothing: typeof value.smoothing === 'number' && Number.isFinite(value.smoothing) ? Math.min(30, Math.max(4, value.smoothing)) : defaults.smoothing,
      springMotion: value.springMotion === 'off' || value.springMotion === 'full' ? value.springMotion : 'gentle',
      captureResolution: value.captureResolution === '1280x720' ? '1280x720' : '640x480',
      zoom: typeof value.zoom === 'number' && Number.isFinite(value.zoom) ? Math.min(1.6, Math.max(0.65, value.zoom)) : defaults.zoom,
      headRange: typeof value.headRange === 'number' && Number.isFinite(value.headRange) ? Math.min(1.3, Math.max(.5,value.headRange)) : defaults.headRange,
      mouthGain: typeof value.mouthGain === 'number' && Number.isFinite(value.mouthGain) ? Math.min(3, Math.max(.8,value.mouthGain)) : defaults.mouthGain,
    };
}
export function readSettings(key = 'vmodel-settings'): StudioSettings {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(key) ?? '{}'));
  } catch { return { ...defaults }; }
}
