# Paths to better motion

Date checked: 2026-10-05.
Terms: [Sprint glossary](../README.md#terms).

Use the current avatars for the first repair cycle.
Compare the repaired application with an established application before replacing the tracking system.
Reserve asset work for defects that remain under correct direct bone control.

## What parity means

There is no single motion standard called industry grade.
A useful comparison must specify the model, sensors, application, movements, and output conditions.

| Area | Practical target |
| --- | --- |
| Visible camera motion | Stable arms, clear gestures, seated torso motion, and bounded delay. |
| Model quality | Correct joint deformation, clear facial expressions, and controlled hair and clothing motion. |
| Performance behavior | Natural return after lost detection, stable feet where measurable, and useful idle motion. |
| VRChat-style full body | Calibrated body proportions, positional targets, IK, and suitable body sensors. |
| Facial detail | Compatible expression shapes and a tracker that supplies useful controls. |

VRChat provides calibration and IK options for different tracker configurations.
Its settings specifiedly control how the head, hips, and chest constrain the spine.
These are system capabilities, not properties obtained by loading a VRChat model. [VRChat IK documentation](https://docs.vrchat.com/docs/ik-20-features-and-options).

A single camera cannot directly observe a finger behind the hand or a hip outside the image.
Software can estimate those states, but it must identify the estimate and its confidence.
The project can pursue strong visible upper-body motion without claiming complete sensor parity.

## Recommended order

1. Repair the confidence defect shown by tests.
2. Add a usable seated torso estimate.
3. Improve arm loss and recovery behavior.
4. Increase useful pose and hand sample rates.
5. Compare the same gestures in an established application.
6. Add external tracking only where measured limits remain.
7. Improve model details after motion passes.

This order addresses observed faults with the smallest number of changed components.
The [sprint plan](../specs/sprint-002-plan.md) gives separate acceptance tests for each step.

## Software options

| Option | Useful role | Work and limits | Decision |
| --- | --- | --- | --- |
| Repair VModel | Keep local operation, diagnostics, and both avatars. | Requires task-specific confidence, torso estimation, better temporal control, and measured scheduling. | First implementation path. |
| Warudo | Reference for desktop VTuber motion. | Different runtime and calibration. Test each model format before comparison. | Primary desktop comparison. |
| XR Animator | Compare full-body webcam motion with VRM or MMD. | Different runtime; source reuse needs a license review. | Primary camera and MMD comparison. |
| VSeeFace | Compare face motion and an established VRM0 output path. | Webcam fingers are not its built-in hand path. | Secondary reference, especially for Rei. |
| KalidoKit | Compare landmark-to-angle calculations. | The original project states that it is deprecated. | Study selected algorithms; avoid an automatic replacement. |
| VRChat | Compare calibrated full-body behavior with appropriate sensors. | Requires its own avatar setup and runtime. | Later comparison, separate from browser delivery. |

Warudo uses MediaPipe for webcam face and hand tracking.
It exposes hand calibration, arm swivel, movement range, and shoulder controls.
Its manual describes typical tracking rates of 15–30 FPS, with lower rates under game load.
Those figures are vendor guidance, not measurements on this laptop. [Warudo MediaPipe guide](https://docs.warudo.app/docs/mocap/mediapipe).

XR Animator accepts VRM and MMD models and camera or video input.
It can export captured motion and send VMC messages from its desktop application.
Use it to compare the supplied assets before downloading unrelated dance videos.
Its source has CC BY-NC-SA conditions; application comparison does not require copying its code. [XR Animator repository](https://github.com/ButzYung/SystemAnimatorOnline).

VSeeFace supports VRM0 and requires a Leap Motion device for its optional hand tracking.
It can receive and combine VMC data.
Ene is currently VRM1, while Rei is VRM0.
Thus, unchanged Ene cannot serve as a direct VSeeFace comparison. [VSeeFace documentation](https://www.vseeface.icu/).

KalidoKit documents face, pose, and hand solvers, but its original README marks the project as deprecated.
Its examples can inform a controlled comparison.
They do not justify an automatic coordinate or handedness substitution. [KalidoKit README](https://github.com/yeemachine/kalidokit/blob/main/README.md).

## Proposed software design

Use a separate adapter for each detector output.
Keep image points, world points, confidence meanings, and sample identities specified.
Google places pose world coordinates at the hips and hand world coordinates at the hand center.
Do not subtract coordinates from those different origins to calculate arm lengths. [Pose guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [hand guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

Use one persistent state per motion channel.
Each state should distinguish a new measurement, a short hold, decay, and recovery.
Expire held goals by their original sample time.
Repeated cached frames must not extend their validity.

Separate hand rotation from finger curl.
Estimate curl and spread in the palm frame.
Apply model-relative joint axes and specified anatomical limits.
Test both thumbs independently; they need different motion rules from the other fingers.

For arms, compare direction-based rotations with a two-bone IK experiment.
IK can keep model bone lengths fixed while matching a wrist target.
The target still needs calibrated scale and depth.
Maintain a stable elbow direction when observations become ambiguous.
Test shoulder contribution and wrist continuity under torso movement.

For seated torso motion, start with observable shoulder roll.
Add pitch and yaw only when the available evidence supports them.
Distribute the accepted torso rotation across spine and chest.
Avoid applying the same world rotation twice through a parent bone.

For temporal filtering, compare the existing exponential filter with an adaptive filter.
The 1€ filter changes its cutoff with motion speed to balance jitter and delay.
Use the authors' method as a candidate, then measure it on the project's gestures. [1€ Filter](https://gery.casiez.net/1euro/).

For scheduling, measure task cost before adding workers.
Separate workers may increase memory use and GPU contention.
Test more frequent body and hand inference with a bounded queue.
Use the newest image instead of processing an accumulated queue.
Make the model display operate independently from inference.

## Paths that require no manual model creation

| Path | User work | Assistant or supplier work | Best use |
| --- | --- | --- | --- |
| Keep Ene and Rei | Perform short gesture reviews. | Repair software and test the existing files. | Current defects. |
| Scripted model repair | Review images and movement. | Examine weights, make a copy, repair a measured defect, and validate export. | A local deformation fault. |
| Ready-made VRM | Select an appearance and review terms. | Examine the rig, expressions, and motion before registration. | A new appearance with low setup effort. |
| VRoid presets | Select appearance choices. | Prepare export and test the result. | A new anime avatar without mesh modeling. |
| Specialist commission | Approve a brief and review samples. | A specialist creates or repairs model details. | High facial detail or difficult deformation. |
| Tripo | Select an experiment and review its output. | Generate or rig a test model, then examine and convert it. | New model experiments. |

VRoid provides presets, adjustable character parts, and VRM export.
It can reduce mesh creation work, but it does not automatically reproduce Ene's appearance.
Third-party clothing and models keep their own terms. [VRoid Studio](https://vroid.com/en/studio).

A commission brief should require separate finger bones, tested shoulder poses, facial controls, source files, and a compatible VRM export.
Require a short motion test before final acceptance.
A file with many bones or shapes can still move poorly.

## Optional sensor progression

First compare software under the same camera, light, distance, and computer load.
Do not use a better sensor to conceal the hand confidence defect shown by tests.

| Requirement after repair | Candidate | Main limit to test |
| --- | --- | --- |
| More stable nearby hands | Leap Motion Controller 2 with a suitable mount | Camera coverage, occlusion, driver support, and source handoff. |
| More detailed face motion | A compatible face-tracking phone | Expression support and total delay. |
| Body motion outside the camera | Body trackers or an inertial system | Calibration, drift, body proportions, and foot contact. |
| High-quality full performance | A multi-sensor system | Cost, setup effort, and synchronization. |

Warudo documents phone face tracking, Leap Motion hands, body trackers, and motion-capture suits as separate inputs.
This supports a mixed-input architecture instead of one universal detector. [Warudo tracking overview](https://docs.warudo.app/docs/mocap/overview).

No hardware price or purchase is part of this proposal.
Choose hardware only after a measured requirement remains unmet.

## External motion route

An external tracker can send VMC bone and expression messages to a local receiver.
The receiver must convert coordinate conventions, keep timing, and define control ownership for each body region.
The VMC specification defines different performer and avatar roles. [VMC specification](https://protocol.vmc.info/english.html).

For the current browser application, a proposed local service would receive UDP messages and send validated data through WebSocket.
This service does not exist in the repository today.
Test loss, stale packets, model changes, and restoration before using it for live output.

VRChat also accepts OSC tracker targets for its calibrated IK system.
Those targets are a different interface from VMC bone rotations.
Do not treat the two interfaces as interchangeable. [VRChat OSC Trackers](https://docs.vrchat.com/docs/osc-trackers).

## Comparison method

Record the same short gesture set in each candidate application.
Use the same avatar when its format permits that comparison.
Record version, settings, sample rate, camera, and computer load.
Compare visible motion, delay, loss recovery, and effort required from the user.
Treat vendor demonstrations as capability examples, not measured parity.

The research phase did not run Warudo, XR Animator, VSeeFace, or VRChat on the user's camera.
Their ranking is a proposal based on documented capabilities and the observed defects.
