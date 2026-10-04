# Physical tracking checks

These checks need a person, the actual camera, and the prepared Ene and Rei models.
Synthetic fixtures cannot establish physical tracking quality.
Record human results under [TASK-061](../ops/001-zhil/sprint-001/tasks/backlog/TASK-061.md).

Before a correction experiment, complete the inspector acceptance checks in TASK-055.
Keep the existing scheduler, confidence thresholds, and smoothing until diagnosis identifies the first failed stage.

## Test record

Record the following conditions:

- Browser name and version.
- Camera model and actual image dimensions.
- Camera position and light conditions.
- GPU or CPU delegate and tracking model hashes.
- Model hash, settings, calibration, and mirror state.
- Power source and OBS state.

Keep personal recordings under `ops/001-zhil/sprint-001/reports/local/`. Commit aggregate measurements only.

## Procedure

1. Record 10 seconds without deliberate movement.
2. Turn the head left and right.
3. Raise each arm separately.
4. Bend each elbow.
5. Rotate each wrist.
6. Open and close the fingers.
7. Cross the hands.
8. Hide one hand.
9. Return the hand to view.
10. Repeat with the other mirror setting.
11. Repeat while standing with the full body visible.
12. Repeat with the face and hands close to the camera.

Compare 640 × 480 and 1280 × 720 only when the camera supports both sizes.
When video is available, annotate at least 30 clear frames per view. Separate visible, hidden, and ambiguous joints.
Identify the first failed stage: image observation, estimated depth, solver acceptance, or avatar appearance.

## Correction decision

Use the same traces and three live repetitions for the baseline and each candidate.
Test one correction at a time.

| Failed metric | Required improvement |
| --- | --- |
| Timing | At least 20% more useful pose samples or 20% lower p95 age |
| Rejection or loss | At least 20% less rejected visible-joint time or 20% lower p95 recovery time |
| Jitter | At least 20% less stationary angular variance |
| Lag | At least 20% lower median motion lag without range loss |
| Mapping | Correct side and rotation in every named fixture |

Allow no more than 10% regression in unselected timing, jitter, recovery, or renderer metrics.
Reject any new wrong-side event or invalid bone transform.
For a near-zero baseline, use absolute units and named correctness cases.
Report 15 Hz useful upper-body updates and 150 ms median age as targets, not assumed results.
Record an adopt, reject, or inapplicable verdict only when measurements support it.
