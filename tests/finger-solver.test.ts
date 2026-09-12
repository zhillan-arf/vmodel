import { expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { limitFingerRotation } from '../src/finger-solver';

it('preserves ordinary curl on either anatomical side', () => {
  for (const sign of [-1,1]) {
    const axis = new Vector3(0,0,sign), curl = new Quaternion().setFromAxisAngle(axis,1.1);
    expect(limitFingerRotation(curl,axis,'intermediate').angleTo(curl)).toBeLessThan(1e-6);
  }
});
it('limits backward and excessive curl while allowing different joint ranges', () => {
  const axis = new Vector3(0,0,-1);
  const backward = limitFingerRotation(new Quaternion().setFromAxisAngle(axis,-1),axis,'proximal');
  expect(backward.angleTo(new Quaternion().setFromAxisAngle(axis,-.1))).toBeLessThan(1e-6);
  const excessive = new Quaternion().setFromAxisAngle(axis,2.8);
  expect(limitFingerRotation(excessive,axis,'distal').angleTo(new Quaternion())).toBeCloseTo(1.55);
  expect(limitFingerRotation(excessive,axis,'intermediate').angleTo(new Quaternion())).toBeCloseTo(1.9);
});
it('allows modest knuckle spread and rejects malformed input', () => {
  const axis = new Vector3(0,0,1), spread = new Quaternion().setFromAxisAngle(new Vector3(0,1,0),1);
  expect(limitFingerRotation(spread,axis,'proximal').angleTo(new Quaternion())).toBeCloseTo(.3);
  expect(limitFingerRotation(spread,axis,'distal').angleTo(new Quaternion())).toBeCloseTo(.08);
  expect(limitFingerRotation(new Quaternion(NaN,0,0,1),axis,'proximal').angleTo(new Quaternion())).toBe(0);
});
