# Voice performance: bounded CPU and ONNX probes

Updated 2026-09-12. **No live preset is accepted.** Three paced local CPU configurations failed their 160 ms block deadlines. TASK-024 remains In progress: physical microphone-to-output latency, combined Ene/OBS load, audible quality, thermal behavior and remote capability have not been measured.

## What was measured

The existing i7-1255U / approximately 16 GB RAM / Iris Xe laptop ran the pinned CHIHAYA bright no-F0 target with deiteris RVC source `b9cd071ae2743c146e5d279453a1c0caeb78e854`, PyTorch 2.8.0+cpu and ONNX Runtime 1.23.2 **CPUExecutionProvider**. No DirectML, CUDA, microphone, speaker, audio driver or remote connection was used.

The web-render worker paused Blender during these measurements and the parent avoided heavy recording/render benchmarks. Before each interval, a two-second sample measured approximately **10.8–11.3% system CPU activity**. This is a coordinated window without project Blender renders, not a claim that Windows and every user application were idle. The earlier full-file conversion ran during other rendering and is not the comparison baseline here.

The [preset file](../../config/voice/benchmark-presets.json) fixes 48 kHz simulated device audio, **160 ms chunks**, **1,600 ms past context**, **40 ms crossfade** and **10 ms SOLA search**. The licensed LJ Speech source is replayed with a 250 ms silence between repeats; its original bytes and hash are preserved. The adapter follows the pinned source's rolling input window, feature upsampling, generator skip/return lengths and SOLA overlap behavior. It does not apply the source client's extra input-volume scaling or claim to be the complete live client. [RVC buffer/inference source](https://github.com/deiteris/voice-changer/blob/b9cd071ae2743c146e5d279453a1c0caeb78e854/server/voice_changer/RVC/RVCr2.py), [SOLA source](https://github.com/deiteris/voice-changer/blob/b9cd071ae2743c146e5d279453a1c0caeb78e854/server/voice_changer/VoiceChangerV2.py).

Each process warms up on ten chunks, then replays a nominal 30-second interval: 187 full chunks / 29.92 seconds of scheduled input. The input mailbox holds only the newest completed block. Older waiting blocks are counted as dropped, discontinuous context is flushed, and results later than the next 160 ms deadline are muted in the deadline-output WAV. There is no unconverted fallback or stale audio replay.

## Results

| Configuration | Compute p50 / p95 | Compute real-time factor | Processed / dropped input blocks | Late processed blocks | Average system CPU |
| --- | ---: | ---: | ---: | ---: | ---: |
| FP32 encoder + eager generator, 4 threads | 489.7 / 963.5 ms | 3.58 | 54 / 133 | 54 / 54 | 58.8% |
| int8 encoder + eager generator, 3 threads | 418.3 / 578.2 ms | 2.89 | 66 / 121 | 66 / 66 | 38.5% |
| int8 encoder + eager generator, 1 thread | 602.0 / 700.4 ms | 3.79 | 51 / 136 | 51 / 51 | 15.8% |

The three-thread int8 configuration was the best of these candidates, but still slower than the incoming audio. **All three deadline-output files are silent by design because every computed block missed its deadline.** The computed-output files retain the late results at their source block positions for diagnosis, with zeros at skipped positions. They are not playable live presets or accepted audition material.

Synthetic timestamps from the first sample of a capture block to conversion readiness had p95 values of **1,234.8 ms**, **858.8 ms** and **993.2 ms**, respectively. These include simulated capture-block collection, queue wait and computation. They exclude real device buffers, playback/routing and acoustic/phonetic alignment, so they must not be presented as measured end-to-end voice latency or lip sync. The tested configurations already miss the proposed 350 ms gate before those missing components are added.

All saved numeric outputs are finite, and all report hashes, scheduled/processed/dropped totals and 48 kHz WAV durations were independently checked. [Full retained results with per-block timing](voice-performance.json). Individual reports and computed/deadline WAVs are in `ops/reports/local/voice/benchmarks/`.

## Optimizations and compatibility

The int8 ContentVec derivative uses the exact fork's supported CPU quantizer: MatMul/Attention weights, per-channel QInt8, reduced range and the recorded quantization options. It reduced encoder size from 378,550,151 to **122,943,199 bytes**; derivative SHA-256 is `74f5b8eb4068060bbc047509f76e52b3baf8a9aac6b5e9daebdf2193c8716023`. The original encoder is unchanged. The derivative retains the original exported-weight GPL-3.0 provenance. No int8 subjective-quality acceptance is inferred. [Pinned quantizer](https://github.com/deiteris/voice-changer/blob/b9cd071ae2743c146e5d279453a1c0caeb78e854/server/voice_changer/common/OnnxLoader.py).

The source-advertised TorchScript JIT path was attempted and failed for the no-F0 generator. First, `TextEncoder` lacks `emb_pitch`; a bounded in-memory unused-zero-embedding probe moved compilation to a second failure, variable `ModuleList` indexing in `Generator.forward`. No JIT preset, source patch or modified target weights were accepted. The final benchmark uses eager generators and records these compatibility failures in the preset/results manifests. [Pinned generator source](https://github.com/deiteris/voice-changer/blob/b9cd071ae2743c146e5d279453a1c0caeb78e854/server/voice_changer/RVC/inferencer/rvc_models/infer_pack/models.py).

The three paced configurations remain rejected; they do not prove that every RVC implementation or optimized backend must fail on this laptop. Reducing model context or increasing chunk size requires renewed quality and delay checks; no quality waiver or multi-second conversational preset was adopted. LLVC remains unmeasured at this checkpoint.

## Fixed full-generator ONNX follow-up

A bounded fixed-shape exporter now uses the verified original no-F0 generator submodules at the same 160 ms / 1.6 s context configuration. Inspection found that the fork's generic exporter selects an F0 class for the no-F0 model, while its alternative no-F0 ONNX class also instantiates the NSF/F0 decoder. The project adapter avoids those incompatible choices without editing upstream source or target weights. It promotes the existing random latent noise to an explicit input for reproducible comparison and translates the source's `tanh(x, out=x)` to functional ONNX Tanh. The adapter matched original eager inference **exactly** on the real-speech fixture. Fixed input dimensions enforce its limited streaming shape; this is not a generic model interchange export. [Exporter](../../scripts/voice/export_onnx.py), [architecture/source inspection and hashes](voice-onnx-export.json), [pinned upstream exporter](https://github.com/deiteris/voice-changer/blob/b9cd071ae2743c146e5d279453a1c0caeb78e854/server/voice_changer/RVC/onnx_exporter/export2onnx.py).

The resulting FP32 generator is 110,192,832 bytes, SHA-256 `92a6f3251cc366bb43ccf1773fbc3becbb2b7a68b4bcbad8e2e27d4cc4bd881f`; the fixed-dimension encoder preserves its original arithmetic/weights and GPL-3.0 terms. The original target and encoder remain unchanged. The target derivative retains its MIT provenance.

Using the baseline CPU ONNX Runtime, one warmup and **five repeated real-speech-window conversions** measured median/p95 compute **327.5 / 355.1 ms**, encoder **156.8 / 177.0 ms**, generator **161.6 / 196.2 ms**, and compute real-time factor **2.08** against each 160 ms incoming block. The complete pipeline differed from the eager reference by at most **2.45e-6** in waveform amplitude; the generator alone differed by at most **2.68e-6**. Runtime profiles show CPU node execution for both graphs. The actual 210 ms output WAV includes the block and its overlaps. [CPU evidence](voice-onnx-cpu.json).

This short probe used the coordinated render-free window with profiling enabled. It repeats one fixture and excludes resampling, SOLA, scheduling, audio devices, combined avatar/OBS load and a speech-quality review. These five observations do not estimate sustained production p95 or physical end-to-end latency. Even their measured compute rate is slower than live arrival, so no CPU ONNX live preset is accepted.

The optional DirectML environment installed separately with 15 hash-locked packages, leaving the 95-package baseline untouched. ONNX Runtime 1.23.0 advertises `DmlExecutionProvider`; the probe requested device 0, sequential execution and disabled memory patterns as required by the [official provider documentation](https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html). Encoder session construction returned after approximately 168 seconds and generator construction began, but **no full conversion completed within approximately four minutes**. Only the verified probe process tree was terminated to release the shared measurement window. There is no completed node profile proving model GPU execution and no GPU speed or compatibility verdict. A longer compile budget might complete; this was a bounded preparation failure. [DirectML attempt](voice-onnx-directml.json).

The ONNX Runtime provider code is MIT, but its bundled **DirectML 1.15.4 Windows/Xbox redistributable has separate Microsoft Software License Terms**, including platform and source/reverse-engineering restrictions. It must not be labeled MIT or accepted as a wholly open-source inference dependency. It remains an optional platform-acceleration experiment; the CPU baseline is unchanged. The exact DLL hash, 15 installed distributions and 30 retained notice files are in the [environment inventory](voice-onnx-environment.json). [Official DirectML package terms](https://www.nuget.org/packages/Microsoft.AI.DirectML/1.15.4/License).

To reproduce the bounded follow-up:

```powershell
python scripts/voice/export_onnx.py
python scripts/voice/probe_onnx.py --provider cpu
python scripts/voice/provision_onnx.py
python scripts/voice/probe_onnx.py --provider directml
```

The [probe](../../scripts/voice/probe_onnx.py) requires same-artifact CPU parity before DirectML and limits each process tree to 240 seconds. Model assets, fixtures, WAVs and native profiles remain private local artifacts; the listening room serves none of the model files. This probe does not capture microphone audio or route sound to OBS.

## OpenVINO CPU and Intel GPU follow-up

The separate OpenVINO **2026.3.1** environment runs the same fixed ONNX graphs through explicit CPU or Intel Iris Xe GPU selection. It does not use automatic device fallback. The eight-package hash lock includes the later SciPy addition for continuous context experiments; CPU/GPU runtime, ONNX frontend and six selected native binaries are recorded with 20 retained notice files. The selected OpenVINO components are Apache-2.0 with bundled third-party notices; Windows and the existing Intel hardware driver remain platform dependencies. No NPU component was selected. OpenVINO import initializes telemetry, so the worker writes the supported opt-out file into its isolated `LOCALAPPDATA` before import and also denies Python socket connections. [Environment inventory](voice-openvino-environment.json), [OpenVINO license](https://github.com/openvinotoolkit/openvino/blob/master/LICENSE).

Each device probe uses one warmup and five repeated real-speech windows, one stream and explicit FP32 precision. CPU uses three threads. These are short profiled functional comparisons with the same limitations as the ONNX probe above.

| OpenVINO configuration | Compute p50 / p95 | RTF | Generator / complete-pipeline peak error vs eager | Result |
| --- | ---: | ---: | ---: | --- |
| CPU FP32 | 317.8 / 382.3 ms | 2.13 | 2.16e-6 / 1.35e-5 | Numerical parity passed; compute slower than arrival |
| Iris Xe GPU FP32 | 219.4 / 222.1 ms | 1.36 | 0.167685 / 0.167690 | Numerical parity failed; quality unaccepted |
| Iris Xe GPU FP32, accuracy hint + Winograd disabled | 206.9 / 215.1 ms | 1.30 | 0.167685 / 0.167690 | Numerical parity still failed; quality unaccepted |

Actual GPU execution is supported by compiled device `GPU.0` plus retained OpenCL kernel profiles for both encoder and generator. Initial session preparation completed in about **10 seconds**, compared with the earlier DirectML timeout. The documented accuracy/Winograd option did not resolve the output difference. No upstream source patch or precision waiver was adopted. [CPU result](voice-openvino-cpu-f32.json), [GPU result](voice-openvino-gpu-f32.json), [GPU accuracy result](voice-openvino-gpu-f32-accuracy.json), [official GPU configuration guidance](https://docs.openvino.ai/2026/openvino-workflow/running-inference/inference-devices-and-modes/gpu-device.html).

The GPU WAVs are retained. On this 210 ms fixture, their RMS is **0.03381** versus **0.04590** for the eager reference, waveform correlation is **0.6314**, and Hann-window spectral convergence error is **0.5348**. The best correlation within a +/-2.5 ms alignment search occurs at zero shift. Both GPU settings produce identical saved PCM output. These diagnostics establish a substantial numerical difference; they do **not** prove audible failure, intelligibility loss or unusable timbre. Listening remains unperformed and the GPU path is not selected. [Amplitude/correlation/spectral diagnostics and WAV hashes](voice-probe-audio-comparison.json).

Reproduction:

```powershell
python scripts/voice/provision_openvino.py
python scripts/voice/probe_openvino.py --device CPU
python scripts/voice/probe_openvino.py --device GPU
python scripts/voice/probe_openvino.py --device GPU --accuracy
.tools/voice/venv/Scripts/python.exe -I scripts/voice/analyze_probe_audio.py
```

The [OpenVINO probe](../../scripts/voice/probe_openvino.py) limits each owned process tree to 180 seconds and saves failed numerical results before returning an error. A nonzero GPU command exit here means its comparison gate failed, not that GPU kernels failed to execute.

### Context overhead and sound-review boundary

At 160 ms chunks with 1.6 seconds of past context and 50 ms overlap/search, each step re-encodes a **1.81 second input window**. The generator predicts 210 ms including overlap. Its flow operates on the last 45 feature frames regardless of whether the tested past context is 0.4, 0.8 or 1.6 seconds. Shortening context reduces encoder and prior-network work but does not remove the waveform decoder's cost. In the retained CPU generator profile, nodes explicitly named under the decoder accounted for about **122 ms**, with additional unattributed graph nodes; this is an observation from that profiled fixture, not a latency lower bound for every implementation.

The current encoder exports complete-window bidirectional features, not a reusable streaming state. Reusing previously computed final features would change inference because the attention input/window changes each step; no equivalence-preserving cache has been established. Compiler caching only reduces startup. [Pinned RVC window allocation](https://github.com/deiteris/voice-changer/blob/b9cd071ae2743c146e5d279453a1c0caeb78e854/server/voice_changer/RVC/RVCr2.py), [attention implementation](https://github.com/deiteris/voice-changer/blob/b9cd071ae2743c146e5d279453a1c0caeb78e854/server/voice_changer/RVC/inferencer/rvc_models/infer_pack/attentions.py).

The target creator's retained instructions recommend an input **CHUNK near two seconds** for clean speech. That is not evidence that 1.6 seconds of past context with 160 ms chunks has equivalent quality. Shorter-context quality and actual conversation delay require their own evidence.

## Complete English context comparison

The same original English passage has now been converted continuously with **1,600 / 800 / 400 ms past context**, fixed 160 ms chunks, 40 ms crossfade, 10 ms SOLA search and the same explicit seeded noise sequence. The new fixed-shape graph exports exactly match their original eager adapters; OpenVINO CPU fixture errors are at most **1.42e-5**. No weights, architecture, F0 mode or retrieval settings changed. Encoder windows are respectively 1.81 / 1.01 / 0.61 seconds long.

Each run warmed up for ten chunks, reset startup context to silence, then converted the complete approximately 8.40 s source. Its last block is padded with approximately 83 ms of silence, preserving the final word and producing **53 blocks / 8.48 seconds** at 40 kHz. The conversions are deliberately **unpaced** so every input block appears in the sound-review file even when computation is late. No dropouts or physical deadlines are claimed from this experiment. All three run sequentially through OpenVINO CPU FP32, three threads and one stream during a window released by the avatar/render/capture workers. No thermal/frequency or whole-system utilization acceptance was collected.

| Past context | Compute p50 / p95 | Compute RTF | Blocks with compute >160 ms | Normalized join jump p95 |
| --- | ---: | ---: | ---: | ---: |
| 1,600 ms | 523.0 / 635.5 ms | 3.37 | 53 / 53 | 1.81 |
| 800 ms | 367.8 / 393.3 ms | 2.25 | 53 / 53 | 1.79 |
| 400 ms | 305.1 / 411.0 ms | 1.83 | 53 / 53 | 2.08 |

Shorter history reduced average compute in this experiment, but **none of these variants processes incoming audio quickly enough**. The changing-window, complete-file workload includes SOLA and differs from the earlier five-repeat profiled fixture. Do not attribute the difference between those separate phases solely to model context or treat either as a combined-workload latency result. Per-stage durations are retained, and the shorter median/p95 differences are observations from these 53 blocks rather than sustained percentiles.

The join statistic measures the adjacent-sample jump at each 160 ms boundary divided by RMS adjacent differences in the surrounding 10 ms, excluding that join. It is a diagnostic for discontinuities, **not an audibility, word-clarity or speech-quality threshold**. All samples are finite and output lengths, block counts and hashes were checked. [1,600 ms report](voice-context1600.json), [800 ms report](voice-context800.json), [400 ms report](voice-context400.json).

For human review, open the local [speech comparison page](../../assets/voice/auditions/context-v1/review.html). It contains the source and three generated clips with RMS matched to 0.07 and shared peak headroom, without dynamic compression. The full passage and final padding are the same. These are experimental versions of the bright voice, separate from the three-timbre choice in the running 5081 listening room. Clarity, naturalness and preference remain unaccepted. [Listening manifest with exact raw/review WAV hashes](voice-context-comparison.json).

Reproduction after the existing voice/ONNX/OpenVINO setup:

```powershell
python scripts/voice/export_onnx.py --context-ms 800
python scripts/voice/export_onnx.py --context-ms 400
python scripts/voice/compare_contexts.py --context-ms 1600
python scripts/voice/compare_contexts.py --context-ms 800
python scripts/voice/compare_contexts.py --context-ms 400
.tools/voice/openvino-venv/Scripts/python.exe -I scripts/voice/summarize_contexts.py
```

The [continuous converter](../../scripts/voice/compare_contexts.py) holds the relevant audio settings constant and enforces a bounded worker lifetime. The [review builder](../../scripts/voice/summarize_contexts.py) checks matching source hashes, durations, block accounting and output values before writing the four level-matched WAVs and local HTML. The existing audition server remains unchanged and no microphone or network conversion is involved.

## Reproduce

After the existing voice provisioner has completed:

```powershell
python scripts/voice/benchmark.py --preset cpu-q8-eager-3t --prepare-only
python scripts/voice/benchmark.py --preset cpu-fp32-eager-4t
python scripts/voice/benchmark.py --preset cpu-q8-eager-3t
python scripts/voice/benchmark.py --preset cpu-q8-eager-1t
```

Run configurations sequentially, and coordinate a render-free interval before comparing them. The [script](../../scripts/voice/benchmark.py) validates original model/source hashes and the unmodified engine revision, runs in a reduced-environment worker, denies Python socket connections and records actual encoder/provider hashes. Warmup and preparation are outside the measured intervals. There is no microphone-device access.

## Remaining decisions

The user currently describes likely **vLLM API access at an internal IP through the laptop VPN**. No address, served model or endpoint description has been supplied. This is tentative API access, not verified SSH/admin access, a deployable RVC service or a training allocation. A chat-completions endpoint is not assumed to support RVC. Inspect only a specifically supplied endpoint/model or obtain an appropriate separate service; no internal network scan occurred.

TASK-003 and OBS integration remain prerequisites for the combined-workload verdict. TASK-024 still needs a viable supported streaming backend, same-clock physical audio delay/jitter measurements, five-minute audible speech testing, memory/thermal/long-session evidence and either measured remote operation or a proven local pass making it unnecessary. The avatar and reference listening-room servers remain independent and local; no accepted live-voice backend has been selected.
