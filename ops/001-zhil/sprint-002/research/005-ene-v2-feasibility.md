# Ene v2 feasibility study

Date: 2026-10-05.
Scope: Ene appearance, model data, expression controls, and webcam use in VModel.

**An Ene v2 derivative is possible and useful. Start with the existing model.**
The strongest reasons are incomplete expression bindings, sleeve overlap, material settings, and unnecessary file data.
The evidence does not require a complete model replacement.

The [interactive comparison](ene-v2-comparison.html) shows actual browser renders.
The [test record](../reports/ene-v2-feasibility.json) contains measurements and file hashes.
The smaller [research VRM](ene-v2-local/ene-packed.vrm) is available locally.
It preserves the current appearance; it is not a finished Ene v2.

## What replaces a VRChat reference

A VRChat example is not necessary for this work.
Use three separate references:

| Reference | Purpose | Limit |
| --- | --- | --- |
| [Official Ene character art](https://www.mekakucityactors.com/character/006ene.html) | Check the hair, headphones, cheek marks, jacket, cuffs, and cyber legs. | A drawing does not specify geometry, weights, or tracking quality. |
| Existing PMX and Blender scenes | Preserve the current character and compare changes from known source data. | The MMD model has its own proportions and surface style. |
| Fixed VModel test scenes | Compare expression, shading, transparency, and deformation under equal conditions. | Static tests do not establish live motion quality. |

The official art has strong differences between light and shade, large cuffs, turquoise details, and distinct hair ends.
The current model uses a softer face, detailed iris textures, curled hair ends, and a different headphone finish.
These are design differences, not proof of a broken model.
Exact agreement with the drawing would require some geometry and texture work.

For the first derivative, preserve the current proportions and cyber design.
Improve face control, edge clarity, and sleeve behavior first.
Treat a closer match to the anime drawing as a separate design option.

## Source and community findings

There is an older [Ene VRChat listing by manek](https://vrcmods.com/item/1924).
The page offers a Unity package and reports approximately 20,000 triangles.
Its preview shows Ene, but it does not establish current use or production quality.
The download requires a CAPTCHA.
I inspected the page and preview, but did not obtain or test that package.
Its relationship to our model remains unverified.
Thus, the absence of a known VRChat example is not a technical obstacle.

The current local source is `ENE Cyber legs ver.pmx`.
I extracted it from the supplied archive into [local research storage](ene-v2-local/source/ENE/).
Its SHA-256 matches the original intake record:

```text
226fe9075f25c7dd2e6474fdd6acb77ff71c45900fb2d5c8794e08647aa9dbe4
```

The bundled readme names `yokkaulove (DA)` as the editor.
It permits edits, requests credit, and prohibits redistribution.
The earlier [asset audit](../../sprint-001/reports/asset-audit.md) records the user's AuroraYok permission.
The contributor readmes remain with the extracted source.
The historical DeviantArt page was unavailable during this check.
This study uses the existing authorization for local work.
It does not establish broader publication rights for a new package.

## Measured model data

The [asset audit script](tools/ene_asset_audit.py) reads the actual deployed source copy.
The public copy has the same bytes.

| Item | Current Ene |
| --- | --- |
| Format | VRM 1.0 |
| File size | 87,635,472 bytes; 83.58 MiB |
| Triangles | 112,948 |
| Source vertices | 63,278 |
| Exported primitive vertices | 63,713; material boundaries can duplicate vertices |
| Humanoid bones | 53, including 30 finger bones |
| Meshes / material sections | 1 / 49 |
| Material transparency | 34 opaque, 13 alpha masks, 2 blends |
| Embedded images | 19; approximately 13.30 MiB of encoded image data |
| Shape keys | 45 |
| Active expression bindings | 11 |
| Empty preset entries | 7, including `ee` and four gaze presets |
| Spring definitions | 19 groups, 55 listed joints, 17 sphere colliders |
| MToon outlines | Disabled on all 49 materials |

A shape key stores a change to mesh vertices.
A rig is the set of bones and controls that move the model.
Skin weights specify how each bone moves the model surface.
An expression binding connects a named control to one or more shape keys.
MToon is the toon material system used by this VRM.
A spring bone simulates motion such as hair movement.
A collider defines a surface that limits spring movement.

The source PMX contains 50 morphs: 45 vertex morphs and five material morphs.
All 45 vertex morph names remain in the exported VRM.
The conversion did not discard the unused facial geometry.
The five material morphs need separate treatment if their effects become required.

The [scene audit](tools/ene_scene_audit.py) opened the editable scene in Blender 5.2.2 LTS.
It found the same 45 shape keys and preserved the scene file hash.

## The most useful face improvement

The current `happy` binding uses `にこり`.
The scene audit shows that this shape changes only 106 vertices in the eyebrow region.
The current smile input therefore raises a facial control without producing a complete mouth smile.
The `sad` binding also uses an eyebrow shape.
These mappings explain why a valid expression name can produce a limited result.

The current solver sends webcam smile values to `happy`.
It sends jaw movement to `aa` and eyelid values to independent blink controls.
It does not drive the additional eyebrow and mouth shapes examined here.
See [motion-solver.ts](../../../../src/motion-solver.ts).

I added eight temporary custom bindings inside the browser test:

| Existing shape | Test purpose |
| --- | --- |
| `上`, `下` | Eyebrow movement |
| `笑い` | Smile with closed eyes |
| `じと目` | Partly closed eyes |
| `優しい` | Softer eye expression |
| `ω` | Stylized mouth shape |
| `ぺろっ` | Tongue expression |
| `照れ` | Blush expression |

All eight bindings changed morph weights through the standard VRM loader.
The comparison includes a smile combination, a partly closed eye expression, and raised eyebrows.
These images show useful controls that already exist.
They do not establish that every shape combination is safe.

Ene v2 should have deliberate expression combinations and clear limits.
Smile, blink, jaw, and manual expressions must not independently close the same eyelid beyond its intended range.
Independent left and right mouth smiles would need additional shape work.
A real `ee` shape also needs authoring; its current preset has no binding.
Renaming existing shapes cannot create a complete ARKit-style face rig.

The model declares expression-based gaze, but its four gaze presets are empty.
VModel currently rotates the eye bones directly, so its own gaze path can work.
Other VRM viewers may use the declared gaze mode and produce no eye movement.
A derivative should use deliberate bone-based gaze settings and receive a separate viewer test.

## Appearance tests

The [browser probe](tools/ene_render_probe.mjs) made 16 renders with fixed cameras and poses.
It used a saved copy of the application source because separate Rei work changed the shared source during research.
The test record identifies the source hashes.

The views separate light changes from material changes.
They also show front, side, back, full-body, and expression conditions.
The material experiment changes shade settings and adds thin outlines to 16 selected materials.
It leaves the mesh, textures, and alpha modes unchanged.

| Render condition | Draw calls | Submitted triangles |
| --- | --- | --- |
| Current model | 49 | 112,948 |
| Selected outlines | 65 | 133,965 |

A draw call is one submission of geometry to the graphics system.
Outlines add work, so they should be applied where they improve the visible result.
The [MToon documentation](https://vrm.dev/en/univrm/shaders/shader_mtoon/) describes shade, outline, and rim controls.
VModel already renders these standard materials.
A Unity shader is not necessary for this first improvement.

Ene uses the same basic asset parts as a typical VRChat avatar: a mesh, bones, weights, textures, and facial shapes.
VRChat adds its own avatar setup and optional application features.
The [VRChat creation guide](https://creators.vrchat.com/avatars/creating-your-first-avatar/) separates the model from that setup.
Unity materials, expression menus, and PhysBones would require conversion or new controls in VModel.
Our existing VRM avoids that extra conversion step.

The test gives the face more visible shading, but it is not a finished art direction.
It does not produce the full illustrated style through light changes alone.
The iris texture, hair shape, headphone finish, and garment folds require separate decisions.

The current export script transfers diffuse images into MToon.
It does not reproduce the complete MMD sphere-map system.
Two source sphere maps are also missing, as the original audit records.
New highlight settings should be checked against the existing source appearance.
These tests give no reason to add more triangles.

The full-body views retain the cyber leg ends on dark and light backgrounds.
The transparent hair materials also remain present.
This small set of views does not prove correct sorting from every camera angle.

## A smaller file, with measured limits

The [packing probe](tools/ene_pack_probe.py) produced a separate VRM:

| Measure | Result |
| --- | --- |
| Original size | 87,635,472 bytes |
| Research copy size | 19,703,484 bytes; 18.79 MiB |
| Reduction | 77.52% |
| Removed unused accessors | 2,205 |
| Sparse morph accessors | 86 |
| Zero-only morph accessors | 2,074 |
| Used accessor values | Preserved |
| Texture bytes | Preserved |
| Neutral browser screenshot | Exact match |
| Active expression results | Same 11 bindings |
| Blender import | Passed; 53 mapped humanoid bones and 45 shape keys |

An accessor describes an array of model values in glTF.
A sparse accessor stores only the values that differ from zero.
The [glTF specification](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc) defines this representation.
The probe removes arrays that the model never references.
It also replaces suitable dense morph arrays with sparse arrays.
It does not reduce the triangle count or image resolution.

The glTF validator reports zero errors for the copy.
Its 58 warnings also occur in the original file.
They concern combined material extensions and image features.
The validator does not fully validate VRM extensions.
The browser loader test therefore provides separate application evidence.
Blender 5.2.2 LTS also imported the copy successfully with the installed VRM add-on.
That check examined structure; it did not include a new Blender render or export.

Sparse arrays expand during loading.
The file reduction does not imply a 77.5% reduction in GPU memory or frame time.
The 19 images alone represent approximately 97.01 MiB as RGBA pixels before mipmaps.
This is a data estimate, not a measured total GPU allocation.
The browser used software rendering, so its frame rate cannot establish target-computer performance.

## Sleeves, bones, and webcam limits

The earlier [implementation verification](../reports/implementation-verification.md) records successful finger and torso tests on Ene.
Those results justify reuse of the main rig.
They do not establish correct clothing deformation for every pose.

The earlier [hand image](../reports/local/ene-implementation-hand_xyz_only.png) shows fingers through the sleeve.
This is a visible asset problem after finger controls become active.
The scene contains `右袖` and `左袖` groups, but neither group has assigned vertices.
Thus, those groups do not provide ready-made independent sleeve control.

The next asset test should check cuff weights, wrist clearance, and hand rotation together.
Possible corrections include a cuff shape key, corrected weights, and a sleeve bone with assigned vertices.
Preserve the large sleeve design while making the fingers visible during common gestures.
A new whole-body mesh is not necessary to test these corrections.

| Webcam function | Practical Ene v2 result | Remaining limit |
| --- | --- | --- |
| Head and neck | Controlled turns and nods | Fast motion and poor light reduce observation quality. |
| Eyes and face | Blink, approximate gaze, jaw, smile, selected eyebrow controls | Shape mappings require calibration and conflict rules. |
| Visible hands | Open hand, fist, point, and peace sign | Crossed fingers and hidden hands remain difficult. |
| Upper body | Seated lean, shoulder movement, visible arm motion | Hidden joints require estimates or a controlled rest pose. |
| Hair and clothing | Spring motion driven by avatar movement | Springs simulate motion; the camera does not measure each hair strand. |
| Hidden legs and feet | Authored idle poses or limited estimates | A webcam cannot uniquely recover hidden limb positions. |

MediaPipe Face Landmarker can output 52 expression scores and face transformations.
These outputs do not automatically connect to Ene's MMD shapes.
They also do not guarantee equally accurate measurements for every expression.
See the [official MediaPipe guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker).

Webcam image size does not set the avatar output resolution.
The avatar's mesh, textures, materials, and renderer determine its displayed detail.
A modest webcam can therefore drive a detailed 1080p avatar image.
The camera still limits motion observations, and the computer must sustain the selected output size.

The current software already includes the sprint's hand and seated torso corrections.
The old 5.73–6.35 Hz trace measurements describe the earlier baseline.
They are not measurements of this asset study or the corrected live application.
Live cadence, delay, stability, and target-computer performance still require the planned human test.

## Recommended Ene v2 scope

| Stage | Work | Acceptance condition |
| --- | --- | --- |
| 1: Export and face | Retain geometry; remove unused data; add selected expression bindings; correct gaze metadata. | Same neutral appearance, 53 mapped bones, working expressions, and a successful second-viewer test. |
| 2: Materials | Tune skin, iris, hair, jacket, headphones, and selected outlines separately. | Better face clarity at equal camera, pose, light, and resolution; no missing surfaces. |
| 3: Sleeves and springs | Correct cuffs; inspect hair collision; test abrupt head and arm movement. | No visible finger breakthrough in agreed gestures; no persistent spring oscillation. |
| 4: Optional design changes | Change iris art, hair ends, garment folds, or proportions where the reference requires it. | Approved front, side, and back images before more extensive mesh work. |

Use a separate `ene-v2.vrm`, editable scene, and generation script.
Keep the existing Ene available for comparison and recovery.
Reuse suitable light and camera controls from the separate Rei work.
The Ene material and expression data still require their own settings.

These tasks can use the existing open-source toolchain.
The user does not need to edit vertices manually for the proposed first stages.
The implementation can use scripts and repeated visual checks.
Complex changes to face proportions or clothing may need specialist modeling work.
This study does not promise that an automatic process will finish those changes without iteration.

For acceptance, compare both assets under the same light and replayed motion.
Check neutral, blink, wink, smile, jaw, combined expressions, four hand gestures, wrist turns, and seated lean.
Check transparent parts on dark and light backgrounds.
Then measure the target computer during the real webcam session.
Do not use polygon count or a good still image as a quality score for all these conditions.

## A new generated model

A newly generated Ene mesh is possible as an experiment.
It has a larger untested scope than a derivative of this model.
The current asset already includes fingers, facial deformation, texture coordinates, cyber transparency, and an editable rig.
A generated replacement must reproduce all those functions.

Tripo's [Auto Rig documentation](https://developers.tripo3d.ai/en/docs/animations-rig) describes automatic skeleton creation and humanoid animation workflows.
It does not establish preservation of this Ene's face shapes, cuff behavior, VRM metadata, or MToon appearance.
An attractive generated preview would not prove those functions.

Use generation for a separate design experiment only if the targeted derivative fails the chosen appearance target.
Test one face-and-cuff prototype before any complete replacement.
The available evidence favors a controlled Ene derivative now.

## Reproduction and limits

Run these commands from the repository root:

```bash
python ops/001-zhil/sprint-002/research/tools/ene_asset_audit.py
python ops/001-zhil/sprint-002/research/tools/ene_pack_probe.py
blender --background --factory-startup --python-exit-code 1 --python ops/001-zhil/sprint-002/research/tools/ene_scene_audit.py
node ops/001-zhil/sprint-002/research/tools/ene_render_probe.mjs
blender --background --factory-startup --python-exit-code 1 --python ops/001-zhil/sprint-002/research/tools/ene_packed_import.py
```

The Python file tools use Pillow and NumPy.
The Blender checks use the repository's installed add-ons.
The browser probe uses the installed Vite, Playwright, and glTF validator packages.
Local research outputs remain outside Git.

The probe checks used array values, expression bindings, selected images, file hashes, and loader operation.
The 55 listed spring joints produce 36 runtime spring segments in this loader.
The static renders disable spring motion.
It does not measure live webcam quality, dynamic cloth collision, or target GPU performance.
It does not establish the source of the older VRChat package.
This study did not deploy or replace the existing Ene avatar.
