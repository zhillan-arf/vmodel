# TASK-014: Validate the supplied VMD and document motion preview compatibility

- Status: Done
- Priority: P1
- Goal: G1 support
- Depends on: TASK-004, TASK-005
- Estimate: S-M (0.5-1.5 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Determine whether the supplied motion can usefully animate Ene without blocking live tracking.

## Work

- Perform a bounds-checked full VMD parse using a maintained reader/importer; include morph and optional camera/light/IK sections.
- Compare motion bone/morph channels with the actual Ene rig, accounting for its different embedded model name.
- Test import on a copy of the source scene. Report mapped/unmapped channels, IK issues and any retargeting steps.
- If compatible, save a short Blender preview or baked compatible animation; keep any runtime playback mutually exclusive with live body control.
- If incompatible, retain the source and provide a clear report; use a known compatible test motion only with suitable provenance.

## Acceptance criteria

- [x] ops/001-zhil/sprint-001/reports/ene-vmd-compatibility.md records parse validity and mapping evidence.
- [x] A compatible preview is demonstrated or incompatibility is specifically explained; neither outcome is represented as a model conversion.
- [x] Live application acceptance has no dependency on this VMD working.

## Implementation notes

Full arbitrary VMD retargeting/editor development is not required to close this bounded investigation.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

## Completion evidence — 2026-09-12

[Compatibility report](../../reports/ene-vmd-compatibility.md) records the full bounds-checked parse, 57/260 bone and 20/74 morph matches, four enabled IK controls, and all seven inspected pose renders. The supplied animation usefully drives the existing Cyber legs rig in [the editable Blender preview](../../../../../assets/work/ene/vmd-inspection.blend), with partial mapping and production cleanup limits explicitly documented.

Validation: `blender.exe --background --python scripts/inspect_vmd.py` exited 0 and imported with `FINISHED`. Saved-scene readback confirmed three animation owners and checked all 349 frames with zero nonfinite bone transforms; see [audit](../../reports/vmd-preview-audit.json). VMD, Cyber legs PMX and final VRM hashes remained unchanged. No continuous rendered-video review, physics bake, general retargeting editor or seamless-loop acceptance is claimed. The live application has no VMD playback dependency.

