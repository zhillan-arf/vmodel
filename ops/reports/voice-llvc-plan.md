# LLVC CPU fallback experiment

2026-09-12. **Initial eager CPU presets missed throughput; a subsequent repeat passed compute deadlines with identical audio, but the timing difference remains unexplained.** LLVC is the bounded CPU fallback already listed in the [voice specification](../specs/voice-conversion-plan.md). Tested RVC configurations miss live deadlines, while the suggested A100 API has no supplied address or established conversion capability. Measurement is coordinated separately from avatar/OBS and receiver tests. No live voice is accepted.

## Reviewed sources

The [KoeAI LLVC repository](https://github.com/KoeAI/LLVC/tree/1627c5d358cf9bb2b92b0ccc513d8b36807c923d) publishes MIT code with an any-to-one streaming model and a pretrained research target. It requires a different checkpoint from the existing RVC presets. Its training workflow uses paired source/teacher-converted speech; no training is part of this probe. Published performance claims are not measurements on this laptop.

The publisher's [pinned checkpoint card](https://huggingface.co/KoeAI/llvc/blob/ebfe8c0fdeb974a7eeb463b3abbc8ce42a0e3851/README.md) declares MIT and separately identifies auxiliary embeddings/F0 origins. The [official model API](https://huggingface.co/api/models/KoeAI/llvc) and [pinned checkpoint listing](https://huggingface.co/api/models/KoeAI/llvc/tree/ebfe8c0fdeb974a7eeb463b3abbc8ce42a0e3851/models/checkpoints/llvc) were read directly because the browser fetch failed. Only `models/checkpoints/llvc/G_500000.pth` is selected: 39,489,146 bytes, SHA-256 `cceb7ab9621f84d62d283725ae3281cacb04f762d6a088fe3e97c1a29d4b8c0e`. No auxiliary embedding, teacher or pitch checkpoint is needed in this LLVC inference path.

The inspected [network](https://raw.githubusercontent.com/KoeAI/LLVC/1627c5d358cf9bb2b92b0ccc513d8b36807c923d/model.py) imports one SpeechBrain positional-encoding class. Provisioning retains the complete source and Apache license at [SpeechBrain v1.0.3's pinned revision](https://github.com/speechbrain/speechbrain/tree/31c1e329048c0380dc7f2acbe680c44a036b6286), extracts that exact class and redirects only its import in a separate runtime copy. No architecture, learned tensor or class implementation is changed. The existing pinned Torch/NumPy/SciPy/soundfile environment supplies the other inference dependencies; the active voice service and its dependency environment are not modified.

## Fixed probe and evidence boundary

[Provisioner](../../scripts/voice/provision_llvc.py) and [probe](../../scripts/voice/probe_llvc.py) keep their source/runtime under `.tools/voice/llvc`, checkpoint under `assets/voice/llvc`, and generated audio under `ops/reports/local/voice/llvc`. These are private experimental files, outside the served avatar, website and voice catalog. Original source and all derived code/artifact hashes are retained. Checkpoint loading uses Torch's `weights_only=True` and strict tensor names; there is no unrestricted-pickle fallback.

The probe executes only the reviewed [upstream streaming function](https://raw.githubusercontent.com/KoeAI/LLVC/1627c5d358cf9bb2b92b0ccc513d8b36807c923d/infer.py), including its buffer, shift, padding and inference-mode behavior. It explicitly sets the model to evaluation mode because the upstream CLI loader omits that step; training dropout would otherwise remain active. A one-second warm-up precedes 30 seconds of repeated licensed English reference input with 250 ms gaps. The upstream function constructs file chunks before the model loop. This is unpaced computation, without physical media, playback, camera, OBS or networking.

The [pinned configuration](https://raw.githubusercontent.com/KoeAI/LLVC/1627c5d358cf9bb2b92b0ccc513d8b36807c923d/experiments/llvc/config.json) uses 16 kHz, `L=16` and 13 decoder frames: factors 1/4/8 correspond to 13/52/104 ms input chunks. Start with factor 4 at one and three CPU threads, sequentially. The owned worker has a 180-second deadline. Compare measured per-block median/p95/p99, compute real-time factor and deadline misses, with load/warm-up outside the interval. Also retain exact input/output hashes, finite samples, output size/level, hardware/runtime information and deterministic buffer-reset comparison. No subjective quality score is inferred from waveform statistics.

The upstream buffer-plus-compute estimate excludes physical input/output, scheduling, routing and acoustic alignment. It will be labeled accordingly rather than reported as measured end-to-end latency. Passing compute would justify an independently tested streaming adapter and audition; it would not accept live G3. This is one research voice, not three distinct timbres or the user's selected cheerful character.

## Execution after the quiet window

```powershell
python scripts/voice/provision_llvc.py
python scripts/voice/probe_llvc.py --threads 1 --chunk-factor 4 --quiet-window
python scripts/voice/probe_llvc.py --threads 3 --chunk-factor 4 --quiet-window
```

Do not run these concurrently with the avatar/OBS soak or receiver browser tests. Preserve failed results; add another chunk factor only if the first comparison identifies a concrete reason. Static parsing and independent source review found no blocking defect.

Provisioning completed during the stopped-soak diagnosis gap: [13-artifact provenance report](voice-llvc-provision.json), exact checkpoint byte count/SHA verified, source and licenses retained. Provisioning itself performed no dependency installation, active service/profile change, Torch import, inference or physical media.

## Initial measured results

Both sequential probes completed after the heartbeat-test browser/server closed and before publisher validation or a new avatar soak. The i7-1255U ran Torch 2.8.0+cpu under isolated Python 3.10.19 with one interop thread and the stated compute threads. Each processed the entire 30-second fixture as 577 blocks, with finite output and exact zero-error deterministic reset checks. No physical media or active Voice Studio/OBS output was used.

| CPU threads | Input chunk | Compute median / p95 | Total conversion wall time | Compute RTF | Blocks above chunk deadline |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 52 ms | 59.84 / 88.78 ms | 36.77 s | 1.222 | 515 / 577 |
| 3 | 52 ms | 63.05 / 84.59 ms | 37.71 s | 1.255 | 567 / 577 |

Raw evidence: [one-thread report](llvc-cpu-1t-factor4.json), [three-thread report](llvc-cpu-3t-factor4.json). Both contain individual compute samples and generated WAV hashes. Thirty-second conversions and first-passage listening files are under `ops/reports/local/voice/llvc`. These are unpaced complete files, not output from a working live stream; English character fit and listening quality remain unaccepted. Increasing threads did not fix throughput in these measurements. The laptop window was then released for the publisher fix and full avatar/OBS retry.

## Compiler gate and exact eager repeat

The [fixed ONNX experiment](voice-llvc-onnx.md) preserved the original network and verified exact functional-wrapper/input-preparation parity. Exported waveform errors stayed below the declared limits, but encoder/decoder state errors during silence exceeded the unchanged recurrent-state limits. The failed graph, fixture and logs are retained. No graph was promoted and no OpenVINO timing ran.

That experiment's upstream eager reference preparation appeared faster than the initial measurements. After its worker and the voice restart test browser closed, the exact one-thread/factor-4 eager probe was repeated with a distinct artifact suffix:

```powershell
python scripts/voice/probe_llvc.py --threads 1 --chunk-factor 4 --run-label post-soak --quiet-window
```

The [repeat report](llvc-cpu-1t-factor4-post-soak.json) records all 577 chunks: median 15.3155 ms, p95 17.4139 ms, maximum 38.9401 ms, zero chunks over the 52 ms compute deadline, compute RTF 0.30079 and total conversion wall time 9.0382 seconds for the 30-second input. The reset check remains exact. An independent [RIFF-chunk comparison](llvc-eager-repeat-audio.json) confirms bit-identical PCM against the initial one-thread output; the WAVs differ only in their PEAK metadata chunk. Earlier reports and WAVs were preserved.

Thread count, input, checkpoint and computation path are unchanged. The speed difference is **not explained** by these measurements; hardware clocks, system load and thermal state were not recorded continuously. This successful unpaced repeat justifies preparing a streaming adapter and checking reproducibility under paced and combined workloads. It does not establish physical latency, speech continuity, user preference or three distinct accepted timbres.

An independent source/report review found the same Torch version, evaluation/inference mode, one intra/inter-op thread, OMP/MKL settings, chunk size and one-second warm-up. Summed timed forward calls account for 36.6729 seconds initially versus 9.0237 seconds in the repeat; all work outside those timers accounts for less than 0.1 seconds in either run. The original slow calls persisted throughout the 577-block sequence. Extra exporter warm-up and logging do not explain the independent repeat. The exporter reference also has the same PCM hash. The next paced adapter check should include process CPU time alongside wall time, with actual thread count, priority and affinity captured outside the timed calls; those observations can distinguish descheduling from increased CPU execution cost without a broad preset sweep.

The subsequent [power-history comparison](capture-power-comparison.md) records `AcOnline=false` at 10:05:43.500 UTC and `AcOnline=true` at 12:03:00.971 UTC, placing a DC-to-AC change between the slow and fast measurements. Current AC/charging, battery-saver-off and Balanced mode are also recorded. This establishes changed conditions, not the CPU-clock, scheduler or thermal cause of the timing difference.

## Isolated online-framing correctness

The [streaming plan](voice-llvc-streaming-plan.md) and experimental [eager adapter](../../scripts/voice/llvc_stream_adapter.py) retain the global 16-sample shift, 32-sample context and all four neural state buffers. The [first file probe](llvc-stream-adapter-eager-v1.json) passed exact equality for all 134,347 source/output samples and all 162 expected calls, including EOF trimming; a reset produced 3,328 matching samples through four fresh calls. Three framing regressions cover boundary lengths, packet divisions, invalid input and reset behavior.

This unpaced adapter check took 2,646.35 ms wall time and 2,546.875 ms process CPU time for the full passage; timed forward calls totaled 2,590.02 / 2,500 ms respectively. Fourteen per-call CPU readings were zero because the Windows timer is coarse, so individual CPU/wall ratios are not interpreted. Start/end snapshots record AC online, 82% battery/charging, battery saver off, one Torch compute/interop thread, five actual process threads, Normal priority and process affinity mask FFF. Reports, logs and compared WAVs are retained. The independent-ingress/output paced proof is next; there is no microphone, served backend, user voice selection or live acceptance from this check.
