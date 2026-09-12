# TASK-011: Implement torso and arm motion for seated performance

- Status: In progress
- Priority: P0
- Goal: G2
- Depends on: TASK-008, TASK-009, TASK-010
- Estimate: L (2-3 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Make the avatar follow upper-body gestures, not only face movement.

## Work

- Solve torso/shoulder orientation and arm segments from pose landmarks with avatar proportions and rest transforms.
- Implement elbow bend-plane continuity, joint limits and confidence gating; use constrained IK where needed.
- Keep seated root stable and define channel ownership so body solving does not overwrite face controls.
- Add comfortable arm idle and per-limb tracking-loss fades.
- Test lean, arm raises, elbows bent, crossed/hidden arms and one arm out of frame using deterministic fixtures and a live check.

## Acceptance criteria

- [ ] Both arm raises and torso lean follow the correct side with stable elbows.
- [ ] Hidden limbs relax smoothly without stretching, snapping or moving the whole avatar off-screen.
- [x] Recorded synthetic failures do not produce NaN transforms or unbounded rotations.

## Implementation notes

Live acceptance with Ene is repeated in TASK-021 after avatar export.

2026-09-12 checkpoint: parent-first world solving and stable limb planes are integrated. [Audit/integration report](../../reports/retarget-audit.md), hierarchy/limb unit tests and [actual-Ene fixtures](../../reports/retarget-fixture-smoke.json) verify finite bounded transforms, unchanged segment lengths, sample expiry and recovery under synthetic inputs. Physical raises, lean and hidden-limb behavior remain unchecked.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

