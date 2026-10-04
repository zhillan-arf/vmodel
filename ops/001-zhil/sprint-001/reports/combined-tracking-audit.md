# Combined tracking audit

Date: 2026-10-05.
Task: [TASK-062](../tasks/archived/TASK-062.md).

## Terms

A landmark is a point that MediaPipe estimates from an image.
A rig is the set of model bones and expression controls.
Skin weights specify how bones move the model surface.
Retargeting converts landmark directions into rotations for model bones.

## Findings and changes

| Requirement | Before this change | Result |
| --- | --- | --- |
| Live camera with face, body, and hands | Separate observation views existed. | Camera and model shows all groups over the same captured image. |
| Face mesh | Face contours and optional points existed. | The combined view adds MediaPipe face triangles. |
| Body and arms | The solver controlled the spine, arms, wrists, and standing legs. | Existing controls remain available. |
| Shoulders | Both models contained shoulder bones. The solver did not set shoulder goals. | Shoulder points and arm elevation now control bounded shoulder rotations. |
| Hands and ten fingers | Both models contained the bones. The solver already processed all ten fingers. | Tests check all 30 finger joints on each actual model. |
| Head, eyes, and mouth | Head, blink, jaw opening, and smile controls existed. Gaze was absent. | Eye coefficients now control both eye bones. |
| Camera and model together | The inspector selected one layer at a time. | Camera and model shows both views together. |
| Visible model rig | The inspector showed a separate reference skeleton. | Blue lines and gold points show the actual model bones. |
| Close inspection | No hand-specific model view existed. | Body, face, left hand, and right hand views are available. |

Both model files contain 53 mapped humanoid bones.
Each model contains both shoulders, both eyes, both hands, and three joints for each finger.
Neither model supplies `upperChest`; both supply `chest`.
Some bones affect the surface through child bones rather than direct skin weights.
The tests include those connections.

The face mesh does not have a matching set of 478 model bones.
VModel uses the face matrix for head motion and face coefficients for expressions and gaze.
The mouth uses shape changes in the surface rather than a required jaw bone.
VModel currently drives jaw opening and smile; it does not reproduce every MediaPipe facial coefficient.

## Design

The combined view retains only captures with matching face, body, and enabled hand sample identities.
This preserves image alignment when the worker reuses body and hand results.
The worker schedule remains unchanged.
Camera capture requests 30 FPS.
Submission limits are 20 Hz in Balanced and 10 Hz in Low.
Body and hands run on every second Balanced submission or every third Low submission.
Thus, their theoretical limits are 10 Hz and about 3.3 Hz before inference costs.
Model interpolation does not increase the detector sample rate.

The model preview uses the same motion solver as the main model.
It can use a newer face result while the combined image waits for a complete capture.
Pause freezes the inspector while the main model and output continue.
Replay uses recorded application history for model motion.
The combined replay image uses the most recent complete capture at the selected event.

The rig display reads raw VRM bones after the VRM update.
These bones control the actual model surface.
It excludes hair and clothing spring bones.
Blue lines connect mapped joints; gold points mark joints.
The display does not invent fingertip bones.
MediaPipe fingertips control the direction of each distal finger bone.

Shoulder tilt comes from the shoulder line relative to the torso.
If the hips are hidden, the shoulder estimate uses the rest torso as its reference.
Visible shoulders and elbows still require the existing confidence threshold.
Raised arms add 0.3 times the positive arm elevation.
The final shoulder angle stays between -0.25 and 0.45 radians.
This is an estimate of clavicle motion, not a direct measurement of the clavicle.
Symmetric shoulder shrugs can remain ambiguous with one camera.

Gaze uses `eyeLookIn`, `eyeLookOut`, `eyeLookUp`, and `eyeLookDown` for each eye.
Yaw stays within 0.35 radians; pitch stays within 0.25 radians.
Missing coefficients return the eyes toward their rest pose.
The existing freshness, confidence, finger limits, and smoothing rules remain active.
The trace solver version is now `motion-solver-2`.

## Research

