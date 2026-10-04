# TASK-055 implementation evidence

Date: 2026-10-04. Status: In progress.

Windows software checks and the measured default-mode limits pass. Required tracking states have test images.
Human review remains open in TASK-061.

See the [shared implementation record](studio-implementation.md) for files, commands, results, requirement mapping, and remaining checks.
See the [browser results](studio-features-smoke.json) for synthetic test results.

This record does not close the task acceptance criteria.

## Numeric summary update limit

T12 limits numeric summaries to four updates per second.
The channel rows initially updated at the display rate.
A browser test measured 24 text changes in 1.1 seconds.
The rows now use the existing 250-millisecond summary interval.
The same test measures four changes in 1.1 seconds after the correction.
The [overlay report](tracking-overlay-smoke.json) records the result. Type checking passes.
This check establishes the update limit only. Target-device overhead and memory acceptance remain open.

## Tracking state images

The browser test captures nine states at widths of 390, 768, and 1440 pixels:

- Camera stopped.
- Valid observations.
- Low confidence.
- Stale observations.
- Disabled hands.
- Inspector paused.
- Trace duration limit.
- Replay.
- Camera permission failure.

The [tracking state report](tracking-states-smoke.json) records 27 image paths, hashes, viewport sizes, and overflow results.
All images have no horizontal page overflow. The browser reports no page errors.
Images remain under `ops/001-zhil/sprint-001/reports/local/visual-states/tracking/`.
The observations use test data and an empty camera stream.
The duration test inserts an event at 60001 milliseconds.
The permission test supplies `NotAllowedError` through the application camera control.
These tests do not establish physical tracking quality or human visual acceptance.

Image examination found orbit controls in the Observations layer.
Those controls now appear only in Estimated 3D and Accepted motion.
The state test checks that other layers hide those controls.
The overlay test still passes its keyboard orbit, zoom, and reset checks.

## Final software checks for this change

Type checking, the production build, the task audit, and the acceptance audit pass.
The build retains its warning for the main JavaScript chunk above 500 kB.
The bundle audit passes after the build.
The whitespace check passes with supplied resources excluded.
These results do not replace the open acceptance checks above.

## Observation graphics contrast

Stale observations previously used 35% opacity.
Camera pixels could reduce line contrast below the required ratio.
Observation lines and points now have opaque dark outlines.
Stale observations use a muted color with full opacity.
Rejected lines retain their dashed pattern.

The overlay test measures canvas pixels for 16 combinations of background, age, and rejection state.
Backgrounds include black, white, accepted green, and warning yellow.
The test checks lines, selected points, normal points, and gaps in rejected lines.
Each foreground exceeds 3:1 contrast against its outline.
The [overlay report](tracking-overlay-smoke.json) records each measured ratio.
These measurements cover observation graphics only.
They do not establish contrast for every 3D graphic or human readability of dense face points.

The repeated overlay test and all 27 tracking-state captures pass after the graphics change.
Assistant examination of the 390-pixel stale image found visible muted lines and readable status text.
Human visual acceptance remains open.
The production build, bundle audit, task audit, and acceptance audit pass after this change.

## Controls for the selected layer

The inspector now hides controls that do not apply to the current layer and task.
Hand selection appears for hand observations and hand estimates.
Dense face points appear for face observations.
Calculated wrist alignment appears for hand estimates.
Model comparison appears only in the Avatar layer.
The overlay test checks all 12 layer and task combinations.

All 12 control combinations pass after this change.
The repeated 27 image captures and 24 accessibility cases also pass.
Type checking and both task audits pass.
Native browser zoom and human review remain open.

## Windows software evidence

All 310 unit tests pass on the laptop.
Installed Chrome and Edge pass the inspector, trace, transform, camera recovery, recording, and replay checks.
The solver comparison preserves 720 baseline updates.
Canonical, Ene, and Rei replay checks pass for 52 bones.
The additional combined test passes in both browsers with a simulated camera.
See [the Windows record](windows-continuation.md) for commands, versions, fixture limits, and linked results.
[TASK-061](../tasks/backlog/TASK-061.md) owns human readability, native zoom, screen-reader, and physical tests.

## Windows performance evidence

The [Windows report](windows-continuation.md) records the fixed fixture, model hashes, power checks, render dimensions, and sample protocol.
The default overlay retains 100.03% of renderer FPS and 104.5% of useful pose rate.
Its median p95 capture-to-use age is 17.1 milliseconds below the inspector-off value.
These values meet the default-mode T12 limits.

The first sequential reference comparison fails the 5% task-rate limit.
The unchanged reference later produces lower rates, which shows variation over time.
The [comparison with changed mode order](windows-tracking-chrome-alternating.json) retains at least 96.8% of each task rate and 99.97% of renderer FPS.
It has three 60-second samples per mode and meets the inspector-off T12 limits.
Both results remain recorded.
These fixture measurements do not establish physical motion quality or the later 15 Hz correction target.

The [measurement summary](windows-tracking-summary.json) checks three samples per mode, equal render dimensions, power, and camera and frame counts.
Dense-face samples contain 478 points.
The optional video repeat exports three nonempty WebM files.
Recording costs include the automatic stop within each measurement interval.
The [Windows report](windows-continuation.md) records active durations and memory ranges.
The resource tests and measured intervals show no unbounded growth.
