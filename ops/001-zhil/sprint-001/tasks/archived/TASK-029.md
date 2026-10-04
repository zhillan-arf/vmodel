# TASK-029: Verify web authoring sources and provision the render toolchain

- Status: Done
- Priority: P0
- Goal: G4
- Controller: [TASK-P03](TASK-P03.md)
- Depends on: TASK-001
- Estimate: S (0.5-1 day)
- Specification: [Web character resources](../../specs/web-character-resources-plan.md)

## Outcome

Establish a reproducible, no-paid-service authoring and encoding environment using the existing Ene Cyber legs source.

## Work

- Read the web proposal, TASK-P03, TASK-P01 and existing source/toolchain reports. Preserve original PMX/VMD hashes and existing authorization/attribution; retain contributor and motion terms without requesting the same permission again.
- Verify assets/work/ene/source.blend and the import script/report. Copy into assets/work/ene-web/ and inspect weights, hand posing, facial morphs and missing-sphere-map repairs needed for these fixed views. Reuse shared G1 fixes where appropriate and record provenance; do not overwrite shared scenes.
- Confirm installed Blender/MMD Tools compatibility for background animation and RGBA rendering. Audit available FFmpeg/ffprobe/libvpx/libwebp builds; provision missing no-cost tools with exact versions, download sources, hashes and component notices.
- Test necessary encoders and a transparent still/frame sequence; record commands and build flags. Isolate work files and plan a separate public directory so source assets cannot be copied into the showcase build.
- Write ops/001-zhil/sprint-001/reports/web-resource-toolchain.md and a web-source/build configuration under config/web-resources/. Mark any model repairs as concrete follow-up work within this task or coordinate them with TASK-004/005/006.

## Acceptance criteria

- [x] Cyber legs originals are unchanged; the separate editable web workspace opens and essential pose/morph controls work.
- [x] Pinned Blender, MMD Tools and available alpha WebM/animated WebP encoders have recorded successful smoke results.
- [x] Attribution, existing use authorization and source-versus-output distribution boundaries are recorded; Tripo and paid service/tool requirements are absent.
- [x] Report and configuration identify reproducible commands, source hashes, tool versions, unresolved repairs and the next sample render.

## Implementation notes

Planned paths are not completed artifacts. Record exact output paths, commands/results and visual evidence before marking Done. Preserve original assets and existing work; keep source and generated character media separate from code distribution. Update TASK-P03 and the backlog after status changes, and summarize material shared dependencies in TASK-P01.


## Delivered evidence - 2026-09-12

- Isolated `assets/work/ene-web/source.blend` and editable `alpha-spike.blend`; [reopen/control audit](../../reports/web-source-audit.json) passes with 193 bones, 63,278 vertices, animated blink and hand controls, and finite evaluated geometry. Shared originals/hash checks pass.
- [Toolchain report](../../reports/web-resource-toolchain.md), [pinned configuration](../../../../../config/web-resources/toolchain.json), [source configuration](../../../../../config/web-resources/source.json), publisher-verified FFmpeg 9.0.1 installation and component notices.
- [Actual encoder smoke](../../reports/web-encoder-smoke.json) preserves transparent, opaque and partial-alpha pixels in VP9 WebM and animated WebP. [Full 48-frame RGBA render](../../reports/web-spike-render.json) is ready for TASK-030's browser/quality sweep.
- Source known degenerate face/edge removed only in web copy without changing vertex indexing. No missing image files; existing absent additive sphere-map repairs reused. Final desk posing, lighting polish and secondary motion remain assigned to TASK-032/036.
