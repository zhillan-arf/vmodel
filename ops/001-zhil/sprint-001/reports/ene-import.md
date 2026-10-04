# Ene Cyber legs import validation

Date: 2026-09-12. [Import script](../../../../scripts/import_ene.py); [structured result](ene-import.json).

Imported the original cyber-legs PMX into Blender 5.1.1 with MMD Tools 4.5.14. Retained the source MMD armature, morphs and physics objects. The source package and its hash are unchanged. Saved the editable scene at `assets/work/ene/source.blend` with available image data packed.

The scene contains one skinned mesh with 63,278 vertices and 49 material slots. The 193 original model bones and importer helper bones remain available. Existing face morphs and the importer's SDEF data keys are preserved in this source scene; export-specific cleanup is confined to a separate scene.

## Repairs

The two unavailable additive sphere maps (`s.bmp`, `spa-pi.bmp`) are explicitly disconnected and their additive reflection effect disabled. Diffuse images are retained. No unrelated replacement image was substituted. MMD materials are converted to Blender Principled shading for the editable source preview; MToon tuning occurs in the export scene.

MMD Tools reported one invalid rigid-body rotation on `髪ガードB` and used its default rotation. This is recorded as a secondary-motion review item for TASK-007, not silently treated as accurate source physics.

## Verification

The import script exited 0 and produced the original front preview. `scripts/render_views.py -- source` reopened the saved scene in a fresh Blender process and rendered front, side and back views. The three images were visually inspected: the character, clothing, hair, headphones and cyber legs remain present; there are no missing-image pink surfaces. [Reopen result](source-views.json) records no missing unpacked image files.

Local review images: `ops/001-zhil/sprint-001/reports/local/ene-source-front.png`, `ene-source-side.png`, and `ene-source-back.png`. They are kept out of code distribution together with the model.

This closes source import and persistence checks. Humanoid deformation, expression combinations, spring tuning and runtime visual comparison are separate acceptance work in TASK-005 through TASK-007. The unviewed YouTube reference has not been used to claim exact appearance parity.
