# TASK-013: Implement standing and visible full-body movement

- Status: In progress
- Priority: P0
- Goal: G2
- Depends on: TASK-011, TASK-012
- Estimate: L (2-4 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Address the user's movement goal beyond a seated talking avatar.

## Work

- Add a standing calibration mode with head-to-feet framing guidance and an explicit mode switch.
- Solve hips, leg segments and knee bend planes; constrain root translation and ground/foot behavior.
- Use observed confidence for legs; keep stable planted/idle fallback when lower body is outside frame.
- Measure hands+standing task scheduling separately and offer a tested lower-cost preset.
- Record a movement checklist: lean, both arm raises, knee bends and small steps; distinguish limitations from failures.

## Acceptance criteria

- [ ] A person fully visible to the camera can demonstrate the prescribed movements with recognizable avatar response.
- [ ] No explosive knees, uncontrolled root drift or limb stretching occurs during occlusion/reacquisition.
- [ ] Seated framing remains stable without inventing foot tracking; standing limitations are documented.

## Implementation notes

Required for release. Exact dance choreography and studio-quality full-body mocap are not claimed.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

## Occlusion and reacquisition stability while standing — 2026-09-13

A system-level test in [retarget-integration.test.ts](../../../tests/retarget-integration.test.ts) drives the solver in **standing** mode through four phases — knees hidden, restored, hips and knees hidden, restored — at 120 frames each, measuring continuously.

- **No explosive knees.** The worst knee rotation across every frame of all four phases stays under 135 degrees.
- **No uncontrolled root drift.** Maximum hip displacement from its pre-occlusion position stays under 0.5 units across the whole sequence.
- **No limb stretching.** Bone lengths for both lower legs, both feet and both arms are unchanged to ten decimal places from before occlusion to after reacquisition.

**Boundary:** synthetic landmark frames through the real solver, so this establishes the numeric stability the criterion names. It does **not** establish that a person moving in front of a camera produces recognisable standing motion, which is the separate first criterion and needs the operator. The criterion stays open pending that check.
