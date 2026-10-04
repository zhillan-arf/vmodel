# TASK-051 implementation evidence

Date: 2026-10-04. Status: Done for software checks.

Installed Chrome and Edge pass the automated checks for this task.
[TASK-061](../tasks/backlog/TASK-061.md) owns the transferred human checks.
The release tasks retain their acceptance requirements.
See [the Windows record](windows-continuation.md).

See the [shared implementation record](studio-implementation.md) for files, commands, results, requirement mapping, and remaining checks.
See the [browser results](studio-features-smoke.json) for synthetic test results.

Software acceptance is complete. The sections below retain earlier implementation evidence.

## Browser coordinates and labels

`node scripts/tracking_overlay_smoke.mjs` passes in Chromium 153.0.8010.12.
The test measures actual canvas draw calls and image pixels.
It checks 390 × 844, 768 × 1024, and 1440 × 900 browser windows.
Each window uses 640 × 480, 1280 × 720, and 480 × 800 input images.
Each input runs with and without display mirroring.

All 18 cases have zero measured corner error in CSS pixels.
The image colors confirm that mirroring occurs once.
Keyboard input selects Right elbow 14. Both mirror states retain that anatomical label.
Missing images show the specified plain-background label.
The [browser report](tracking-overlay-smoke.json) records these measurements and zero page errors.

The canvas now refers to a text status for image availability.
Joint selection has a polite live region.
Unchanged joint selections and inspector status cause no repeated announcement mutations during the 600 ms observation period.
Type checking passes.
These checks do not establish physical-camera alignment or screen-reader behavior.

## Live camera and output during pause

`node scripts/inspector_live_smoke.mjs` passes with Chromium 153.0.8010.12.
The test uses the installed tracking worker, Chromium camera input, and a separate output window.
Synthetic model bytes replace the bundled models.

Pause preserves the inspector canvas while camera and output frame sequences continue.
Task controls stay disabled during pause. Resume enables them and updates the canvas.
A return to Studio closes all retained inspector images while camera and output frames continue.
The camera stops when the user selects Stop.

The test creates 11 retained images and closes all 11.
The maximum live count is three. The bound is five, including one pending camera copy and four inspector images.
No page error or external request occurs.
The [live browser report](inspector-live-smoke.json) records the result.
This check does not establish physical gesture accuracy or target-laptop acceptance.

## Text contrast and scaled layout

`node scripts/studio_accessibility_smoke.mjs` passes 24 cases in Chromium 153.0.8010.12.
The matrix covers Library, Observations, Estimated 3D, and Accepted motion at three window widths and two CSS scales.
Window widths are 390, 768, and 1440 pixels. CSS scales are one and two.
Navigation initially overflowed the narrow window at scale two.
Navigation now wraps, and output status text stays within the available width.

No horizontal overflow remains in the matrix.
All measured text color pairs pass. The minimum ratio is 7.51:1.
Visible primary controls meet the 44-pixel minimum target size.
Keyboard navigation works and has a visible focus outline.
The [browser report](studio-accessibility-smoke.json) records the measurements.

The test measures solid text backgrounds. It excludes disabled controls and canvas graphics.
CSS scaling does not establish native browser zoom or screen-reader acceptance.

## Control boundary contrast

The browser check found control borders at 2.22:1 against the panel background.
This failed the required 3:1 ratio.
Controls now use `--control-border: #7285A5`. Panel dividers retain `--border: #41516D`.
The U01 token table records this design change.

All 24 browser cases pass after the correction.
The minimum measured control-border ratio is 4.75:1.
Text contrast, primary target sizes, keyboard focus, and CSS scale checks still pass.
The [accessibility browser report](studio-accessibility-smoke.json) records both text and control color pairs.
Canvas graphics, native browser zoom, and screen-reader behavior remain outside this check.

## Solver summary rows

The inspector now shows separate Face, Body, Left hand, and Right hand rows.
Each row counts accepted and rejected solver decisions and lists their reasons.
These counts are not distinct sample counts. One sample can produce several decisions.
Unassigned hand results appear separately. They do not imply an anatomical side.
Before solver use, each row shows `No solver result.`

Joint values, timing distributions, and full solver values now have expandable details.
The browser check verifies the four labels, a visible rejection reason, and access to solver details.
Four unit checks cover empty results, anatomical sides, ambiguous candidates, and mixed face decisions.
All four pass. Type checking passes.
The earlier full suite passed 306 tests across 32 files before these four tests were added.

All 24 accessibility cases pass with tracking details expanded.
The [overlay report](tracking-overlay-smoke.json) and [accessibility report](studio-accessibility-smoke.json) record zero page errors.
No solver threshold or motion behavior changed.
Human review of diagnostic clarity remains open.
