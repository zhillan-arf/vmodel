# Ene v2 implementation and checks

Date: 2026-10-05.
Status: The asset candidate exists. Appearance acceptance and physical measurements remain open.

The [plan](../specs/ene-v2-plan.md) acts on the [Ene research](../research/005-ene-v2-feasibility.md).
The [review procedure](../specs/ene-v2-review.md) links the model, editable source, and image comparison.

## Delivered changes

Ene v2 retains the current proportions, hair, headphones, cheek marks, jacket, and cyber legs.
It adds material settings, face controls, corrected gaze metadata, and shorter cuffs.
It uses the shared VModel controls from the [Rei v2 work](rei-v2-verification.md).
The original Ene VRM and its public copy remain unchanged.

The recipe adds thin outlines to 20 selected materials.
It sets separate shade colors for skin, face parts, hair, clothing, and mechanical parts.
All 19 embedded images retain their original bytes.
The original alpha modes, alpha thresholds, and double-sided settings remain unchanged.
The comparison includes front, side, and back views on dark and light backgrounds.
The inspected images retain the transparent cyber-leg ends and hair surfaces.
These views do not establish correct transparency from every angle.

## Face controls and gaze

The original 45 vertex shapes remain present.
Six new shapes provide separate left and right brow and wide-eye controls.
The new `ee` shape combines the source mouth positions with a separate width adjustment.
Its vertex changes differ from each original mouth shape.
The model has 52 vertex shapes after these additions.

The recipe binds existing shapes for mouth corners, soft eyes, partly closed eyes, tongue, and blush.
The `happy` and `sad` presets now include mouth movement.
The `surprised` preset combines eyes, brows, and mouth movement.
Custom expressions retain the three original preset bindings.
Preset override settings limit added blink and mouth input during those expressions.

VModel drives nine custom brow, mouth, and wide-eye controls in More detail mode.
It also uses the available standard vowel shapes.
Some additional expressions remain available to VRM applications without a VModel button.
The current mouth smile moves both sides together.
Separate left and right mouth corners need further shape work.
This candidate does not supply a complete ARKit face rig.

The original Ene declares expression gaze with empty gaze bindings.
Ene v2 declares bone gaze with bounded eye movement.
The maximum horizontal values are 10° inward and 15° outward.
Both vertical values are 8°.
Equal vertical values avoid different up/down range interpretations in the two tested viewers.

The browser and Blender VRM viewer each passed left, right, up, and down eye checks.
The original declared gaze path produced no eye rotation in the same browser test.
VModel's existing direct eye control remains available on the original model.
Thus, the metadata repair improves use in other VRM viewers without claiming a new camera detector.

## Cuff repair

The original cuff extends approximately 70.65 mm beyond the wrist in its rest pose.
Ene v2 ends the selected cuff surface 25 mm before the wrist.
A smooth position change starts 140 mm before the wrist.
The change preserves the cuff width and existing skin weights.
The recipe adjusts normals and tangents for the changed surface.
It changes 208 primitive vertices on each side across four material sections.
A primitive vertex is a vertex in one exported material section.
Material boundaries can duplicate vertices.

The browser checks each hand with four gestures and two additional wrist poses.
It measures separation along the wrist-to-middle-finger direction.
The finger sample includes vertices of triangles connected to finger-weighted vertices.
The cuff sample covers 106 vertices on each side of the cuff opening.

| Measure | Original Ene | Ene v2 |
| --- | ---: | ---: |
| Smallest separation along the test direction | −66.51 mm | 29.06 mm |
| Largest separation along the test direction | −64.14 mm | 31.42 mm |
| Tested hand and wrist poses | 12 | 12 |

A positive value separates the two tested surface sets with a plane.
A negative value indicates overlap along that direction; it does not measure intersection depth.
The images show exposed hands and wrists after the repair.
This result covers the selected surfaces and poses.
It does not prove that every sleeve, palm, or arm pose has no intersection.

## Export and source checks

The [build report](ene-v2-build.json) records repeated equal exports and protected source data.
The original Ene SHA-256 is:

```text
dcb46b18c7c5c47e2a66a63826bad2772950cfe3ccd7c8bb11896c1ba7a05acc
```

The Ene v2 SHA-256 is:

```text
952e05bae0f20976df6a3340a6aba3c92422b2a6455b8f6029a9b5241d099e2d
```

