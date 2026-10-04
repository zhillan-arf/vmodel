# TASK-049 implementation evidence

Date: 2026-10-04. Status: Done for the defined software scope.

Optional diagnostic envelopes, task identities, session clocks, and metrics are implemented. Unit checks pass. Physical-camera and target-laptop acceptance remain with TASK-055 and TASK-056.

See the [shared implementation record](studio-implementation.md) for files, commands, results, requirement mapping, and remaining checks.
See the [browser results](studio-features-smoke.json) for synthetic test results.

The software checks close TASK-049. They do not close P05 release acceptance.

Worker parity tests now compare nine captures for each of the balanced and low quality settings.
The tests use positive face, pose, and hand observations. They disable and re-enable hands during each run.
Task order and frame contents match with diagnostics enabled and disabled. Timing measurements are excluded from equality checks.
Absent confidence fields remain absent in diagnostic observations.
Command: `npx vitest run tests/tracking-worker.test.ts --reporter=dot`; nine tests passed.
Restart tests now verify new session IDs and rejection of old responses. Physical-camera acceptance remains open.

Camera restart tests found a retained-image ownership race.
A late image copy could replace the new session's image before its generation check.
`src/camera.ts` now retains the copy locally until the generation check passes.
Failure cleanup also checks the generation before it changes shared image state.
The regression tests cover late completion and late failure.
Old worker responses and incorrect session IDs cannot release a new pending frame.

Final unit suite: 282 tests passed across 29 files. Production typecheck and build passed.

## Rolling metrics

The metric window now expires samples after 10 seconds without a new camera result.
Duplicate and older sample identities cannot increase the inference count after expiration.
The first 10 seconds of session samples form the warm-up group. Later samples form a separate group.
Both groups show counts, durations, rates, and nearest-rank receipt-age percentiles.
A group with fewer than two samples has no rate.
Rejected channel uses and distinct rejected channel samples have separate counts.
The counts exclude outcomes without a positive sample ID.
The inspector does not display live rates as replay evidence.

Tests cover window expiration, old captures, repeated identities, the warm-up boundary, repeated rejected uses, and session reset.
Command: `npx vitest run tests/tracking-diagnostics.test.ts --reporter=dot`; all 11 tests passed.

The synthetic browser suite passed. The pinned tracking files are installed. The installed-worker checks below pass.

## Installed worker checks

Command: `node scripts/tracking_positive_fixture_smoke.mjs --functional`.
The check used Linux Chromium and the installed CPU delegate. It ran 44 frames across four photo variants.
Face, body, and hand detections passed, including simultaneous detections.
Of those frames, 24 requested diagnostics. The worker returned up to 478 face points.
Diagnostic sample times matched runtime sample times. Disabled diagnostics produced no envelope.
Session and capture identities matched each request. Worker end times did not precede start times.
No external requests or page errors occurred.

The two existing photo fixtures retain these SHA-256 values:

- Portrait: `7a7536821783691d1c7b58f5ee7cb601abbeaaa2f4703e755a15c5dbb4271b78`.
- Full body: `194f6ba51f7bdeb090c9a47e7ab69d3fa191fbb6240cd4b6f118a215bc27caf0`.

The [functional worker report](tracking-positive-functional.json) records the source references, worker hash, and results.
The historical performance report remains unchanged. These measurements do not establish target-laptop performance.

## Camera lifecycle

Command: `node scripts/diagnostic_camera_smoke.mjs`.
The check used Chromium fake video with the real CameraTracker and installed worker.
The camera continued to return results through the 70-second interval.
It returned 142 frames across two sessions. The test received and closed 138 retained images.
Stop released every media track and cleared the video source.
Restart created a different session ID and returned new results.
With diagnostics disabled, runtime frames continued without diagnostic callbacks or retained images.
Every diagnostic sample time matched its runtime sample. Receipt times did not precede capture times.
No external requests or page errors occurred.
See the [camera result](diagnostic-camera-smoke.json).

These function checks use Linux Chromium. Physical camera gestures, target-laptop overhead, and human review remain unverified.
The verification entry point includes both new checks. No scheduler or solver threshold changed.
