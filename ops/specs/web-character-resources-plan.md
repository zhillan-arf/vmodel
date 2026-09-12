# Web character resources: research and implementation proposal

Date: 2026-09-12. All five final animations, editable sources and the separate showcase are delivered. TASK-029 through TASK-038 pass the recorded local Windows gates; [final G4 acceptance](../reports/web-resource-acceptance.md) is handed to TASK-P01/TASK-021. Actual macOS Safari, iOS Safari and Android Chrome remain untested/unpassed.

Controller: [TASK-P03](../tasks/archived/TASK-P03.md). Implementation: TASK-029 through TASK-038 in the [backlog](../tasks/backlog/README.md).

## Decision and scope

Implementation checkpoint: All ten G4 tasks are complete. The [final production report](../reports/web-resource-production.md) covers 408 RGBA masters and five large/small rendition families, with every-frame alpha/timing, byte budgets, source hashes and reproducible settings verified. The selected [encoding configuration](../../config/web-resources/encoding.json) is 24 fps, VP9 CRF 34, animated WebP Q65/compression 4, with explicit RGBA resizing; desk loops are three seconds and the greeting is five seconds. All initial byte ceilings pass unchanged. The [showcase report](../reports/web-showcase.md) verifies the isolated 11,725-byte gzip JS/CSS build and final Windows Chrome/Edge/Firefox WebM plus supplementary Windows WebKit animated WebP paths. [Final acceptance](../reports/web-resource-acceptance.md) records 1,531/1,920 ms cold animation, four playback intervals over 61 seconds and the 602.21-second lifecycle check. Actual Safari/mobile hardware and direct comparison with the unavailable screenshot attachment remain unverified.

The implemented design uses **five transparent, pre-rendered Ene animations** from the existing **Cyber legs PMX** in Blender with MMD Tools. It delivers **VP9 WebM with alpha**, **animated WebP compatibility variants**, and **static transparent posters**, backed by editable animation scenes and a reproducible render/encode recipe. A small Vite/TypeScript showcase integrates all five completed resources. Room, desk, player chrome, text and chat stay in HTML/CSS so the eventual personal website can change layout. The remaining design sections preserve the original requirements and research; the reports above identify measured results.

This is the third workstream (avatar/performance kit, voice, website resources). Its goal is **G4**, because the existing project already calls voice G3. It does not replace G1-G3 or add live tracking, voice synthesis, a streaming backend, chat service or a new character-generation pipeline to the showcase.

The deliverable is animated character footage made from a 3D source. Visitors see a flat composited layer; they cannot rotate its camera. For five fixed performances, that is a useful tradeoff. If future requirements include arbitrary camera movement, cursor gaze, continuous expression blending or live lip sync, reconsider a separately optimized shared GLB/VRM. Do not make that speculative runtime part of this delivery.

## What the references establish

### Kizuna AI: distinguish the screenshot from the current site

