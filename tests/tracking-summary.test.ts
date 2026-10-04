import {describe,it,expect} from 'vitest';
import {trackingSummary} from '../src/tracking-summary';
import type {SolverOutcome} from '../src/tracking-diagnostics';
const outcome=(channel:string,accepted=true,reason:SolverOutcome['reason']='accepted'):SolverOutcome=>({channel,accepted,reason,stage:'solver'});
describe('tracking summary',()=>{
  it('keeps all four rows without claiming acceptance before solver use',()=>{
    const result=trackingSummary([]);expect(result.rows.map(row=>row.label)).toEqual(['Face','Body','Left hand','Right hand']);
    expect(result.rows.every(row=>row.text==='No solver result.')).toBe(true);
  });
  it('keeps arm results in Body and finger results on their anatomical side',()=>{
    const result=trackingSummary([outcome('leftArm'),outcome('leftIndexProximal'),outcome('rightHand',false,'low_visibility')]);
    expect(result.rows[1].text).toContain('Accepted: 1');expect(result.rows[2].text).toContain('Accepted: 1');expect(result.rows[3].text).toContain('low visibility');
  });
  it('does not assign an ambiguous hand candidate to either side',()=>{
    const result=trackingSummary([outcome('hand candidate 0',false,'hand_score')]);
    expect(result.rows[2].text).toBe('No solver result.');expect(result.rows[3].text).toBe('No solver result.');expect(result.shared).toContain('hand score');
  });
  it('includes face coefficients and preserves mixed decisions',()=>{
    const result=trackingSummary([outcome('head.x',true,'clamped'),outcome('eyeBlinkLeft'),outcome('jawOpen',false,'invalid_value')]);
    expect(result.rows[0].text).toBe('Accepted: 2. Rejected: 1. Reasons: clamped, accepted, invalid value.');
  });
});