[Google's pose guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) describes image points, world points, and synchronous inference.
VModel already uses a worker to keep inference off the main thread.
The design retains that separation.

[Google's hand guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) documents hand landmarks and handedness.
The combined display draws both 21-point hands.
VModel retains its existing wrist association and ambiguous-hand checks.

[Google's face guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js) documents landmarks, expression coefficients, and transformation matrices.
The new display uses the installed SDK triangle connections.
Gaze uses the existing face coefficients.

[KalidoKit](https://github.com/yeemachine/kalidokit) provides a MediaPipe-to-VRM example with separate face, pose, and hand solvers.
Its [arm solver](https://github.com/yeemachine/kalidokit/blob/main/src/PoseSolver/calcArms.ts) and [hand solver](https://github.com/yeemachine/kalidokit/blob/main/src/HandSolver/index.ts) provide useful comparison points.
VModel already has model-relative rotations, parent compensation, confidence checks, and finger limits.
This change adopts the combined inspection approach and adds missing controls through the existing solver.
It does not add KalidoKit as a dependency.

[XR Animator](https://github.com/ButzYung/SystemAnimatorOnline) provides another full-body application for comparison.
Its source license includes noncommercial and share-alike conditions.
No XR Animator code or assets were copied.
No external application establishes that VModel passes a physical camera test.

## Verification

The [model report](combined-tracking-models.json) records file hashes, skin connections, and measured rotations.
The [combined test report](combined-tracking-smoke.json) records model and display checks.
The browser test uses synthetic observations and the actual Ene and Rei files.
It checks 30 finger joints per model, shoulder side, both eyes, mouth opening, and blink.
It also checks matched captures, pause, model changes, rig visibility, and small-screen layout.

Existing baseline comparisons now disable only the new shoulder and gaze methods inside those comparison tests.
They continue to check the old behavior against the pinned baseline commit.
The new tests check the added controls separately.
This scope change does not claim that the entire new solver equals the old solver.

## Measured model results

| Check | Ene | Rei |
| --- | --- | --- |
| Mapped humanoid bones | 53 | 53 |
| Tested fingers | 10 | 10 |
| Finger joints with motion and a skin connection | 30 | 30 |
| Smallest raw finger rotation in the curl tests | 0.4555 rad | 0.5187 rad |
| Raised shoulder rotation | 0.2782 rad | 0.2782 rad |
| Each eye rotation in the gaze test | 0.3500 rad | 0.3500 rad |

These values describe synthetic test inputs, not physical accuracy.
The finger test derives landmarks from each model's rest geometry and known joint rotations.
It rotates each test palm toward the camera before the existing palm confidence check.
It checks both normalized controls and raw bones after the VRM update.
The actual model files retain their original hashes.

## Remaining physical checks

The laptop camera and external webcam use the existing device selector.
No special depth camera is required by this implementation.
Camera quality, lighting, distance, and occlusion still affect detection.
A better webcam cannot guarantee correct hidden fingers or depth.

The automated tests do not establish physical gesture accuracy, acceptable delay, or comfortable appearance.
Use the [tracking guide](../../../../docs/tracking-inspector.md) and [physical protocol](../../../../docs/tracking-check.md) for those checks.
Keep the face, shoulders, elbows, wrists, and fingers inside the camera image.
Use Balanced quality first.
Use 1280×720 when the selected camera supports it and the laptop can sustain it.
Compare both cameras under the same light and distance before choosing one.

TASK-056, TASK-059, TASK-060, and TASK-061 retain their physical or human acceptance requirements.

## Final verification

All 318 unit tests and the final production build pass.
All 39 verification checks have passing results across the full run and follow-up runs.
The [verification record](combined-tracking-verification.json) preserves the original failures and each follow-up result.
The first full run passed 37 checks.
A source edit reloaded one browser test page during that run.
The other failure came from a test selector that included a hidden control.
The corrected layout test waits for the selected view and examines visible controls through stable element references.
Both affected tests pass after correction.
The final model test also checks that portrait hand views contain every selected hand joint.

TASK-062 is complete for software work before human tests.
No physical camera, gesture, or appearance acceptance was inferred from these results.
