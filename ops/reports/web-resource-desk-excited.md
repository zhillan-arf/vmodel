# Excited desk animation and four-state comparison

TASK-035 evidence, 2026-09-12. `desk-excited` is a three-second animated performance with a broad upturned mouth, a short laughing-eye beat, buoyant head/shoulder motion and a lively presenting palm. The [playable four-state review](local/web-resources/desk-states-review.html), [excited contact sheet](local/web-resources/desk-excited/contact-sheet.png), and [unlabelled comparison at 320 CSS px](local/web-resources/desk-states-unlabelled-320px.png) show the actual model. Left-to-right comparison order: normal, confused, surprised, excited.

## Source and composition

The private [authoring scene](../../assets/work/ene-web/desk-excited-authoring.blend) uses `desk-excited-body-authored`, keeping body/face controls editable before secondary curves. The [render scene](../../assets/work/ene-web/desk-excited.blend) uses `desk-excited-body-and-secondary-baked` and `desk-excited-face`. Source frames 1–72 run at 24 fps; equal endpoint 73 is excluded from delivery. The draft animation is 480×480 at 12 fps, 36 frames; final 960/480 px 24 fps renditions are TASK-036.

The [fixed normal baseline](../../config/web-resources/desk-baseline.json) is unchanged: level orthographic camera `(0,-4,1.40)`, scale 0.90; desk anchor `(0.5,0.92222186)` in normalized top-origin coordinates; hidden guide Z 1.02. The screen-right model-left palm, fixed model-right wrist, seated lower body and private cuff correction match the other states. The original screenshot attachment was unavailable, so direct attachment comparison remains unverified; the common written pose brief governs composition.

## Facial selection and movement

| Imported Blender shape-key index | Name | Value / purpose |
| --- | --- | --- |
| 6 | にこり | 0.20, smile brow |
| 30 | あ | 0.45–0.53, open mouth |
| 38 | ω | 0.90, broad upturned mouth corners |
| 8 | 上 | 0.50, lifted brows |
| 13 | 笑い | 0–0.55, a laughing-eye beat near the loop middle |
| 10 | まばたき | Blink around 1.9 seconds |

These are imported Blender key-block indices, not raw PMX offsets. The initial `ω□` mouth looked too similar to surprise's round mouth. Nine actual face candidates were inspected in a private diagnostic camera; the [candidate record](web-expression-candidates.json) preserves those combinations. The selected broad-mouth combination returns to open eyes at the boundary and moves into a brief laughing-eye expression during the loop. Its smile-eye contribution fades during the blink, avoiding conflicting lid deformations.

Head response is a 2° periodic bounce, spine buoyancy 0.7°, and presenting wrist bounce 7 mm plus the shared breathing motion. The wrist's fixed counterpart stays on the same guide. [Exact settings](../../config/web-resources/performances.json), [authoring record](desk-excited-authoring.json) and [shared recipe](../../scripts/author_web_performances.py) preserve these choices. Ene's own hair followers are warmed for 24 seconds, integrated at 240 Hz and baked at 24 fps; the bounded skirt motion and seated fold are retained. This is controlled authored secondary animation, not Bullet collision simulation.

## Four-state and technical review

| State | Visible distinction at 320 CSS px |
| --- | --- |
| Normal | Open calm eyes, small soft mouth curve and gentle breathing |
| Confused | Downturned mouth, concerned brow/eye shape and sideways questioning tilt |
| Surprised | Wider alert eyes, smaller pupils, round open mouth and recoil |
| Excited | Broad upturned open mouth, laughing-eye beat and buoyant movement |

The author reviewed each 12-pose contact sheet, the four-state browser comparison without labels, and black/white/checkerboard composites. Excitement now reads through a smile/laugh rather than the round surprised mouth. Its blink closes cleanly, the mouth remains intact, and no major hand/hair/headset clipping was visible. Boundary poses match. This is bounded visual review, not an exhaustive collision certification or a claim of user signoff.

The [all-frame audit](desk-excited-audit.json) checks 73 finite geometry samples and reports 0.0 m loop endpoint difference, no clamped arm targets, exact common camera/anchor, and all moving extremities within the 5% inset (normalized 0.07936–0.94264). Resting wrist drift is below 0.00000051 m. The lowest resting forearm/cuff is stable 1.43 mm above the guide.

[Chrome playback evidence](web-desk-states-browser.json) records three loops for each of the four states, actual decoded alpha in both WebM and WebP, changing animated WebP frames, and passing pause/replay/poster controls. Excited counted 121 video frames and three drops including startup; the other three counted 121 with zero drops. This short simultaneous-draft check is not a final performance benchmark. [Encoding evidence](desk-excited-preview-media.json) records actual sizes/hashes and a 36-frame animated WebP lasting 2,999 ms. Final byte, 24 fps quality and real Safari/mobile coverage remain TASK-036/038.

[Baseline readback and protected hashes](web-performance-baselines.json) verify all five editable pre-secondary scenes and unchanged original PMX variants, VMD, shared source.blend and accepted ene.vrm. Generated scenes, frames and review media remain private, with AuroraYok / yokkaulove attribution retained.

Reproduce using Blender `scripts/author_web_performances.py -- desk-excited`, `scripts/render_web_drafts.py -- desk-excited preview` and `scripts/audit_web_performances.py -- desk-excited` with `--background --python-exit-code 1 --python`; run `python scripts/encode_web_drafts.py desk-excited`, the Blender baseline audit, and `node scripts/review_web_desk_states.mjs` after all four desk previews exist.

The parent controller independently reviewed the unlabelled 320 px four-state comparison and confirmed normal/confused differ through brow/mouth and tilt, while surprise's round mouth and excitement's smiling-eye moment are distinct.
