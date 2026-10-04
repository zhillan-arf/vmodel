# TASK-042 implementation evidence

Date: 2026-10-04. Status: Done.

The worker inspects and hashes model bytes before graphic preparation.
Parser tests cover VRM 0 and VRM 1 metadata, required bones, external resources, malformed accessors, sparse indices, cycles, and unsupported extensions.

Changed files: `src/vrm-inspection.ts`, `src/vrm-inspection.worker.ts`, `src/model-types.ts`, and `src/library-validation.ts`.
Tests: `tests/vrm-inspection.test.ts` and `tests/inspection-limits.test.ts`.

Commands:

```text
npx vitest run tests/inspection-limits.test.ts --reporter=dot
npx tsc --noEmit
```

All 16 limit tests pass. Type checking also passes.

| Limit | Boundary evidence |
| --- | --- |
| Input bytes | The size gate accepts 150 MiB and rejects one more byte through a Blob.size test override. |
| JSON bytes | Actual encoded JSON at 8 MiB passes. Four more bytes fail. |
| JSON depth and values | Depth 64 and 250,000 values pass. One additional level or value fails. |
| Collections | Node, mesh, primitive, accessor, and image counts pass at each ceiling. One additional item fails. |
| Image dimensions | Width and height 8,192 pass separately. Dimension 8,193 fails. |
| Decoded pixels | Headers for 201,326,592 pixels pass. One more pixel fails. |
| Geometry estimate | A sparse accessor declares 128 MiB. One additional scalar fails. |
| Combined estimate | The combined guard accepts 1,024 MiB and rejects the next larger estimate. |
| Terms | Eight files, 2 MiB per file, and 8 MiB total pass. Each larger case fails. |
| Thumbnail | Header checks accept 320 by 320 and 512 KiB. Different dimensions or an additional byte fail. |

The revised pixel ceiling permits a direct combined-boundary test.
The test changes no application ceiling.

Image tests use headers without full image decode. Sparse geometry tests do not allocate the declared geometry.
The thumbnail test verifies the size and dimension gate. It does not establish full PNG decoding.
Actual model preparation remains a separate loader check.

The [browser report](library-storage-smoke.json) records hashes for renderable synthetic models.
Ene now has a Linux rebuild that passes structural inspection. The pinned Seed-san VRM 1 fixture now passes the same import pipeline.
The supplied Rei VRM passes the revised import limits and browser preparation.
The browser checks now cover external requests, terms display, and actual-model capabilities.
Human appearance and terms review remain under library acceptance.
The fixture results below complete TASK-042.

## Original Rei incompatibility

The native Rei file has SHA-256 `07037243141d9c3f260c6ef09419f1225ca64ffb7791204b4aef0b817ebc1735`.
Its 43 images contain 145,752,064 pixels. The limit is 67,108,864 pixels.
Estimated texture memory alone is 777,344,342 bytes. The combined limit is 536,870,912 bytes.
`node scripts/rei_library_smoke.mjs` confirms that worker inspection rejects the file.
The original bytes and terms remain unchanged. These measurements preceded the ceiling revision below.
[Original measured evidence](rei-original-limits.json) records the failure.
Target-laptop acceptance remains open.

## Rei compatibility revision

D08 and L04 now select fixed ceilings of 201,326,592 pixels and 1,024 MiB combined resources.
The original input-byte, geometry, image-dimension, collection, and attachment limits remain unchanged.
Rei needs 19,891,256 geometry bytes and 777,344,342 estimated texture bytes.
The total is 797,235,598 bytes. The new combined ceiling contains this required model.
All 16 boundary tests pass, including both sides of the new pixel and combined limits.
No automatic per-file ceiling increase exists.

The native Rei file passes inspection, preparation, required bones, relaxed arms, cancellation, and unchanged export.
No external requests or page errors occurred in the browser check.
The optional `upperChest` bone is absent. The surprise alias resolves to `びっくり`.
The original terms hash is `c361775b83d3ad371eb29dccac794a65e7b78a1788670e3b2fb957e5706fc313`.
The [revised browser result](rei-library-smoke.json) records the model hash and capabilities.
The reviewed screenshot shows the full body with lowered arms and visible textures.
This Linux result does not establish target-laptop capacity or human appearance acceptance.

Rei's happy and surprise expressions each reach 0.75. Neutral clears both values.
Disposal reduces the renderer counts from 45 geometries and 55 textures to zero.
The complete unit suite passes 282 tests. The production typecheck and build pass.
The existing large-chunk warning remains.

## Metadata and version checks

`node scripts/import_metadata_smoke.mjs` passes in Chromium 153.0.8010.12.
Four invalid fixtures fail before a new graphics context exists.
These fixtures contain external buffers, external images, script image URIs, and an unknown required extension.
The test counts external requests and blocks them. The count is zero.

Metadata and terms contain HTML, scripts, and unsafe link text.
The application displays this content as text. No script executes, and no unsafe element or link exists.
The [browser result](import-metadata-smoke.json) records these checks.

The optional supplied package version remains separate from the embedded model version.
Browser import, database storage, backup, and restore preserve both values.
The original metadata and terms hashes remain unchanged.
Older backups can omit the new field.

All 41 backup tests pass. These tests include invalid package versions and version preservation.
The production build passes. The existing large-chunk warning remains.
The licensed fixture criterion now passes as recorded below.

## Licensed VRM 1 fixture

Seed-san is by VirtualCast, Inc. Its source notice identifies VRM Public License 1.0.
[Original notice](https://github.com/vrm-c/vrm-specification/blob/94e82dd346fa6cf0337c4421728640e5252dd38e/samples/Seed-san/README.md).
The model and notice are pinned at commit `94e82dd346fa6cf0337c4421728640e5252dd38e`.
`config/import-fixture.json` records their URLs and SHA-256 values.
`python scripts/provision_import_fixture.py` downloads and verifies those files.
The original files stay under ignored `assets/testing/seed-san`.

`node scripts/licensed_import_smoke.mjs` passes inspection, graphics preparation, registration, unchanged export, and original-notice preservation.
The model has 10,917,800 bytes and embedded version 1.
Its SHA-256 is `624d0d554bc205bbdc33e22a68a2c3c20edebb3e573011ead8878a65e5329b23`.
Geometry allocation is 6,328,320 bytes. Estimated texture allocation is 57,671,680 bytes.
The optional upperChest bone is absent. The required bones pass. Spring bones and 18 expressions are available.
The renderer makes 31 draw calls.
No external request or page error occurs during the browser check.
[Measured result](licensed-import-smoke.json).

The fixture exposed a renderer-owned `dfgLUT` lighting texture after ordinary renderer disposal.
This texture is not model data. The viewer now explicitly loses its graphics context during final disposal.
The test verifies context loss and zero remaining geometries.
The renderer retains one internal texture counter after context loss. The report records that counter without a zero-resource claim.

All 305 unit tests pass. The production build passes with the existing large-chunk warning.
Ene and Rei remain separate required fixtures with their own linked reports.
Physical and target-laptop acceptance remain outside TASK-042.
