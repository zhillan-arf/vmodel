# Prepared fixed-shape LLVC ONNX / OpenVINO CPU experiment

2026-09-12. **The first export attempt ran and failed recurrent-state parity; OpenVINO did not run.** The [measured attempt report](voice-llvc-onnx.md) and [raw failure](voice-llvc-onnx-export.json) retain the result. This is a bounded TASK-024 follow-up to the [eager LLVC results](voice-llvc-plan.md), whose 52 ms one/three-thread presets had compute RTF 1.222/1.255. Existing environments and the provisioned research checkpoint are reused. The active Voice Studio, presets, catalog and audio/OBS routes remain unchanged.

Execution waited for the avatar/OBS soak **and the subsequent voice restart/browser checks** to finish, followed by the explicit coordinated quiet-window release. Preparation used only source reads/static parsing. The first attempt then ran in its owned worker and stopped at the prescribed numerical gate; its worker closed and the compute window was released. Further numerical investigation needs a new coordinated window. The planned gates below remain unchanged.

## Scripts and ownership

- [Exporter](../../scripts/voice/export_llvc_onnx.py) runs only in the existing `.tools/voice/venv/Scripts/python.exe`, with its installed CPU Torch/ONNX/ONNX Runtime packages.
- [CPU comparison](../../scripts/voice/probe_llvc_openvino.py) runs only in `.tools/voice/openvino-venv/Scripts/python.exe`, with the existing OpenVINO 2026.3.1 environment. It does not import Torch or select GPU/DirectML/AUTO/HETERO.
- [Shared helpers](../../scripts/voice/llvc_onnx_common.py) import the standard library only at module load. Numerical/runtime imports are deferred until explicit worker execution.

Each launcher requires `--quiet-window`, starts a hidden owned worker with Python isolated mode, a restricted inherited environment and a private working directory, and enforces a 180-second worker deadline. It can terminate only its own worker tree. OpenVINO telemetry consent is declined in that worker's private `LOCALAPPDATA` before import; Python socket connections are denied. No automatic setup, fallback engine, training or live integration is included.

The provisioned [source/checkpoint manifest](voice-llvc-provision.json) is checked before every run. Source revision `1627c5d358cf9bb2b92b0ccc513d8b36807c923d`, model revision `ebfe8c0fdeb974a7eeb463b3abbc8ce42a0e3851`, and checkpoint SHA-256 `cceb7ab9621f84d62d283725ae3281cacb04f762d6a088fe3e97c1a29d4b8c0e` must match. All source, minimal runtime, license and checkpoint hashes are rechecked. Original learned tensors, source files and source manifest are preserved. The [earlier LLVC provenance review](voice-llvc-plan.md) retains the MIT source/model declaration and exact Apache-licensed SpeechBrain positional-encoding extraction.

## Fixed recurrent interface

Only factor 4 at 16 kHz is in scope. It emits 832 samples per step (52 ms). The waveform input includes the same 32-sample preceding context as the pinned upstream `infer_stream`.

| Value | Input shape | Output shape |
| --- | --- | --- |
| Waveform | `[1, 1, 864]` | `[1, 1, 832]` |
| Encoder state | `[1, 512, 510]` | `[1, 512, 510]` |
| Decoder state | `[1, 2, 13, 256]` | `[1, 2, 13, 256]` |
| Output state | `[1, 512, 4]` | `[1, 512, 4]` |
| Prenet state | `[1, 1, 24]` | `[1, 1, 24]` |

All inputs/outputs are explicit float32 tensors. The wrapper calls the original `Net` with `pad=False`, matching the reviewed lookahead path. It clones every supplied waveform/state before calling upstream because upstream updates recurrent buffers in place. Export uses independent cloned inputs captured during real speech, and checks that the caller's state has not been mutated. A fingerprint of every learned tensor/model buffer must remain identical after reference generation and export. No layer replacement, quantization, precision reduction or trained-weight modification is included.

The ONNX graph uses the installed legacy exporter at opset 17 with static inputs. Shape inference and full ONNX checking must preserve all five input/output names, float32 types and exact dimensions. Unsupported operators or failed shape checks produce retained failure evidence; the scripts do not silently replace architecture or weaken validation.

## Numerical gates before performance

The exporter verifies the licensed cached English input and resamples it to 16 kHz using the existing SciPy environment. Its parity fixture contains 64 complete speech blocks and 16 silence blocks, with the final silence block shortened by 17 samples to exercise EOF padding. A separate full 30-second input repeats the complete reference with 250 ms gaps, matching the prior eager probe's pattern.

