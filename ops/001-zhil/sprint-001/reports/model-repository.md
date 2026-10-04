# TASK-041 implementation evidence

Date: 2026-10-04. Status: Done.

The repository stores model bytes, entries, and attachments in one IndexedDB transaction.
It returns saved entries only after transaction completion.

Changed files: `src/model-repository.ts`, `src/library-db.ts`, `src/library-validation.ts`, and `src/library-panel.ts`.
Tests: `scripts/library_storage_smoke.mjs` and `tests/browser-host.html`.

Command: `node scripts/library_storage_smoke.mjs`.
The command passed in Chromium 153.0.8010.12 on Linux.
The [browser report](library-storage-smoke.json) contains fixture hashes and measurements.

| Acceptance check | Result |
| --- | --- |
| Second visit | The same origin restores the saved entry and its changed name. |
| Two-tab duplicate race | Two simultaneous saves produce one model, one asset, and one terms attachment. |
| Transaction rollback | Injected quota failure and cancellation leave all three record counts unchanged. |
| Cancellation after commit | The saved entry remains available. |
| Unavailable IndexedDB | The interface loads bundled and temporary synthetic models. |
| Newer schema | The repository rejects version 2 with recovery text. The stored entry remains. |
| Blocked upgrade | A native blocked event produces recovery text. The database remains at version 1. |
| Persistence | Granted, denied, and unavailable states remain visible. A zero estimate does not prevent two saves. |
| Persistence request | The interface requests persistence once after explicit save. It makes no request before save. |
| Existing preferences | Repository initialization preserves the existing model, settings, and calibration keys. |
| Cross-tab changes | A change event reaches the other tab. A later visit reads the changed name. |

The blocked-upgrade test changes the requested version through a test wrapper.
The quota test injects `QuotaExceededError` after the transaction has queued other writes.
These tests use actual IndexedDB transactions. They do not simulate browser eviction or disk failure.

Synthetic models establish storage behavior. They do not establish actual model appearance or Windows release acceptance.
P04 retains those separate acceptance checks.
