# Model library

An entry is a saved model record. An asset is the original VRM file, identified by its SHA-256 hash.
A prepared avatar contains decoded graphics and a motion solver. Preparation does not change the active avatar.

The normal launcher uses `http://127.0.0.1:4173`. Other ports and `localhost` have separate browser storage.
Keep original model files and backups outside browser storage. Browser data can disappear after storage cleanup.

## Import and selection

1. Open Library.
2. Select Import VRM.
3. Select one VRM file.
4. Examine the preview and capability report.
5. Read the original metadata and terms.
6. If necessary, attach TXT or MD terms files.
7. If the text is incorrect, select CP932 or UTF-8.
8. Select the terms acknowledgment checkbox.
9. Select Save to library.
10. Select Use model on the saved entry.

Save does not select the model. A failed import or selection keeps the active avatar.
Try without saving selects a temporary model. It does not change the saved startup selection.
The library identifies the temporary model and states that it is not saved.
A duplicate file uses the existing entry. Changed bytes create a separate entry and separate calibration.

The preview supports the expressions that the model supplies. An unavailable expression has a disabled control and an explanation.
The application preserves terms as text. A terms acknowledgment does not establish permission for publication.

## Entry actions

- Use Rename to change an imported entry name.
- Use Export original VRM to download the exact saved bytes.
- Use the attachment export buttons to download original terms files.
- Select another model before removal of the active entry.
- Confirm removal with the entry name.

Removal retains model settings and camera calibration under the asset hash. Reimport of the same bytes can use those settings.
A model removed in another tab can remain active until the current session ends.

## Backup and restore

1. Select the checkboxes for the entries to back up.
2. If necessary, select Include model settings.
3. Select Back up selected entries.
4. Check the displayed file size.
5. Confirm the download.
6. Keep the `.vmlib` file outside browser storage.

A backup can include original bundled bytes. Backups exclude camera calibration.
The format stores a bounded JSON manifest followed by binary segments. It uses no compression.

1. Open Library in the destination browser profile.
2. Select Restore backup.
3. Select the `.vmlib` file.
4. Examine the restore summary and terms.
5. If required, select the terms acknowledgment checkbox.
6. Select Restore entries.
7. Select Use model when you want to change the active model.

Restore validates all files before the database transaction. Invalid backups save no entries.
Restore retains existing entries on hash conflicts. Optional settings fill missing keys only.
A settings failure does not undo successful asset restoration.

## Recovery

| Message or condition | Action |
| --- | --- |
| Storage unavailable | Use a bundled model or Try without saving. Retry storage later. |
| Full storage | Export a backup. Remove unused entries or free browser storage. |
| Close other studio tabs | Close other VModel tabs, then retry. |
| Newer database schema | Use an application version that supports the saved schema. |
| Missing bytes | Restore a backup or import the original VRM. |
| Corrupt saved bytes | Select another model. Remove the corrupt entry, then restore its backup. |
| Selected for this session only | Keep the session open. Retry selection after storage recovers. |
| Output error or model mismatch | Inspect the output status. Retry selection or reopen output. |

The studio and output window prepare models separately. A successful studio selection does not establish output success.
Output keeps its previous model until the replacement is ready.

## Current evidence limits

Automated checks cover synthetic models and database recovery. Actual Ene/Rei appearance and Windows Chrome/Edge acceptance remain open.
See [implementation evidence](../ops/001-zhil/sprint-001/reports/studio-implementation.md).

The embedded model version comes from the original VRM metadata.
The optional supplied package version identifies the source package.
These versions can differ. For Rei, the supplied package is 1.3.3 and the embedded version is 1.3.2.
Import and backup preserve both fields separately.

## Bundled previews

`npm run build` creates local thumbnails for available bundled models.
The generator uses Chrome, Edge, or the Playwright Chromium installation.
If no browser is available, run `npx playwright install chromium`, then repeat the build.
The generator saves images under `public/avatars/thumbnails/`.
Model hashes identify the images. The generator checks cached image hashes before reuse.
No model or image leaves the computer.
If a thumbnail is unavailable, the card shows `Preview unavailable.`
