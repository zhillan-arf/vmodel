# Sprint 002 human test

Purpose: test the corrected hands, torso, and arm recovery on Ene and Rei.
This procedure requires no Blender work or model edits.

Start with the short defect check.
If a major defect remains, save that evidence before the longer acceptance session.
A trace contains motion measurements.
A paired camera video shows the physical movement that produced those measurements.

## Prepare the session

1. Open the [local studio](https://10.12.1.193:4173).
2. Reload the browser page.
3. Open **Tracking Inspector**.
4. Find **Motion solver 3 · Sprint 002** above the trace controls.
5. Select Ene as the studio model.
6. Set **Movement** to **Seated · face and gestures**.
7. Set **Quality** to **Balanced**.
8. Set **Camera size** to **640 × 480 · lighter**.
9. Enable **Follow hands and fingers**.
10. Set **Response speed** to 14.
11. Set **Hair & accessory motion** to **Gentle**.
12. Start the camera.
13. Keep your shoulders, elbows, and hands inside the image.
14. Wait 10 seconds for the first task calculations.
15. Sit upright with level shoulders.
16. Press **Recenter & calibrate**.
17. Open **Tracking Inspector** again.
18. Select **Camera and model** as the layer.
19. Select **Current model** as the comparison model.
20. Enable **Record camera video**.

Keep the same camera position, lighting, resolution, and response speed for both avatars.
A hand near the lens can hide an elbow or leave the image.
Record these conditions when they occur.
They are useful evidence, not automatically a model defect.

## Save each clip

1. Press **Record trace**.
2. Wait for **Recording trace and camera video**.
3. Perform one clip from the table below.
4. Press **Stop recording** before 60 seconds.
5. Press **Export trace**.
6. Press **Export camera video** when it becomes available.
7. Save both files in `ops/001-zhil/sprint-002/research/trace/retest-001/`.
8. Add the clip label to the result sheet.

Keep the matching JSON and WebM files together.
The files contain matching trace identifiers.
The JSON file also records model hashes, settings, calibration, and solver versions.
Save each pair before the next recording replaces it.

## Short defect check

Allow approximately 5–10 minutes for each model, including file export.
Repeat the four clips with Rei after the Ene clips.
Calibrate again after you select Rei.

| Clip | Movement | What to inspect |
| --- | --- | --- |
| `hands` | Show both open palms, fists, pointing fingers, and peace signs. Hold each pose for 3 seconds. Repeat once. | Correct fingers move on each hand. The ring and little fingers fold for peace signs. |
| `torso` | Keep hips outside the image. Lean left and right three times. Then tilt only your head three times. | The torso follows shoulder roll. A head-only tilt does not move the torso. |
| `arms` | Hold both arms raised for 10 seconds. Lower them for 3 seconds. Repeat three times. | No elbow flip, repeated return to rest, or rapid shaking. Keep both elbows visible. |
| `loss` | Hide each hand for 1 second three times. Then cross your hands slowly. Turn each palm sideways. | Motion recovers after observations return. Hands do not exchange anatomical sides. |

For the `arms` clip, stop before the 60-second limit.
The three holds and two gaps require approximately 36 seconds.
Do not change the response speed during a clip.

For a cuff defect, also save a close-up of **Left hand** or **Right hand** under **Model view**.
Record whether the camera still detects the elbow and wrist.
The current Ene replay shows cuff overlap in one hand pose.
This defect needs a controlled physical check before a model change.

## Full acceptance session

Use the targets in the [sprint proposal](sprint-002-plan.md#acceptance-targets).
The short check does not replace these targets.
Allow additional time for repeat gestures and the 15-minute output session.

| Test | Required evidence |
| --- | --- |
| Each hand gesture | Ten 2-second holds for each hand, each gesture, and each model. At least nine holds must look correct. |
| Stationary arms | Three trials per pose. Allow 2 seconds to settle, then hold for 3 seconds. Codex measures angular RMS from labeled intervals. |
| Raised arms | Three 10-second trials with both elbows visible. Mark any flip or repeated rest return. |
| Torso | Three lean trials near ±20°. Keep hips outside the image. Include stationary shoulders during head-only tilt. |
| Hand ownership | Repeat the crossing sequence with **Mirror my performance** enabled and disabled. |
| Loss recovery | Three 1-second occlusions for each hand and arm. Mark the time that visible movement becomes stable again. |
| Face and expressions | Blink, speak, smile, and turn your head. Try the existing happy and surprised expressions. Check for a regression. |
| Model surface | Inspect shoulders, cuffs, fingers, hair, and clothing in the specified poses. |
| Cadence and delay | Record at least 30 seconds after the first 10 seconds. Open **Timing and distributions**. |
| Output load | Use the intended output configuration for 15 minutes. Record a short trace near the start and end. |

Do not record a single 15-minute trace.
The trace recorder stops at 60 seconds or 32 MiB.
If it stops early, export both files and split the movement across shorter clips.
Record the longer session through the normal output workflow if a continuous video is useful.

Detector Hz counts distinct detector results.
The inspector separately shows how many samples contain detections.
Neither value proves gesture accuracy.
Receipt age excludes the final display delay.
Codex will calculate solver-use age from the trace timestamps.
An external camera-to-screen measurement is required for the full visible-delay target.

## Compare an established application

Run this comparison if the corrected build still misses a required quality target.
Use Warudo with its MediaPipe input as the first reference.
Use XR Animator if an MMD or full-body comparison is more useful.
The [option research](../research/002-industry-options.md) supplies source links and compatibility limits.

1. Use the same computer, camera, lighting, and distance.
2. Select the same avatar where the reference application supports it.
3. Close other camera applications before you start the reference input.
4. Record the four short clips again.
5. Record the application version and input settings.
6. Note any required model conversion or unavailable control.
7. Compare finger poses, torso motion, arm stability, and visible delay.

Do not buy a model service or sensor for this comparison.
A format incompatibility is a comparison limit, not a failed motion test.
Keep VMC integration open until this comparison shows a useful source.

## Return the evidence

Use the [result sheet](human-test-results.md).
Include the JSON and WebM pair for every failed clip.
Include at least one successful pair for each avatar.
Keep the raw traces inside the private trace directory.
The repository excludes that directory from Git.

Codex will inspect the traces and compare the results against the unchanged targets.
The sprint remains open until the required physical checks pass or the user changes the scope.
