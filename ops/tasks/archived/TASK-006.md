# TASK-006: Map and repair Ene facial expressions

- Status: Done
- Priority: P0
- Goal: G1, G2
- Depends on: TASK-005
- Estimate: M-L (1-3 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Provide the facial controls required for webcam speaking and expression.

## Work

- Inspect the 50 existing MMD morph entries and map suitable ones to VRM expressions, starting with blink, left/right wink and the existing vowel shapes identified in the specification. Store source index plus name to disambiguate duplicate toon morph names.
- Create or repair independent left/right blink and mouth-open controls; add vowel/emotion shapes where practical.
- Document raw morph names, output expression names, ranges, mutually exclusive shapes and manual-override priorities.
- Validate combined blink, jaw and smile poses and save the editable scene/profile.

## Acceptance criteria

- [x] Each eye closes independently without crossing or exposing unintended geometry.
- [x] Mouth-open visibly animates speaking, returns cleanly to neutral and does not distort unrelated features.
- [x] Optional missing vowels/emotions are listed; full 52-shape compatibility is not claimed.

## Implementation notes

Use visual jaw opening for baseline speech; phoneme recognition is outside this task.

Completed 2026-09-12. Independent blinks, full `aa`, combined smile/blink/jaw and return-to-neutral were rendered and inspected in the [pose sweep](../../reports/pose-sweep.json). The [profile](../../../config/avatars/ene.json) records source names, indices and ranges for 11 explicit expressions. The [recipe](../../../docs/avatar-conversion.md) documents overlap/override rules and the missing optional `ee`; no full ARKit set is claimed. Automatic extra presets, including inappropriate eyebrow-to-gaze mappings, are cleared consistently from the saved scene and export.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.
