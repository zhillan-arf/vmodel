# Physical diagnosis

Date: 2026-10-05.
Terms: [Sprint glossary](../README.md#terms).
Evidence: [Trace measurements](../reports/trace-analysis.json) and [replay measurements](../reports/replay-probe.json).

The evidence supports the user's main hypothesis.
Several software decisions prevent usable observations from producing correct motion.
The evidence also shows missing observations and limited sample rates.
Thus, a correct camera overlay does not show correct 3D motion or continuous detection.

## Image groups

The user specifies three pose groups in images 1–9.
Images 10–13 show the same peace-sign pose through different views.

| Group | Images | Observation |
| --- | --- | --- |
| Pose A | 1, 4, 7 | The hand reaches the head area. The avatar raises an arm but keeps an upright torso. |
| Pose B | 2, 5, 8 | The person tilts. The head responds, but the reference skeleton and avatar keep an upright spine. |
| Pose C | 3, 6, 9 | The arm crosses the chest. The estimated or applied hand position differs from the visible gesture. |
| Peace sign | 10, 11, 12, 13 | The detailed hand overlay shows two extended fingers. The avatar keeps an open hand. |

These images show corresponding poses. Exact frame synchronization is unknown.
Some panels contain different reasons within the same pose group.
The user reports unstable arms and the same defects with Rei.
Still images cannot measure shake frequency or latency.

The 3D lines in images 4–6 have the fixed proportions of the canonical rig.
This suggests that the images show solved motion rather than untouched MediaPipe world points.
The visible captions do not resolve the selected layer with certainty.
The replay below shows the failure on the canonical rig without that assumption.

## Trace contents and limits

The analysis resolves cached task references before it counts observations.
A cached reference points to an earlier result; an empty stored array can therefore mean reused data.
Counting those arrays as detection failures would give incorrect results.

| File | Duration | Sample events | Apply events | Different hand samples | Samples with a hand |
| --- | ---: | ---: | ---: | ---: | ---: |
| `ene_body.json` | 14.038 s | 160 | 826 | 80 | 33 |
| `human_body.json` | 12.060 s | 154 | 714 | 77 | 31 |
| `human_hand.json` | 8.949 s | 113 | 517 | 57 | 20 |

All files use seated mode, Balanced quality, 640×480 capture, enabled hands, and smoothing 14.
All files have no saved calibration and no rig hashes.
Each manifest names a video file by hash, but the supplied directory contains only JSON traces.
The files therefore permit solver replay, but not new inference from the original video.
The filenames do not show which avatar produced recorded diagnostics.
The recorder uses the canonical solver for those diagnostics.

The first `human_body.json` sample predates the recording window.
The rate calculation excludes that old sample.
The age calculation keeps recorded apply events, including initial stale data.
The reports keep the file hashes and the source commit.

## Finger defect shown by tests

Every world point from 131 different hand observations contains `visibility: 0`.
There are 2,751 such points.
Their `presence` field is absent.

The installed SDK converts a missing visibility value to zero.
Its `vision_bundle.mjs` contains the expression `visibility:Dr(r,4)??0` in landmark conversion.
VModel passes these objects directly from the worker to the solver.

`MotionSolver.points()` requires visibility and presence values above 0.55.
The same check applies to pose points and finger points.
Thus, the solver rejects every finger segment even when the hand shape appears correct.
The wrist calculation uses palm geometry without that point check.
This explains why a wrist can move while its fingers remain open.

Google documents hand coordinates and handedness separately from the detector's internal presence checks.
The handedness score measures left/right classification; it is not a per-finger visibility score.
This supports an adapter for each task's output contract. [Hand Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

The isolated ablation keeps only `x`, `y`, and `z` in hand world points.
It keeps hand assignment, score checks, pose confidence, sample times, palm checks, and joint limits.
It does not change the saved traces or production code.

| Trace | Original finger goals | Goals after ablation | Different finger bones after ablation |
| --- | ---: | ---: | ---: |
| `ene_body.json` | 0 | 960 | 15 |
| `human_body.json` | 0 | 1,290 | 30 |
| `human_hand.json` | 0 | 1,170 | 30 |

All three rigs produce these counts: canonical, Ene, and Rei.
The counts describe accepted solver goals, not successful physical gestures.
Repeated use of a cached sample can produce more than one goal event.

The [original preview](../reports/local/ene-original.png) and [ablation preview](../reports/local/ene-hand_xyz_only.png) show different finger shapes on unchanged Ene.
Both images use event 212 of `human_hand.json`.
The ablation moves the fingers, but the pose still has visible defects near the cuff.
It does not show a correct peace sign, finger axes, or hand placement.

**Repair direction:** normalize unsupported confidence fields at the task boundary.
Keep valid pose confidence and all finite-coordinate checks.
Add a recorded-data regression case with specified zero hand visibility.
The old synthetic fixtures omit visibility, so the solver substitutes 1 and the tests pass.

## Torso defect shown by tests

The spine calculation requires shoulders 11 and 12 plus hips 23 and 24.
Each required point must pass the same 0.55 confidence threshold.
Seated mode does not remove the hip requirement.

Every different pose sample places at least one hip outside the image.
The highest recorded hip visibility across these traces is about 0.0181.
The solver therefore rejects the spine before it calculates a rotation.

| Trace | Spine rejections for low visibility | Other spine rejections | Accepted spine goals |
| --- | ---: | ---: | ---: |
| `ene_body.json` | 160 | 0 | 0 |
| `human_body.json` | 152 | 1 missing landmark | 0 |
| `human_hand.json` | 113 | 0 | 0 |

The spine remains at zero local rotation in all 18 replay runs.
Direct model tests can rotate the spine and chest and move their connected surfaces.
This places the immediate fault in the solver's observation requirements.

The chest has no additional goal in `MotionSolver.body()`.
Even after spine recovery, the current design cannot distribute measured torso motion across spine and chest.

**Repair direction:** add a seated torso estimate that uses visible upper-body evidence and a calibrated reference.
Use shoulder roll when hips are unavailable.
Use separate confidence for roll, pitch, and yaw.
One shoulder line cannot uniquely determine all three rotations.
Do not convert head tilt directly into body tilt.
Do not lower the hip threshold until invisible hips pass.

## Arm instability: strong causes, incomplete attribution

The current traces show two conditions that can cause instability.
They do not contain a labeled interval for the reported two-arm shake.

| Trace | Body and hand rate | Median sample age | p95 sample age | Left arm visibility rejections | Right arm visibility rejections |
| --- | ---: | ---: | ---: | ---: | ---: |
| `ene_body.json` | 5.73 Hz | 180.0 ms | 326.8 ms | 92 | 80 |
| `human_body.json` | 6.35 Hz | 162.8 ms | 263.3 ms | 92 | 90 |
| `human_hand.json` | 6.35 Hz | 162.2 ms | 263.2 ms | 77 | 73 |

Sample age is capture-to-solver time, not measured camera-to-screen latency.
The worker runs face, pose, and hands in sequence.
Balanced mode runs pose and hands only on every second submission.
The theoretical 10 Hz ceiling falls further under the measured inference cost.
Smooth display frames cannot replace missing detector samples.

On each new frame, `MotionSolver.update()` clears all goals.
When one arm point fails confidence, that arm immediately receives its rest target.
Later accepted points produce the measured target.
This can alternate measured motion with return toward rest.
There is no bounded hold of the last valid arm goal or separate recovery state.

The limb solver also derives its bend plane from estimated 3D points.
Small depth changes can change that plane, especially near a straight arm.
The current code has continuity protection, but the traces contain zero `plane_jump` rejections.
Thus, this rejection path is not an observed cause here.
Plane noise below its limit remains possible.

The replay contains arm changes of about 30–32 degrees in one apply step.
These maxima include initialization and movement, so they are not valid measurements of stationary jitter.
Do not use them as a claimed improvement target without a labeled hold interval.

**Repair direction:** test bounded hold, recovery blending, bend-plane control, and faster task scheduling separately.
Measure both motion error and added delay.
More smoothing alone can conceal errors while increasing delay.

## Inspector defects

The inspector clears its reasons on every display update.
The solver recalculates most body and hand goals only when a new frame arrives.
Intermediate display updates can therefore show no hand result while the solver still applies existing goals.
The summary can show only `disabled_by_mode` from seated root handling.
That reason does not mean that seated mode disables the whole body.

The summary also counts confidence defaults and clamps as accepted results.
Those counts do not measure correctly reproduced joints.
The reasons come from the canonical solver, not a diagnostic sink on the selected avatar solver.
This can conceal model-specific failures.

**Repair direction:** keep reasons per task sample until replacement or expiry.
Show separate states for measurement, held motion, decay, and model application.
Record the selected model hash and the solver version in every trace.

## Hypothesis ranking

| Hypothesis | Evidence level | Next discriminating test |
| --- | --- | --- |
| Hand confidence semantics block fingers | Shown by values, code, and isolated replay | Repeat open hand, fist, and peace sign after the adapter repair. |
| Hidden hips block seated torso motion | Shown by values, code, and three rigs | Compare torso tilt with hips visible and hidden. |
| Goal loss causes arm return and recovery shake | Mechanism shown by code; contribution to visible shake unknown | Compare original and bounded-hold replay on labeled arm holds. |
| Sparse inference increases delay and visible steps | Rate and age measured | Compare task schedules with fixed camera input and equal load. |
| Depth ambiguity or bend-plane noise causes raised-arm shake | Possible; not isolated | Record both arms raised with visible elbows and a stationary hold. |
| Hand assignment errors affect crossing poses | Possible; distance rejections exist | Compare labeled anatomical sides through crossings. |
| Model bones are absent or immobile | Rejected for the tested bones | Keep direct bone and surface tests. |
| All model deformation is already suitable | Not shown | Review a full pose sweep after software repairs. |

The face overlay receives a favorable user report.
This does not show complete facial expression support or accurate hidden body depth.
The same failure on a reference skeleton and two different avatars strongly favors a shared software cause.

## Source locations

- [`tracking.worker.ts`](../../../../src/tracking.worker.ts): task schedule and unchanged landmark objects.
- [`motion-solver.ts`](../../../../src/motion-solver.ts): confidence, torso inputs, goal reset, and rest targets.
- [`retarget-math.ts`](../../../../src/retarget-math.ts): hand assignment and palm geometry.
- [`finger-solver.ts`](../../../../src/finger-solver.ts): curl and spread limits.
- [`tracking-inspector.ts`](../../../../src/tracking-inspector.ts): per-update reasons and canonical recording solver.
- [`tracking-recording.ts`](../../../../src/tracking-recording.ts): cached references and replay times.
- [`tracking-motion.ts`](../../../../tests/fixtures/tracking-motion.ts): synthetic hand points without visibility.

Paths above resolve from this document through the repository root.
