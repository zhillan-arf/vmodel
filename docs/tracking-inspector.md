# Tracking Inspector

A sample is one result from face, body, or hand inference. Cached results retain the original sample identity and time.
A trace stores observations and application events for replay. A canonical skeleton is a fixed reference rig that needs no VRM.


## Show camera points and model bones

1. Open Tracking.
2. Select Camera and model from Layer.
3. Select Ene or Rei from Comparison model.
4. Select Start camera.
5. Keep your face, shoulders, elbows, wrists, and hands inside the image.
6. Move one arm slowly.
7. Select Left hand or Right hand from Model view.
8. Bend each finger separately.
9. Select Face to check gaze, blink, and mouth motion.

The camera image shows face triangles, body lines, and both detected hands.
All displayed points belong to the same captured image.
The counts below the image show missing groups.
The model appears beside the image on wide screens and below it on small screens.

A rig is the set of model bones and expression controls.
Show model bones displays the actual rig over the model surface.
Blue lines connect bones. Gold points mark joints.
Skin weights connect these bones to the model surface.
The face uses head and eye bones plus expression shapes.
It does not contain a model bone for every face point.

The Body view shows the model at the current framing setting.
Face and hand views follow the selected part at a closer distance.
Model data contains the model hash and comparison settings.
Pause inspector freezes this comparison. The main model and clean output continue.

Use Balanced quality first.
The detector updates body and hands less frequently than the camera captures images.
The combined image waits for a complete capture; the model can use a newer face result.
The inspector does not establish that a physical movement passed acceptance.

Use the Studio camera selector to choose the laptop camera or an external webcam.
Select Stop camera before a device change.
Select the device, then select Start camera.
Use 1280?720 if the camera supports it and motion remains responsive.

See the [combined tracking audit](../ops/001-zhil/sprint-001/reports/combined-tracking-audit.md) for model coverage, research, and test limits.

## Inspect movement

1. Open Tracking.
2. Select Start camera.
3. Select Observations.
4. Select Body, Face, or Hands.
5. Move one elbow slowly.
6. Select its joint index or image point.
7. Read the raw values and solver reasons.
8. Compare Estimated 3D with Accepted motion.
9. Select Avatar to examine the current model in a separate preview.

Observations use the image that matches the selected task sample. A missing image produces a plain background.
Display mirroring affects the image and points together. Anatomical left and right remain unchanged.
Estimated 3D shows the SDK depth estimate. It is not a measured body model.
Pose and hand depth use separate views. The display maps `(x, y, z)` to `(x, -y, -z)`.
Accepted motion uses the same solver as the active avatar. The canonical rig has fixed reference proportions in meters.

Pause inspector freezes its display. Live tracking and clean output continue.
The first three layers remain available when avatar loading fails.
The inspector limits display updates to 30 FPS and numeric summaries to 4 Hz.

## Read timing values

Each task has a rolling 10-second measurement window.
Warm-up contains samples from the first 10 seconds of the camera session.
The display separates warm-up samples from later samples.
Rates require at least two distinct samples. Old values expire when samples stop.
Receipt age measures the time from capture to receipt on the main thread.
The p50 and p95 values use nearest-rank percentiles.
A repeated rejected channel sample adds a rejected use but does not add a distinct rejected sample.
Outcomes without a positive sample ID do not enter these counts.
Live metrics are unavailable during replay.

## Record a trace

1. Start the camera.
2. If video is necessary, select Record camera video.
3. Select Record trace.
4. Perform the movement.
5. Select Stop recording.
6. If you recorded video, wait for the camera video ready message.
7. Select Export trace.
8. If video was recorded, select Export camera video.

Video is optional and excludes audio. Traces contain personal movement even when they contain no image.
Exports occur only after an explicit action. No model or diagnostic upload occurs.
Leaving Tracking stops recording and retains the trace for export.
Unsaved traces disappear when the application closes.

The recorder stops at 60 seconds, 1,800 captures, 7,200 apply events, or 32 MiB.
A separate memory guard stops at 10,000 total events.
It retains the valid prefix. Camera video stops at 60 seconds or 64 MiB.
Unsupported video recording leaves trace recording available.

## Replay

1. Select Import trace.
2. Select a trace exported by VModel.
3. Select Replay.
4. Use Step forward, Step back, or the event control.
5. If you saved camera video, select Import camera video.
6. Select the camera video exported with this trace.
7. Select Return to live when the comparison is complete.

New traces include a video hash. A different video fails the hash check.
The image follows the selected task sample time, including cached samples.
Samples outside the recorded video use a plain background.
Closing Tracking or selecting Return to live releases the loaded video. Import the video again if necessary.
Older traces without a recording start time retain landmark-only replay.

Each seek resets the solver and replays its history. Recorded times control freshness and smoothing.
Replay uses a separate solver. It does not change the active model, live settings, or output messages.
A different solver version produces a Comparison label. The application does not claim equal results across versions.

## Read a failure

| Reason | Meaning |
| --- | --- |
| `not_detected` | The task returned no subject. |
| `missing_landmark` | A required point is absent. |
| `low_visibility`, `low_presence` | Confidence failed the existing threshold. |
| `stale`, `future_sample` | The sample failed the existing age limit. |
| `missing_bone` | The rig lacks a required control for that channel. |
| `degenerate_segment`, `fully_folded`, `plane_jump` | The limb failed a geometry or continuity check. |
| `ambiguous_hand`, `hand_distance`, `hand_score` | Hand association failed a named check. |
| `palm_edge_on` | The palm plane failed the facing limit. |
| `clamped` | The solver accepted motion but limited its range. |

Missing confidence remains unavailable in raw data. The unchanged runtime applies a default of 1.
The accepted age range is at least -50 ms and less than 500 ms.
The scheduler and filter settings remain unchanged. TASK-062 adds shoulder and gaze controls before physical acceptance.

See [physical checks](tracking-check.md) and [implementation evidence](../ops/001-zhil/sprint-001/reports/studio-implementation.md).

In Estimated 3D, select Hands to show a separate hand estimate.
Select Calculated wrist alignment to place the matched hand at the pose wrist.
This display calculation does not change tracking or the original world coordinates.
If association fails, the aligned hand disappears and a status message explains the result.

The Face, Body, Left hand, and Right hand rows summarize solver decisions.
A sample can produce both accepted and rejected decisions.
Unassigned hand results do not identify an anatomical side.
Open `Joint values`, `Timing and distributions`, or `Solver values and reasons` for the full data.
