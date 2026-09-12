# TASK-033: Author the animated confused desk expression

- Status: Done
- Priority: P0
- Goal: G4
- Controller: [TASK-P03](TASK-P03.md)
- Depends on: TASK-032
- Estimate: S (0.5-1 day)
- Specification: [Web character resources](../../specs/web-character-resources-plan.md)

## Outcome

Create desk-confused as a clearly distinct animated performance using the established desk composition.

## Work

- Derive from TASK-032's camera, crop, desk anchor and pose. Retain screen-right palm presentation and the resting forearm contact.
- Inspect source-index/name mappings for concerned/asymmetrical brow and mouth candidates (including 困る where useful), then tune a readable questioning face rather than relying on the morph name.
- Animate a slight head tilt, uncertain mouth, restrained questioning palm movement and breathing/blink through the shared 3-4 second loop. Keep hair/cloth motion bounded and preserve the loop boundary.
- Save the named editable action, draft animation/contact sheet and a normal-versus-confused comparison at intended display size in ops/reports/web-resource-desk-confused.md.

## Acceptance criteria

- [x] desk-confused is a real bone/morph animation and visually distinguishable from normal, surprise and excitement.
- [x] Camera, crop, anchor, desk contact and dimensions agree with the normal baseline; the face and raised hand remain visible.
- [x] Blink, expression deformation, silhouette and loop seam are reviewed in playback.
- [x] Editable source/action, expression mapping and draft preview are linked in the report.

## Implementation notes

Planned paths are not completed artifacts. Record exact output paths, commands/results and visual evidence before marking Done. Preserve original assets and existing work; keep source and generated character media separate from code distribution. Update TASK-P03 and the backlog after status changes, and summarize material shared dependencies in TASK-P01.


## Completed evidence

[Animation report](../../reports/web-resource-desk-confused.md) links the actual 24 fps editable/pre-secondary and baked scenes, 12 fps animated previews, source-key mapping, all-frame endpoint/contact/framing audit and four-state comparison at 320 CSS px. Chrome/WebP transparency, animated playback and controls passed; the parent controller independently reviewed distinct facial reads. Final 24 fps rendition production and actual-device coverage remain TASK-036/038.
