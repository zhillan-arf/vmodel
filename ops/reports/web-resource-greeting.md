# Full-body greeting animation

TASK-031 implementation evidence, 2026-09-12. `home-greeting` is a five-second Ene Cyber legs performance: a brief acknowledgment/nod, a raised open-palm greeting with a small wave, and a settled return. It is authored at 24 fps. Private [playable review](local/web-resources/review.html), [contact sheet](local/web-resources/home-greeting/contact-sheet.png) and [poster](local/web-resources/home-greeting/poster.png) are available; the small draft animation is 360×480 at 12 fps. TASK-036 retains final full-resolution/24 fps production.

## VMD interpretation

The supplied `ops/resources/ene.vmd` was opened on Ene in a separate [VMD inspection scene](../../assets/work/ene/vmd-inspection.blend). The [visual compatibility report](ene-vmd-compatibility.md) and [mapped-channel evidence](vmd-inspection.json) identify the embedded `八雲紫(773)` model name, 57/260 exact bone matches and 20/74 morph matches. Name matches alone did not establish a transferable Ene greeting: 128 unmatched `sk_*` channels and model-specific hair/hat channels are not Ene secondary motion.

The author examined rendered Blender frames 120, 180 and 240: hands near the chest/mouth, then an arm raised overhead, then a bent overhead arm with a wink. These correspond to source VMD frames 119/179/239 at approximately 3.97/5.97/7.97 seconds under the 30 fps interpretation. The reference's opening faces backward and its final pose differs, so it is not already a repeatable homepage loop.

The new Ene action retains the readable upward acknowledgment from that interval. It replaces the entry/exit, hand silhouette, wrist wave, timing and facial expression, adding settled boundaries for the website. It does not claim a literal retargeted wave, reuse foreign hair channels, or silently discard source Bezier timing. The original VMD and its imported actions remain untouched; the delivered action is newly authored by seconds at 24 fps, rather than changing a 30 fps action's scene FPS.

## Editable source and animation recipe

- [home-greeting-authoring.blend](../../assets/work/ene-web/home-greeting-authoring.blend) opens with the editable `home-greeting-body-authored` action before secondary curves. The face action remains separately editable.
- [home-greeting.blend](../../assets/work/ene-web/home-greeting.blend) uses `home-greeting-body-and-secondary-baked` and `home-greeting-face`, frames 1–120 at 24 fps. Frame 121 is retained as the equal loop endpoint and excluded from output.
- [Performance settings](../../config/web-resources/performances.json), [authoring script](../../scripts/author_web_performances.py), [FK/hand helpers](../../scripts/web_authoring.py), and [authoring record](home-greeting-authoring.json) preserve the exact source, action names, camera and bake settings.

Ene's actual bones are posed through corrected FK parenting and analytic two-bone arm positioning. The hands use measured source nail normals to distinguish palm from hand back. Fingers are gently separated. A private `WebCuffRetractRight` corrective key retracts 85 clothing vertices by at most 6.5 cm, exposing the raised palm otherwise hidden by the long source cuff. The original mesh and accepted VTuber export are unchanged.

The acknowledgment occupies roughly 0.15–0.85 seconds. The arm rises over 0.55–2.30 seconds, waves gently around 2.25–3.60, and lowers over 3.60–4.55 before the rest beat. Palm angle is interpolated directly to avoid a quick reversal from normalizing a near-zero interpolated direction. Happy/soft-mouth source keys are `にこり` index 6 at 0.18 and `ω` index 38 at 0.10; `まばたき` index 10 supplies a brief blink around 0.35 seconds.

These indices identify the imported Blender shape-key slots, consistent with the avatar profile, rather than raw PMX morph-table offsets.

Hair motion uses Ene's own bone chains with a 2.2 Hz damped angular follower, damping ratio 0.82, 0.65° periodic driving amplitude and 240 Hz integration. Eight five-second warm-up cycles precede key baking. The stored spring endpoint angle/velocity differences are below 4e-15; bounded skirt motion is 0.25°. This is authored secondary motion with controlled settling, not Bullet collision simulation.

## Camera, boundary and review evidence

The fixed orthographic camera is at `(0, -4, 0.97)`, looking level toward `(0, -0.02, 0.97)`, scale 1.95. Final sizes are 720×960 and 360×480. The full model including cyber-leg tips is visible throughout. Normalized coordinates from top-left use a foot anchor near `(0.5, 0.915207)` and a 5% safe inset. No ground, room, text or UI is burned into the RGBA frames.

The [reopened all-frame audit](home-greeting-audit.json) checks 121 samples, all evaluated vertices finite and the final endpoint identical to frame one (0.0 m maximum distance). Full geometry remains inside the camera. The largest adjacent-frame movement is 8.52 cm at a fingertip during the quicker arm return, down from 17.87 cm after the palm-angle correction; the event is explicitly located in the audit for later animation polish.

The [baseline readback](web-performance-baselines.json) checks the editable body action is active and changes with time, and verifies original-source hashes. Both PMX variants, the supplied VMD, shared source.blend and accepted ene.vrm remain byte-identical. The private scenes/frames preserve Ene's Cyber legs design and AuroraYok / yokkaulove credit.

The [preview encoding record](home-greeting-preview-media.json) records actual draft sizes, hashes and commands. The animated WebP has 60 image frames and approximately 4,999 ms duration; WebM is five seconds. [Browser evidence](web-drafts-browser.json) checks actual decoded alpha, frame progress, observed repeat boundaries, pause/replay and changing WebP frames in Chrome. The two-preview functional check includes startup and is not a final performance benchmark. Final 24 fps rendition sizes, Safari/mobile hardware and site integration remain TASK-036/038.

Visual review examined the updated 12-pose sheet and consecutive return poses at source frames 97/99/101, with no major hand/body clipping observed. The reviewer checked the full greeting at black/white/checkerboard backgrounds, including the raised-palm pose at the verified 2.6-second seek in [Chrome](local/web-resources/chrome-white.png). Face, headset, hand and cyber-leg tips remain visible, and the opening/closing rest poses agree. The parent controller also independently reviewed the greeting contact sheet. This is bounded visual review, not exhaustive collision certification or user signoff.

Final small review files are 105,316 bytes WebM and 544,422 bytes animated WebP. Chrome observed two greeting loop resets and 133 video frames with zero drops in the short simultaneous-preview check. Its WebM pixels demonstrably change, and both WebM and WebP decode zero-alpha background pixels. The private HTTP harness now supports byte-range requests; the test explicitly asserts accurate seek positions instead of accepting an opening-frame fallback.

Reproduction: run Blender with `--background --python-exit-code 1 --python scripts/author_web_performances.py -- home-greeting`; render using `scripts/render_web_drafts.py -- home-greeting preview`; run `python scripts/encode_web_drafts.py home-greeting`; run the Blender `audit_web_performances.py` and `audit_web_baselines.py` scripts; run `node scripts/review_web_drafts.mjs` for the private two-animation check.