1. Compare the cloned-input wrapper with the unchanged eager `Net` at every waveform **and all four recurrent outputs**, using independently evolving state chains. Require waveform/state max absolute difference at most `1e-6` and RMSE at most `1e-7`.
2. Compare the fixture's pad/shift/context and concatenated eager output with the actual AST-extracted pinned `infer_stream`, including its L-sample shift and EOF handling. Require the same tight adapter limits.
3. Generate the complete 30-second eager waveform reference through that actual upstream function; this is reference generation, not a new eager performance claim.
4. Validate the ONNX graph using **CPUExecutionProvider only** over all 80 blocks, feeding back the ONNX runtime's own states. Repeat from zero state. No eager state is injected after the reset.
5. After export passes, OpenVINO must compile explicitly for **CPU, FP32, one stream**, with accuracy/latency settings and the requested thread count recorded. Its same 80-block free-running waveform/state check must pass **before** the timing interval. After timing it repeats from zero state again, so previous measured history cannot contaminate a fresh stream.

Predetermined cross-runtime FP32 limits are waveform maximum absolute error `1e-4` / RMSE `1e-5`, and each recurrent state's maximum absolute error `5e-4` / RMSE `5e-5`, checked at every block. The full 30-second OpenVINO waveform must also satisfy the waveform limits against the complete eager reference. Shapes and finite values are checked. First failing block/output and worst errors are retained. **Do not loosen these limits to manufacture a pass**; investigate any observed export or parity failure first. Numerical equivalence alone is not listening-quality or character-fit acceptance.

## Bounded CPU measurement

Start with one CPU thread, matching the better initial eager preset. Three-thread support is prepared for a separately justified follow-up; it is not an automatic extra benchmark. The graph shape remains factor 4 in either case.

Warm-up consumes 20 complete blocks (1.04 seconds), then restores all four zero states. The measured sequence consumes all 480,000 input samples as 577 blocks, including 64 samples of final padding that are trimmed from saved output. Record every per-call elapsed time, min/median/p95/p99/max, mean compute RTF, full conversion wall time/RTF and **all blocks exceeding 52 ms**. Per-call time includes synchronous OpenVINO inference and owned output/state copies, with profiling enabled. Wall time additionally includes finite-state checks and occasional progress writes. Preparation/compilation/warm-up are outside that interval.

The graph has explicit CPU execution and float32 IO checks, captures actual executed-operation profiling, and rejects unexpected reduced-precision kernels. CPU, OS, Python, OpenVINO/NumPy versions, source/weight/export/script hashes, exact shapes, settings and complete output WAV metadata are retained. There is no automatic device fallback.

All chunks are prepared before the unpaced loop. This measures compute under a quiet laptop workload; it does not measure packet arrival, physical input/output, scheduling, audio queues, routing, acoustic alignment or a combined avatar workload. The buffer-plus-compute estimate is labeled as an estimate. A mean compute RTF below 1 still requires inspection of deadline misses and wall RTF; it could justify an independently tested streaming adapter and audition, **never live acceptance by itself**. This remains one unselected research voice, with `liveAccepted` and `qualityAccepted` false.

## Commands after coordinated release

```powershell
python scripts/voice/export_llvc_onnx.py --quiet-window
```

Inspect the resulting export report first. Only if its current numerical/shape gates pass:

```powershell
python scripts/voice/probe_llvc_openvino.py --threads 1 --quiet-window
```

Run sequentially. If a three-thread comparison becomes justified by those results, the same probe accepts `--threads 3`; do not run both concurrently. Factor 8 eager experimentation remains a separate root-owned decision.

## Output paths and first-attempt state

- `assets/voice/llvc/onnx-factor4-v1/runs/<run-id>/model.onnx`, `fixture.npz` and `manifest.json`: private fixed graph, numerical references and exact provenance. The failed run `20260912T123054Z-2852` contains its 14,002,839-byte graph and 94,077,608-byte fixture, but no passing manifest. The state-rich fixture is not served to browsers or committed as application code.
- `assets/voice/llvc/onnx-factor4-v1/manifest.json`: promoted only after export plus ONNX CPU waveform/state/reset parity pass. The CPU probe also requires the latest export attempt to be successful with this same run ID; an older manifest cannot hide a newer failed attempt.
- `ops/reports/voice-llvc-onnx-export.json`: actual failed attempt. `ops/reports/voice-llvc-openvino-cpu-1t-factor4.json` remains a planned result because the OpenVINO probe was correctly skipped.
- `ops/reports/local/voice/llvc-onnx/<run-id>/report.json`, `worker.log` and, for a completed conversion, `converted-30s.wav`: per-run retained diagnostics. Failed runs are preserved separately.

The first attempt produced a structurally valid fixed graph and waveform parity, but encoder/decoder state errors exceeded the predetermined limits during silence and repeated from reset. No manifest was promoted, no threshold was relaxed and no acceleration/live claim is made. See the [artifact hashes](voice-llvc-onnx-attempt-artifacts.json) and [measured report](voice-llvc-onnx.md).
