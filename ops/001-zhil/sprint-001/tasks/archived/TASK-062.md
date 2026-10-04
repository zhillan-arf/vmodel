# TASK-062: Complete combined tracking before human tests

- Status: Done
- Priority: P0
- Owner: Codex
- Goal: G2, G6
- Parent controller: [TASK-P05](../active/TASK-P05.md)
- Depends on: TASK-051, TASK-052, TASK-054

## Scope

The user requested this work on 2026-10-05.
Audit Ene and Rei against face, body, shoulder, arm, hand, and finger requirements.
Add missing software before human tests.
Keep physical acceptance in TASK-056, TASK-059, and TASK-061.

## Plan

1. Inspect camera data, model bones, and existing controls.
2. Compare the design with MediaPipe and open source examples.
3. Add a combined camera and model view.
4. Add visible model bones and close views.
5. Implement missing shoulder and gaze controls.
6. Test both model files and camera display behavior.
7. Update the guides and task records.

## Acceptance criteria

- [x] One camera image shows face triangles, body lines, and both hands.
- [x] The model and its bones appear with the camera image.
- [x] Ene and Rei pass checks for shoulders, eyes, mouth, and all ten fingers.
- [x] Cached observations, pause, model changes, and small screens pass software checks.
- [x] The test suite and production build pass.
- [x] Research sources, measurements, and physical limits are recorded.

## Scope decision

This task supersedes the restriction that missing shoulder and gaze controls must wait for physical diagnosis.
This task also extends the separate views from TASK-051 and TASK-054.
The user explicitly requested implementation before human tests.
Scheduler, association, and confidence experiments retain their physical evidence requirements.
OpenSeeFace remains deferred.

Evidence: [combined tracking audit](../../reports/combined-tracking-audit.md).

## Completion

Date: 2026-10-05.
All 318 unit tests pass. The production build passes.
All 39 verification checks have passing results after the recorded follow-up runs.
Both actual models pass the finger, shoulder, gaze, and combined-view tests.
The layout test includes Camera and model at 390, 768, and 1440 pixels, with CSS zoom at 1 and 2.
Physical and human acceptance remain in the existing tasks.

Evidence: [verification record](../../reports/combined-tracking-verification.json).