| Measure | Original Ene | Ene v2 |
| --- | ---: | ---: |
| File bytes | 87,635,472 | 19,818,552 |
| Source triangles | 112,948 | 112,948 |
| Humanoid assignments | 53 | 53 |
| Finger controls | 30 | 30 |
| Vertex shapes | 45 | 52 |
| Expression entries with bindings | 11 | 28 |
| Embedded images | 19 | 19 |
| Import estimate for geometry | 70.81 MiB | 43.10 MiB |
| Estimated texture memory with mipmaps | 129.35 MiB | 129.35 MiB |

The file is 77.39% smaller.
The packer removes unused accessors and stores sparse or zero-filled morph arrays.
An accessor describes an array of model data in glTF.
The packer checks every used array value before and after packing.
It also checks that every image retains its bytes.
The build preserves original face arrays, topology, skin weights, texture coordinates, humanoid assignments, springs, and colliders.
The smaller file does not establish lower measured GPU memory or faster display.
The resource figures are import estimates.
The build guards also rejected a changed source hash and an excessive cuff change in separate checks.

The [Blender report](ene-v2-blender.json) confirms a successful save and reopen.
The editable source contains 53 different humanoid assignments, 52 face shapes, and 19 packed images.
Its embedded build record matches the tested VRM.
The recipe supplies the tested export; the Blender file supplies editable source work.

## Browser and spring checks

The [comparison report](ene-v2-comparison.json) records 37 paired views, source hashes, and image hashes.
Both files pass glTF validation with zero errors and 58 warnings.
The warnings are equal on both files.
They concern 49 combined material extensions and nine existing image-format features.
The validator does not validate the VRM extension itself.
Actual VModel import and browser load passed separately.

All expressions with bindings moved sampled surface vertices.
The spine, chest, and all 30 finger controls passed direct bone and connected-surface tests.
Synthetic open-hand, fist, point, and peace-sign input passed on both models.
All four output dimensions passed: landscape and portrait at 720p and 1080p.
The browser made no external network requests.

The original and edited models produced equal spring results under the fixed abrupt head and arm movement.
Full and Gentle each used 36 active joints; Off used none.
The largest local rotation was 2.0405 rad in Full and 1.9615 rad in Gentle.
The largest step change during the final 30 frames was below 0.000588 rad.
All rotations remained finite during the five-second test.
The movement stopped after the first second.
The images show the hair during movement and after recovery.
Hair can still contact the shoulders during abrupt movement.
The evidence does not justify a new spring or collider configuration for this candidate.
It does not establish acceptable collisions for every physical movement.

Original Ene uses 49 draw calls and 112,948 drawn triangles in the fixed front view.
Ene v2 uses 69 draw calls and 135,111 drawn triangles.
The added outline passes increase that work.
Chromium used SwiftShader software graphics.
These counts do not establish performance on the intended GPU.

## Software checks

`npm test` passed 346 tests across 37 files.
`npm run build` passed with the existing large JavaScript bundle warning.
`git diff --check` passed.

The import gate now accepts glTF accessors that contain only zeros without a stored buffer view.
This behavior follows the [glTF accessor rules](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#accessors).
The geometry memory limit still applies before the loader creates those arrays.
Tests cover the limit and an invalid byte offset without a buffer view.

VModel also treats an empty expression binding as unavailable.
The detailed mouth solver uses its existing fallback when the original Ene has no bound `ee` shape.
The new test checks that this fallback preserves the mouth movement budget.

The [production studio and output check](ene-v2-studio.json) passed.
It checked selection, all five source-term files, the thumbnail, saved settings, facial calibration, output dimensions, and expression conflicts.
It also checked output reload and equal light settings in the studio and output.
The test used synthetic face coefficients and made no external network requests.

## Tools, terms, and remaining review

The work uses Python, NumPy, Blender, the VRM add-on, Three.js, three-vrm, and existing browser tools.
It adds no runtime dependency or remote service.
The source readmes retain their bytes, names, and credits in the local notices directory.
The model library links those files and the source record.
The original asset restrictions still apply.
Open-source tools do not make this character asset unrestricted.
No model publication or license change occurred.

The user must review the [image comparison](local/ene-v2/index.html).
The shorter cuff changes the sleeve design visibly.
The hand outlines, jacket folds, mouth shape, hair contact, and transparency need that review.
The existing [physical targets](../specs/sprint-002-plan.md#acceptance-targets) remain open.
No synthetic input or software graphics result closes them.
