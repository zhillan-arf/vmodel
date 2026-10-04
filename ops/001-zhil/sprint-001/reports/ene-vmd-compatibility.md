# Ene VMD compatibility investigation

Validated on 2026-09-12 for TASK-014. The supplied motion is **partially compatible and useful as an editable Blender preview** on Ene Cyber legs. The shared body channels produce recognizable poses and facial changes. Its source-specific channels do not fully transfer, and the complete clip needs cleanup and new loop boundaries before use as a website greeting.

## Evidence and delivered preview

- [Bounds-checked parse, exact channel lists, import result and seven pose bounds](vmd-inspection.json).
- [Saved-scene readback, animation actions, IK flags and all-frame finite-transform check](vmd-preview-audit.json).
- [Editable animated Blender scene](../../../../assets/work/ene/vmd-inspection.blend): original MMD rig with separate `ene_bone`, `ene_facial` and `ene_display` actions. Timeline frames 1–349 at 30 fps. Open with the project's Blender/MMD Tools setup, select the model, and scrub or play the timeline in the viewport. The review camera and lights were created after saving this file, so the saved scene contains the editable animation rather than a prepared render camera.
- Rendered review frames: [1](local/vmd/frame-001.png), [60](local/vmd/frame-060.png), [120](local/vmd/frame-120.png), [180](local/vmd/frame-180.png), [240](local/vmd/frame-240.png), [300](local/vmd/frame-300.png), [349](local/vmd/frame-349.png).

The scene and images are private generated artifacts. Original PMX, VMD and the delivered VRM were not modified by this investigation.

## Parse validity

The file is 165,023 bytes and identifies its source model as `八雲紫(773)` (Yakumo Yukari), rather than Ene. MMD Tools 4.5.14 section readers were wrapped in an exact-length reader that raises on a truncated read. Parsing consumed every byte with zero trailing bytes. Bone position/quaternion values and morph weights were finite; interpolation bytes were within the checked 0–127 range. This establishes structural validity for this file, not a guarantee of the intended choreography or expressive equivalence across models.

| Section | Records | Source frame range | Byte range, end exclusive |
| --- | ---: | --- | --- |
| Bones | 1,405 | 0–348 | 50–156009 |
| Morphs | 387 | 0–341 | 156009–164914 |
| Camera | 0 | — | 164914–164918 |
| Light | 0 | — | 164918–164922 |
| Self-shadow | 0 | — | 164922–164926 |
| Visibility/IK | 1 | 0 | 164926–165023 |

The MMD import uses 30 fps and shifts source frame 0 to Blender frame 1. The last keyed timestamp is 11.6 seconds. VMD carries no separate scene FPS setting.

## Mapping and IK

Names were compared with the actual imported Cyber legs rig's Japanese PMX bone names and mesh shape keys. The complete matched/unmatched lists are in the parse report.

| Channels | Matched | Unmatched | Interpretation |
| --- | ---: | ---: | --- |
| Bones | 57 / 260 | 203 | Center, torso, neck/head, eyes, shoulders, arms, wrists, finger joints, legs and four foot/toe IK controls transfer by name. |
| Morphs | 20 / 74 | 54 | Shared mouth, blink, smile, wink and eyebrow morphs transfer; other expressions and appearance controls require explicit replacement. |

Of the 203 unmatched bone channels, 128 are named `sk_0_0` through the `sk_7_*` families. The rest include source-specific hair, hat ribbon, eyebrow, tongue and chest controls. Their presence explains why a low overall name-match percentage still yields useful body motion. They must not be blindly assigned to Ene's hair or clothing bones.

Matched morphs include `あ`, `い`, `う`, `お`, `まばたき`, `ウィンク右`, `笑い`, `にこり`, `困る`, `怒り`, `上` and `下`. Unmatched examples include `え`, `ウィンク`, `ウィンク２`, hat controls and numerous source eye-color/appearance morphs. The original Ene source shape keys are used in this preview; it is separate from the VRM expression profile.

The sole visibility/IK record keeps the model visible and enables `右足ＩＫ`, `右つま先ＩＫ`, `左足ＩＫ` and `左つま先ＩＫ`. All four control names exist on Ene, and their enabled properties survived saved-scene readback. No later IK switch occurs in the file. All pose-bone matrices evaluated as finite across Blender frames 1–349. These checks do not prove planted feet or continuous collision quality: Cyber legs fade away below the calves, and floor contact is not visible in this variant. No physics bake or production foot-contact acceptance was performed.

## Visual result and adaptation limits

All seven rendered review images were inspected:

| Blender frame | Observed result |
| --- | --- |
| 1 | Rear-facing opening pose with arms down. |
| 60 | Front-facing lean, both hands beside the face, closed smiling eyes. |
| 120 | Hands brought together near the chest and mouth, changed facial expression. |
| 180 | One straight arm raised overhead, open eyes. |
| 240 | Raised arm bends over the head, the other arm extends down/out, visible wink. |
| 300 | Both hands beside the forehead, mouth open. |
| 349 | Similar raised-hand pose with a changed lean and closed smiling eyes. |

The Cyber legs appearance remains visible throughout. The reviewed images show a coherent torso and limbs without an exploded mesh. This is a pose review plus a full-timeline numeric check; a continuous rendered-video review was not performed. Hands close to the face and oversized cuffs, intermediate intersections, secondary hair/cloth motion and precise expression timing remain production cleanup work.

For TASK-031, approximately Blender frames 120–240 (about 4–8 seconds) provide a candidate chest-to-overhead greeting gesture to inspect more closely. This is a candidate interval, not an accepted wave loop. Author a settled start/end and a rest beat, adjust the pose to keep a clear hand silhouette, replace unsupported morph behavior, and use Ene-specific secondary motion. Preserve the source timing and Bezier interpolation when sampling by seconds into a 24 fps deliverable. The rear-facing opening and different final pose make the complete 1–349 interval unsuitable as a seamless loop without adaptation.

## Reproduction and scope

Run from the repository root:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --background --python scripts/inspect_vmd.py
```

Result: exit 0; MMD import returned `FINISHED`; all six animation sections parsed; seven images and the separate animated scene were saved. A subsequent background Blender readback opened that saved scene, confirmed its three animation owners and four enabled IK properties, evaluated every frame from 1 through 349, and found zero nonfinite pose-bone transforms. Its results and source hashes are recorded in [vmd-preview-audit.json](vmd-preview-audit.json).

| Original or delivered asset | SHA-256 after inspection |
| --- | --- |
| `ops/001-zhil/sprint-001/resources/ene.vmd` | `d3abdedf45e36a55ad66e2546ec0a562054db8a6c11d4198fa8c6a773f39bea8` |
| `ops/001-zhil/sprint-001/resources/ENE/ENE Cyber legs ver.pmx` | `226fe9075f25c7dd2e6474fdd6acb77ff71c45900fb2d5c8794e08647aa9dbe4` |
| `assets/avatars/ene.vrm` | `3657b97928638e7ada5f6639141fb63f555912049a2c6ec217851001e322cbcb` |

These match the previously recorded source and delivered-avatar hashes. The investigation imports animation onto the existing MMD rig; it does not convert the model or certify webcam retargeting. [The live-kit plan](../specs/ene-vtuber-plan.md) explicitly keeps VMD compatibility outside live acceptance dependencies. The current application loads VRM and has no VMD playback mode, so this offline Blender preview cannot compete with live body control. No additional test motion was downloaded or substituted.
