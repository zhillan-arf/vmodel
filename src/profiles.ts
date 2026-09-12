import { normalizeSettings, type Calibration, type StudioSettings } from './types';
export interface CalibrationScope { avatar: string; device: string; mode: StudioSettings['mode']; format: string }
export const avatarSettingsKey = (avatar: string) => `vmodel-avatar-settings:${avatar}`;
const calibrationKey = (scope: CalibrationScope) => `vmodel-calibration:${JSON.stringify(scope)}`;
export function saveLocal(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function validCalibration(value: unknown): value is Calibration {
  if (!value || typeof value !== 'object') return false;
  const c = value as Calibration;
  if (c.version !== 1 || !Array.isArray(c.head) || c.head.length !== 4 || !Array.isArray(c.root) || c.root.length !== 3) return false;
  if (![...c.head, ...c.root].every(v => typeof v === 'number' && Number.isFinite(v))) return false;
  const norm = Math.hypot(...c.head);
  return norm > 0.99 && norm < 1.01 && c.root.every(v => Math.abs(v) < 10);
}
export function readCalibration(scope: CalibrationScope | null): Calibration | null {
  if (!scope?.avatar || !scope.device) return null;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(calibrationKey(scope)) ?? 'null');
    return validCalibration(value) ? value : null;
  } catch { return null; }
}
export function saveCalibration(scope: CalibrationScope | null, value: Calibration) {
  return !!scope?.avatar && !!scope.device && validCalibration(value) && saveLocal(calibrationKey(scope), value);
}
export function clearAvatarCalibration(avatar: string): boolean {
  try {
    const prefix = 'vmodel-calibration:';
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    for (const key of keys) {
      if (!key?.startsWith(prefix)) continue;
      try {
        if (JSON.parse(key.slice(prefix.length)).avatar === avatar) localStorage.removeItem(key);
      } catch { /* An unrelated malformed key cannot affect this avatar. */ }
    }
    return true;
  } catch { return false; }
}
export function parseSettingsFile(text: string, avatar: string): StudioSettings {
  if (text.length > 65536) throw new Error('Settings file is too large.');
  const value = JSON.parse(text);
  if (value?.type !== 'vmodel-settings' || value.version !== 1 || value.avatar !== avatar || value.settings?.version !== 1) {
    throw new Error('Choose settings saved for this avatar and this app version.');
  }
  return normalizeSettings(value.settings);
}
