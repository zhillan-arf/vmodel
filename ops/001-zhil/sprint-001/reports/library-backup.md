# TASK-046 implementation evidence

Date: 2026-10-04. Status: Done.

Backups preserve original model and attachment bytes.
Restore validates the complete file before it writes new entries in one database transaction.

Changed files: `src/library-backup.ts`, `src/library-validation.ts`, `src/model-repository.ts`, `src/library-panel.ts`, and `src/model-selection.ts`.
Tests: `tests/library-backup.test.ts`, `tests/model-selection.test.ts`, and both browser scripts below.

Commands:

```text
npm test -- --reporter=dot
node scripts/library_storage_smoke.mjs
node scripts/studio_features_smoke.mjs
```

The backup test file has 37 passing cases.
The [storage report](library-storage-smoke.json) and [interface report](studio-features-smoke.json) contain browser results.
The storage report records SHA-256 hashes for the synthetic fixtures.

| Acceptance check | Evidence |
| --- | --- |
| Original export | Original and exported hashes match. CP932 terms bytes remain unchanged. |
| New profile | A new browser profile restores the model and terms. The actual VRM loader validates the synthetic model. |
| Invalid backup | Hash, bounds, schema, count, size, reference, settings, and acknowledgment fixtures reject before writes. |
| Bundled bytes | Identical bytes resolve to the installed bundle. Different bytes require a new imported entry and terms review. |
| Duplicate restore | Existing names and settings take precedence. Invalid duplicate attachments still reject. |
| Settings failure | An injected settings failure leaves both restored entries saved. The result reports one settings failure. |
| Selection and calibration | Restore does not select an entry. Default export excludes settings. Camera calibration is excluded. |
| Cancellation | Cancellation before or during the transaction saves nothing. Cancellation after commit retains saved entries. |
| Graphic candidates | Candidates decode sequentially. Each preparation has a separate 30-second limit. |
| Restore summary | The interface displays original CP932 text. A new invalid file clears the previous restore plan. |

The real IndexedDB test restores two entries together.
An injected failure at the second attachment leaves one original model, one asset, and one attachment.
Cancellation at the same point leaves the same counts.
Successful restore produces three records in each store, even when the later settings write fails.

The size rejection fixture reports an oversized `Blob.size`. It does not allocate a 512 MiB file.
Synthetic model checks do not establish Ene/Rei appearance or target-laptop performance.
Those checks remain in P04 acceptance.

## Optional package version

Entries can include the supplied package version separately from embedded VRM metadata.
Backup and restore preserve this field. Earlier backups can omit it.
All 41 backup tests pass, including invalid package versions and unchanged embedded metadata.
The [metadata browser check](import-metadata-smoke.json) confirms database and backup preservation of both versions and original terms bytes.
