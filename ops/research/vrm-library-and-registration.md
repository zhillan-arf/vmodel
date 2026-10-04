# VModel model library and VRM registration

Date: 2026-10-04. Status: proposed feature. This document uses the work to add Rei beside Ene as evidence. Persistent registration is not available now.

Add a model library for bundled and imported models. Use local browser IndexedDB first. Validate and preview each VRM before registration. Keep its original bytes, attribution, and terms. Save the model only after the user selects **Save to library**. Provide a separate disk export for recovery. This application runs on one laptop. It does not need a cloud account or database server. A later desktop adapter can keep files across browser profiles.

## Findings from Rei

The Ene process converts a source character into a prepared VRM. Rei has separate MMD and VRM ZIP files. The VRM ZIP already has a model that the app can use. Use a native VRM for normal import. Keep MMD conversion in a separate authoring procedure. Tell users that ZIP, PMX, and VMD files are not runtime avatars.

Select the two bundled models through the catalogue. Keep the optional temporary VRM loader. A future library can use the same renderer and retargeter.

Browser review found two compatibility differences after a successful file load. Ene-specific fallback rotations raised Rei's arms. Rei uses `びっくり` for surprise instead of `surprised`. The two-model implementation uses rig rest directions for relaxed arms and maps the expression. Record model capabilities and expression aliases. Preview a neutral pose. A valid VRM can still behave differently from another model.

Current integration points, inspected in this repository:

| Area | Existing behavior | Consequence for registration |
| --- | --- | --- |
| `src/main.ts` | Hashes VRM bytes with SHA-256 and constructs a new retargeter on load | Preserve that content identity for settings and duplicate detection |
| `src/profiles.ts` | Settings use an avatar hash; calibration also includes camera, mode and capture format | A display-name edit must not invalidate calibration; changed model bytes need separate calibration |
| `src/viewer.ts` | Loads a Blob through three-vrm, checks required bones, rejects external resource URLs and normalizes VRM 0 orientation | Reuse these checks, but separate validation from replacing the active viewer |
| `src/output-link.ts` | Synchronizes the active model Blob and performance state with output windows | Output must follow the committed selection, including an imported model |
| `scripts/server.mjs` | Primarily serves a static local build, bound to loopback | Do not assume an existing upload endpoint or server database |
| `.gitignore` | Excludes original/prepared model assets and runtime copies | A library must remain private local data, outside code distribution |

Rei has 55,715,860 bytes before browser decode. Its SHA-256 is `07037243141d9c3f260c6ef09419f1225ca64ffb7791204b4aef0b817ebc1735`. It is a VRM 0 model from UniVRM 0.94.0. The archive gives version 1.3.3. Embedded metadata gives version 1.3.2. Keep both values. Use Rei to test import progress, quota errors, and memory use during model selection. File size does not show GPU memory use. Decoded textures, geometry, previews, and output windows use more memory. Measure Ene and Rei separately.

Rei's metadata and readme give different use terms. Metadata includes `licenseName: Redistribution_Prohibited` and `commercialUssageName: Disallow`. The Japanese readme describes modification, redistribution, and paid doujin use. It gives separate terms for corporate commercial use. Keep and show both sources. Show the difference and keep the original CP932 readme. Local import does not give permission to publish the asset. Source evidence is in `public/avatars/rei-notices/`.

## Storage decision

The following is a design recommendation, not a claim that any of these stores is installed.

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| IndexedDB storing metadata and Blobs | Fits the current browser application, supports atomic transactions, works offline, no write API exposed on localhost | Tied to browser profile and origin; quotas and deletion remain possible | First implementation |
| OPFS for bytes plus IndexedDB metadata | Can make large file workflows convenient | Two storage systems need crash reconciliation; still tied to origin | Defer until measured need |
| Local service with files plus SQLite | Durable library independent of browser port/profile; straightforward folder backup | Adds authenticated write APIs, migration and service packaging work | Later desktop mode if requested |
| Remote object store plus database | Sharing and multiple devices | Accounts, network dependency, access control and redistribution questions | Outside current scope |

IndexedDB supports structured records and transactions. It can save model bytes and the model entry together. See the [MDN IndexedDB guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).

