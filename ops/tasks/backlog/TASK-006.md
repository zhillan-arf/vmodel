# TASK-006: Map and repair Ene facial expressions

- Status: Todo
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

- [ ] Each eye closes independently without crossing or exposing unintended geometry.
- [ ] Mouth-open visibly animates speaking, returns cleanly to neutral and does not distort unrelated features.
- [ ] Optional missing vowels/emotions are listed; full 52-shape compatibility is not claimed.

## Implementation notes

Use visual jaw opening for baseline speech; phoneme recognition is outside this task.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.
