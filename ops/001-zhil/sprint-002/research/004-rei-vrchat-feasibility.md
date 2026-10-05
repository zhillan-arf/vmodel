# Rei model origin and VModel feasibility

Date checked: 2026-10-05.

**Recommendation: improve the existing Rei model and VModel first.**
My model-origin estimate is a modified model from the official Rei family.
The evidence does not establish the exact VRChat file or its editor.
VModel can display comparable model detail with a webcam as its motion input.
The webcam limits motion measurement; it does not set the detail of the displayed model.

Use the [image comparison](rei-vrchat-comparison.html) to examine the reference images and the local tests.
The tests show possible changes, but they do not reproduce the reference appearance exactly.

Terms follow the [sprint glossary](../README.md#terms).
A **mesh** is the surface geometry of a model.
A **texture** is an image that supplies surface detail.
A **shader** calculates the color of each surface point.
A **material** supplies a shader and its settings to a mesh.
A **renderer** produces images from the model, materials, camera, and lights.
A **morph target** is a stored surface change, also called a blendshape.
A **draw call** is one graphics command that draws a group of triangles.

## 1. Which Rei model appears in the images?

**Model-origin estimate: an official Rei derivative with appearance changes. Confidence: moderate.**
An independent model remains possible.
The visible details give stronger evidence for reuse of official parts.
This is a visual inference, not a verified file identity.

The user supplied a quotation post on X.
Its [quoted post](https://x.com/softblueish/status/2098121800852906008) contains the two supplied images.
The [quotation post](https://x.com/softblueish/status/2098165680612712483) discusses Rei in VRChat but does not identify the model creator or file.
X returned HTTP 403 through the research browser.
A public FxTwitter response supplied the post text, quoted-post link, and original image URLs.
The saved images match the user attachments.
I found no public author statement that identifies this avatar's exact source or shader.

| Visible detail | Comparison with the local official model | Strength of evidence |
| --- | --- | --- |
| Chip accessory | Similar shape, placement, and small white lettering | Evidence for common parts; not unique proof |
| Jacket | Matching circuit symbols, seam detail, orange cuffs, and collar arrangement | Stronger evidence than color alone |
| Hair | Similar asymmetric construction and irregular light patches | Evidence for the official family; exact geometry remains unverified |
| Eyes | Both have orange rings with white lettering | Matches the character design; the reference has different inner detail |
| Face | The reference has stronger eyelash, eyebrow, nose, and mouth lines | Indicates material, texture, expression, or geometry changes |
| Outlines | Clear black boundaries in the reference; none enabled in the local VRM | A measured appearance difference |

The character design alone cannot prove common mesh geometry.
I did not obtain the author's Unity project, model hash, or VRChat avatar ID.
The images cannot reveal topology, exact facial controls, tracking equipment, or live motion quality.

**The local model is already an official VRM.**
VModel does not convert an MMD file when it starts.
The [provision script](../../../../scripts/provision_rei.py) copies a supplied native VRM without model edits.
The saved [source record](../../../../public/avatars/rei-notices/provenance.json) names `足立レイver1.3.3（VRM）.zip`.
The embedded author is `みさいる`; its embedded version is `1.3.2`.
The archive name and readme use `1.3.3`, so those version fields differ.
The original supplied ZIP is absent from this checkout.
I verified the current asset and public copy directly; their bytes are equal.

The [official character page](https://mechanicalgirl.jp/adachi-rei/) links both MMD and VRM releases.
The creator's [release announcement](https://adachirei.seesaa.net/article/468677591.html) also links a combined MMD, VRM, and Unity archive.
The [official USB edition](https://booth.pm/ja/items/3644869) explicitly includes VRM and a Unity package for VRChat.
It specifies MToon, a toon shader, and 59,176 polygons.
The local VRM contains exactly 59,176 triangles.
This is evidence of a shared official model family across applications.
It does not prove that the screenshot uses that exact edition.

## 2. Files and alternative models

| Source | Available resource | Result |
| --- | --- | --- |
| [Official MMD release](https://3d.nicovideo.jp/works/td60213) | Official PMX model | Linked by the creator; the research browser could not read the page |
| [Official VRM release](https://3d.nicovideo.jp/works/td60214) | Official VRM model | Linked by the creator; the local native VRM is already usable |
| [Official VRoid Hub entry](https://hub.vroid.com/characters/7405676366762836028/models/7392036479731375574) | Official model listing | Another creator-linked source |
| [Official BowlRoll archive](https://bowlroll.net/file/204581) | Version 1.0.0; MMD, VRM, and Unity archive | Public download; retained locally for source comparison |
| [Official numbered USB edition](https://booth.pm/ja/items/3644869) | VRM, Unity package, textures, and numbered edition | Listed at ¥15,000 and out of stock when checked; not needed for the current model |
| [a7_riri Rei](https://booth.pm/ja/items/6912239) | Free fan model; Unity package, FBX, and textures | Real alternative; the public preview differs from the reference |
| [一止月サノツキ MMD model](https://3d.nicovideo.jp/works/td87166) | Separate fan model | A further lead, not an identified match |
| [Rei 256](https://booth.pm/ja/items/5556861) | Free simplified VRM with 256 polygons | Clearly unsuitable for this appearance target |
| [Steam Workshop MMD port](https://steamcommunity.com/sharedfiles/filedetails/?id=3608943261) | Garry's Mod model | The uploader credits 一止月サノツキ; this is not a VModel import file |

The a7_riri listing specifies 56,101 polygons for its normal version.
It also lists 14,856 and 93,685 polygons for other versions.
Its preview shows different jacket details and a different face.
The download link requires a BOOTH sign-in, so I did not obtain that archive.
The listing does not establish whether every part has independent geometry.
I therefore describe it as a separate fan model, not a proven model made entirely from scratch.

The search covered Japanese and English model names, BOOTH, creator pages, community posts, Steam Workshop, and the supplied account.
Community results supplied leads; creator pages and local files supply evidence for the model findings.
I found no verified public download for the exact edited avatar in the screenshots.
A VRChat avatar selection or clone does not supply an editable source package for VModel.
The useful acquisition path is the creator's VRM, FBX, or Unity project.

The [downloaded archive](rei-vrchat-local/official-rei-v1.0.0.zip) contains four PMX models, one VRM, a Unity package, textures, and source terms.
The ZIP integrity check passed.
Its VRM also has 59,176 triangles, 45 materials, and 43 images.
Its 2019 Unity package contains UniVRM assets; I did not establish compatibility with the current VRChat SDK.
This older archive documents the shared source family; it is not a replacement for the newer deployed VRM.
The [archive inventory](rei-vrchat-local/archive-audit.json) and [download record](rei-vrchat-local/archive-provenance.json) preserve these measurements.

## 3. What the existing asset contains

The [asset audit](tools/rei_asset_audit.py) reads the local VRM directly.
Its [JSON result](rei-vrchat-local/asset-audit.json) preserves materials, expressions, image sizes, and bone mappings.

| Property | Measured result |
| --- | ---: |
| File size | 55,715,860 bytes |
| VRM format | 0.0 |
| Triangles | 59,176 |
| Meshes | 2 |
| Material groups | 45 |
| Embedded images | 43 |
| Image sizes | 32 at 2048 × 2048; 11 at 1024 × 1024 |
| Humanoid bones | 53 |
| Finger bones | 30 |
| Facial morph targets | 51 |
| Expression groups, including neutral | 35 |
| Spring groups | 8 |
| Collider groups / individual colliders | 44 / 108 |
| Materials with outlines disabled | 45 of 45 |

A collider is a volume that limits intersections during simulated motion.
Spring groups control secondary motion, such as hair movement.
The model includes spine, chest, eyes, hands, and fingers.
It lacks the optional `upperChest` mapping.
This does not prevent the current loader from accepting it.

The model's SHA-256 is:

```text
07037243141d9c3f260c6ef09419f1225ca64ffb7791204b4aef0b817ebc1735
```

The existing [direct-motion tests](003-model-and-tripo.md) moved all 30 finger bones and both tested torso bones.
Those tests also measured movement of the connected surface.
The existing asset therefore has the main controls needed for the proposed webcam system.

**The facial controls have unused capacity.**
Rei contains five vowel shapes, separate blinks, brow shapes, eye shapes, and several expressions.
The [worker](../../../../src/tracking.worker.ts) requests MediaPipe expression scores.
The [solver](../../../../src/motion-solver.ts) uses blinks, jaw opening, a combined smile, and gaze.
It also lets the user select a surprise expression.
It does not provide a complete mapping for the existing brow and mouth controls.

MediaPipe reports 52 face coefficients, which are numerical estimates of facial movement.
Rei's 51 morph targets do not correspond one-to-one with those coefficients.
A mapping needs calibration, limits, and rules for expressions that affect the same vertices.
[Google Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker).

## 4. Actual display and expression tests

The [browser test](tools/rei_render_probe.mjs) uses VModel's `AvatarViewer`, current Three.js, and current `three-vrm` loader.
It produces six images from the existing model.
The original model hash remains equal before and after the test.
The test makes the outline change only in a temporary model held in memory.

| Test | Result | Limit |
| --- | --- | --- |
| Load the current native VRM | Pass | One known model |
| Apply 11 selected expressions | All 11 changed morph weights | Does not test webcam accuracy |
| Change lights and camera | Pass | Does not reproduce the reference world |
| Enable MToon outlines | Pass | Uniform outline width causes visible artifacts |
| Render at 1920 × 1080 | Pass | Static test; no target-computer timing result |
| Preserve the original model file | Pass | Temporary material changes only |

The expression test covers five vowels, both blinks, happy, angry, sad, and Rei's custom surprise expression.
The test counts changed weights across material groups; these counts are not counts of unique facial shapes.
The [result file](rei-vrchat-local/render-probe.json) records the settings and graphics device.
The [saved verification report](../reports/rei-vrchat-feasibility.json) also records the archive hash and checks of the image controls.
The browser used SwiftShader, a software graphics renderer.
These tests establish loading and display feasibility, not live GPU performance.

The current [output configuration](../../../../src/composition.ts) uses 1280 × 720 for landscape output.
The research test retains that size for the studio baseline and uses 1920 × 1080 for the close views.
The [viewer](../../../../src/viewer.ts) fixes three lights and uses `NoToneMapping`.
It does not configure world lighting, a detailed background, or a postprocessing chain.
Postprocessing means image effects applied after the renderer draws the scene.

The original model required 45 draw calls and 59,176 drawn triangles in this test.
Uniform outlines increased those values to 90 and 118,352.
The extra triangles belong to the outline pass; the source mesh did not gain triangles.
MToon can draw outlines directly. [MToon documentation](https://vrm.dev/en/univrm/shaders/shader_mtoon/).

The image set shows large changes from camera, lights, resolution, and outlines.
It also shows remaining differences in the eyes, face, and hair.
The outline sample has excessive lines around some small parts.
A finished version needs material-specific widths and face treatment.
This test does not show that light changes alone will duplicate the supplied images.

The embedded images total 556 MiB if each image uses four bytes per pixel without mipmaps.
Mipmaps are smaller texture copies that the renderer uses at a distance.
This calculation is a resource estimate, not a GPU memory measurement.
Texture memory and 45 material groups deserve measurement before more detail is added.

## 5. Can VModel use VRChat assets?

**Yes, through a controlled asset conversion.**
VRChat and VModel use the same basic kinds of model data.
Their application-specific controls differ.
The [VRM format](https://vrm.dev/en/vrm/vrm_features/) standardizes humanoid bones, expressions, materials, and secondary motion.
The current VModel loader already accepts VRM 0 and VRM 1.

| Resource | Use in VModel | Required work |
| --- | --- | --- |
| Mesh and skin weights | Usually reusable | Preserve shape, bone mapping, scale, and pose |
| Texture images | Usually reusable | Preserve color space, transparency, and texture coordinates |
| MToon materials | Direct use through VRM | Check outlines and light response |
| Unity shaders, such as lilToon or Poiyomi | Not directly executable in VModel | Convert materials or implement the required visual effects |
| Facial morph targets | Reusable when the export preserves them | Map names, weights, and expression combinations |
| PhysBones | VModel cannot execute these components | Convert to VRM springs and compare behavior |
| VRChat menus and animation controllers | VModel cannot execute these components | Recreate only the useful controls in VModel |
| VRChat contacts, grabbing, and network behavior | Separate application features | Add explicit VModel behavior if needed |
| World lights and postprocessing | Not part of the avatar alone | Build an equivalent scene and image treatment |
| Compiled VRChat avatar file or avatar ID | VModel cannot load these inputs | Obtain an authorized editable source |

VRChat's [creation guide](https://creators.vrchat.com/avatars/creating-your-first-avatar/) describes Unity projects, humanoid rigs, FBX files, and avatar components.
Its [PhysBones documentation](https://creators.vrchat.com/common-components/physbones/) includes grabbing, posing, and interactions with other avatars.
Ordinary VRM springs do not preserve all those behaviors.
A converted avatar can keep its appearance while some interactions need separate code.

**Recommended conversion path for a new source package:**

1. Obtain the source model and its terms from the creator.
2. Open the package in a separate Unity project with the required shader and avatar dependencies.
3. Record front, side, face, and hand images before conversion.
4. Convert materials, facial bindings, and secondary motion to VRM equivalents.
5. Export a separate VRM with embedded textures and source credits.
6. Run VModel's import checks and the expression and pose tests.
7. Compare identical views and poses with the Unity source.
8. Measure combined webcam, display, and output performance on the target computer.

[UniVRM](https://vrm.dev/en/univrm/export/univrm_export/) provides the export path from a Unity humanoid model.
Keep unused morph targets during export if VModel will need them later.
The export options can otherwise remove unbound shapes or custom expression groups.

[VRM Converter for VRChat](https://pokemori.booth.pm/items/1025226) converts between VRChat SDK3 avatars and VRM 0.0.
Its [source repository](https://github.com/esperecyan/VRMConverterForVRChat) provides another installation and inspection path.
[XRift VRM Exporter](https://github.com/WebXR-JP/XRiftVRMExporter/blob/main/Packages/com.halby24.xrift-vrm-exporter/README.md) documents VRM 1.0 export, lilToon conversion, and PhysBone conversion.
I reviewed these tools but did not run a Unity conversion in this study.
Their feature lists do not establish complete visual or behavioral equivalence.

VModel currently rejects FBX, PMX, ordinary GLB files without VRM data, and Unity packages.
Its [inspection code](../../../../src/vrm-inspection.ts) also rejects Draco, Meshopt, and BasisU compressed resources.
Exports must fit its 150 MiB input limit and other resource limits.
Renaming an FBX or Unity package to `.vrm` cannot satisfy these requirements.

## 6. Maximum useful result with one webcam

**Best practical target: detailed face and upper-body presentation, with controlled hand gestures and secondary motion.**
This is a proposed engineering target, not a measured result from the present camera system.
The renderer can use detailed textures and scene lighting independently of camera resolution.
The camera still needs enough visible detail to estimate the requested movement.

| Capability | Practical webcam target | Main limit |
| --- | --- | --- |
| Face appearance | Detailed eyes, hair, outlines, and scene lighting | Asset and renderer quality |
| Head movement | Smooth calibrated rotation and small position changes | Side views, motion blur, and face loss |
| Facial expression | Blinks, smile, mouth opening, brows, and selected mouth shapes | Existing shapes and stable coefficient mapping |
| Eye direction | Approximate calibrated direction | Ordinary webcam images do not measure precise gaze reliably |
| Torso | Visible lean and shoulder movement | Hidden hips require constrained estimates |
| Arms | Stable movement when shoulders, elbows, and hands remain visible | Depth ambiguity and overlapping limbs |
| Fingers | Open hand, fist, point, and peace sign under suitable conditions | Small fingers, overlap, and hand rotation |
| Hair and clothes | Simulated secondary motion | Simulation settings, not extra body trackers |
| Legs | Approximate poses when the full body remains visible | Smaller face and hand images; uncertain depth and foot contact |
| Hidden limbs | Rest poses, brief holds, or selected animations | No dependable measurement from an unseen body part |

MediaPipe estimates face, hand, and body landmarks from images.
Its world coordinates remain model estimates; they are not direct depth measurements.
[Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker),
[Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker).

VRChat images do not prove continuous finger tracking or face tracking.
VRChat has a built-in `Victory` hand gesture and discrete facial controls.
Its mouth controls can also use audio.
[VRChat parameters](https://creators.vrchat.com/avatars/animator-parameters/),
[lip synchronization](https://creators.vrchat.com/avatars/creating-your-first-avatar/#lip-sync-mode).
A selected peace-sign pose could produce the supplied hand pose without measuring each finger continuously.
The screenshots do not identify which method the author used.

For VModel, combine continuous webcam movement with optional selected poses and expression controls.
For uncertain observations, use a controlled transition to a known pose.
This can improve visible stability without claiming to measure hidden motion.
An optional microphone could improve speech-driven mouth shapes, but that is an additional input.
A strict webcam-only version must estimate mouth motion from the image.

The [existing diagnosis](001-physical-diagnosis.md) already found software rejection of valid hand movement and dependence on hidden hips.
Its measured body and hand sample rates were 5.73–6.35 Hz.
These are local implementation defects and timing limits, not proof of an absolute webcam limit.
A new avatar alone would not correct those defects.
Separate motion repairs appeared in the working tree during this study.
The quoted rates describe the baseline traces, not a measurement of those repairs.

Use the [existing acceptance targets](../specs/sprint-002-plan.md#acceptance-targets):

- At least 15 Hz useful body and hand results.
- At most 200 ms p95 visible delay.
- At least 9 correct holds from 10 attempts for each specified hand gesture.
- Stable recovery within 500 ms after usable observations return.
- A 15-minute combined camera and output test.

These targets need physical tests on the intended computer.
This study adds no claim that VModel already meets them.

## 7. Is Rei v2 worth creating?

**A limited Rei v2 is worth testing after the motion repairs.**
Here, Rei v2 means a separate derivative of the existing official asset.
It does not mean a newly generated replacement body.

| Option | Decision | Reason |
| --- | --- | --- |
| Keep Rei and improve VModel lights, camera, and output | Proceed first | The local test proves these changes work |
| Add mappings for existing brows, mouth shapes, and expressions | Proceed | The asset already contains useful controls |
| Create Rei v2 with targeted face, eye, material, and spring changes | Conditional next step | Compare specific improvements against the original |
| Convert a different VRChat avatar | Possible with source access | Conversion and visual comparison still required |
| Generate a new Rei in one operation | Do not select as the primary plan | No verified gain in facial control, weights, or character fidelity |
| Replace the whole application with Unity | Not justified by these images | The present renderer already handles the required model class |

Automatic 3D generation can produce a useful initial shape.
That result does not establish correct eyelids, ten fingers, skin weights, facial shapes, or hair collisions.
Tripo documents automatic skeleton creation and GLB/FBX output.
The reviewed [rig API](https://developers.tripo3d.ai/en/docs/animations-rig) does not establish a complete Rei-specific VRM with those controls.
A generated model would need the same inspection and physical tests.
It could also lose the visual details that identify Rei.

**Proposed work order and effort.**
These estimates cover focused engineering work; they are not delivery commitments.
The prior sprint plan owns motion repairs, so the estimates below do not include those repairs.

| Stage | Proposed effort | Acceptance condition |
| --- | --- | --- |
| Light, camera, outline, and 1080p experiment | 1–3 days | Reviewed comparison images and acceptable frame time |
| Existing facial-shape mapping | 2–5 days | Calibrated expression tests without conflicting shapes |
| Limited Rei v2, if the comparison shows a need | 3–10 days | Clear improvement in identical views and direct poses |
| First independent Unity-to-VRM import | 2–5 days | Preserved appearance, expression controls, and useful springs |

Complex Unity effects or facial geometry repair can increase these estimates.
The assistant can perform the conversion and asset changes in a later implementation task.
The user would review the appearance and perform the physical camera tests.

Keep the original model, editable work, and a separate export for any Rei v2.
Use fixed front, side, smile, blink, mouth, raised-arm, and peace-sign comparisons.
Retain the existing 30 finger controls and all required expression data.
Reduce texture memory or material groups only when comparison images preserve the needed detail.

The supplied readme permits modification and format conversion.
The embedded metadata uses `Redistribution_Prohibited` and disallows commercial use.
Those records differ; preserve both with any local derivative.
The [current character guidelines](https://mechanicalgirl.jp/guidelines/) also distinguish fan use from other commercial use.
This study does not establish unrestricted publication rights for a converted file.

## 8. Reproduction and remaining evidence

Run these commands from the repository root:

```bash
python ops/001-zhil/sprint-002/research/tools/rei_asset_audit.py
python ops/001-zhil/sprint-002/research/tools/rei_archive_audit.py
node ops/001-zhil/sprint-002/research/tools/rei_render_probe.mjs
```

The Python tool requires Pillow.
The archive tool requires the downloaded ZIP in `research/rei-vrchat-local/`.
The browser tool uses the installed Vite and Playwright packages.
Downloaded files and generated images remain under `research/rei-vrchat-local/`.
Its local Git rule excludes model files, extracted textures, and reference images from code distribution.

The following evidence remains unavailable:

- The exact edited VRChat source and its material settings.
- A Unity conversion test for a separate VRChat model.
- Live webcam accuracy after the proposed solver repairs.
- Target-computer performance with 1080p output and tuned materials.
- A user review that accepts the final appearance.

The current study is sufficient to select the existing Rei asset as the first implementation path.
It does not establish exact screenshot reproduction or full VR tracking from one webcam.
