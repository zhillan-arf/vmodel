import type { SolverOutcome } from './tracking-diagnostics';
export function trackingSummary(outcomes: readonly SolverOutcome[]) {
  const groups = { Face: [] as SolverOutcome[], Body: [] as SolverOutcome[], 'Left hand': [] as SolverOutcome[], 'Right hand': [] as SolverOutcome[] };
  const shared: SolverOutcome[] = [];
  for (const outcome of outcomes) {
    const channel = outcome.channel;
    if (/^(head(?:\.|$)|face$|neck$|eyeBlink|mouthSmile|jawOpen$|aa$)/.test(channel)) groups.Face.push(outcome);
    else if (/hand|thumb|index|middle|ring|little/i.test(channel)) {
      if (channel.startsWith('left')) groups['Left hand'].push(outcome);
      else if (channel.startsWith('right')) groups['Right hand'].push(outcome);
      else shared.push(outcome);
    } else groups.Body.push(outcome);
  }
  const describe = (items: readonly SolverOutcome[]) => {
    if (!items.length) return 'No solver result.';
    const accepted = items.filter(item => item.accepted).length;
    const reasons = [...new Set(items.map(item => item.reason.replaceAll('_', ' ')))];
    return `Accepted: ${accepted}. Rejected: ${items.length - accepted}. Reasons: ${reasons.join(', ')}.`;
  };
  return { rows: Object.entries(groups).map(([label, items]) => ({ label, text: describe(items) })), shared: shared.length ? `Unassigned hand results. ${describe(shared)}` : '' };
}
