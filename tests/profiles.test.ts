import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { avatarSettingsKey, clearAvatarCalibration, parseSettingsFile, readCalibration, saveCalibration, saveLocal, validCalibration, type CalibrationScope } from '../src/profiles';
import { defaults, readSettings, type Calibration } from '../src/types';

const scope: CalibrationScope = { avatar: 'ene', device: 'camera-a', mode: 'seated', format: '640x480' };
const neutral: Calibration = { version: 1, head: [0, 0, 0, 1], root: [.5, -.5, 0] };
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    get length() { return storage.size; },
    key: (i: number) => [...storage.keys()][i] ?? null,
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('saved profiles and calibration', () => {
  it('restores neutral only for the same avatar, camera, movement and actual capture format', () => {
    expect(saveCalibration(scope, neutral)).toBe(true);
    expect(readCalibration({ ...scope })).toEqual(neutral);
    for (const other of [{ avatar: 'other' }, { device: 'camera-b' }, { mode: 'standing' as const }, { format: '1280x720' }]) {
      expect(readCalibration({ ...scope, ...other })).toBeNull();
    }
    expect(saveCalibration(null, neutral)).toBe(false);
  });
  it('rejects corrupt, stale and nonfinite neutral poses', () => {
    for (const invalid of [null, {}, { ...neutral, version: 2 }, { ...neutral, head: [0, 0, 0, 0] }, { ...neutral, root: [NaN, 0, 0] }, { ...neutral, root: [100, 0, 0] }]) {
      expect(validCalibration(invalid)).toBe(false);
    }
    saveCalibration(scope, neutral);
    storage.set([...storage.keys()][0], '{broken');
    expect(readCalibration(scope)).toBeNull();
  });
  it('reset removes every saved neutral for the current avatar and preserves other avatars/settings', () => {
    saveCalibration(scope, neutral);
    saveCalibration({ ...scope, mode: 'standing' }, neutral);
    saveCalibration({ ...scope, avatar: 'other' }, neutral);
    saveLocal(avatarSettingsKey('other'), { ...defaults, zoom: 1.5 });
    storage.set('vmodel-calibration:broken', 'unrelated');
    expect(clearAvatarCalibration('ene')).toBe(true);
    expect(readCalibration(scope)).toBeNull();
    expect(readCalibration({ ...scope, mode: 'standing' })).toBeNull();
    expect(readCalibration({ ...scope, avatar: 'other' })).toEqual(neutral);
    expect(readSettings(avatarSettingsKey('other')).zoom).toBe(1.5);
  });
  it('normalizes saved settings and rejects foreign or oversized settings imports', () => {
    const file = { type: 'vmodel-settings', version: 1, avatar: 'ene', settings: { ...defaults, zoom: 999, background: '<script>', mode: 'wrong', unused: 'discard' } };
    expect(parseSettingsFile(JSON.stringify(file), 'ene')).toEqual({ ...defaults, zoom: 1.6 });
    expect(() => parseSettingsFile(JSON.stringify(file), 'other')).toThrow('this avatar');
    expect(() => parseSettingsFile(' '.repeat(65537), 'ene')).toThrow('too large');
    saveLocal('vmodel-settings', { ...defaults, version: 0 });
    expect(readSettings()).toEqual(defaults);
  });
  it('keeps the app usable when storage is denied or full', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, get length() { throw new Error('denied'); } });
    expect(saveLocal('x', {})).toBe(false);
    expect(saveCalibration(scope, neutral)).toBe(false);
    expect(readCalibration(scope)).toBeNull();
    expect(readSettings()).toEqual(defaults);
    expect(clearAvatarCalibration('ene')).toBe(false);
  });
});
