import type { SolverOutcome } from './tracking-diagnostics';
export function trackingSummary(outcomes: readonly SolverOutcome[]) {
  const groups = { Face: [] as SolverOutcome[], Body: [] as SolverOutcome[], 'Left hand': [] as SolverOutcome[], 'Right hand': [] as SolverOutcome[] };
  const shared: SolverOutcome[] = [];
  for (const outcome of outcomes) {
    if(outcome.stage.startsWith('confidence.'))continue;
    const channel = outcome.channel;
    if (/^(head(?:\.|$)|face$|neck$|leftEye$|rightEye$|eyeBlink|mouthSmile|jawOpen$|aa$)/.test(channel)) groups.Face.push(outcome);
    else if (/hand|thumb|index|middle|ring|little/i.test(channel)) {
      if (channel.startsWith('left')) groups['Left hand'].push(outcome);
      else if (channel.startsWith('right')) groups['Right hand'].push(outcome);
      else shared.push(outcome);
    } else groups.Body.push(outcome);
  }
  const describe = (items: readonly SolverOutcome[]) => {
    if (!items.length) return 'No solver result.';
    const measured=items.filter(item=>item.stage!=='application');
    const accepted = new Set(measured.filter(item => item.reason==='accepted').map(item=>item.channel)).size;
    const rejected = new Set(measured.filter(item => !item.accepted).map(item=>item.channel)).size;
    const states=[...new Set(items.filter(item=>item.stage==='application').map(item=>item.reason))];
    const reasons = [...new Set(items.map(item => item.reason.replaceAll('_', ' ')))];
    return `Accepted: ${accepted}. Rejected: ${rejected}. Reasons: ${reasons.join(', ')}.${states.length?' Motion: '+states.join(', ')+'.':''}`;
  };
  return { rows: Object.entries(groups).map(([label, items]) => ({ label, text: describe(items) })), shared: shared.length ? `Unassigned hand results. ${describe(shared)}` : '' };
}
