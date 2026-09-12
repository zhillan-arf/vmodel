# TASK-031: Author the full-body VMD-informed homepage greeting

- Status: Done
- Priority: P0
- Goal: G4
- Controller: [TASK-P03](TASK-P03.md)
- Depends on: TASK-030
- Estimate: S-M (1-2 days)
- Specification: [Web character resources](../../specs/web-character-resources-plan.md)

## Outcome

Create home-greeting: a clear, friendly full-body Ene performance informed by the supplied ene.vmd.

## Work

- Read web-resource-vmd-inspection.json and preview ops/resources/ene.vmd on a copy of the Ene scene with MMD Tools. Inspect every relevant section and channel mapping beyond name matches; coordinate useful evidence with TASK-014.
- Record the reference interval and meaning in source frames/seconds, actual gesture observations, mapped/unmapped body and face channels, IK corrections, source-specific secondary channels and timing/Bezier treatment.
- Adapt a suitable greeting into a proposed 4-6 second full-body action: acknowledgement/nod, readable greeting hand and settled repeatable boundaries. If direct transfer is unsuitable, author Ene motion informed by the inspected reference and explain the retained/replaced elements.
- Retain the original VMD and editable action before baking. Author hands, face, weight shifts and controlled hair/cloth settling; use a warm-up and source-time-correct sampling for 24 fps delivery.
- Set the 720x960 camera and normalized foot/safe bounds, inspect the entire animated silhouette including cyber legs and hair, and produce a draft contact sheet plus playback preview.
- Record source/action names, frame range, camera settings and visual review in ops/reports/web-resource-greeting.md.

## Acceptance criteria

- [x] Actual animated home-greeting shows the entire model and an unmistakable friendly greeting with no major hand/rig clipping.
- [x] The supplied VMD has been visually examined; source interval/adaptation or evidenced fallback is documented, not inferred from its filename.
- [x] Editable action, reference mapping, warm-up/bake settings, frame rate and draft preview exist; originals remain unchanged.
- [x] Loop boundary, framing and expression are visually reviewed; no source-model hair or morph channels are blindly applied to Ene.

## Implementation notes

Planned paths are not completed artifacts. Record exact output paths, commands/results and visual evidence before marking Done. Preserve original assets and existing work; keep source and generated character media separate from code distribution. Update TASK-P03 and the backlog after status changes, and summarize material shared dependencies in TASK-P01.


## Completed evidence

[Greeting report](../../reports/web-resource-greeting.md) documents the visually inspected VMD interval and new Ene-specific adaptation, editable authoring/baked scenes, 24 fps source, 12 fps animated previews, source preservation and actual all-frame loop/framing checks. Corrected palm-angle interpolation was rerendered and visually reviewed at consecutive return poses. Chrome/WebP decoded alpha, changed pixels, repeat boundaries and accurate seek positions passed. Full 24 fps media/device/site acceptance remains TASK-036/038.
