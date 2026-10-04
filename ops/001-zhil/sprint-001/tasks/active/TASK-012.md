# TASK-012: Implement wrist and visible finger tracking

- Status: In progress
- Priority: P0
- Goal: G2
- Depends on: TASK-009, TASK-011
- Estimate: L (2-3 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Support waves and visible hand gestures while treating occlusion realistically.

## Work

- Associate hand detections with pose wrists and preserve person-left/person-right under mirroring.
- Solve palm orientation and finger flexion into available humanoid joints with calibrated limits.
- Define reliable hand input ownership over wrists; blend to pose-only wrist orientation when hands disappear.
- Provide finger tracking toggle and low-cost hand cadence.
- Test open palm, fist, wave, hands crossing and disappearance; document finger joints missing from an imported avatar.

## Acceptance criteria

- [ ] Open/close and wave gestures visibly animate supported fingers and wrists.
- [ ] Crossing hands does not cause persistent identity swaps; uncertain detections decay safely.
- [ ] Hands leaving/reentering frame do not lock in an extreme pose.

## Implementation notes

Do not infer observed motion for fingers that the rig cannot deform; repair needed Ene rig gaps before final acceptance.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

## Hand identity, uncertainty and reentry through the full solver — 2026-09-13

Three tests in [retarget-integration.test.ts](../../../../../tests/retarget-integration.test.ts) drive the whole retargeter, so what is checked is the effect on the rig rather than the association rule in isolation. The seventeen existing [association unit tests](../../../../../tests/retarget-math.test.ts) already cover the assignment rule itself.

- **Crossing wrists leave no persistent identity swap.** With the wrists exchanged in image space *and* the detector's ordering reversed for 90 frames, returning to the original arrangement restores both hand orientations to within 0.05 rad of their pre-crossing values.
- **Uncertain detections are not adopted.** Detections below the association score floor are dropped, the goal expires and each hand decays to rest within 0.1 rad rather than being yanked toward the bogus pose.
- **Leaving and re-entering frame locks nothing.** After 120 frames with no detections and a stale hand sample, both hands stay finite; when detections return, both recover to within 0.05 rad of their established orientations.

### The tests passed before they tested anything

All three passed on first run and were **meaningless**. A vacuity guard — asserting the hands actually rotate the rig away from identity — failed immediately, exposing two silent skips:

1. The mock rig had no finger bones. The solver builds a palm basis from `Hand`, `MiddleProximal`, `IndexProximal` and `LittleProximal`; with any missing there is no palm, and the entire hand path is skipped without error. The harness now carries proximal, intermediate and distal bones for all four fingers on both sides.
2. The synthetic landmarks were collinear, which the solver correctly rejects as a degenerate palm. They now form real geometry spanning a plane.

A third correction followed: the uncertainty test asserted the hand stayed near its driven pose, which is backwards. Rejected detections *should* relax to rest, and measuring 2.139 rad of travel was the solver behaving correctly against a wrong expectation.

The guard is retained in the first test so this cannot silently regress.

**Boundary:** synthetic landmark frames through the real solver. This covers the two criteria that are numeric — no persistent identity swap, safe decay, no locked pose on reentry. Whether open, close and wave gestures **visibly** animate fingers and wrists is a separate judgement needing the operator, so no box is ticked.
