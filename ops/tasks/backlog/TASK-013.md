# TASK-013: Implement standing and visible full-body movement

- Status: Todo
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

