# TASK-040 implementation evidence

Date: 2026-10-04. Status: Done for the defined software scope.

## Implementation

`AvatarViewer` separates preparation, commit, and disposal.
Preparation validates required bones and constructs the retargeter before commit.
Commit updates the viewer and application state before any asynchronous selection write.
The readiness message waits for that write. Storage failure retains session-only selection.

Each candidate belongs to its creating viewer. Another viewer cannot commit or dispose it.
New preparation, cancellation, and viewer disposal release uncommitted candidates.
Operation generations reject stale results. Completed candidates retain their resources until replacement or disposal.

`src/avatar-resources.ts` tracks geometries, materials, textures, skeletons, and image bitmaps during decoding.
It captures successful primitives separately and includes parser-associated material clones after failure.
Resources that complete after rejection are released immediately. Shared resources are released once.
The same owner follows a successful model through commit and final disposal.

Changed files: `src/viewer.ts`, `src/avatar-resources.ts`, and `src/main.ts`.

## Failure evidence

Nine preparation tests cover foreign ownership, supersession, viewer disposal, late completion, missing VRM data, missing bones, retargeter failure, and commit rollback.
Four resource tests cover repeated disposal, late resources, failed primitives, and associated material clones.
These tests preserve the active model after failure.

The real-loader browser check injects failure after mesh allocation and during root completion.
Each case releases its geometry, material, texture, and image exactly once.
The active model still draws, and its renderer resource counts remain unchanged.
The check initially found an undisposed material clone. Parser-association cleanup corrected that failure.
See [decoder results](avatar-decoder-failure-smoke.json), including the synthetic fixture hash.

## Native model evidence

| Check | Ene | Rei |
| --- | --- | --- |
| Version | VRM 1 | VRM 0 |
| Required bones and preparation | Pass | Pass |
| Both hands below shoulders | Pass | Pass |
| Happy and surprise values | 0.75 each | 0.75 each |
| Neutral clears manual expressions | Pass | Pass |
| Invalid replacement preserves active model | Pass | Pass |
| Canceled candidate cannot commit | Pass | Pass |
| Export preserves model hash | Pass | Pass |
| Geometry count after disposal | 0 | 0 |
| Texture count after disposal | 0 | 0 |

[Ene results](ene-library-smoke.json) and [Rei results](rei-library-smoke.json) record hashes, terms hashes, capabilities, and resource estimates.
The reviewed screenshots show both models facing forward with lowered arms and visible textures.
Ene is a new Linux rebuild. Its [provenance](ene-rebuild.json) preserves the source and tool hashes.

The combined native-model sequence passes settings isolation, output synchronization, reload persistence, and failed or superseded selections.
See [native selection results](local/model-selection-smoke.json).
This sequence found the early-readiness race. The corrected sequence and delayed-write regression pass.

## Commands and limits

- `npm test -- --reporter=dot`: 295 tests passed across 31 files.
- `npm run build`: typecheck and build passed; the existing large-chunk warning remains.
- `node scripts/avatar_decoder_failure_smoke.mjs`: both injected decoder stages passed.
- `node scripts/rei_library_smoke.mjs --ene`: passed.
- `node scripts/rei_library_smoke.mjs`: passed.
- `node scripts/model_selection_smoke.mjs --chromium`: passed after the readiness correction.

Browser evidence uses Linux Chromium. Mocked boundaries and injected failures are identified above.
These checks do not establish Windows performance, physical movement, or human appearance acceptance.
TASK-047, TASK-054, and TASK-055 retain their respective acceptance requirements.

The final output-failure and integrated studio browser checks passed after the resource-owner changes.

## Renderer-owned lighting resources

The licensed Seed-san fixture uses physically based materials and causes Three.js to allocate its shared `dfgLUT` texture.
Ordinary renderer disposal leaves that GPU allocation until context cleanup.
Final viewer disposal now calls `forceContextLoss` after renderer disposal.
The viewer ignores later context events after disposal.
The ownership test verifies exactly one context-release call.
The [licensed fixture report](licensed-import-smoke.json) distinguishes the internal counter from model resources and verifies context loss.
