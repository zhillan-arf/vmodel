# TASK-054 implementation evidence

Date: 2026-10-04. Status: Done.

Canonical and avatar adapters use `MotionSolver`.
The first three inspector layers require no VRM.
The integrated browser fixture runs those layers while bundled models return HTTP 404.
See [Studio feature checks](studio-features-smoke.json) and [overlay checks](tracking-overlay-smoke.json).

## Native avatar replay

`node scripts/avatar_replay_smoke.mjs` runs one 120-sample trace on the canonical rig, rebuilt Ene, and native Rei.
The trace changes the anatomical left arm while the right arm remains fixed.
All three rigs change the left arm by approximately 0.679563 radians.
Right-arm changes remain below 0.000002 radians after settling.
The native left-arm changes match the canonical result within 0.0001 radians.
No anatomical side swap occurs.

Each run checks 52 normalized bones.
Forward replay, backward seek, and repeated replay differ by at most 0.000000030 radians.
The trace remains at `ops/001-zhil/sprint-001/reports/local/avatar-comparison-trace.json`.
The [native replay report](avatar-replay-smoke.json) records its SHA-256 and both model hashes.

## Extraction comparison

The native check loads the former solver from commit `da48542e991aa202a1b9eaafc1a4f1cbb22ef7b9`.
It compares all 120 updates against the current solver on each rig.
The maximum rotation difference is 0.000000052 radians.
Bone-position differences are zero. Accepted goal sets match.
Temporary baseline source files are removed after the check.

The [earlier baseline check](solver-baseline.json) also covers missing bones, opposite orientation, calibration, and changed settings.
The [Ene preparation check](ene-library-smoke.json) and [Rei preparation check](rei-library-smoke.json) verify the current model fixtures.
The full unit suite passed 305 tests across 32 files before the comparison display update.

## Isolated comparison display

The comparison display now shows trace time in milliseconds.
Model hash, settings, and calibration remain visible.
Backward and forward seeks update the displayed calibration from the selected trace event.
The browser checks both calibration states.

`node scripts/replay_video_smoke.mjs` passes after the display update.
Replay and avatar comparison preserve Studio state, the active model, and clean output.
Replay publishes no tracking frames to output.
The [replay browser report](replay-video-smoke.json) records these results.
Type checking passes.

These checks use synthetic observations on actual model rigs.
They do not establish detector accuracy, physical gesture acceptance, or target-laptop performance.

## Return to the comparison view

A navigation check found that Avatar comparison stayed empty after a return from Studio.
The inspector released its model on exit but did not prepare another model on return.
The inspector now prepares the selected comparison model when the Avatar layer becomes visible without a viewer.
The regression test checks canvas removal on exit and model preparation on return.
It also checks replay calibration and unchanged Studio and output state.
The [replay browser report](replay-video-smoke.json) records the passing return check and zero page errors.
Type checking and the task audit also pass.

## Comparison failure and timeout recovery

A failed comparison load previously left the comparison status at `Preparing comparison model`.
The inspector now displays the failure beside the comparison control with an assertive alert.
A new attempt restores the polite status role.
The error handler clears the failed solver and comparison metadata.
Canceled or replaced operations cannot overwrite the current status.

Model retrieval now uses the existing abortable wait.
The comparison deadline can end the wait even when the provider never returns.
The browser fixture injects a ten-millisecond deadline. The production deadline remains 30 seconds.
The fixture checks an absent current model, a stalled provider, and successful preparation after failure.
The checks pass with zero page errors in [the browser report](tracking-overlay-smoke.json).
A late failure from the stalled provider leaves the recovered comparison status unchanged.
Type checking and the task audit pass.

## Live comparison settings

The live comparison viewer previously retained its initial background and framing after Studio settings changed.
Its displayed settings also stayed unchanged.
The new browser test reproduced this defect with a background and framing change.

The inspector now updates the comparison viewer and its displayed settings during live solver use.
A settings key prevents repeated renderer configuration when values do not change.
The existing announcement helper avoids repeated status updates with identical text.
Replay uses the same settings update path.
The live browser check passes and confirms one configuration call across three unchanged apply calls.
Type checking passes.
The replay browser check also passes with zero page errors.
See [live comparison results](tracking-overlay-smoke.json) and [replay results](replay-video-smoke.json).
