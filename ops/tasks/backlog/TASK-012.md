# TASK-012: Implement wrist and visible finger tracking

- Status: Todo
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

