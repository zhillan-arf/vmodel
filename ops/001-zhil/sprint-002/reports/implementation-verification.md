# Sprint 002 implementation verification

Date: 2026-10-05.
Result: ready for another human test.
The local service runs the corrected build.
Physical acceptance remains open.

Start with the [human procedure](../specs/human-test.md).
Use the [task register](../tasks/backlog/README.md) to track the remaining requirements.
The [implementation decisions](../specs/implementation-decisions.md) explain the code changes and limits.

## Delivered behavior

- Hand motion uses task-specific confidence without changes to raw trace fields.
- Seated torso roll works when the full torso estimate lacks visible hips.
- Spine and chest share torso rotation through world-space goals.
- Rejected arm goals have a bounded hold before decay.
- Balanced mode runs all enabled tasks on each submitted frame.
- The inspector retains sample reasons and reports current application states.
- New traces record model hashes and version identifiers.
- New calibration files can contain neutral shoulder roll.

Both model files remain unchanged.
No Ene v2, Tripo purchase, or VMC bridge was necessary for this build.
Cuff appearance and physical tracking quality remain explicit review items.

## Software evidence

The [check manifest](implementation-checks.json) records commands, results, source hashes, and model hashes.
The source tree contains uncommitted work.
The Git commit alone does not identify this build; use the file hashes in the manifest.

| Check | Result |
| --- | --- |
| Unit suite | 334 tests passed across 36 files. |
| Production build | TypeScript and Vite passed. Vite retains the existing large-chunk advisory. |
| Actual avatar gestures | Ene and Rei passed open hand, fist, point, and peace sign tests. |
| Actual avatar torso | Both models passed ±0.35 rad shoulder-roll tests with hidden hips. Error stayed below 0.002 rad. |
| Supplied trace replay | All 30 finger bones receive controls across the supplied trace set on each rig. |
| Direct model controls | All 64 spine, chest, and finger probes moved their raw bones and sampled surfaces. |
| Inspector | Model hash, selected rig reasons, cached reasons, new trace metadata, and cancelled recording passed. |
| Replay | Forward, backward, and repeated replay gave the same current-solver result. |
| Existing model checks | Shoulder, gaze, and finger checks passed on both models. |
| Browser behavior | Overlay coordinates, recording, replay video, camera recovery, and inspector pause passed. |
| Installed inference | The CPU worker detected face, body, and hands across the static photo fixtures. |
| Runtime bundle | File inventory, model hashes, runtime hashes, and notices passed. |
| Deployment | Production camera checks passed. Both service containers are healthy. |

See [model motion results](motion-smoke.json), [inspector results](inspector-smoke.json), and [recorded replay results](implementation-replay.json).
The [integration directory](integration/) preserves the other current results.
Historical sprint-001 reports remain unchanged by this test session.

## Recorded comparison

These are the same observations as the research baseline.
The production solver now accepts the original hand fields directly.
No hand-field removal is required.

| Trace | Finger bones controlled per rig | Maximum local spine angle |
| --- | --- | --- |
| `ene_body.json` | 15 | Approximately 1.36°. |
| `human_body.json` | 30 | Approximately 1.56°. |
| `human_hand.json` | 30 | Approximately 1.74°. |

The canonical rig, Ene, and Rei produce these coverage results.
The baseline produced zero finger goals and zero spine rotation from the original observations.
The small spine angles describe these peace-sign recordings, not a full lean-range test.
Synthetic ±0.35 rad tests provide the separate torso-range check.

Goal coverage does not establish gesture accuracy.
These traces do not contain labeled stationary holds for the arm RMS target.
They also do not contain the paired camera video needed for a complete physical comparison.
A local Ene hand close-up shows folded fingers and remaining cuff overlap.

## Test corrections and remaining limits

Two initial browser runs failed during startup or development reloads.
The test servers now disable file watching for those checks.
The startup wait also permits the status element to appear.
Both checks then passed.

The old solver equality requirement no longer applies to intentional torso and recovery changes.
The replay test still checks deterministic results and isolated arm movement.
It retains the previous solver as a numerical comparison.
New model tests check the intended gesture and torso behavior directly.

The general documentation audit reports 139 links to absent historical local evidence or assets.
These links concern earlier recordings, voice files, and generated web resources.
This result does not indicate a missing runtime file.
The current runtime bundle audit passed.
The new sprint documents receive a separate link and line-ending check.

The complete `npm run verify` command was not run.
This session ran the relevant motion, browser, recording, inference, build, and deployment checks individually.
Windows voice checks and unrelated historical asset checks remain outside this change.

Static photo inference verifies installed runtime operation.
It does not establish target-computer performance or live gesture quality.
The 15 Hz cadence, 150 ms sample-age, 200 ms visible-delay, and physical stability targets remain open.
No result here establishes industry certification or full VRChat sensor parity.

## Deployed build

Open the [local studio](https://10.12.1.193:4173/).
Reload the page before the test.
The Tracking Inspector shows **Motion solver 3 · Sprint 002**.
The [deployment result](deployment.json) confirms the marker, model load, health response, and absence of page errors.
The HTTPS check verified the service certificate against the local certificate authority.

The deployment preserves the existing certificate storage and browser model library.
The user must calibrate again for each model before the physical session.
