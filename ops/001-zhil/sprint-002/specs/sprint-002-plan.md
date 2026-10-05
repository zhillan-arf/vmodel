# Sprint 002 proposal

Date: 2026-10-05.
Status: Implementation authorized. The first human test build passed its software gates. Physical acceptance remains open.
Terms: [Sprint glossary](../README.md#terms).

Achieve the best practical motion quality that approaches established VTuber and VRChat systems.
Keep manual model creation outside the user's required work.
Use the supplied physical evidence to replace the old motion work order.

## Deliverables

The research deliverables are the diagnosis, option comparison, model assessment, trace measurements, and repeatable replay probe.
The user authorized implementation through the next human test.
The [implementation decisions](implementation-decisions.md) define this build and its open physical gates.

| Level | Proposed outcome | Limit |
| --- | --- | --- |
| A: Reliable camera motion | Both hands, stable raised arms, seated torso motion, clear loss recovery, and useful delay. | Visible upper-body movement from one camera. |
| B: Expressive performance | Better fingers, torso distribution, expressions, shoulder behavior, hair, and clothing. | Requires model-specific review after Level A. |
| C: Extended tracking | External face, hand, or body input with calibrated control ownership. | Requires a measured need and a separate input experiment. |

Level A is the required first milestone.
Level B makes the result more expressive without requiring a new avatar.
Level C provides a route beyond the information available from one camera.
Full VRChat sensor parity is an ambition, not a measured result or an unconditional promise.

## Decisions from the research

1. Keep Ene and Rei as comparison models.
2. Repair hand confidence semantics before changing models or detector thresholds.
3. Add a seated torso path that does not require hidden hips.
4. Separate arm recovery from measurement filtering.
5. Measure task scheduling independently from motion conversion.
6. Repair inspector reasons before interpreting acceptance counts as quality.
7. Compare an established application before a major solver replacement.
8. Defer Ene v2 until a direct model test identifies a useful asset repair.
9. Defer Tripo expenditure for the current defects.

The research ablation is not a complete production fix.
Production work must keep coordinate checks, valid pose confidence, trace compatibility, and model-independent behavior.

## Work packages

| ID | Work | Dependency | Completion evidence |
| --- | --- | --- | --- |
| S002-001 | Correct task confidence and keep accurate diagnostic reasons. | Completed research | Recorded hand inputs produce finger goals; stale and invalid inputs still fail correctly. |
| S002-002 | Add seated torso estimation and spine/chest distribution. | S002-001 | Torso lean works with hidden hips; head-only tilt does not move the torso. |
| S002-003 | Stabilize arm goals, elbow direction, and recovery. | S002-001 | Labeled holds and raised-arm motion meet stability and recovery targets. |
| S002-004 | Correct finger curl, spread, thumb motion, and hand assignment. | S002-001 | Open hand, fist, pointing, and peace signs work on both avatars. |
| S002-005 | Improve task scheduling and measure delay. | S002-001 | Higher useful rates and lower sample age under the same load. |
| S002-006 | Compare established applications and decide runtime direction. | S002-001 | Same-camera results for VModel and at least one other application. |
| S002-007 | Improve expression mapping and measured model defects. | S002-002, S002-003, S002-004 | Reviewed expression and pose matrix; conditional Ene v2 only with a measured benefit. |
| S002-008 | Test an external motion input if necessary. | S002-005, S002-006 | Working local input route or an evidence-backed decision to defer it. |
| S002-009 | Complete physical acceptance and revised handoff. | S002-002 through S002-008 | Both avatars pass required motion tests; optional work has a recorded decision. |

S002-002 through S002-006 can use separate experiments after S002-001.
The research already isolated the hand confidence defect through an ablation.
The next build combines the corrections after separate regression tests.
Compare its physical result with the supplied baseline evidence.

## S002-001: Confidence and diagnostics

Use an adapter that knows the confidence contract for each task.
Handedness confidence must keep its classification meaning.
Unsupported hand visibility must not become a measured zero-confidence value inside the solver.
Keep the original raw fields in diagnostic evidence.

Add a small recorded-data regression fixture with specified zero hand visibility.
Test malformed points, low pose visibility, absent hands, stale hands, ambiguous ownership, and cached references.
Test both current model formats.
Version the solver and adapter behavior in new traces.
Replay older traces through a specified compatibility path.

Keep the latest reasons by task sample and selected model.
Display held and decaying motion separately from new accepted measurements.
Record the selected avatar hash.
Do not count defaults or clamp events as successful gesture recognition.

## S002-002 through S002-004: Motion

For torso motion, compare a shoulder-based estimate with the existing four-point solution.
Use the existing solution only when its required points are valid.
When hips are hidden, keep root translation and legs stable in seated mode.
Estimate roll first; limit unsupported pitch and yaw independently.
Distribute accepted motion across spine and chest without duplicate parent rotation.

For arms, test a short hold of the last accepted goal before decay.
Use the original sample timestamp for hold expiry.
Compare several bounded intervals, such as 100, 150, and 250 ms.
Select an interval from measured loss and recovery behavior.
Add separate entry and exit conditions where threshold crossings cause oscillation.
Compare direction-based motion with two-bone IK only after the loss behavior is visible.

For fingers, compare each joint's local curl with the measured palm frame.
Test spread separately from curl.
Test each thumb's base and tip.
Keep model-relative axes and limits specified.
Verify both hands through crossings and changes in palm direction.
Correct a model only if direct control also fails.

## S002-005: Scheduling

First measure face-only, pose-only, hands-only, and combined task costs.
Then compare the current schedule with more frequent hand and body tasks.
Keep camera resolution, inference models, power, and output load fixed for each comparison.
Measure a higher capture resolution only as a separate experiment.
Test CPU and GPU paths where the application supports them.
Reject queues that accumulate old frames.

Use the recorded 5.73–6.35 Hz body and hand rates as the original baseline.
Do not compare browser render FPS with detector Hz.
The replay probe cannot measure new inference performance.
Scheduling acceptance requires the target computer and camera.

## S002-006 through S002-008: Comparison and extension

Use Warudo for a desktop upper-body reference.
Use XR Animator for camera full-body and MMD comparison where available.
Prefer the same avatar and camera conditions.
Record incompatible formats as comparison limits.

If an established runtime gives a better result with acceptable setup effort, propose adoption or a VMC connection.
If VModel meets the targets, keep the local architecture.
If all camera options fail a required hidden-body test, examine a suitable sensor.
Do not call a software defect a camera limit without these comparisons.

S002-007 first maps useful existing facial shapes.
It then tests shoulder deformation, cuffs, hair, and clothing under fixed direct poses.
Any Ene v2 must include an editable source, a change report, and identical before/after tests.
A new character from Tripo is a separate optional asset experiment.

## Acceptance targets

These numbers are proposed project targets, not an industry certification.
Physical measurements must identify camera, model, application version, and computer load.
Use three trials for each continuous movement.
Use ten repetitions for each discrete hand gesture.

| Requirement | Initial target | Measurement |
| --- | --- | --- |
| Hand gesture accuracy | At least 9 of 10 correct holds per hand and gesture | Person checks open hand, fist, point, and peace sign. Each hold lasts 2 s. |
| Finger coverage | All 30 finger joints receive valid controls in the full test set | Solver goals plus raw-bone and surface checks on Ene and Rei. |
| Seated torso | Correct direction through approximately ±20° visible lean | Hips remain outside the image; projected shoulder roll error stays within 10°. |
| Head/body separation | No torso movement from a head-only tilt beyond 3° | Three stationary-shoulder trials. |
| Arm stability | At most 2° RMS angular variation during each stationary hold | Remove the first 2 s; measure 3 s per hold in a fixed world frame. |
| Arm accuracy | Median projected segment-direction error at most 10° | Camera and model views share a calibrated projection; proportions do not count as angle error. |
| Raised arms | No visible elbow flip or repeated rest return | Both elbows remain visible during three 10 s trials. |
| Hand ownership | No left/right swap in the defined crossing sequence | Labeled anatomical sides with mirror on and off. |
| Inference cadence | At least 15 Hz useful body and hand results | Different task samples over 30 s; report intervals and lost detections. |
| Sample age | p95 at most 150 ms for accepted body and hand data | Original capture time to solver use. |
| Visible delay | p95 at most 200 ms | External video or another clock-verified camera-to-screen measurement. |
| Recovery | Stable return within 500 ms after usable observations resume | Three 1 s occlusions per hand and arm. |
| Invalid input | No nonfinite pose, unbounded rotation, or indefinite hold | Replay malformed, absent, stale, and recovered inputs. |
| Model deformation | No new severe shoulder collapse or finger inversion | Fixed pose sweep and user review. |
| Combined operation | Motion targets remain usable with intended output load | A 15 min session with the selected output configuration. |

RMS means root mean square.
The stationary test measures unwanted variation around the mean held rotation.
The projected angle test measures image-plane agreement; it does not claim 3D ground truth.
If a target is unsuitable, record the measurement and the revised target before final acceptance.
Do not change a target silently after a failed test.

## Evidence to collect next

The supplied material is sufficient to start the measured software repairs.
No full repetition of sprint-001 setup is a prerequisite for those repairs.
The following evidence remains necessary for final acceptance:

1. Record neutral posture with visible shoulders and hidden hips.
2. Record torso lean while keeping the head aligned with the torso.
3. Record head tilt while keeping the shoulders stationary.
4. Record each arm raise with visible shoulder, elbow, and wrist.
5. Record both arms raised with a 3 s stationary hold.
6. Record each hand gesture on both hands.
7. Record crossed hands and a short occlusion.
8. Record the same sequence with Ene and Rei.

Keep the associated video and trace together for these new tests.
Include camera dimensions, light, power state, browser, load, mirror setting, and calibration state.
The assistant prepares capture controls and measurements.
The user supplies movement and an appearance verdict.
The user does not need Blender or model-authoring experience.

## Effort and stop conditions

Estimate 10–20 engineering days for Level A and the first application comparison.
This estimate excludes waiting for physical trials and is not a delivery commitment.
Level B effort depends on the defects that remain.
Level C requires a separate scope after the comparison.

Stop a model replacement experiment if the same failure remains on the canonical rig.
Reject a filter if stability improves only through excessive delay.
Reject a schedule if higher throughput increases sample age or output stalls.
Stop a Tripo experiment if the sample lacks usable fingers or required expressions.
Record rejected experiments so a later sprint does not repeat them without new evidence.

## Sprint-001 transfer

This table supersedes the remaining motion work order from sprint 001.
Original task files keep acceptance history; they must not create duplicate execution queues.
Completed software checks remain valid within their recorded limits.

| Sprint-001 work | New disposition |
| --- | --- |
| TASK-003 and TASK-009 | Keep feasibility and camera code. Measure new cadence and delay in S002-005 and S002-009. |
| TASK-010 | Keep the favorable face observation. Keep full facial and calibration acceptance open under S002-007 and S002-009. |
| TASK-011 | Record failed torso and unstable-arm acceptance. Replace correction work with S002-002 and S002-003. |
| TASK-012 | Record failed finger acceptance. Replace correction work with S002-001 and S002-004. |
| TASK-013 | Supplied seated traces do not show standing acceptance. Carry the extended body requirement into the later comparison. |
| TASK-015 | Carry motion calibration and recovery requirements into the new motion tasks. |
| TASK-047, TASK-048, TASK-055 | Use the supplied images as partial review evidence. Keep unrelated layout, access, and library checks. |
| TASK-056 | Remove the claim that no physical evidence exists. Accept the new diagnosis as partial evidence; keep unperformed checks. |
| TASK-057 | Replace its execution order with S002-005. |
| TASK-058 | Replace its execution order with S002-001 through S002-004. |
| TASK-059 | Replace motion acceptance with S002-009 and its specified sensing limits. |
| TASK-060 and motion part of TASK-061 | Use S002-009 for the new motion handoff. Keep unrelated human checks. |
| TASK-021 | Keep the overall delivery requirement. Consume the new motion evidence when available. |
| Voice, OBS installation, final recordings, and library work | Keep prior status. The supplied motion tests do not answer these requirements. |
| Completed web resources and asset conversion | Keep their delivered results. Reopen only a specific defect with new evidence. |

Sprint-001 motion tasks remain historically incomplete until their carried requirements pass or receive a specified scope decision.
This research does not mark failed motion as delivered.
