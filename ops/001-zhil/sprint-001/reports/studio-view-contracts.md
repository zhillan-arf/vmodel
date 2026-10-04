# TASK-039 implementation evidence

Date: 2026-10-04. Status: Done for software checks.

Installed Chrome and Edge pass the automated checks for this task.
[TASK-061](../tasks/backlog/TASK-061.md) owns the transferred human checks.
The release tasks retain their acceptance requirements.
See [the Windows record](windows-continuation.md).

See the [shared implementation record](studio-implementation.md) for files, commands, results, requirement mapping, and remaining checks.
See the [browser results](studio-features-smoke.json) for synthetic test results.

Software acceptance is complete. The sections below retain earlier implementation evidence.

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

## Actual bundled models and navigation

`node scripts/bundled_navigation_smoke.mjs` passes with Chromium 153.0.8010.12.
The test loads actual Ene and Rei files through the application startup path in separate browser contexts.
It uses simulated camera input and the installed tracking worker.
Keyboard navigation opens Library, Tracking, and Studio for each model.
Each change preserves the model object, camera stream, settings, and output model.
Camera and output frame sequences continue after each change.
No page error or external request occurs.
The [browser report](bundled-navigation-smoke.json) includes model hashes and all six results.

Eighteen screenshots cover both models, all three views, and widths of 390, 768, and 1440 pixels.
Files are under `ops/001-zhil/sprint-001/reports/local/bundled-navigation/`.
These screenshots precede the tablet-column correction below. Human acceptance remains open.

## Tablet column correction

The 768-pixel Tracking screenshot exposed an unused 240-pixel column.
Library had the same grid placement.
A new layout assertion reproduced the defect in Library, Observations, Estimated 3D, and Accepted motion.
Feature panels now use the full grid width below 1200 pixels.
Studio retains its existing controls and stage arrangement.
The accessibility matrix checks the panel position as well as overflow, contrast, and control sizes.

All 24 accessibility cases pass after the correction, with zero page errors.
Type checking and the task audit pass.
The [accessibility report](studio-accessibility-smoke.json) records zero panel offset in all four tablet views at CSS scale one.

## Panel motion

Feature panels now enter with a 150-millisecond opacity transition.
The previous interface had no panel transition.
The browser test first reproduced the missing transition.
It now records the opacity transition event and its 0.15-second duration.
With reduced motion, computed transition duration is zero and no panel animation remains.
All 24 layout and contrast cases still pass with zero page errors.
The [accessibility report](studio-accessibility-smoke.json) includes the transition events and reduced-motion results.

## Comparison with the selected design

The reference is [studio-layout.html](../specs/studio-layout.html).
The following differences describe the current implementation.
They do not replace the required human review.

| Item | Reference | Current implementation and reason |
| --- | --- | --- |
| Navigation | Brand, description, and three tabs occupy the left column. | Three navigation buttons occupy the left column above the existing Studio controls. The controls retain their current functions. |
| Narrow navigation | Tabs move above the content below 1200 pixels. | Navigation moves above the content at the same breakpoint. Feature panels use the full available width. |
| Control border | Borders use `#41516D`. | Controls use `#7285A5` because the reference color failed the required contrast ratio. Panel borders retain `#41516D`. |
| Library status | A short notice appears above the grid. | A fixed-height status region contains progress and errors. This prevents messages from moving the primary controls. |
| Library thumbnails | Placeholder figures appear in fixed-height frames. | Square images show the actual bundled models. Missing images show a text fallback. |
| Entry actions | Each sample card has one disabled action. | Cards have a working selection action and a labeled details menu. Imported entries also support rename, export, and removal. |
| Import details | Sample details use two flexible columns. | The preview has a flexible column and a 320-pixel details column. Narrow layouts stack the preview before the details. |
| Tracking layers | Static labels show the selected layer. | A labeled select control changes the layer. Keyboard access uses the native control. |
| Tracking details | Sample metrics remain beside the scene. | Channel summaries remain visible. Raw values and distributions use expandable details to reduce visible text. |
| Observation graphics | The sample uses fixed SVG geometry. | The canvas draws matched observations. Dark outlines preserve contrast against camera images. |
| Loading motion | The static specimen has no runtime transition. | Feature panels use a 150-millisecond transition. Reduced-motion mode removes the transition. |

The browser tests cover layout, selected control colors, focus, and panel motion.
They do not establish human acceptance of model appearance or diagnostic clarity.
