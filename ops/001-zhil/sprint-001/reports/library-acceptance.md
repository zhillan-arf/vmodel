# TASK-047 implementation evidence

Date: 2026-10-04. Status: In progress.

Chrome and Edge pass the software matrix and target-laptop memory checks.
Human review remains open under [TASK-061](../tasks/backlog/TASK-061.md).

See the [shared implementation record](studio-implementation.md) for files, commands, results, requirement mapping, and remaining checks.
See the [browser results](studio-features-smoke.json) for synthetic test results.

This record does not close the task acceptance criteria.

## Windows acceptance checks

Both browsers completed 20 measured Ene/Rei changes after five warm-up changes, with output closed and open.
All four conditions pass the L13 cleanup limit.
Graphics counts remain stable for each model. Disposal leaves zero owned geometries and textures.
Both browsers also pass the storage, failure, selection, and fresh-profile restore checks.
See [the Windows record](windows-continuation.md), [Chrome measurements](windows-library-chrome.json), and [Edge measurements](windows-library-msedge.json).

## Actual model checks

The [Ene report](ene-library-smoke.json) and [Rei report](rei-library-smoke.json) record actual model inspection, preparation, expressions, and resource cleanup.
The checks preserve the active model after failed replacement or cancellation.
Exported bytes and terms retain their original hashes.
The [decoder failure report](avatar-decoder-failure-smoke.json) checks cleanup after partial decoder allocation.
These component checks do not establish memory acceptance or human appearance review.

## Library visual-state evidence

The import browser test now captures seven states at all three required viewport sizes:

- Empty library.
- Inspection error.
- Import preview.
- Conflicting supplied terms and embedded metadata.
- Quota failure.
- Saved entry.
- Duplicate bytes.

The [import report](import-metadata-smoke.json) records all 21 image paths, hashes, viewport sizes, and horizontal-overflow results.
Images remain under `ops/001-zhil/sprint-001/reports/local/visual-states/library/`.
Every captured case has no horizontal page overflow.
The conflict fixture sets embedded `allowRedistribution` to true and supplies text that prohibits redistribution.
Both sources remain visible as text. The test does not decide which terms apply.
Quota failure retains the preview, and a retry saves the model after the injected quota error is removed.

The first narrow quota image showed a blank preview after a viewport change.
The capture helper now resets scroll and waits for two animation frames before the screenshot.
The repeated image shows the preview. No runtime change was needed.
Assistant examination covered the narrow quota state and wide terms-conflict state.
These synthetic images do not establish actual avatar appearance or human visual acceptance.
Output-mismatch images now have [separate evidence](model-selection.md). The [tracking report](tracking-inspector-acceptance.md) records nine tracking states. Human visual acceptance remains open under U07.
