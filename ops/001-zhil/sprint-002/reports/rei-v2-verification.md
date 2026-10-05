# Rei v2 implementation and checks

Date: 2026-10-05.
Status: The first asset candidate exists. Appearance acceptance and physical measurements remain open.

The [plan](../specs/rei-v2-plan.md) acts on the [Rei research](../research/004-rei-vrchat-feasibility.md).
The [review procedure](../specs/rei-v2-review.md) links the local model, editable source, and comparison images.

## Delivered changes

Rei v2 has selected outlines on 16 materials.
The recipe gives hair, skin, clothing, and gloves different outline widths.
Small mechanical parts, eyes, eyelashes, and eyebrows have no added outline pass.
The recipe darkens eyelashes and eyebrows slightly.
It adjusts face shade color and adds a small emission value to each iris material.
The eye textures and their lettering remain unchanged.

The model has nine added controls for brows, mouth corners, and wide eyes.
Each added control reuses an existing position change.
A normal is a direction that the renderer uses to calculate surface shading.
The source brow shapes contain normal changes across unrelated face vertices.
Those changes caused visible face shading defects in the first comparison.
The added controls therefore use position changes without those normal changes.
The original 51 morph targets and 35 expression groups remain present.

The source also has an invalid skeleton-root reference for its face skin.
Rei v2 uses the common root for that skin.
The recipe removes the invalid top-level `extensionUsed` property.
It preserves the valid `extensionsUsed` list.
These repairs do not change skin weights or vertex positions.

VModel now supports the following controls:

- Studio, warm, and violet light presets, with adjustable intensity.
- A face view and a camera field of view from 20° to 50°.
- Landscape and portrait output at 720p or 1080p.
- Optional detailed facial controls with neutral calibration.
- Shared limits for mouth shapes, brow shapes, and eyelid shapes.
- Release of automatic facial controls during selected expressions in More detail mode.
- Release of facial controls after absent or stale face data.
- Separate saved settings for each model hash.
- Transfer of settings and facial calibration to the output window.
- Import of earlier trace settings with defaults for the added fields.

The detailed mouth controls approximate visible mouth shape.
They do not identify spoken vowels.
Rei v2 has separate brow controls; models without these controls keep their available expressions.
The motion solver version is `motion-solver-4`.

## Asset checks

The [build report](rei-v2-build.json) records the complete change list and hashes.
Repeated builds produced equal VRM bytes.
The original asset and public copy still have this SHA-256:

```text
07037243141d9c3f260c6ef09419f1225ca64ffb7791204b4aef0b817ebc1735
```

The current Rei v2 SHA-256 is:

```text
9afc0d72fb640e3b3d89075e38a957e2d6d990e0ea8f7058f6796fd7c6487639
```

The output contains 55,719,380 bytes.
The complete binary chunk remains equal to the original.
The added morph targets reference existing position accessors.
Texture images, base geometry, skin weights, original facial data, humanoid assignments, springs, and colliders remain intact.

The [Blender check](rei-v2-blender.json) reopened the saved source successfully.
It found 53 different humanoid bone assignments and all nine added shapes.
The face mesh has 61 shape keys, including its Basis key.
All 43 images remain packed in the Blender file.
The embedded build record matches the tested VRM hash.
The Blender file is editable source work; the recipe supplies the tested export.

## Browser checks

The [comparison report](rei-v2-comparison.json) records source hashes, settings, measurements, and image hashes.
The browser used Chromium with SwiftShader software graphics.
The test made no external network requests.

| Check | Original Rei | Rei v2 |
| --- | ---: | ---: |
| glTF validation errors | 1 | 0 |
| glTF validation warnings | 4 | 3 |
| Expression groups | 35 | 44 |
| Direct bone and surface checks | 32 passed | 32 passed |
| Finger controls in the gesture tests | 30 | 30 |
| Draw calls per image | 45 | 61 |
| Drawn triangles per image | 59,176 | 104,952 |
| Embedded images | 43 | 43 |
| Estimated texture memory with mipmaps | 741.33 MiB | 741.33 MiB |

The three remaining warnings concern the legacy `VRM` extension name and two skinned meshes below other nodes.
The validator does not validate the VRM extension itself.
VModel's import check and actual browser load passed separately.
The texture figure is an estimate, not measured GPU memory.
The added outline pass accounts for the extra drawn triangles.
The source geometry still has 59,176 triangles.

Each model passed front, side, smile, blink, mouth, brow, raised-arm, and peace-sign checks.
The test also produced front views with studio and violet light.
The paired views use equal camera settings.
The sampled surface positions remained equal in every pair except the intended brow-control comparison.
Every non-neutral expression moved sampled surface vertices.
The direct checks moved the spine, chest, and all 30 finger controls with their connected surfaces.
Synthetic open-hand, fist, point, and peace-sign observations passed on both models.
These tests do not measure human gesture accuracy.

Both models produced equal results for the fixed spring movement.
Full and gentle modes each used 180 active joints.
The maximum measured local rotation was approximately 0.2844 rad in full mode and 0.1919 rad in gentle mode.
Off mode used no active spring joints.
All measured rotations remained finite.
The result supports retaining the original springs and existing gentle setting for this candidate.
It does not establish acceptable collisions for every movement.

## Software checks

`npm test` passed 346 tests across 37 files after the shared Ene changes.
`npm run build` passed.
The build still reports the existing large JavaScript bundle warning.
`git diff --check` passed.
The [face tests](../../../../tests/face-expressions.test.ts) cover neutral values, conflicting controls, absent data, invalid data, and recovery.
The trace tests cover earlier settings and the new facial calibration data.
The browser checks verified actual canvas dimensions in both orientations at both output sizes.

The [studio and output test](rei-v2-studio.json) passed on the production build.
It checked model selection, source terms, the thumbnail, light settings, camera settings, and saved settings.
It also checked facial calibration, brow movement, mouth movement, selected expressions, output reload, and output dimensions.
The test used synthetic face coefficients and made no external network requests.

## Open-source tools and asset terms

The work adds no runtime dependency or remote service.
Python creates the tested VRM directly from the local source and recipe.
Blender and its VRM add-on create the editable source file.
The installed Three.js and three-vrm packages use MIT licenses.
MediaPipe Tasks Vision uses Apache-2.0.
Blender uses GPL terms; the installed VRM add-on declares `MIT OR GPL-3.0-or-later`.
The existing [tracking-model notices](../../../../config/model-notices.json) remain applicable.
The [tool manifest](../../../../config/tool-downloads.json) records the add-on sources and pinned downloads.

The character asset has separate source terms.
Its supplied readme permits changes and format conversion.
Its embedded metadata prohibits redistribution and commercial use.
Both records remain with Rei v2.
The Blender importer requested a license review for the source URL.
The script checked the known source hash and supplied readme before it accepted that local import notice.
No model publication or license change occurred.

## Remaining acceptance

The reference VRChat avatar still has no verified editable source in this checkout.
This candidate does not establish an exact match to those screenshots.
The fixed images show stronger hair boundaries and darker face details.
Hair intersections, lip lines, shoulder deformation, and cuffs still need user review.
The original vowel shapes can still change shading outside the mouth.
Further targeted normal repair remains possible after a separate comparison.

The user must review the [image comparison](local/rei-v2/index.html).
The intended computer must supply 1080p timing and the [physical acceptance measurements](../specs/sprint-002-plan.md#acceptance-targets).
The 15-minute combined session, camera delay, detector cadence, recovery time, and gesture accuracy remain unverified.
No software graphics result closes those requirements.
