# TASK-005: Prepare Ene's humanoid rig and deformation

- Status: Done
- Priority: P0
- Goal: G1
- Depends on: TASK-004
- Estimate: L (2-4 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Create an exportable humanoid rig while preserving recognizable shape and useful existing weights.

## Work

- Map the actual MMD skeleton to VRM humanoid bones, including required legs even for seated use.
- Normalize scale/rest pose and record coordinate/rest offsets; handle helper, twist and IK bones according to their actual influence.
- Repair weight problems and missing required bones as needed; keep an editable source rig and export rig distinction where useful.
- Save config/avatars/ene rig mappings and a reproducible pose sweep for neck, shoulders, elbows, wrists, hips, knees and fingers.

## Acceptance criteria

- [x] All required humanoid assignments are valid with no contradictory mappings.
- [x] A T-pose and arm raise, elbow bend, head turn and squat show no major collapse, inversion or detached geometry.
- [x] Bone exclusions are justified by inspection; no weighted geometry is broken by cleanup.

## Implementation notes

Manual weight painting may be necessary; scripts should automate repeatable operations, not hide missing rig quality.

Completed 2026-09-12. [Avatar validation](../../reports/ene-avatar-validation.md), [rig audit](../../reports/rig-audit.json) and [pose sweep](../../reports/pose-sweep.json) record the inspected result. All 53 configured assignments are unique and have valid ancestry; zero vertices lack deform weights. Weighted helpers remain attached, D leg bones follow FK counterparts, and the single degenerate triangle repair preserves vertex/shape indexing. Rest bases and constraint exclusions are recorded in export preparation. Runtime live-pose quality remains in TASK-010 through TASK-013.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

