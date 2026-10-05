import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { captureFaceNeutral, faceChannels, faceExpressions, hasFaceBinding, relativeFaceValue, solveFaceExpressions } from '../src/face-expressions';
import { MotionSolver } from '../src/motion-solver';
import { validCalibration } from '../src/profiles';
import { defaults, type TrackingFrame } from '../src/types';

const available = () => true;
const vowels = ['aa', 'ih', 'ou', 'ee', 'oh'];

describe('extended face controls', () => {
  it('treats an empty VRM preset as unavailable', () => {
    expect(hasFaceBinding({ binds: [] })).toBe(false);
    expect(hasFaceBinding(undefined)).toBe(false);
    expect(hasFaceBinding({ binds: [{}] })).toBe(true);
    const result = solveFaceExpressions({ jawOpen: 1, mouthStretchLeft: 1, mouthStretchRight: 1 }, 1, true,
      name => hasFaceBinding({ binds: name === 'ee' ? [] : [{}] }));
    expect(result.aa + result.ih).toBeCloseTo(1);
    expect(result.ee).toBeUndefined();
  });
  it('removes the neutral offset and retains full movement', () => {
    const neutral = captureFaceNeutral({ jawOpen: .2, eyeBlinkLeft: .1, browDownLeft: .3, mouthSmileLeft: NaN });
    expect(relativeFaceValue(.2, neutral.jawOpen)).toBe(0);
    expect(relativeFaceValue(.6, neutral.jawOpen)).toBeCloseTo(.5);
    expect(relativeFaceValue(1, neutral.jawOpen)).toBe(1);
    expect(neutral).not.toHaveProperty('mouthSmileLeft');
    expect(validCalibration({ version: 1, head: [0, 0, 0, 1], root: [0, 0, 0], face: neutral })).toBe(true);
    for (const face of [{ jawOpen: Infinity }, { jawOpen: .9 }, { unknown: .2 }, []]) {
      expect(validCalibration({ version: 1, head: [0, 0, 0, 1], root: [0, 0, 0], face })).toBe(false);
    }
  });
  it('limits combined mouth, brow, and eye controls', () => {
    for (const level of [0, .1, .5, 1]) {
      const result = solveFaceExpressions(Object.fromEntries(faceChannels.map(name => [name, level])), 3, true, available);
      expect(Object.values(result).every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
      expect(vowels.reduce((sum, name) => sum + (result[name] ?? 0), 0) + result.vmodelMouthSmile + result.vmodelMouthFrown).toBeLessThanOrEqual(1.000001);
      for (const side of ['Left', 'Right']) {
        expect(result[`vmodelBrowUp${side}`] + result[`vmodelBrowDown${side}`] + result.vmodelBrowWorry).toBeLessThanOrEqual(1.000001);
        expect(result[`blink${side}`] + result[`vmodelEyeWide${side}`]).toBeLessThanOrEqual(1.000001);
      }
    }
  });
  it('uses available vowel shapes and rejects invalid coefficients', () => {
    const face = { jawOpen: .5, mouthFunnel: .8, mouthPucker: .2 };
    const full = solveFaceExpressions(face, 1, true, available);
    expect(full.oh).toBeGreaterThan(full.aa);
    const fallback = solveFaceExpressions(face, 1, true, name => name === 'aa');
    expect(fallback.aa).toBeCloseTo(.5);
    expect(fallback.oh).toBeUndefined();
    const invalid = solveFaceExpressions({ jawOpen: NaN, eyeBlinkLeft: Infinity, browDownLeft: -1 }, 1, true, available);
    expect(Object.values(invalid).every(value => value === 0)).toBe(true);
  });
  it('retains separate left and right brow controls', () => {
    const result = solveFaceExpressions({ browOuterUpLeft: 1, browDownRight: 1 }, 1, true, available);
    expect(result.vmodelBrowUpLeft).toBe(.7);
    expect(result.vmodelBrowUpRight).toBe(0);
    expect(result.vmodelBrowDownRight).toBe(.7);
    expect(result.vmodelBrowDownLeft).toBe(0);
  });
});

function fixture() {
  const values = new Map<string, number>();
  const solver = new MotionSolver({ scene: new Object3D(), humanoid: { resetNormalizedPose() {}, getNormalizedBoneNode: () => null },
    expressionManager: { getExpression: available, getValue: name => values.get(name), setValue: (name, value) => { values.set(name, value); } } });
  const frame: TrackingFrame = { version: 1, sequence: 1, timestamp: 1000, face: {}, faceMatrix: null, pose: [], poseImage: [], hands: [], inferenceMs: 0,
    samples: { face: { timestamp: 1000, present: true, inferenceMs: 0 }, pose: { timestamp: 1000, present: false, inferenceMs: 0 }, hands: { timestamp: 1000, present: false, inferenceMs: 0 } } };
  const settings = { ...defaults, faceDetail: 'extended' as const, mouthGain: 1 };
  const settle = (input: TrackingFrame | null, now = 1000) => { for (let i = 0; i < 90; i++) solver.update(input, settings, 1 / 60, now); };
  return { solver, frame, values, settings, settle };
}

it('calibrates face controls and restores saved calibration', () => {
  const { solver, frame, values, settle } = fixture();
  frame.face = { jawOpen: .2, browOuterUpLeft: .3 };
  solver.calibrate(frame); settle(frame);
  expect(values.get('aa')).toBe(0);
  expect(values.get('vmodelBrowUpLeft')).toBe(0);
  const saved = solver.getCalibration();
  solver.setCalibration(null); settle(frame);
  expect(values.get('aa')).toBeGreaterThan(.19);
  solver.setCalibration(saved); settle(frame);
  expect(values.get('aa')).toBeLessThan(.001);
  expect(solver.getCalibration()).toEqual(saved);
});

it('releases automatic controls during manual expressions, face loss, and mode changes', () => {
  const { solver, frame, values, settings, settle } = fixture();
  frame.face = { jawOpen: 1, eyeBlinkLeft: 1, browOuterUpLeft: 1 };
  settle(frame);
  expect(values.get('aa')).toBeGreaterThan(.99);
  solver.setExpression('surprised'); settle(frame);
  expect(values.get('surprised')).toBeGreaterThan(.74);
  expect(values.get('aa')).toBeLessThan(.001);
  expect(values.get('blinkLeft')).toBeLessThan(.001);
  solver.setExpression('neutral'); settle(frame);
  expect(values.get('aa')).toBeGreaterThan(.99);
  settle(frame, 2000);
  for (const name of faceExpressions) expect(values.get(name)).toBeLessThan(.001);
  settle(frame);
  for (let i = 0; i < 90; i++) solver.update(frame, { ...settings, faceDetail: 'basic' }, 1 / 60, 1000);
  expect(values.get('vmodelBrowUpLeft')).toBeLessThan(.001);
  expect(values.get('aa')).toBeGreaterThan(.99);
  settle(null);
  for (const name of faceExpressions) expect(values.get(name)).toBeLessThan(.001);
});
