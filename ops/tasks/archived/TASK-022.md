# TASK-022: Audit and provision the open source voice-conversion toolchain

- Status: Done
- Priority: P0
- Goal: G3
- Depends on: None
- Estimate: S-M (1-2 days)
- Specification: [Live English character voice](../../specs/voice-conversion-plan.md)

## Outcome

Provide a reproducible RVC environment and an explicit inventory of voice-model terms before live integration.

## Work

- Inspect current Python, audio devices, available storage and installed converters; retain the verified i7-1255U/Iris Xe hardware baseline.
- Compare official w-okada RVC and deiteris builds/source revisions; use isolated environments and pin a tested build, dependency lock, download origin and hashes. Keep Applio training separate.
- Audit licenses for client, inference engine, content encoder, pitch estimator, pretrained generator, target weights and routing components. Exclude restricted Beatrice inference libraries and unreviewed bundled voices from the baseline.
- Inventory CHIHAYA V2 original-character weights and a suitable English control. Read bundled terms at the exact revision; document access or compatibility failures. Use LJ Speech training as a fallback when no suitable English checkpoint is available.
- Create ops/reports/voice-toolchain.md and ops/reports/voice-models.md plus a voice asset manifest. Keep weights/recordings out of code distribution unless redistribution terms are explicit; isolate unfamiliar checkpoint loading.

## Acceptance criteria

- [x] A clean isolated environment loads an audited RVC model and converts a local licensed sample.
- [x] Exact builds, all required weights, source links, licenses and hashes are recorded; no closed runtime is needed for the selected configuration.
- [x] At least one character audition candidate is provisioned with explicit weight terms, and the English-control acquisition/training route is concrete.

## Implementation notes

This is implementation work, not completed by the research/design document.

When completing this task, record changed artifacts, exact validation commands/results or manual evidence, and unresolved limitations. Leave unperformed checks unchecked.

## Completion evidence — 2026-09-12

- Installed isolated Python 3.10.19 with 95 hash-locked packages and deiteris RVC source `b9cd071ae2743c146e5d279453a1c0caeb78e854`. [Provisioner](../../../scripts/voice/provision.py), [dependency lock](../../../config/voice/requirements-cpu.lock), [toolchain report](../../reports/voice-toolchain.md), [beginner setup](../../../docs/voice-setup.md).
- Acquired three explicitly MIT-licensed CHIHAYA v2 targets, the separately GPL-3.0 ContentVec ONNX encoder and an official public-domain English input. All original downloads passed SHA-256/size checks. [Asset manifest](../../../config/voice/assets.json), [model/provenance report](../../reports/voice-models.md), [95-package inventory](../../reports/voice-dependencies.json), [127 license/notice hashes](../../reports/voice-license-inventory.json).
- `python scripts/voice/provision.py` created/synced the environment; `uv pip check` passed. `python scripts/voice/convert.py --voice bright`, `--voice soft` and `--voice cool` each exited zero after converting the 8.396644-second local LJ Speech input into 8.3967 seconds of finite, non-silent, unclipped 40 kHz output. The safe derivative retained all 446 tensors per model. [Combined conversion evidence](../../reports/voice-conversion-smoke.json) and local WAV/JSON files under `ops/reports/local/voice/`.
- The adapter binds an upstream no-F0 `use_jit` attribute mismatch without modifying its source checkout. It uses forced weights-only checkpoint reads and a reduced-environment worker with Python network calls denied. No microphone/speaker stream, cloud audio request or A100 access was used. [Audio endpoint enumeration](../../reports/voice-audio-devices.json) found 22 endpoints without opening streams.
- LUNAR target access returned HTTP 401. The [concrete independent LJ Speech training route](../../../docs/voice-setup.md#english-control-fallback) specifies acquisition, split, pure RVC source revision, parameters and later weight audit. Applio stays separate and uninstalled.

Boundary: this closes toolchain/model provisioning and file conversion only. The source client UI, microphone auditions, accepted timbres, streaming acceleration, A100 access, OBS routing and final voice preference remain in TASK-023 through TASK-028. The tested eager CPU conversions took 20.17–31.64 seconds for 8.40 seconds of input, so these results do not pass a live-conversation gate. Standard Windows/native package components remain subject to their retained notices; no Beatrice engine, commercial voice service or proprietary virtual cable is selected.

