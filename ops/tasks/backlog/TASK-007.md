# TASK-007: Tune appearance and export the reusable Ene avatar

- Status: Todo
- Priority: P0
- Goal: G1
- Depends on: TASK-005, TASK-006
- Estimate: L (2-3 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Finish and validate the deliverable model rather than stopping at an intermediate Blender import.

## Work

- Convert materials to MToon and tune color, outline, transparency and eye appearance against source views.
- Recreate relevant hair/accessory spring bones and colliders; test sudden movement and large frame deltas.
- Export the user-selected cyber-legs variant to assets/avatars/ene.vrm as VRM 1.0 with embedded textures and truthful attribution/usage metadata; record its source hash and variant in the profile.
- Provide scripts/validation and a conversion recipe including manual corrections; save final editable .blend and mapping profile.
- Load the export in the target runtime and a separate VRM-capable viewer; produce ops/reports/ene-avatar-validation.md.

## Acceptance criteria

- [ ] Ene is recognizable with no missing textures or major unintended shading changes.
- [ ] Required humanoid bones, expressions and embedded dependencies pass validation; pose sweeps work after export.
- [ ] Spring motion is stable, can be reduced/disabled, and does not explode after pause/resume.
- [ ] Final .blend, VRM, profile and recipe are available locally; generated assets are excluded from code distribution by default.

## Implementation notes

Closes G1 only when using the actual Ene package. A VRM 0.x compatibility export is optional and must be separately validated if added.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.
