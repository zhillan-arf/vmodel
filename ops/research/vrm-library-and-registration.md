# VModel model library and VRM registration design

Prepared for the VModel owner on 2026-10-04. This is a proposed next feature, informed by adding Rei alongside Ene. It does not claim that persistent upload registration is implemented in the current change.

VModel should expose a model library with bundled and imported entries, backed initially by IndexedDB in the local browser. Import should validate and preview a VRM, preserve its attribution and terms, and register its original bytes only after the user chooses Save to library. Keep a separate disk export for recovery. A cloud account or database server is unnecessary for this single-laptop application; a later desktop library adapter can provide disk durability across browser profiles.

## What adding Rei teaches us

The existing Ene pipeline converts a source character into a prepared VRM. Rei's supplied resources contain separate MMD and VRM ZIP archives; the native VRM archive already contains the runtime model. Loading a native VRM should therefore be the normal import path. MMD conversion belongs in a separate authoring workflow. A ZIP, PMX or VMD file is not a runtime avatar, and the import interface should say so explicitly.

The two bundled entries should be selected through a catalogue, not by adding another special case throughout the renderer. This change establishes that small catalogue and keeps an optional temporary VRM loader. The future library replaces the catalogue's storage boundary while reusing the renderer and retargeter.

Browser review also exposed two compatibility differences that a successful file load did not catch: Ene-specific fallback arm rotations raised Rei's arms, and Rei's surprise expression uses the custom name `びっくり` instead of the standard `surprised`. The two-model implementation derives relaxed arms from rig rest directions and maps that expression. A registry should record capabilities and explicit expression aliases and preview a neutral pose; a “valid VRM” badge alone cannot promise matching behavior across models.

Current integration points, inspected in this repository:

| Area | Existing behavior | Consequence for registration |
| --- | --- | --- |
| `src/main.ts` | Hashes VRM bytes with SHA-256 and constructs a new retargeter on load | Preserve that content identity for settings and duplicate detection |
| `src/profiles.ts` | Settings use an avatar hash; calibration also includes camera, mode and capture format | A display-name edit must not invalidate calibration; changed model bytes need separate calibration |
| `src/viewer.ts` | Loads a Blob through three-vrm, checks required bones, rejects external resource URLs and normalizes VRM 0 orientation | Reuse these checks, but separate validation from replacing the active viewer |
| `src/output-link.ts` | Synchronizes the active model Blob and performance state with output windows | Output must follow the committed selection, including an imported model |
| `scripts/server.mjs` | Primarily serves a static local build, bound to loopback | Do not assume an existing upload endpoint or server database |
| `.gitignore` | Excludes original/prepared model assets and runtime copies | A library must remain private local data, outside code distribution |

Rei is 55,715,860 bytes before browser decoding, with SHA-256 `07037243141d9c3f260c6ef09419f1225ca64ffb7791204b4aef0b817ebc1735`. It is a native VRM 0 model exported by UniVRM 0.94.0. The archive labels version 1.3.3 while embedded metadata reports 1.3.2: store both source and embedded versions rather than inventing a single authoritative version. This is a useful real fixture for import progress, quota handling and switching memory use. File size does not equal GPU memory consumption: decoded textures, geometry, a preview and an output window can add substantially more memory. Benchmark both avatars instead of assuming Ene's rendering cost applies to Rei.

Rei also demonstrates why metadata alone cannot summarize terms reliably. Its embedded fields include `licenseName: Redistribution_Prohibited` and `commercialUssageName: Disallow`; the packaged Japanese readme describes permissions for modification/redistribution and paid doujin activity, with separate permission for corporate commercial activity. These are conflicting source signals, not a resolved licensing conclusion. Preserve and display both, flag the discrepancy, and leave the original CP932 readme available. Local addition is not permission to publish the asset. The exact source evidence is retained in `public/avatars/rei-notices/`.

## Storage decision

