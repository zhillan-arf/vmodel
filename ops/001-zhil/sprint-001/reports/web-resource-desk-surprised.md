# Surprised desk animation

TASK-034 evidence, 2026-09-12. `desk-surprised` combines wider eyes, raised brows, a rounded open mouth and a small recoil/settle. It remains distinct from the broad smile and laughing eyes used for excitement. Review the [four-state playback page](local/web-resources/desk-states-review.html), [contact sheet](local/web-resources/desk-surprised/contact-sheet.png), and [unlabelled 320 CSS px comparison](local/web-resources/desk-states-unlabelled-320px.png); states run normal, confused, surprised, excited from left to right.

## Editable source and shared camera

[desk-surprised-authoring.blend](../../../../assets/work/ene-web/desk-surprised-authoring.blend) opens with `desk-surprised-body-authored` before secondary curves. [desk-surprised.blend](../../../../assets/work/ene-web/desk-surprised.blend) uses `desk-surprised-body-and-secondary-baked` and `desk-surprised-face`. The source is 24 fps, frames 1–72 plus equal endpoint 73. Private review media is 480×480 at 12 fps (36 frames, three seconds); final 960/480 px 24 fps production remains TASK-036.

The [normal baseline](../../../../config/web-resources/desk-baseline.json) camera, dimensions, screen-right open palm and fixed other forearm are preserved. Orthographic camera `(0,-4,1.40)`, scale 0.90; normalized top-origin desk anchor `(0.5,0.92222186)`; invisible guide Z 1.02. The accepted seated lower-body pose and raised-cuff correction are retained. Room, desk and UI stay out of the RGBA render. The original screenshot attachment was unavailable; this follows the written composition brief, with direct attachment comparison unverified.

## Expression and reaction

| Imported Blender shape-key index | Name | Value / purpose |
| --- | --- | --- |
| 18 | びっくり | 0.90–0.96, wider eyes |
| 8 | 上 | 0.65, raised brows |
| 33 | お | 0.72–0.80, round mouth |
| 22 | 瞳小 | 0.22, restrained pupil reduction |
| 10 | まばたき | Blink around 2.3 seconds |

Indices are imported Blender slots, consistent with the avatar profile, not raw PMX offsets. The wide-eye morph fades during the blink to avoid summing contradictory lid positions. The mouth stays round through the loop; the blink occurs after the main reaction. A cosine-shaped pulse adds 1.2° backward spine motion, half that in the chest, and a 3° head response, then returns to the starting pose. Analytic arm positioning preserves the resting wrist while the upper body reacts. The palm has 2 mm extra vertical motion.

[Settings](../../../../config/web-resources/performances.json), [authoring record](desk-surprised-authoring.json), and [recipe](../../../../scripts/author_web_performances.py) retain exact keys/actions. Actual [face-candidate renders](web-expression-candidates.json) informed the stronger eye/round-mouth combination. Hair followers use the common 24-second warm-up and 240 Hz integration before 24 fps key baking; cloth has a bounded cyclic offset. This is authored secondary motion, not Bullet collision simulation.

## Validation

The [saved-scene audit](desk-surprised-audit.json) checks every frame and the endpoint: 73 finite geometry samples, 0.0 m endpoint difference, no clamped arm targets, matching camera/anchor and a 5% inset. All moving extremities stay within 0.07936–0.92992 normalized bounds. Resting wrist drift is below 0.0000005 m, with the lowest resting forearm/cuff stable 1.43 mm above the guide.

The author reviewed the 12-pose sheet, blink/reaction/boundary poses and four-state 320 CSS px browser comparison on black/white/checkerboard backgrounds. The round mouth and alert eyes read as surprise; excitement instead has upturned mouth corners and a laughing-eye beat. No major eyelid, pupil, mouth or hand clipping was visible, and hair/hand/headset remain in frame. This bounded review does not certify exhaustive collision freedom or user approval.

[Chrome playback evidence](web-desk-states-browser.json) records real decoded transparency for WebM/WebP, three repeated loops, 121 video frames with zero drops in the short four-state check, changing WebP frames and passing pause/replay/poster controls. [Encoding evidence](desk-surprised-preview-media.json) records actual sizes/hashes and 36-frame, 2,999 ms animated WebP. This is draft functionality evidence, not final rendition performance or Safari/mobile acceptance; those remain TASK-036/038.

[Readback and original-hash checks](web-performance-baselines.json) verify the editable pre-secondary action and preserve the original PMX variants, supplied VMD, shared source.blend and accepted ene.vrm. All source/media remains private and keeps AuroraYok / yokkaulove attribution.

Reproduction uses Blender `scripts/author_web_performances.py -- desk-surprised`, `scripts/render_web_drafts.py -- desk-surprised preview` and `scripts/audit_web_performances.py -- desk-surprised` with `--background --python-exit-code 1 --python`; run `python scripts/encode_web_drafts.py desk-surprised`, the Blender baseline audit and `node scripts/review_web_desk_states.mjs` for the completed four-state review.

The parent controller independently reviewed the unlabelled 320 px four-state comparison and confirmed normal/confused differ through brow/mouth and tilt, while surprise's round mouth and excitement's smiling-eye moment are distinct.
