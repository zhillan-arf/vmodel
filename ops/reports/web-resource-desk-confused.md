# Confused desk animation

TASK-033 evidence, 2026-09-12. `desk-confused` is a genuine three-second bone/face animation from the Ene Cyber legs source. A downturned mouth, concerned brows, questioning head tilt and restrained palm movement distinguish it from the normal soft smile. The [four-state playback page](local/web-resources/desk-states-review.html), [contact sheet](local/web-resources/desk-confused/contact-sheet.png), and [unlabelled 320 CSS px comparison](local/web-resources/desk-states-unlabelled-320px.png) show the result. Comparison order is normal, confused, surprised, excited.

## Editable source and composition

The private [authoring scene](../../assets/work/ene-web/desk-confused-authoring.blend) contains `desk-confused-body-authored`, preserving editable body/face keys before secondary motion. The [render scene](../../assets/work/ene-web/desk-confused.blend) uses `desk-confused-body-and-secondary-baked` plus `desk-confused-face`. Frames 1–72 run at 24 fps; frame 73 is an equal endpoint excluded from output. Actual review files are 480×480, 36 frames at 12 fps. They are draft media; TASK-036 produces the final 960/480 px 24 fps files.

The [normal baseline](../../config/web-resources/desk-baseline.json) is retained: orthographic camera `(0,-4,1.40)`, scale 0.90; top-origin desk anchor `(0.5,0.92222186)`; hidden guide Z 1.02; model-left open palm on screen-right and model-right wrist fixed at `(-0.15,-0.30,1.07)`. The seated lower body remains behind the crop. The original screenshot attachment was unavailable; all desk states follow the accepted written composition brief. Direct attachment comparison is unverified.

## Source shapes and performance

| Imported Blender shape-key index | Name | Value / purpose |
| --- | --- | --- |
| 5 | 困る | 1.0, concerned brow |
| 36 | ∧ | 0.70–0.76, downturned questioning mouth |
| 19 | じと目 | 0.18, restrained uncertain eye shape |
| 10 | まばたき | Blink around 1.8 seconds |

These indices follow the existing imported avatar profile convention, not raw PMX morph-table offsets. The eye-shape contribution is attenuated during the blink so competing eyelid deformations do not accumulate. The head tilts 7° sideways with 1.2° variation, and the presenting palm changes angle gently. Breathing, 24-second warmed hair followers and bounded skirt motion reuse the normal recipe. Source-specific secondary channels from the unrelated VMD are not imported. The same private 85-vertex raised-cuff correction keeps the whole palm visible.

[Performance settings](../../config/web-resources/performances.json), [authoring record](desk-confused-authoring.json), and the [shared authoring script](../../scripts/author_web_performances.py) preserve exact values/actions. The original soft frown was increased after inspecting actual face renders; [candidate evidence](web-expression-candidates.json) records the inspected source-shape combinations.

## Validation

The [all-frame scene audit](desk-confused-audit.json) reopened the saved render source and checked 73 samples. All vertices are finite; loop endpoint maximum vertex difference is 0.0 m; no arm target was clamped. The fixed wrist drifts less than 0.0000005 m, and the lowest resting forearm/cuff remains 1.43 mm above the desk guide. Moving extremities remain within 0.07936–0.93732 normalized bounds, passing the common 5% inset and exact camera/anchor checks.

The author reviewed the complete 12-pose sheet, including blink and boundary poses, and the four expressions together at 320 CSS px on black/white/checkerboard backgrounds. Confused reads through the frown/tilt rather than an open round mouth or laughing smile; the palm, headset and hair remain visible. No major visible hand, eyelid or mouth clipping was observed. This is bounded visual review, not exhaustive collision certification or user signoff.

[Chrome playback evidence](web-desk-states-browser.json) records three loop resets, 121 video frames with zero drops in the short four-video draft check, real decoded alpha in WebM/WebP, changing animated WebP frames, stable pause/replay and poster pause behavior. This is a functional check, not a production performance benchmark. [Encoding evidence](desk-confused-preview-media.json) records actual sizes, hashes, 36 WebP frames and 2,999 ms duration. Final 24 fps size/browser/device acceptance remains TASK-036/038.

[Authoring readback and preservation evidence](web-performance-baselines.json) confirms the pre-secondary action is active and changes with time, and that both original PMX files, supplied VMD, shared source.blend and accepted ene.vrm remain byte-identical. Private scenes, master frames and review media retain AuroraYok / yokkaulove credit and remain outside public/code distribution.

Reproduce with Blender `--background --python-exit-code 1 --python scripts/author_web_performances.py -- desk-confused`, then `scripts/render_web_drafts.py -- desk-confused preview`. Encode with `python scripts/encode_web_drafts.py desk-confused`; run `scripts/audit_web_performances.py -- desk-confused`, `scripts/audit_web_baselines.py` in Blender, and `node scripts/review_web_desk_states.mjs` after all four desk previews exist.

The parent controller independently reviewed the unlabelled 320 px four-state comparison and confirmed normal/confused differ through brow/mouth and tilt, while surprise's round mouth and excitement's smiling-eye moment are distinct.
