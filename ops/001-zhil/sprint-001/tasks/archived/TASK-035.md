# TASK-035: Author the animated excited desk expression

- Status: Done
- Priority: P0
- Goal: G4
- Controller: [TASK-P03](TASK-P03.md)
- Depends on: TASK-032
- Estimate: S (0.5-1 day)
- Specification: [Web character resources](../../specs/web-character-resources-plan.md)

## Outcome

Create desk-excited with a cheerful face and lively but controlled movement in the common pose.

## Work

- Reuse the normal desk camera/crop/anchor and hand arrangement. Tune a broad happy expression from existing smile/brow/mouth shapes, keeping Ene recognizable and the eyes readable.
- Animate a small buoyant head/shoulder response and lively raised palm, breathing and blink within the shared 3-4 second loop. Preserve forearm/desk contact and avoid excessive hair motion.
- Compare all four desk expressions at 320 CSS px to ensure normal, confused, surprised and excited have different facial reads.
- Save the named editable action, expression mapping, draft animation/contact sheet and comparison in ops/001-zhil/sprint-001/reports/web-resource-desk-excited.md.

## Acceptance criteria

- [x] desk-excited is an animated performance with an unmistakable happy/excited face distinct from normal and surprise.
- [x] Composition, dimensions and desk anchor match the common baseline; no major clipping or cropped animated silhouette remains.
- [x] Loop seam, blink/mouth behavior and hair/cloth settling have playback evidence.
- [x] Editable source/action, mappings and draft animation plus four-state comparison are recorded.

## Implementation notes

Planned paths are not completed artifacts. Record exact output paths, commands/results and visual evidence before marking Done. Preserve original assets and existing work; keep source and generated character media separate from code distribution. Update TASK-P03 and the backlog after status changes, and summarize material shared dependencies in TASK-P01.


## Completed evidence

[Animation report](../../reports/web-resource-desk-excited.md) links the actual 24 fps editable/pre-secondary and baked scenes, 12 fps animated previews, source-key mapping, all-frame endpoint/contact/framing audit and four-state comparison at 320 CSS px. Chrome/WebP transparency, animated playback and controls passed; the parent controller independently reviewed distinct facial reads. Final 24 fps rendition production and actual-device coverage remain TASK-036/038.
