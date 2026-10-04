# TASK-007: Tune appearance and export the reusable Ene avatar

- Status: Done
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
- Load the export in the target runtime and a separate VRM-capable viewer; produce ops/001-zhil/sprint-001/reports/ene-avatar-validation.md.

## Acceptance criteria

- [x] Ene is recognizable with no missing textures or major unintended shading changes.
- [x] Required humanoid bones, expressions and embedded dependencies pass validation; pose sweeps work after export.
- [x] Spring motion is stable, can be reduced/disabled, and does not explode after pause/resume.
- [x] Final .blend, VRM, profile and recipe are available locally; generated assets are excluded from code distribution by default.

## Implementation notes

Closes G1 only when using the actual Ene package. A VRM 0.x compatibility export is optional and must be separately validated if added.

Completed 2026-09-12. The [avatar validation report](../../reports/ene-avatar-validation.md) links the final model, editable scene, recipe and evidence. Final output SHA-256: `3657b97928638e7ada5f6639141fb63f555912049a2c6ec217851001e322cbcb`. Its 53 mappings, 11 explicit expressions and embedded dependencies pass the validator; glTF has zero errors and 49 documented material-extension warnings. The same final hash appears in the 13-pose sweep and independent Blender reimport. Springs are included in the editable scene, tuned from the automatic defaults and support Gentle/Full/Off with verified pause/re-enable behavior. Export replay explicitly supplies the mesh selection and rejects skeleton-only candidates. G2 live-motion and recording acceptance remain separate.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.