On 2026-09-12, a direct HTTP inspection of [Kizuna AI's English homepage](https://kizunaai.com/en/) found a native `<video>` with `loop`, `muted`, `autoplay` and `playsinline`. Its source is `https://kizunaai.com/2026/wp-content/themes/ka_official/assets/mv/KA_HP_TOP_v1.2.mp4`. This confirms video delivery for the current hero. It does not establish the codec, alpha, original authoring software, or implementation of the older pink/grid screenshot. The current page has a different layout; the screenshot alone cannot distinguish video from WebGL. See the [inspection record](../reports/web-resource-research.md). Do not copy their character, movie or site assets.

### The Japanese post and Tripo

The user-supplied excerpt explicitly describes **Tripo generating separate hair/head/body pieces**, followed by an assistant using **Blender plus the author's custom rigging helper** to join and rig them, including secondary motion. The writer reports substantial Tripo-credit and assistant-token use and says 3D/Blender knowledge was still needed. This is a model-generation/assembly anecdote, not evidence that the same helper is available here or that a screenshot proves rig quality. Direct access to the [X post](https://x.com/Dstudio_ai/status/2096475126942560677) failed; the account of the workflow is grounded in the supplied text, not independent video inspection.

[Tripo's official pricing](https://www.tripo3d.ai/pricing) currently lists free and paid tiers. The free tier has 200 monthly credits, public/non-commercial models and limited exports; paid tiers expand access. Thus it is not exclusively paid, but **exclude Tripo entirely**, including free-credit trials, in accordance with the user's no-paid-service direction. No generated replacement model is needed.

### What MMD does, and where Blender fits

MikuMikuDance is a desktop animation application. The [original publisher](https://sites.google.com/view/vpvp/) supplies Windows editions and physics documentation. A PMX/PMD contains the model, skeleton, weights, materials, morphs and potentially physics; a VMD contains animation channels; a VPD is a pose file. MMD can pose and animate an existing rig without Blender. It is not a browser asset format or an automatic web publishing system.

[MMD Tools](https://github.com/MMD-Blender/blender_mmd_tools) imports/exports PMX/PMD models and VMD/VPD motion/pose data in Blender. Here Blender is a practical **authoring and rendering tool**, reused from the installed workflow. It allows scripted camera/lighting, corrective posing, morph animation, physics baking and transparent image output. Neither Blender nor MMD runs on the visitor's device. Avoid describing an MMD workflow as requiring fresh rigging: Ene already has a skeleton, weights and morphs; our work is verification and correction where necessary.

## Repository evidence and remaining uncertainty

| Inspected item | Finding | Effect on this work |
| --- | --- | --- |
| Cyber legs PMX | 63,278 vertices, 112,949 triangles, 49 materials, 193 bones, 50 morph entries, 81 rigid bodies, 78 joints | Reuse the existing character; the full source is unnecessarily heavy for a decorative browser layer |
| Existing import | `assets/work/ene/source.blend` exists; import script and report preserve bones and expression shapes | Copy it into a separate web-authoring scene; do not overwrite G1 sources |
| Existing VRM | `assets/avatars/ene.vrm` is 87,634,512 bytes (83.6 MiB) | A working local preview is not a lightweight website delivery asset |
| Existing appearance preview | Front render inspected; recognizable Ene, but bright face/hair highlights and resting pose | Tune facial readability and lighting for small web presentation; do not claim the AI illustration's exact finish |
| Morphs | Import reports include `まばたき`, `困る`, `びっくり`, `にこり`, `笑い`, `瞳小` and mouth shapes | Confusion/surprise/excitement can start from existing shapes; names alone do not validate expression quality |
| Source details | Duplicate PMX morph names exist; sphere textures `s.bmp` and `spa-pi.bmp` are missing | Keep stable source index/name mappings; reuse documented repairs and compare resulting renders |
| Toolchain | Reports record Blender 5.1.1, MMD Tools 4.5.14, Vite 8.3.0, TypeScript 7.0.2, Three.js 0.186.0 | Reuse and verify the needed subset; a tracking initialization gate need not block offline web rendering |
| Encoders | `ffmpeg` and `ffprobe` were not found on PATH during this inspection | Provision pinned no-cost encoders during TASK-029; absence on PATH is not proof none exist elsewhere |

Sources: [asset audit](../reports/asset-audit.md), [import report](../reports/ene-import.json), [toolchain report](../reports/toolchain.md), [VRM validation](../reports/vrm-validation.json). Existing task statuses and files show implementation has begun elsewhere; older planning-only summaries must not be mistaken for current artifact state. No G1 animation-quality task is closed by these findings.

### The supplied VMD is a reference, not a guaranteed Ene greeting

A read-only, bounds-checked structural inspection consumed all 165,023 bytes, including optional sections, with zero trailing bytes. It found 1,405 bone keys across 260 named channels (frames 0-348), 387 morph keys across 74 channels (frames 0-341), zero camera/light/shadow keys, and one IK/display record at frame 0. Only **57/260 bone names and 20/74 morph names** exactly match the audited Ene PMX. Some unmatched channels are source-specific secondary bones; exact matches do not prove equivalent axes or correct motion.

The embedded model is `八雲紫(773)`, not Ene. At the usual MMD 30 fps interpretation, the final keyed timestamp is 11.6 seconds; VMD does not provide an independent FPS setting. The [structural report](../reports/web-resource-vmd-inspection.json) is not a visual compatibility verdict. TASK-031 must preview it, identify a useful greeting interval, document source frames and timing, map appropriate body channels and replace source-specific hair/morph behavior. Preserve VMD timing/Bezier interpolation when adapting it; resample by seconds for 24 fps delivery, rather than simply changing scene FPS.

If no usable greeting can be transferred, author a clean greeting on Ene after inspecting the reference, and explain which gesture/timing elements were retained and what was replaced. Do not invent an observed wave or claim successful retargeting now. Coordinate evidence with TASK-014, whose bounded compatibility investigation remains separate; arbitrary VMD editing is outside scope.

## Delivery alternatives

| Configuration | Strengths | Costs and limits | Decision |
| --- | --- | --- | --- |
| Transparent WebM + animated WebP + posters | Fixed visual quality; independently composited over changing UI; no runtime skeleton/physics; selective download | Camera is baked; alpha decoding varies; WebP animation can use more CPU and has no native media timeline | **Selected**, subject to a small measured encoding/alpha spike before all five renders |
| One optimized GLB/VRM with five clips | Shared geometry across all states; real camera, gaze and transition control | Texture/material optimization, skinning/physics and renderer startup; raw model reaches browsers; present VRM is 83.6 MiB | Future option if interaction requirements change |
| Direct PMX + VMD browser player | Retains MMD motion conventions | MMD-specific loaders, IK, physics and material behavior on visitors' devices | Not selected |
| Opaque MP4 scene | Straightforward video playback and efficient distribution | Background and camera are baked; cannot freely overlay Ene on changing layouts | Optional diagnostic preview only |
| GIF/APNG or large sprite atlas | Easy bitmap usage in some contexts | GIF's limited color/alpha; full-frame animation/atlas transfer and decoded-memory cost | Not baseline |

[Khronos describes GLB/glTF](https://www.khronos.org/gltf/) as runtime 3D delivery with skins and animations; that remains a valid alternative, not an inherently bad format. For this task the fixed-performance requirement and inspected source size favor rendering. An optimized shared 3D asset could eventually be smaller than a growing library of video clips; no universal video-versus-3D size claim is intended.

Do not implement old tutorials importing `three/addons/loaders/MMDLoader.js`: the installed Three.js package has no MMD modules. The [official migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide) documents their deprecation and migration direction; the [suggested external repository](https://github.com/takahirox/three-mmd-loader) currently only says it is forthcoming. A direct-MMD fallback would require its own maintained implementation audit.

## Five creative deliverables

Use the first supplied screenshot as a **pose and composition reference**, not a pixel-exact environment brief. Preserve the actual Ene model's identity and proportions. The four desk states share a waist-up, slightly forward-leaning pose, face turned toward the viewer, one open palm raised on screen-right and the other forearm resting at a consistent desk line. Keep the whole palm, face, headset and animated hair inside the transparent bounds. Pose the lower body plausibly even where cropped.

| Stable resource ID | Required performance | Proposed timing and framing |
| --- | --- | --- |
| `home-greeting` | Full body, friendly acknowledgement/nod and clear hand greeting informed by `ene.vmd`; gentle hair/cloth settling | 4-6 seconds, 720x960, 24 fps; settled start/end with a rest beat for a repeatable loop |
| `desk-normal` | Screenshot-like welcoming presentation, relaxed brows, soft smile, blink and breathing | 3-4 second seamless loop, 960x960 transparent waist-up composition, 24 fps |
| `desk-confused` | Same desk pose; asymmetrical/concerned brows, slight head tilt, small uncertain mouth and restrained palm questioning motion | Same camera, crop, desk anchor and loop length as normal |
| `desk-surprised` | Same pose; widened eyes, raised brows, rounded mouth, small controlled recoil then settle | Same camera/crop/anchor; distinct from excitement; return to matching boundary pose |
| `desk-excited` | Same pose; broad happy expression and buoyant small shoulder/head motion, lively raised palm | Same camera/crop/anchor; readable eyes and no violent hair bounce |

Each is genuinely animated through bones/morphs and secondary motion, not a still with a CSS transform. Each codec/resolution/poster is a rendition of the same resource; **five resources** does not mean five total files. Suggested morph names are starting candidates; author and inspect combinations, blink interaction, eyelid closure, mouth geometry and clipping. Do not let expression blending close surprised eyes or exaggerate the mouth into broken geometry.

Add half-resolution versions: 360x480 greeting and 480x480 desk states. Keep the camera and normalized anchors fixed across renditions. Render character-only RGBA with no burned-in text, room, chat or desk. A simple desk plane may be used privately as an animation contact guide, hidden in the character output. The web demo supplies the visible desk/occlusion layer. Camera changes later require re-rendering; changing UI columns, colors and text does not.

## Production and format configuration

1. Copy the existing imported PMX scene to `assets/work/ene-web/`; verify source hashes, geometry, missing-map repairs, rig/hand/morph behavior and attribution. Keep the already authorized use recorded. Code licenses and character/motion terms are separate; retain author credit and supplied terms. Do not ship PMX, VMD, Blend or VRM source files with the public web build. Do not infer that rendering changes underlying rights or that obfuscation prevents downloads.
2. Reuse Blender/MMD Tools and script scene setup, two cameras, lighting, named actions and frame ranges. Tune soft, readable anime lighting; inspect the face at actual display size. Keep an editable action version before baking.
3. Evaluate IK and secondary motion sequentially after a warm-up interval, then bake/cache the final timeline. Trim warm-up from output. Use deterministic seeds and record Blender/add-on versions. Close loop seams through keyed settling/cyclic motion; matching the first and last body pose alone does not close hair/cloth discontinuities. Do not distribute render frames across processes until simulation evaluation is baked.
4. Render transparent PNG RGBA masters, using an explicit color-management configuration and stable camera/bounds. Prefer EEVEE on this machine, with CPU-capable alternatives if needed. Record elapsed render time and peak memory before extrapolating full production cost. Do not chroma-key blue Ene against a blue background.
5. Encode from masters using pinned FFmpeg/libvpx for VP9 alpha WebM and FFmpeg/libwebp or libwebp tools for animated WebP. Verify the actual build exposes the necessary encoders; no Tripo, paid plugins, Adobe tools or remote generation. Use roughly 24 fps, no audio, and CRF/quality sweeps instead of fixed unverified settings. Example starting point for WebM: `ffmpeg -framerate 24 -i frame-%04d.png -an -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 output.webm`. This is a starting recipe, not an executed/validated command.
6. Export a static transparent WebP poster and PNG fallback per resource. Render contact sheets and extract decoded output frames over black, white and checkerboard backgrounds to inspect fringes, transparency and color, including fine hair and bright trim. Alpha metadata alone is insufficient evidence.
7. Generate a versioned manifest and stage only final renditions and posters into an isolated web public directory. Retain sources/PNG sequences outside the served directory and exclude generated character media from code distribution.

[Chrome's alpha-video documentation](https://developer.chrome.com/blog/alpha-transparency-in-chrome-video) establishes VP8/VP9 WebM alpha and a Blender/FFmpeg route. It is historical format evidence, not a current all-browser compatibility guarantee. [FFmpeg's encoder documentation](https://ffmpeg.org/ffmpeg-codecs.html) describes libvpx and libwebp support; exact builds and options must be tested locally.

[WebP's specification](https://developers.google.com/speed/webp/docs/riff_container) supports both transparency and animation, and [MDN's image-format guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types) provides browser guidance. WebP is the animated compatibility path, but its actual decode cost must be measured. An `<img>` has no native pause/seek timeline: pause means replacing it with the poster and resume may restart the loop. Document this behavior rather than promising frame-accurate resume.

[Apple documents HEVC with alpha](https://developer.apple.com/videos/play/wwdc2019/506/) as a separate profile/workflow. Ordinary H.264 MP4 is not a transparent fallback, and ordinary x265 encoding does not establish an Apple-compatible alpha file. No Apple hardware or paid encoder dependency is required here; use tested animated WebP when WebM alpha fails. HEVC alpha is outside baseline scope.

### Playback behavior

- Start with an immediately sized poster; defer animation until the component is near the viewport. Set explicit width/height or aspect ratio to prevent layout movement. Load only the selected resource/rendition, not all five animations.
- Test a tiny, local known-alpha WebM via actual decoded alpha/compositing, with a timeout and safe fallback. `canPlayType()` tests codec recognition, not preserved transparency. Cache the session result; failed or inconclusive alpha detection selects WebP. Validate this probe against real compositing on tested browsers, since decoding paths can differ.
- Use muted, inline, audio-free `<video>` playback and handle rejected `play()` promises with the poster and a play control. [MDN's autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) explains why autoplay must be handled rather than assumed.
- Pause offscreen and on hidden tabs. For WebP, remove the animation source and show the poster. Preserve user pause intent across visibility changes. Default to posters for reduced-motion and supported data-saving preferences; offer explicit playback. Follow [the reduced-motion media feature](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).
- Switch desk expressions through a short crossfade (about 150-250 ms) only once the next source is ready; use hard changes for reduced motion. Limit overlap to two active sources during transition and release the old one afterward. Posters represent unselected states in a gallery. A load error must retain a visible correctly framed character and usable controls.

### Proposed manifest contract

`schemaVersion`, character/source revision, credits, and a `resources` map keyed by the five IDs. Each resource records label, duration, FPS, loop policy, render dimensions, normalized bounding box, desk/foot anchor, safe display region, poster/PNG paths, and small/large WebM/WebP renditions with MIME, codec, byte count and SHA-256. Record bake/render/encoder settings in a private build manifest, not in product-facing controls. Use relative URLs and an injectable base URL for later integration. Keep draft expected values separate from measured output metadata.

### Initial quality and performance gates

These are proposed acceptance budgets, **not measurements**. TASK-030 must establish that both animation paths are viable before full production; deviations require an explicit documented decision, not silent removal of animation on a target browser.

| Check | Initial target |
| --- | --- |
| Large WebM | Greeting <=3 MiB; each desk state <=1.5 MiB; all five <=9 MiB |
| Small WebM | Greeting <=1.5 MiB; each desk state <=0.75 MiB |
| Animated WebP fallback | Large greeting <=5 MiB, desk <=3 MiB each; small greeting <=2.5 MiB, desk <=1.5 MiB each; animated fallback remains required |
| Posters | <=150 KiB each at large size, <=75 KiB small, excluding optional PNG fallback |
| Showcase initial code | <=150 KiB gzip JS+CSS, excluding media; no Three.js/MediaPipe/voice bundle or source model requests |
| First visit | Load one poster plus the chosen animation only; test at 10 Mbit/s and 100 ms RTT, animation visible within 4 s for small rendition; poster/UI usable before animation |
| Playback | 24 fps source; <=5% dropped video frames over 60 s on inspected laptop at normal display size; separately inspect WebP continuity, CPU and memory |
| Lifecycle | One active animation normally; no requests for unselected variants; offscreen/hidden stop; no monotonic memory growth after warm-up over 20 repeated switches and a 10-minute session |
| Visual | All five recognizable, expressions distinguishable at 320 CSS px; no cropped moving extremities, black alpha rectangle, fringe halos, obvious seam or major rig clipping |

Browser matrix: installed Chrome/Edge and Firefox on Windows; Safari on macOS/iOS and Android Chrome for mobile behavior when devices are available. Record exact versions, device, path (WebM/WebP/poster) and evidence. Playwright WebKit is useful regression coverage, **not a Safari/iPhone hardware-codec certification**. No device access has been established in this research. Keep missing target checks explicitly open and continue other work; a static poster alone does not satisfy the normal animated Safari path.

## Showcase server and handoff

The separate `web-showcase/` entry/config uses the installed Vite/TypeScript toolchain. Player/layout code was prepared during TASK-036 rendering; final integration and TASK-037 acceptance used all five completed media families. Its dedicated `web-showcase/public/ene/` and `web-showcase/dist/` directories exclude the existing 83.6 MiB `public/avatars` content. The implemented loopback-only commands are `npm run web:dev` (5180), `npm run web:build` and `npm run web:preview` (4180). Follow the [launch/integration guide](../../docs/web-showcase.md); the build/hash audit proves the served file list.

Provide a homepage mode with full-body greeting and a stream-style mode with a main content/player area, Ene at the desk, title/status and illustrative chat/sidebar. Clearly present it as a local showcase. Provide keyboard-accessible five-state selection, play/pause/replay, responsive desktop/mobile layouts and light/dark/checkerboard backgrounds for review. Keep debugging metrics in a separate inspector, not the normal site flow. No microphone, camera, account or external API is needed. Do not start a stream or publish the site.

The handoff includes all five media families, editable scenes/actions, reference mapping and bake settings, reproducible render/encode instructions, manifest, a reusable media component, runnable showcase and integration quickstart. Document that future authors can change a pose/expression in Blender and rebuild a single resource. The complete resource package is local/personal; app source and notices remain separate from character media.

## Implementation order and acceptance

| Task | Outcome | Dependency |
| --- | --- | --- |
| TASK-029 | Audit reusable source and provision rendering/encoding subset | TASK-001 (Done) |
| TASK-030 | Prove alpha, quality, size and performance using a short Ene sample | TASK-029 |
| TASK-031 | Author full-body VMD-informed greeting | TASK-030 |
| TASK-032 | Author common desk composition and animated normal state | TASK-030 |
| TASK-033 | Author confused state | TASK-032 |
| TASK-034 | Author surprised state | TASK-032 |
| TASK-035 | Author excited state | TASK-032 |
| TASK-036 | Bake/render/encode all five and generate final manifest | TASK-031 through TASK-035 |
| TASK-037 | Build simple web showcase server and reusable media component | TASK-036 |
| TASK-038 | Verify cross-browser delivery, package resources and hand off G4 | TASK-037 |

TASK-030 may use a minimal throwaway HTML harness for codec measurement. TASK-037 may prepare its player and layouts while TASK-036 renders; its final integration and acceptance follow the completed resources. TASK-029 verifies the needed existing G1 artifacts without waiting for the unrelated webcam/voice acceptance chain. Coordinate discovered shared-model fixes with TASK-004/005/006 and record their use; do not mutate shared work scenes silently. TASK-031 contributes to TASK-014 where useful, without making G4 depend on arbitrary motion compatibility.

Planning effort ranges total roughly 9-17 focused workdays plus rendering and device-review time: source/tool verification 0.5-1 day; spike 1-2; greeting 1-2; normal desk 1-2; each additional expression 0.5-1; production 1-2; UI 1-2; final checks 1-3. These are uncertainty ranges, not a delivery commitment; geometry repairs and measured encoding results can change them.

| Goal criterion | Required evidence | Owner |
| --- | --- | --- |
| G4-A greeting | Full-body animation and recorded `ene.vmd` interpretation/adaptation; source retained | 031, 038 |
| G4-B four desk states | Four actual animated performances with shared composition and distinct normal/confused/surprised/excited faces | 032-035, 038 |
| G4-C lightweight resources | Measured WebM/WebP/poster renditions, source-derived alpha, manifest and budgets | 030, 036, 038 |
| G4-D web setting | Runnable local server, homepage and stream modes, responsive layout and lifecycle/fallback controls | 037, 038 |
| G4-E reusable handoff | Editable source, no-paid-service recipe, credits, integration instructions and explicit browser evidence | 029, 036, 038 |

TASK-P03 coordinates these ten children and closes after TASK-038 plus its G4 handoff to TASK-P01. TASK-021 remains overall acceptance and consumes TASK-038; P03 does not depend on TASK-021 completing. This avoids a circular completion condition. Research completion does not mark any of the ten implementation tasks Done.
