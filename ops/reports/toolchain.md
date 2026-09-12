# Toolchain implementation checkpoint

Date: 2026-09-12. Authoring/export, runtime initialization and OBS launch pass. The remaining exact model-notice inventory is now resolved; TASK-002 is complete. Live combined-workload acceptance remains in TASK-003 and later tasks.

| Component | Installed/tested version | Evidence |
| --- | --- | --- |
| Blender | Existing 5.1.1, build b70da489d7f4 | Both add-ons load; full PMX parsing/import and VRM export succeed |
| MMD Tools | 4.5.14 | Publisher SHA-256 verified; includes opencc-python-reimplemented 0.1.7 |
| VRM add-on | 4.7.1 | Publisher SHA-256 verified; export loads in Three.js |
| OBS | Portable 32.2.2, Windows x64 | Publisher SHA-256 verified; launched successfully and responded; process closed after smoke check |
| Node / npm | 24.12.0 / 11.6.2 | Dependencies installed; exact resolution recorded in the working-tree lockfile |
| Three.js / three-vrm | 0.186.0 / 3.5.5 | Actual Ene VRM renders without browser errors |
| MediaPipe Tasks Vision | 1.0.1 | All three local tasks initialize; 70-second synthetic camera and restart test passes |
| TypeScript / Vite | 7.0.2 / 8.3.0 | Production build passes |
| Vitest / Playwright | 5.0.0 / 1.63.0 | Fifty-five math/camera/worker/settings/solver tests pass; actual-Ene fixtures, output and camera recovery checks pass |
| Chrome | Installed 152.0.7977.83 | Automated headless render smoke; not a substitute for live camera/OBS performance |

[Publisher download manifest](../../config/tool-downloads.json), [runtime asset manifest](../../config/runtime-assets.json), [npm lockfile](../../package-lock.json).

## Setup choices

Reused the compatible installed Blender instead of downloading a second version. Add-ons and their bundled Python dependency are isolated in `.tools/blender/`; no global Python packages or saved Blender preferences were changed. OBS is isolated in `.tools/obs/` with portable configuration. It has not yet been configured with the final scenes or virtual-camera registration.

Reproduce downloads with `python scripts/provision_tools.py`, npm dependencies with `npm.cmd ci`, and local tracking assets with `node scripts/provision_runtime.mjs`. Run Blender scripts with `--background --factory-startup --python-exit-code 1`. Scripts fail on publisher checksum mismatches. Runtime model hashes were recorded from versioned official storage URLs on first download; this is distinct from independently published checksums.

## Licenses and boundaries

MMD Tools: GPL-3.0-or-later; bundled OpenCC implementation: Apache-2.0. VRM add-on: MIT OR GPL-3.0-or-later. Three.js and three-vrm: MIT. MediaPipe framework/package: Apache-2.0. OBS: GPL-2.0-or-later. Retain their distribution notices in `.tools` and npm packages. The exact face, hand and pose-Lite bundles are identified as Apache-2.0 by explicit statements in the publisher-linked model cards; [model audit](model-notices.md), [notice manifest](../../config/model-notices.json) and [retained license](../../config/notices/Apache-2.0.txt) resolve that separate inventory. Final packaging must retain them.

The proposed license for newly written application/helper code is MIT; this proposal does not relicense character assets, upstream tools or later voice-model weights. No public distribution has occurred. Windows and the user's installed Chrome are the host environment; the application uses open-source rendering/tracking libraries and does not require a paid proprietary avatar SDK or cloud inference service.

Ene is loaded only from the local supplied model, under the user's existing authorization and bundled asset terms. It is not redistributed under a software license. No third-party sample avatar was downloaded: the toolchain smoke uses actual Ene, which gives stronger model-compatibility evidence.

## Executed checks

- `scripts/audit_assets.py` in Blender: exit 0; both full PMX files parsed.
- `scripts/import_ene.py` in Blender: exit 0; editable source and front render saved.
- `scripts/export_ene.py` in Blender: exit 0; VRM and working Blender scene saved.
- `npm.cmd run build`: passes; expected bundle-size advisory remains.
- `npm.cmd test`: fifty-five tests pass at the current implementation checkpoint.
- `node scripts/tracking_recovery_smoke.mjs`: 70-second synthetic camera check, release/restart and document/worker external-request blocking pass. See [camera reliability report](camera-reliability.md).
- `node scripts/browser_smoke.mjs`: passes, no page errors or external requests; approximately 60 fps in a short render-only headless check.
- `node scripts/validate_avatar.mjs`: no glTF errors; required humanoid assignments and expressions present. Validator warns about material extension combinations and cannot validate VRM extension semantics. See [validation report](vrm-validation.json).
- OBS launch: process responded and initialized graphics/audio. OBS's default first-run scene opened its standard audio devices; no recording or stream was started. Final audio routing is pending.

The initial export's material transparency caused the face to draw over the fringe. Export logic now classifies actual alpha values instead of marking all RGBA textures transparent; the corrected browser render has been inspected. Live tracking, sustained performance, detailed pose quality and final recording acceptance remain open.
