# TASK-045 implementation evidence

Date: 2026-10-04. Status: In progress.

Entry cards, rename, export, and protected removal are implemented. Responsive checks pass. Actual thumbnails and the full accessibility matrix remain open.

See the [shared implementation record](studio-implementation.md) for files, commands, results, requirement mapping, and remaining checks.
See the [browser results](studio-features-smoke.json) for synthetic test results.

This record does not close the task acceptance criteria.

## Entry management across tabs

`node scripts/library_management_smoke.mjs` passes in Chromium 153.0.8010.12.
The test uses two Studio tabs and synthetic model bytes.
The active local entry has a disabled Remove control.
Both bundled entries have no Remove control. Repository removal rejects both bundled identifiers.

A remote rename initially cleared backup selections and closed entry details.
The library now prepares replacement cards before it replaces the visible grid.
Refresh preserves checked entries, open details, and keyboard focus by entry identifier.
Unused preview URLs are released if a newer refresh supersedes the pending refresh.

Remote rename preserves the current performance state.
Remote removal preserves the decoded model and reports that the entry is no longer saved.
When the focused entry disappears, focus returns to Import VRM.
The [browser report](library-management-smoke.json) records these checks with zero page errors.
Type checking passes. Full viewport, zoom, contrast, and keyboard acceptance remains open.

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

## Actual bundled thumbnails

The build now generates 320 by 320 PNG thumbnails from the actual Ene and Rei models.
Bundled and imported thumbnails share `captureModelThumbnail`.
The capture uses posed bounds, a neutral background, and centered square framing.
It restores the preview camera after capture.
Bundled cards load local images by model hash. Missing images show a square text fallback.

`node scripts/provision_thumbnails.mjs` checks model, renderer, and cached image hashes.
A valid cache avoids another browser render. Chrome and Edge are alternatives to the installed Playwright Chromium.
The build can omit unavailable models. It does not create an image for missing model bytes.

`node scripts/library_thumbnail_smoke.mjs` passes with actual model files.
Both images contain visible model pixels and at least ten pixels of vertical margin.
Cards retain square images without page overflow at widths of 390, 768, and 1440 pixels.
Missing-image fallback checks pass. No page error occurs.
The [thumbnail report](library-thumbnail-smoke.json) records hashes, image bounds, and layout results.

The import metadata browser check and production build also pass.
All 24 accessibility cases passed after the card and fallback changes.
The final framing adjustment changes image pixels only.
Human visual acceptance remains open.

## Served thumbnail audit

The bundle audit now permits only the generated thumbnail filename pattern and its manifest in the thumbnail directory.
For Ene and Rei, it compares the model hash with the served VRM bytes.
It checks each image hash, PNG signature, and 320 by 320 dimensions.
The updated audit passes alongside the existing model, runtime, and notice checks.
The [bundle report](bundle-audit.json) records the result.

## Blocking errors and restore focus

Library selection, rename, removal, export, backup, and list failures now use the existing assertive error state.
An invalid-name browser test first reproduced the incorrect polite status role.
The corrected test passes with `role="alert"` and `aria-live="assertive"`.
The two-tab checks still preserve the active performance model.

Restore cancellation now reports `Restore canceled.` and returns focus to `Restore backup`.
Successful restore also returns focus before the entry list refresh.
The browser imports a real VMLIB archive for both focus checks.
Both checks pass. Successful restore uses the normal status role.

The [management report](library-management-smoke.json) and [import report](import-metadata-smoke.json) record zero page errors.
Type checking passes. Native screen-reader acceptance remains open.

## Temporary and removed active models

The library now identifies an active temporary model and states that the model is not saved.
It uses text content for the model name. This status creates no library entry or persistent selection.
A separate status remains visible when another tab removes the active saved entry.
The decoded model remains active for the current session.

The [studio browser check](studio-features-smoke.json) verifies the temporary status and unchanged saved startup selection.
The [management check](library-management-smoke.json) verifies the persistent missing-entry status after remote removal.
Both checks pass with zero page errors. Type checking passes.

## Stable status area and visible layout checks

The standalone thumbnail fixture previously left the library panel hidden.
Its image-byte checks were valid, but its zero-sized layout rectangles did not establish layout acceptance.
The fixture now displays the panel and requires positive image dimensions.
The new results replace the earlier thumbnail layout measurements.

A visible status-change test found a 77-pixel movement of the import controls.
Current-model status now shares a reserved, scrollable status area below the toolbar.
Import and model-use controls remain in place when the status appears or disappears.
The test checks all three required widths with actual bundled thumbnails.
At CSS scale two, keyboard End scrolls a long status message into view.
This CSS-scale check does not establish native browser zoom acceptance.

The corrected [thumbnail report](library-thumbnail-smoke.json) passes with zero page errors.
All 24 accessibility cases also pass. Type checking passes.
