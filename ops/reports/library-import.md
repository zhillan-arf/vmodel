# TASK-043 implementation evidence

Date: 2026-10-04. Status: In progress.

Preview, terms review, save, and temporary selection are implemented. The browser verifies save without selection. Full cancellation and accessibility checks remain open.

See the [shared implementation record](studio-implementation.md) for files, commands, results, requirement mapping, and remaining checks.
See the [browser results](studio-features-smoke.json) for synthetic test results.

This record does not close the task acceptance criteria.

## Late terms failure

A browser test held the first terms file read open while a second terms file completed.
The first read then failed. Before the fix, this failure removed the current attachments and replaced the status message.
`LibraryPanel.readTerms` now checks the operation generation before it handles an error.
The same browser test passes after the fix.
The saved entry and its backup retain the second terms file with the same bytes.

Command: `node scripts/import_metadata_smoke.mjs`.
Evidence: [metadata browser result](import-metadata-smoke.json).
Type checking also passes.

## Temporary selection and preview cancellation

`node scripts/studio_features_smoke.mjs` passes in Chromium 153.0.8010.12.
Cancel removes the preview canvas and preserves the active model, output, database entries, and saved selection.
Try without saving changes Studio and output to the temporary model.
The database entry identifiers and saved selection remain unchanged.
Reload restores the saved model in both windows.
The [browser report](studio-features-smoke.json) records these results with zero page errors.

All 299 unit tests pass. The production build passes with the existing large-chunk warning.
Cancellation during each preparation phase and full accessibility acceptance remain open.

## Inspection and preview deadlines

`node scripts/import_lifecycle_smoke.mjs` checks cancellation and timeout in both phases.
The test holds inspection messages or prepared candidates. It uses the actual 30-second timers.
Each case preserves Studio state, the output model, and the database.
Inspection workers terminate. Late prepared candidates cannot commit after cancellation or timeout.
The preview canvas disappears. Save remains disabled. A subsequent valid import succeeds.

Evidence: [import lifecycle result](import-lifecycle-smoke.json).
The test substitutes synthetic models for both bundled files.
Full accessibility acceptance remains open.

## Progress and error state

The import flow now shows a labeled progress indicator during inspection, preparation, and save.
Cancel returns keyboard focus to Import VRM and reports cancellation.
Import, save, terms, and restore failures use an assertive live region.
Relevant file and text fields refer to the status message with `aria-describedby`.

The lifecycle browser check verifies progress visibility, cancellation focus, and timeout announcement attributes.
It does not establish screen-reader behavior across all supported browsers.
The metadata browser check and production build also pass after these changes.
