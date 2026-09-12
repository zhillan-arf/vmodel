import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { confidence, point, segmentRotation, smoothingFactor } from '../src/retarget';

describe('retargeting coordinate and failure behavior', () => {
  it('keeps camera horizontal direction while converting vertical and depth axes', () => {
    expect(point({x:0.2,y:0.3,z:-0.4}).toArray()).toEqual([0.2,-0.3,0.4]);
  });
  it('rotates a left arm segment downward without changing bone length', () => {
    const rest=new Vector3(0.4,0,0), target=new Vector3(0,-0.8,0);
    const q=segmentRotation(rest,target)!;
    const actual=rest.clone().applyQuaternion(q);
    expect(actual.x).toBeCloseTo(0);expect(actual.y).toBeCloseTo(-0.4);
    expect(actual.length()).toBeCloseTo(rest.length());
  });
  it('handles opposite directions and rejects coincident or nonfinite landmarks', () => {
    const q=segmentRotation(new Vector3(1,0,0),new Vector3(-1,0,0))!;
    expect(new Vector3(1,0,0).applyQuaternion(q).x).toBeCloseTo(-1);
    expect(segmentRotation(new Vector3(1,0,0),new Vector3())).toBeNull();
    expect(segmentRotation(new Vector3(1,0,0),new Vector3(NaN,0,0))).toBeNull();
    expect(confidence({x:0,y:0,z:0,visibility:0.1})).toBe(false);
  });
  it('has the same smoothing response at 30 and 60 fps over equal time', () => {
    const response=(fps:number)=>{let value=0;for(let i=0;i<fps;i++)value+=(1-value)*smoothingFactor(4,1/fps);return value;};
    expect(response(30)).toBeCloseTo(response(60),10);
    expect(smoothingFactor(12,0)).toBe(0);
  });
});
