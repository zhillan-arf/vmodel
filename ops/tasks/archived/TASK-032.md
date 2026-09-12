# TASK-032: Author the shared desk pose and animated normal expression

- Status: Done
- Priority: P0
- Goal: G4
- Controller: [TASK-P03](TASK-P03.md)
- Depends on: TASK-030
- Estimate: S-M (1-2 days)
- Specification: [Web character resources](../../specs/web-character-resources-plan.md)

## Outcome

Create desk-normal and the shared composition for all four screenshot-inspired desk performances.

## Work

- Pose Ene waist-up with a slight forward lean toward the viewer, open palm on screen-right, and the other forearm at a desk line, using the first user screenshot as the composition reference.
- Preserve the actual Cyber legs character design. Keep the face, whole raised hand, headset and moving hair visible; author plausible seated lower-body positioning behind the crop.
- Set one locked 960x960 transparent camera, shared normalized desk anchor and safe bounds; plan the 480x480 rendition. Use an invisible desk contact guide and keep room/text/desk out of final RGBA frames.
- Author a 3-4 second normal loop with a relaxed friendly expression, blink, breathing and small living motion. Verify morph interactions and stable hand contact.
- Save an editable shared pose/action baseline and low-resolution animated preview; document camera, anchors, pose, duration and source index/name expression mapping in ops/reports/web-resource-desk-normal.md.

## Acceptance criteria

- [x] desk-normal is visibly animated and follows the screenshot's presenting-at-a-desk composition.
- [x] A fixed camera/anchor baseline is reusable for the three expression variants; all moving extremities remain within safe bounds.
- [x] Normal expression is readable at 320 CSS px without relying on a label, and its blink/mouth geometry is intact.
- [x] Editable source, pose/expression mapping, draft animation and loop/contact review evidence exist.

## Implementation notes

Planned paths are not completed artifacts. Record exact output paths, commands/results and visual evidence before marking Done. Preserve original assets and existing work; keep source and generated character media separate from code distribution. Update TASK-P03 and the backlog after status changes, and summarize material shared dependencies in TASK-P01.


## Completed evidence

Implemented the three-second desk loop and reusable camera/pose baseline. [Animation report](../../reports/web-resource-desk-normal.md) links editable pre-secondary/baked scenes, 24 fps source and 12 fps playable previews, all-frame loop/contact audit, expression mapping and 320 CSS px review. The original screenshot attachment was unavailable; the written composition brief was followed and direct attachment comparison remains unverified. Final 24 fps media/device/site acceptance remains TASK-036/038.