Browser data is not a permanent archive. Request persistent storage. Show the result. Estimate free capacity before import. Handle quota errors. Provide backup and export. Browser profiles, origins, and user deletion affect availability. Ports 5173 and 4173 have separate libraries. Explain this to the user. See [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Use one normal launcher origin. If the host or port changes, export from the old origin. Then import into the new origin. An origin cannot automatically find another origin's private storage.

## Records and identity

Create a versioned `vmodel-library` database with these object stores. Field names below describe a proposed schema.

| Store | Key | Main fields |
| --- | --- | --- |
| `assets` | SHA-256 of original bytes | Blob, byte length, media type, import timestamp, validation version |
| `models` | Stable UUID | Display name, asset hash, source kind, original filename, extracted VRM metadata, capability report, created and updated timestamps |
| `attachments` | UUID | Model ID, attachment type, original filename, Blob for supplied readme or terms |
| `preferences` | Named setting | Selected model ID and schema migration version |

Keep `ene` and `rei` as stable catalogue IDs. Resolve each ID to its current asset. Do not copy bundled files into IndexedDB only to list them. Imported entries use `LibraryEntry` and resolve through storage. A content hash identifies model bytes. An entry ID identifies the user's named library entry.

For a duplicate hash, offer **Select existing** and **Rename existing**. Select the existing entry by default. Do not store duplicate bytes. Treat changed VRM bytes as a new asset and version or entry. Keep the old version until the user removes it. Do not copy calibration across different hashes. Bone axes or proportions can change.

Read current localStorage settings and calibration with their current hash keys. Asset registration does not require their migration. If IndexedDB later holds them, use an explicit one-time migration. Keep recoverable old records until verification succeeds.

## Import and registration flow

1. **Choose VRM.** Show bundled and registered models in one library. Keep temporary load as **Try without saving**. Accept one `.vrm` file in the first version. Explain how to extract it from a ZIP.
2. **Inspect.** Check byte length, GLB header, version, chunk bounds, JSON, and VRM extension before GPU use. Calculate the hash once. Find duplicate bytes. Initial proposed limits are 150 MiB per file and 8 MiB for JSON. Test these limits with real models. Show the applicable limit when the app rejects a file.
3. **Validate compatibility.** Test required humanoid bones with the runtime policy. Report optional fingers, expressions, and spring bones. If an optional expression is absent, disable its control and show why. Accept supported VRM 0 and VRM 1 models through three-vrm. Test both versions. Keep the original bytes.
4. **Preview.** Load into a disposable preview viewer with a timeout and cancel option. Keep the active performance/output running on its current avatar. Show name, author, version, thumbnail, capabilities and warnings. Produce a thumbnail only after decoding succeeds. Render untrusted metadata as text.
5. **Review terms.** Display extracted metadata and supplied terms attachments. Preserve version-specific fields and raw metadata alongside a readable summary. Opening an external terms link is an explicit user action. A Save action records acknowledgement of the displayed terms, not a legal conclusion or an automatic grant of redistribution rights.
6. **Save to library.** Commit asset, model entry and attachments in one transaction. Only show Saved after transaction completion. A quota failure or cancelled preview leaves no selectable half-entry. Return to the library and optionally select the new entry.
7. **Select.** Get the bytes and verify their hash. Load the new avatar. Then send the selection to output windows. Save the selected ID only after a successful load. If load fails, keep the previous avatar, settings, and ID.

VRM 1 metadata has separate fields for authorship and use conditions. Keep the meaning of each field. Do not replace them with one **free to use** flag. See the [VRM 1 metadata specification](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/meta.md).

VRM versions have different orientation rules. Keep format handling in the loader. Do not add a Rei-specific transform. Do not assume that all models use Ene's VRM version. See [VRM 1 changes](https://vrm.dev/en/vrm1/changed/).

## Boundaries and failure handling

Expose a `ModelRepository` interface with `list`, `inspect`, `register`, `resolve`, `rename`, `remove` and `export`. Implement a bundled repository and IndexedDB repository behind a combined service. The UI uses entries and capabilities; the viewer continues to accept a Blob. The retargeter should not know whether bytes came from a bundle, temporary file or registered library.

Every load has a generation token. Fetching, hashing, decoding and committing must each check it. Cancelling or superseding a preview disposes temporary GPU objects and revokes object URLs. Never dispose the current model until its replacement has passed validation. Do not keep all library models decoded in memory. Measure the peak while switching Rei with the output window open and place a bounded limit on concurrent previews.

Retain the existing embedded-resource policy and add preflight validation of buffer/image URIs. A model import must not fetch arbitrary URLs. Bound JSON complexity, texture dimensions/count and geometry allocation before or during decode; an upload byte limit alone does not prevent excessive decoded allocation. Reject unsupported required extensions clearly. These are proposed robustness controls, not claims that the current loader implements all of them.

Remove metadata and attachments for an inactive entry in one transaction. Delete asset bytes only when no entry uses them. Select another model before you remove the active model. The UI cannot delete bundled source files. If browser data loss removes the selected model, select Ene and show why. Do not change models without notice during a stream.

Export original VRM bytes and optionally a versioned library backup containing metadata, attachments and settings. Restore must validate hashes and schema, disallow archive path traversal, enforce decompression limits, resolve duplicates and never execute archive contents. No backup/export leaves the laptop without an explicit user action.

## Implementation sequence and acceptance

1. Extract the current catalogue into a repository boundary while preserving Ene/Rei selection, per-avatar settings and output synchronization. Define a capability report and make validation reusable without replacing the active avatar.
2. Add IndexedDB transactions, import inspection, preview and registration; then implement rename, remove and backup. Provide visible storage failures and recovery instructions.
3. Test migration and recovery. Keep the temporary loader until these tests pass. Recommend the library as the only copy after backup tests pass.

Acceptance tests must cover both supplied avatars and a second visit to the same origin. Select each avatar with an output window open. Test separate settings for each content hash. Test duplicate import and a new filename with the same bytes. Test an updated model with different bytes. Test denied storage, quota errors, malformed GLB, unsupported extensions, and external textures. Test a missing required bone and missing optional expression. Cancel during decode and change models rapidly. Confirm that no stale operation commits. Confirm that failed registration keeps the previous model usable. Restore a backup in a new browser profile.

Measure import duration, peak browser memory and time to first visible frame for Ene and Rei on this laptop, with and without output open. Report actual measurements before setting performance budgets. Passing a synthetic rig test does not establish physical tracking quality; use the separate [tracking diagnostics proposal](tracking-diagnostics-and-improvement.md) to evaluate that pipeline independently.
