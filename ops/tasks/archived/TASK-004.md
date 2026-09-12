# TASK-004: Import Ene and preserve an editable source scene

- Status: Done
- Priority: P0
- Goal: G1
- Depends on: TASK-001, TASK-002
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Bring the complete Ene package into Blender with its original appearance and an inspectable rig.

## Work

- Import ops/resources/ENE/ENE Cyber legs ver.pmx with MMD Tools and record model scale, bone hierarchy, weights, morphs and texture references. Preserve the normal-legs PMX as an optional alternative.
- Resolve or explicitly replace the sphere-map effects of missing s.bmp and spa-pi.bmp. Record chosen replacements and visual evidence; normal-variant texture repair is outside this baseline.
- Repair paths, normals, material alpha and import problems; preserve source assets and save assets/work/ene/source.blend.
- Capture front, side and back reference images from the imported model; compare any accessible user reference without claiming unseen-video parity.
- Add repeatable import/inspection support under scripts and write ops/reports/ene-import.md.

## Acceptance criteria

- [x] Every material texture resolves or an explicit repair is completed; no accidental white/pink surfaces remain.
- [x] Editable meshes, armature and morphs are present; asset counts and warnings are documented.
- [x] Reopening the scene works without depending on temporary extraction paths.

## Completion evidence

2026-09-12: [Import report](../../reports/ene-import.md), [structured scene inventory](../../reports/ene-import.json), and [fresh-process reopen/render results](../../reports/source-views.json). `scripts/import_ene.py` and `scripts/render_views.py -- source` exited 0 in Blender; front, side and back images were inspected. Available images are packed in `assets/work/ene/source.blend`. Blender/add-on compatibility from TASK-002 is exercised by these checks; remaining toolchain packaging checks do not invalidate the source scene.

## Implementation notes

Do not destructively apply armature operations or discard the original MMD rig.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.
