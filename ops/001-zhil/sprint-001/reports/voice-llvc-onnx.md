# LLVC fixed ONNX attempt: recurrent-state parity failed

2026-09-12. **The bounded compiler path is not accepted.** The fixed-shape ONNX graph was created, but encoder/decoder state errors exceeded the recorded numerical limits. The exporter stopped before promoting a passing manifest. The dependent OpenVINO CPU timing probe did not run. This does not establish a hardware-acceleration result or accept live voice conversion.

The attempt ran only after the avatar/OBS and voice restart/browser checks released their window. It used the existing isolated Python 3.10.19, Torch 2.8.0+cpu and ONNX Runtime 1.23.2 on the Intel i7-1255U, with one compute and one interop thread. The owned worker exited after 24.36 seconds, below its 180-second cap; it is closed. No source, learned weight, active service, catalog or route was changed.

Evidence: [raw failed export](voice-llvc-onnx-export.json), [retained per-run report](local/voice/llvc-onnx/20260912T123054Z-2852/report.json), [worker log](local/voice/llvc-onnx/20260912T123054Z-2852/worker.log), [artifact hash inventory](voice-llvc-onnx-attempt-artifacts.json), [unchanged experiment plan](voice-llvc-onnx-plan.md).

## What passed

- The checked source/model/runtime hashes and strict evaluation-mode checkpoint load matched the previously reviewed pins. Learned-state fingerprint checks found no mutation.
- The functional wrapper matched the unchanged eager network exactly for waveform and all four recurrent outputs; cloned caller inputs/states remained unchanged.
- The independently assembled pad/shift/context sequence matched actual upstream `infer_stream` exactly, including the final partial block's 17 padded samples.
- Graph export, full ONNX validation, and all five explicit float32 input/output shape checks passed. The fixed graph emits 832 samples per call (52 ms), with all four recurrent states exposed.
- All 80 ONNX parity blocks and the reset repetition completed with finite outputs. The converted waveform remained within its numerical gate.

## What failed

The fixture has 64 speech blocks followed by 16 silence blocks, with partial EOF padding in the last block. Each runtime feeds back its own outputs as its next recurrent states; eager states are not injected into the ONNX chain.

| Output | Maximum absolute difference | Worst-block RMSE | Required max / RMSE | Result |
| --- | ---: | ---: | ---: | --- |
| Converted waveform | 0.000007492 | 0.000001475 | 0.0001 / 0.00001 | Pass |
| Encoder state | 0.001379251 | 0.000022119 | 0.0005 / 0.00005 | **Fail: maximum error** |
| Decoder state | 0.005023956 | 0.000096000 | 0.0005 / 0.00005 | **Fail: both limits** |
| Output state | 0.000002950 | 0.000000073 | 0.0005 / 0.00005 | Pass |
| Prenet state | 0.000000104 | 0.000000044 | 0.0005 / 0.00005 | Pass |

The first failing state comparisons are at zero-based block 66, during silence. Repeating from zero state produces the same recorded error maxima and first failures. The cause has not been established. Close waveform agreement does not override the separate recurrent-state gate, particularly for a future long-running stream. No thresholds were loosened and no alternate precision/device was tried.

## Retained artifacts and next boundary

The failed attempt retains its 14,002,839-byte ONNX graph and 94,077,608-byte reference fixture under `assets/voice/llvc/onnx-factor4-v1/runs/20260912T123054Z-2852/`. Their hashes, source/weight hashes, script hashes and immutable failure/log hashes are in the inventory. No `assets/voice/llvc/onnx-factor4-v1/manifest.json` was promoted. The CPU probe refuses to run without the matching current successful export report and manifest.

The full 30-second eager waveform was generated as a numerical reference, not as a new timed eager benchmark. There is no OpenVINO timing, deadline-miss count, wall RTF or physical-latency result from this attempt. The earlier eager results retain their own scope. Any investigation of numerical drift or an alternative eager chunk size is a separate coordinated experiment; it must preserve this failed evidence and the original acceptance limits. Listening quality, cheerful character fit, three distinct timbres and live G3 remain unaccepted.
