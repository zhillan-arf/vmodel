# TASK-034: Author the animated surprised desk expression

- Status: Done
- Priority: P0
- Goal: G4
- Controller: [TASK-P03](TASK-P03.md)
- Depends on: TASK-032
- Estimate: S (0.5-1 day)
- Specification: [Web character resources](../../specs/web-character-resources-plan.md)

## Outcome

Create desk-surprised with a readable surprised face and controlled reaction motion.

## Work

- Reuse the common desk camera/crop/anchor and presenting pose; author a small recoil and settle that keeps the forearm contact plausible.
- Inspect and tune widened eyes/raised brows, including びっくり where useful, and a rounded mouth. Check lid and pupil behavior; surprise must remain distinct from a broad excited smile.
- Create a 3-4 second loop with subtle secondary motion and a matching boundary. Coordinate blink timing so it does not erase the primary surprised look.
- Save the editable named action, expression map, draft animation/contact sheet and small-display comparison in ops/reports/web-resource-desk-surprised.md.

## Acceptance criteria

- [x] desk-surprised contains actual face/body animation with a clearly surprised expression, not a relabeled excited state.
- [x] Shared framing/desk anchor are stable and no reaction motion leaves the safe crop or breaks major contact.
- [x] Mouth/eyelid deformation, secondary motion and loop continuity pass visual review.
- [x] Editable source/action, mapping and draft playback evidence are recorded.

## Implementation notes

Planned paths are not completed artifacts. Record exact output paths, commands/results and visual evidence before marking Done. Preserve original assets and existing work; keep source and generated character media separate from code distribution. Update TASK-P03 and the backlog after status changes, and summarize material shared dependencies in TASK-P01.


## Completed evidence

[Animation report](../../reports/web-resource-desk-surprised.md) links the actual 24 fps editable/pre-secondary and baked scenes, 12 fps animated previews, source-key mapping, all-frame endpoint/contact/framing audit and four-state comparison at 320 CSS px. Chrome/WebP transparency, animated playback and controls passed; the parent controller independently reviewed distinct facial reads. Final 24 fps rendition production and actual-device coverage remain TASK-036/038.