The following is a design recommendation, not a claim that any of these stores is installed.

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| IndexedDB storing metadata and Blobs | Fits the current browser application, supports atomic transactions, works offline, no write API exposed on localhost | Tied to browser profile and origin; quotas and deletion remain possible | First implementation |
| OPFS for bytes plus IndexedDB metadata | Can make large file workflows convenient | Two storage systems need crash reconciliation; still tied to origin | Defer until measured need |
| Local service with files plus SQLite | Durable library independent of browser port/profile; straightforward folder backup | Adds authenticated write APIs, migration and service packaging work | Later desktop mode if requested |
| Remote object store plus database | Sharing and multiple devices | Accounts, network dependency, access control and redistribution questions | Outside current scope |

IndexedDB supports structured records and transactions, making it suitable for committing the model bytes and entry together. [MDN IndexedDB guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)

Browser data is not an unconditional permanent archive. Request persistent storage, report whether it was granted, inspect estimated capacity before import, catch quota errors, and provide backup/export. Browser profiles, origins and user deletion affect availability. Development on port 5173 and everyday use on port 4173 must not silently be presented as one library. [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

Use the normal launcher origin consistently. If the app later changes its host or port, offer export from the old origin and import into the new one. Do not promise automatic discovery of another origin's private storage.

## Records and identity

Create a versioned `vmodel-library` database with these object stores. Field names below describe a proposed schema.

| Store | Key | Main fields |
| --- | --- | --- |
| `assets` | SHA-256 of original bytes | Blob, byte length, media type, import timestamp, validation version |
| `models` | Stable UUID | Display name, asset hash, source kind, original filename, extracted VRM metadata, capability report, created and updated timestamps |
| `attachments` | UUID | Model ID, attachment type, original filename, Blob for supplied readme or terms |
| `preferences` | Named setting | Selected model ID and schema migration version |

Keep bundled catalogue IDs such as `ene` and `rei` as stable aliases resolved to their current assets. Do not copy bundled files into IndexedDB merely to list them. Imported entries use the same `LibraryEntry` interface but resolve through storage. Keep content hash distinct from entry ID: the former identifies rig bytes, while the latter identifies the user's named library entry.

For a duplicate hash, offer Select existing or Rename existing; default to selecting the existing entry. Avoid creating duplicate asset bytes. A genuinely changed VRM is a new asset and a new version or entry. Retain the old version until the user removes it. Do not automatically carry calibration across different hashes, because bone axes and proportions may have changed.

Continue reading existing localStorage settings/calibration using the existing hash keys. Migration of those small records can happen later; it is not a prerequisite for registering assets. If moved into IndexedDB, use an explicit one-time migration and retain recoverable old records until verification succeeds.

## Import and registration flow

1. **Choose VRM.** Show bundled and registered models in one library. Keep temporary loading available as Try without saving. For this first version, accept a single `.vrm`, not an archive; explain how to extract the VRM from a source ZIP.
2. **Inspect.** Check byte length, GLB header/version/chunk bounds, JSON structure and supported VRM extension before creating GPU resources. Hash once and check for a duplicate. Proposed initial limits are 150 MiB per file and 8 MiB JSON; tune these against real accepted assets and show the exact limit when rejecting a file.
3. **Validate compatibility.** Check required humanoid bones using the runtime's actual policy. Report optional fingers, expressions and spring bones as capabilities. Missing optional expressions should disable the affected expression control with a reason, not reject an otherwise usable avatar. Accept supported VRM 0 and VRM 1 through three-vrm and test both; preserve original bytes instead of rewriting formats during import.
4. **Preview.** Load into a disposable preview viewer with a timeout and cancel option. Keep the active performance/output running on its current avatar. Show name, author, version, thumbnail, capabilities and warnings. Produce a thumbnail only after decoding succeeds. Render untrusted metadata as text.
5. **Review terms.** Display extracted metadata and supplied terms attachments. Preserve version-specific fields and raw metadata alongside a readable summary. Opening an external terms link is an explicit user action. A Save action records acknowledgement of the displayed terms, not a legal conclusion or an automatic grant of redistribution rights.
6. **Save to library.** Commit asset, model entry and attachments in one transaction. Only show Saved after transaction completion. A quota failure or cancelled preview leaves no selectable half-entry. Return to the library and optionally select the new entry.
7. **Select.** Resolve bytes, validate that stored content matches identity, load the new avatar, then publish a committed selection to output windows. Save the selected ID only after success. A failed load leaves the previous avatar, settings and selected ID active.

VRM 1 metadata explicitly separates authorship and use conditions, including avatar permission and licensing fields. Preserve the original field meanings rather than flattening them into a single “free to use” flag. [VRM 1 metadata specification](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/meta.md)

VRM versions differ in specification details, including orientation conventions. Keep format handling inside the established loader rather than adding a Rei-specific transform or assuming that every model is the same version as Ene. [VRM 1 changes](https://vrm.dev/en/vrm1/changed/)

## Boundaries and failure handling

Expose a `ModelRepository` interface with `list`, `inspect`, `register`, `resolve`, `rename`, `remove` and `export`. Implement a bundled repository and IndexedDB repository behind a combined service. The UI uses entries and capabilities; the viewer continues to accept a Blob. The retargeter should not know whether bytes came from a bundle, temporary file or registered library.

Every load has a generation token. Fetching, hashing, decoding and committing must each check it. Cancelling or superseding a preview disposes temporary GPU objects and revokes object URLs. Never dispose the current model until its replacement has passed validation. Do not keep all library models decoded in memory. Measure the peak while switching Rei with the output window open and place a bounded limit on concurrent previews.

Retain the existing embedded-resource policy and add preflight validation of buffer/image URIs. A model import must not fetch arbitrary URLs. Bound JSON complexity, texture dimensions/count and geometry allocation before or during decode; an upload byte limit alone does not prevent excessive decoded allocation. Reject unsupported required extensions clearly. These are proposed robustness controls, not claims that the current loader implements all of them.

Removing an inactive entry deletes its metadata and attachments atomically and deletes asset bytes only when no entry references them. Removing the active model requires choosing another available model first. Built-in entries cannot have their shipped source bytes deleted from the UI. If a selected imported model disappears because browser data was cleared, fall back to Ene with a visible explanation; do not silently substitute during an ongoing stream.

Export original VRM bytes and optionally a versioned library backup containing metadata, attachments and settings. Restore must validate hashes and schema, disallow archive path traversal, enforce decompression limits, resolve duplicates and never execute archive contents. No backup/export leaves the laptop without an explicit user action.

## Implementation sequence and acceptance

1. Extract the current catalogue into a repository boundary while preserving Ene/Rei selection, per-avatar settings and output synchronization. Define a capability report and make validation reusable without replacing the active avatar.
2. Add IndexedDB transactions, import inspection, preview and registration; then implement rename, remove and backup. Provide visible storage failures and recovery instructions.
3. Add migration and recovery coverage before removing the temporary loader or recommending the library as the only copy of an avatar.

Acceptance should include registering both supplied avatars, reopening the same origin, selecting each with an output window open, keeping different settings per content hash, duplicate import, renamed filename with identical bytes, updated model with different bytes, storage denied/quota exceeded, malformed GLB, unsupported extension, external textures, missing required bone, optional-expression absence, cancelling during decode and rapid alternating selections. Check zero stale commits and that failed registration cannot corrupt the previously working model. Test recovery from a backup in a fresh browser profile.

Measure import duration, peak browser memory and time to first visible frame for Ene and Rei on this laptop, with and without output open. Report actual measurements before setting performance budgets. Passing a synthetic rig test does not establish physical tracking quality; use the separate [tracking diagnostics proposal](tracking-diagnostics-and-improvement.md) to evaluate that pipeline independently.
