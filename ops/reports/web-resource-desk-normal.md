# Desk-normal animation and reusable composition

TASK-032 implementation evidence, 2026-09-12. A three-second Ene Cyber legs desk loop is authored at 24 fps, with editable Blender actions and private animated review media. The composition follows the written brief: slight forward lean, open palm on screen-right, other forearm at the desk line. The original screenshot attachment is unavailable in this workspace, so direct visual comparison to that attachment remains unverified.

Open the private [playable review](local/web-resources/review.html), [12-pose contact sheet](local/web-resources/desk-normal/contact-sheet.png), or [320 CSS px face/hand view](local/web-resources/desk-normal/chrome-320px.png). The preview is 480×480 at 12 fps; it is review media, not TASK-036's final 24 fps rendition.

## Editable source and shared baseline

- [desk-normal-authoring.blend](../../assets/work/ene-web/desk-normal-authoring.blend) opens with `desk-normal-body-authored`, preserving the body/face authoring state before secondary animation. Its body keys are editable; its hair/skirt curves are excluded.
- [desk-normal.blend](../../assets/work/ene-web/desk-normal.blend) opens with `desk-normal-body-and-secondary-baked` and `desk-normal-face`. Frames 1–72 play at 24 fps; frame 73 is an equal endpoint retained for continuity checks and excluded from output.
- [Desk baseline configuration](../../config/web-resources/desk-baseline.json) records the locked camera, anchors, source-index/name expressions and reuse rules. The private [pose snapshot](../../assets/work/ene-web/desk-baseline-pose.json) records actual frame-one bone transforms and shape values.
- [Authoring recipe](../../scripts/author_web_performances.py), [rig helpers](../../scripts/web_authoring.py), and [performance settings](../../config/web-resources/performances.json) reproduce the scene from the isolated web source. TASK-033/034/035 should copy the desk scene, preserve its camera and contact, and edit expressions plus small head/hand accents.

Camera: orthographic, location `(0, -4, 1.40)`, level front view toward `(0, -0.04, 1.40)`, scale `0.90`. Delivery dimensions are 960×960 and 480×480. Image coordinates are normalized from top-left: desk anchor `(0.5, 0.92222186)`, with a 5% moving-extremity inset. The hidden guide is at world Z `1.02`; no room, desk, text or UI is rendered. Lower legs are posed seated forward with knees bent down behind the camera crop; front/side skirt bones are folded for that pose.

The model-left raised wrist is `(0.32, -0.19, 1.41)` with 3 mm periodic motion. Model-right wrist stays at `(-0.15, -0.30, 1.07)`. Analytic two-bone positioning keeps the resting wrist fixed during breathing. Source nail normals establish the actual palm direction; five fingers remain distinct. Ene's long cuff originally covered the raised palm, so the private `WebCuffRetractLeft` corrective key moves 85 clothing vertices back by at most 6.5 cm. This correction leaves body/hand geometry and original source assets intact.

## Expression and motion

| Source index | Source name | Use |
| --- | --- | --- |
| 6 | にこり | Relaxed smile, value 0.16 |
| 38 | ω | Small soft mouth curve, value 0.08 |
| 10 | まばたき | One blink around 1.65 seconds; frames 40–41 close fully |

Indices above identify the imported Blender shape-key slots, consistent with the existing avatar profile; they are not raw PMX morph-table offsets.

The face uses Ene's own shapes, with breathing in the spine/chest, a small living movement in the presenting hand, and bounded hair/cloth motion. No foreign VMD hair or face channels are applied. Hair uses damped angular followers driven by periodic motion: 2.2 Hz natural frequency, 0.82 damping ratio, 0.65° driving amplitude, ten substeps at 24 fps. Eight warm-up cycles (24 seconds) precede the baked loop. Skirt motion is a 0.25° cyclic offset on top of the seated fold. These are controlled secondary keys, not Bullet collision simulation.

## Review and measured checks

The [saved-scene audit](desk-normal-audit.json) reopens the source and checks all 73 samples including the endpoint. Every evaluated vertex is finite; the final endpoint exactly matches frame one (0.0 m maximum vertex difference). Resting wrist drift is 0.0000004872 m. The lowest resting forearm/cuff vertices remain at Z 1.02142525–1.02142572, a stable 1.43 mm above the invisible desk guide. All moving upper-body extremities stay within normalized bounds 0.07936–0.92991. The seated lower-body crop is intentional.

The author visually examined the open-palm and blink poses, the 12-pose contact sheet, and black/white/checkerboard browser composites. At 320 CSS px the neutral friendly face, whole palm and headset remain legible without a label; the blink closes the eyelids without obvious mouth/eye tearing. The parent implementation controller independently reviewed the contact sheet and confirmed the anchored forearm and blink/breath variation. This is a bounded animation review, not an exhaustive collision certification or a claim of user approval.

[Chrome playback evidence](web-drafts-browser.json) records real decoded alpha, three observed loop resets, actual changing WebM pixels, accurate paused seeking, stable pause/replay and an animated WebP path with decoded transparency. The simultaneous two-preview check counted 134 video frames and three drops including startup; it is a functional draft check, not a final performance benchmark. The [encode record](desk-normal-preview-media.json) records 36 review frames: WebM 96,973 bytes / 3 seconds, animated WebP 684,172 bytes / 2,999 ms. Byte sizes do not certify the future full-resolution 24 fps renditions. Safari/iOS/Android hardware remains TASK-038.

The [baseline readback](web-performance-baselines.json) verifies the authoring action is actually active and animated, exports the pose and expression mapping, and confirms unchanged SHA-256 hashes for both original PMX files, supplied VMD, shared source.blend and accepted ene.vrm. Model credit remains AuroraYok / yokkaulove. All generated character scenes, frames and previews remain private under the existing ignored asset/report paths.

Reproduction: run Blender with `--background --python-exit-code 1 --python scripts/author_web_performances.py -- desk-normal`; render with `scripts/render_web_drafts.py -- desk-normal preview`; run `python scripts/encode_web_drafts.py desk-normal`; run the Blender `audit_web_performances.py` and `audit_web_baselines.py` scripts; run `node scripts/review_web_drafts.mjs`. Final production and the public showcase remain TASK-036/037.
