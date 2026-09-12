# Ene avatar validation

Validated on 2026-09-12 using the user's Cyber legs model. This report covers avatar preparation and export; it does not certify live webcam retargeting, recording, voice or website animations.

## Delivered authoring artifacts

- [Imported MMD source scene](../../assets/work/ene/source.blend), preserving the MMD authoring rig.
- [Export working scene](../../assets/work/ene/vrm-work.blend), with humanoid assignments, morph bindings, materials and spring configuration.
- [Reusable VRM](../../assets/avatars/ene.vrm) and [profile](../../config/avatars/ene.json).
- [Conversion recipe](../../docs/avatar-conversion.md), including the intentional fixes and exact reproduction commands.

The [machine-readable VRM validation](vrm-validation.json) is authoritative for the current output hash, byte count, assignments and glTF results. The original source hash is preserved in the profile and [asset audit](asset-audit.md).

## Rig and deformation

All 53 configured humanoid assignments resolve to unique nodes, match the profile names and have the expected parent ancestry; all 15 mandatory bones are present. [Rig audit](rig-audit.json) finds zero vertices without a positive deform-bone weight. The 74 weighted helper bones retain a humanoid ancestor; non-deforming MMD metadata groups are excluded from this count. Helpers are preserved rather than discarded with their animation constraints.

The [export preparation report](ene-export-preparation.json) records removed constraints and rest transforms. D leg bones follow their respective FK bones. Twist groups follow upper/lower arms; this preserves their weights while simplifying MMD-specific twist distribution. The imported scene remains available for more elaborate future weight or twist editing.

The [pose sweep](pose-sweep.json) drives the exported model directly through three-vrm's normalized bones. T-pose, raised arms, bent elbows, head turn, wrist rotations, finger curls and a squat were visually inspected. No major detached geometry, inverted limbs or joint collapse was observed in these poses. Wider framing includes the raised hands. The existing loose sleeve shape can obscure fingers at some angles; live hand-solver quality is still a separate TASK-012 requirement.

Blender identified one degenerate edge/triangle with repeated vertex 21535. The export copy removes it without changing vertex count or shape indices. Re-validating the saved export mesh reports no further repair. The final export log no longer contains the glTF invalid-mesh warning.

## Face

Independent left/right blink renders close only the intended eye; the other eye remains open. The `aa` render opens the mouth without moving unrelated facial features. Combined smile/blink/jaw and return-to-neutral are included in the sweep. Explicit source names/indices, ranges and override rules are in the profile/recipe. The optional `ee` vowel is unavailable; full 52-shape support is not claimed.

## Appearance and secondary motion

The target runtime and independent Blender VRM import both display Ene with embedded textures. Source/VRM front, side and back views are recorded in [source views](source-views.json) and [VRM views](vrm-views.json). The cyber fade, blue cheek markings, jacket, skirt, twin tails and headphones are preserved. MToon is an approximation of the original MMD shading; the unavailable sphere maps are explicitly accounted for in the import report.

The working scene and VRM include 19 spring chains and 17 colliders generated from source physics. The runtime simulates 36 joints with usable child tails. [Tuning measurements](spring-tuning.json) motivated higher stiffness/drag than the automatic defaults. [Spring verification](spring-smoke.json) tests Full, Gentle, Off and re-enable across 180 abrupt head/root steps per mode, including a 10-second elapsed-time input. Bone positions/quaternions remain finite; Off removes every active simulation joint and re-enable restores them. Gentle reduces movement. These finite-transform checks supplement the inspected renders and do not claim collision perfection for arbitrary extreme poses.

## Validation limits

Khronos glTF validation reports zero errors and 49 warnings about combinations of material extensions. It does not validate VRM extension semantics; explicit humanoid/expression checks and loading in both viewers supply additional evidence. Required live movement quality, camera hardware checks, sustained performance, final OBS recordings and user acceptance remain open under their own tasks.
