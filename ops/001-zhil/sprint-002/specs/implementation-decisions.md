# Sprint 002 implementation decisions

Date: 2026-10-05.
Scope: the next human test build.
Authority: the user's request to implement the evaluated proposal through human test readiness.

## Required result

Deliver a testable correction for the defects that the supplied evidence proves.
Keep the numerical targets in the [sprint proposal](sprint-002-plan.md#acceptance-targets).
A successful software test does not establish physical acceptance.

| Finding | Decision for this build | Reason |
| --- | --- | --- |
| Hand world landmarks contain unsupported zero visibility. | Ignore hand visibility and presence inside motion conversion. | These fields are not measured hand confidence. Keep finite-coordinate and assignment checks. |
| Hips remain outside the seated camera image. | Use shoulder image roll when the full torso estimate fails. | Visible shoulders supply roll without invented hip positions. |
| Spine alone receives the torso goal. | Give the spine 45% of total rotation. Give the chest the full world rotation. | Parent-relative application supplies the remaining chest rotation without duplication. |
| Arm rejection immediately removes a valid goal. | Hold a rejected goal for 150 ms after the first rejected use. | This covers a short detection gap without indefinite motion retention. |
| Old body data can outlive its value. | Limit every hold to a source age below 500 ms. | Cached frames cannot extend this deadline. |
| Raised-arm noise has several possible causes. | Keep the existing elbow plane checks and rotation filter. | The traces do not prove a need for a new IK algorithm. |
| Balanced mode halves body and hand cadence. | Run enabled tasks on each submitted Balanced frame. | Remove the artificial half-rate limit before a larger scheduling change. |
| Camera submission stops at 20 Hz. | Permit up to 30 submissions per second in Balanced mode. | Keep one frame in flight and prohibit queues. |
| Reasons disappear between renders. | Retain the latest sample reasons. Add application states. | The display must distinguish rejection, hold, and decay. |
| Trace model identity is absent. | Record current and comparison model hashes. | Later comparisons can identify the exact assets. |

A world rotation describes orientation in the shared scene coordinates.
A local rotation describes orientation relative to the parent bone.

## Confidence and fingers

The adapter version is `task-confidence-2`.
The solver version is `motion-solver-3`.
Raw hand fields remain unchanged in traces.
Pose visibility and presence retain their existing thresholds.
Hand assignment retains its score, distance, and ambiguity checks.
The solver rejects malformed palm coordinates before it creates finger goals.

The existing finger geometry reproduces four synthetic gestures after the confidence correction.
The tests cover both hands on Ene and Rei.
Keep model-relative curl axes, spread limits, and thumb limits for this test build.
Physical thumb opposition, side views, and hand crossings still require review.

## Torso and calibration

The seated fallback estimates roll only.
It does not infer unseen hip translation, torso pitch, or torso yaw.
The full four-point path remains available when its landmarks pass confidence checks.
The root and legs remain stationary in seated mode.

Calibration now stores an optional `torsoRoll` value.
Old calibration files remain valid and use zero torso roll.
The user should calibrate again with level shoulders before the next test.
Head-only motion does not supply a torso measurement.

## Arm recovery

The selected grace period is 150 ms after the first rejected use.
A 100 ms grace period can end before one missed body sample returns at the previous 5.73–6.35 Hz cadence.
A 250 ms grace period retains rejected motion longer without additional evidence.
These comparisons explain the initial choice; they do not establish the best physical setting.
The original source timestamp still enforces the 500 ms age limit.

The solver preserves the previous valid arm goal during the grace period.
It then approaches the rest pose through the existing exponential rotation filter.
A fresh valid result replaces the held goal.
Changes to mode or hand enablement clear incompatible goals.
Calibration also clears motion history.

## Scheduling and measurement limits

Balanced mode now requests face, body, and enabled hands for every submitted frame.
Low mode requests body and hands on alternate submissions.
Low mode keeps its 10 Hz submission limit.
A disabled hand task clears its previous observations immediately.

The supplied traces show median task costs near 23–26 ms for face inference.
They show approximately 24–28 ms for pose inference and 29–39 ms for hand inference.
These costs show that 30 Hz submission permission does not guarantee 30 Hz results.
The combined worker still returns its results together.
Face cadence can decrease when every frame includes body and hand calculations.

Measure face response as well as body and hand response in the next session.
Keep the 15 Hz useful-result target open.
Use a later worker split only if target-computer measurements justify its added synchronization work.
The inspector now shows detected sample counts and inference cost percentiles.
A detection count does not establish a valid gesture or an accepted bone goal.

## Diagnostics and old traces

Visible avatar summaries use the selected comparison rig.
Canonical views use the canonical rig.
Recordings explicitly identify `diagnosticRig: canonical`.
Their model hashes identify the visible assets; their stored reasons still describe the canonical solve.

The summary excludes default confidence events from accepted counts.
It counts accepted channels separately from clamp events.
Application states identify cached, held, and decaying motion.
Rejection metrics exclude application states.

Old traces retain their raw observations and recorded reasons.
Replay applies the current solver to those observations.
The interface identifies this operation as a comparison when solver versions differ.
It does not reproduce the old solver's numerical output.

The old solver equality gate is obsolete because torso distribution and recovery intentionally changed.
The current checks retain deterministic forward, backward, and repeated replay.
New tests check gestures and torso motion on both actual avatars.
The old solver remains a numerical comparison in the replay report.

## Conditional work

### S002-006: Established application comparison

Prepare the same-camera comparison procedure now.
Keep the comparison open until a person can operate the target camera and application.
Use it after the first corrected VModel session if quality remains below the targets.
Do not replace the runtime before the proven defects receive a physical retest.

### S002-007: Expressions and model changes

Keep the existing blink, mouth, smile, gaze, and manual expression mappings for the retest.
The user reported favorable facial motion.
The direct tests show working spine, chest, and finger controls on both models.
No measured defect requires an Ene v2 to test these corrections.

The replay hand close-up still shows cuff overlap.
That image cannot separate cuff weights from wrist orientation and incomplete arm observations.
Review a fixed palm pose before an asset change.
The [Rei appearance research](../research/004-rei-vrchat-feasibility.md) remains a separate source for later appearance work.

### S002-008: External input

Defer a VMC bridge until the corrected camera test or application comparison demonstrates a benefit.
A bridge cannot repair rejected hand fields in the current solver.
It also cannot add measurements that the sending application does not provide.

If this branch opens, use a local UDP receiver and a browser WebSocket connection.
Convert source coordinates once at the receiver boundary.
Preserve source timestamps and reject stale packets.
Define one owner for each bone group before combining camera and external input.
Calibrate the source rest pose against the normalized avatar rig.
On source loss, use the same bounded hold and decay policy.
Test sender loss, reconnection, packet order, and source changes before physical acceptance.

This decision closes the conditional design choice for this build.
It does not close external tracking as a future option.
No Tripo expenditure or sensor purchase is required for this test build.

## Release gates

1. Pass unit tests and the production build.
2. Pass gesture and torso tests on Ene and Rei.
3. Replay the supplied traces with unchanged raw hand fields.
4. Check deterministic replay and inspector recording.
5. Check camera recovery and deployed browser access.
6. Supply the human procedure and result sheet.
7. Keep physical acceptance tasks open.
