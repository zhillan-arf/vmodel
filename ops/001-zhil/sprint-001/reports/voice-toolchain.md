# Voice toolchain: TASK-022

Updated 2026-09-12. The isolated CPU RVC environment is installed and has converted the official LJ Speech test file. This verifies model loading and file conversion. It does not accept microphone tracking, user auditions, live latency, OBS routing or the A100.

## Installed configuration

| Component | Exact selection | Terms / evidence |
| --- | --- | --- |
| Inference source | deiteris/voice-changer `b9cd071ae2743c146e5d279453a1c0caeb78e854` | [MIT source license](https://github.com/deiteris/voice-changer/blob/b9cd071ae2743c146e5d279453a1c0caeb78e854/LICENSE); checkout at `.tools/voice/deiteris` |
| Python | CPython 3.10.19, Windows x64, uv-managed installation | PSF Python license; dedicated `.tools/voice/venv` |
| Generator runtime | torch 2.8.0+cpu, torchaudio 2.8.0+cpu; CPU FP32/eager | BSD licenses; exact official PyTorch wheel URLs and SHA-256 values in the lock |
| Content encoder | `contentvec-f.onnx`, exporter revision `c2f3e4a8884dba0995347dfe24dc0ad40acb9eb7` | **GPL-3.0 for these distributed weights**, explicitly stated by their publisher; [exact notice](https://huggingface.co/wok000/weights_gpl/blob/c2f3e4a8884dba0995347dfe24dc0ad40acb9eb7/README.md) |
| Encoder execution | ONNX Runtime 1.23.2 CPUExecutionProvider, four intra-op threads, one inter-op thread | [MIT license](https://github.com/microsoft/onnxruntime/blob/v1.23.2/LICENSE); no DirectML/CUDA provider selected |
| Targets | CHIHAYA V2 SYAKITTO, HOWATTO, KAKKOII | Explicit creator MIT terms, documented individually in [voice-models](voice-models.md) |
| Audio file processing | NumPy 1.26.4, SciPy 1.15.3, soundfile 0.14.0 | BSD; soundfile's native libsndfile component has LGPL-2.1 terms, with other codec notices retained |
| Device discovery | sounddevice 0.4.7 / PortAudio | MIT-style licenses. Enumeration only; no streams opened |

The [dependency lock](../../../../config/voice/requirements-cpu.lock) pins all **95** installed distributions and archive hashes. Named Python packages are obtained through the public PyPI index; torch/torchaudio use explicit `download.pytorch.org` URLs. [Dependency inventory](voice-dependencies.json) records package metadata, versions and project links. [License inventory](voice-license-inventory.json) hashes **127** installed license/notice files, including native codec notices. llvmlite's metadata omits a license field; its installed `LICENSE` provides BSD redistribution terms, and its `LICENSE.thirdparty` retains LLVM notices. This is not an assertion that every dependency is MIT or that Windows itself is open source.

The [voice asset manifest](../../../../config/voice/assets.json) records every selected weight/input origin, revision, size and SHA-256. The package dependencies also contain inactive torchcrepe 0.0.24 and torchfcpe 0.0.4 estimator weights; their file hashes are enumerated separately. Their project/package MIT notices were read. They are not loaded by the no-F0 configuration. [torchcrepe license](https://github.com/maxrmorrison/torchcrepe/blob/master/LICENSE), [FCPE license](https://github.com/CNChTu/FCPE/blob/main/LICENSE).

There is no separately loaded pretrained generator/discriminator for inference: each target contains its generator tensors. Training checkpoints require their own pin/audit when training begins. The dummy CHIHAYA index is unnecessary at the required zero retrieval ratio. No Beatrice inference library, commercial voice service or proprietary virtual cable is installed by this work. The existing OBS installation will support the separately implemented routing task.

## Client/source comparison

The inspected upstream w-okada revision is `f1caf8e7c39fd0d6866202be27bf142790191a51`; it covers several engines and sample catalogs. deiteris' fork concentrates on RVC and makes its CPU/DirectML limitations explicit. Its newest published binary release during inspection was `b2332`; the Windows DML ZIP was 288,921,773 bytes. That binary was **not** downloaded or benchmarked. The selected, actually tested build is the pinned source plus the local CPU dependency lock, rather than an unverified all-engine executable. [Upstream README](https://github.com/w-okada/voice-changer/blob/f1caf8e7c39fd0d6866202be27bf142790191a51/README_en.md), [fork README](https://github.com/deiteris/voice-changer/blob/b9cd071ae2743c146e5d279453a1c0caeb78e854/README.md).

`scripts/voice/convert.py` is a bounded local-file adapter around the fork's RVC v2 no-F0 generator and ContentVec output. The unmodified fork has an attribute mismatch: its no-F0 loader sets `use_jit_eager`, while `infer` reads `use_jit`. The adapter explicitly binds the intended switch; the checkout remains clean. It does not invoke the upstream server's automatic downloader, sample installer or microphone client. Building/wiring the live client belongs to the subsequent live benchmark and control tasks.

Applio is kept separate. Its inspected source is `7b9f3fa0dde9f90946a5302b4ce4ab3410f12bb8`; it is not installed or required here. The [setup note](../../../../docs/voice-setup.md#english-control-fallback) records its additional official-configuration terms reference and a pure RVC-project training fallback.

## Hardware and validation

The previously verified ASUS ExpertBook B1402CBA / i7-1255U / approximately 16 GB RAM / Iris Xe baseline is retained. Read-only inspection found **63.26 GiB free** before voice provisioning, no existing converter, Python 3.14 as the main interpreter, and usable Git/uv. Realtek and Intel Smart Sound devices report OK. [Audio endpoint inventory](voice-audio-devices.json) lists **22** endpoints across Windows audio APIs; it records enumeration, not microphone quality or successful routing.

Executed commands:

```powershell
uv pip compile config/voice/requirements-cpu.in --python .tools/voice/venv/Scripts/python.exe --generate-hashes --output-file config/voice/requirements-cpu.lock
python scripts/voice/provision.py
python scripts/voice/convert.py --voice bright
python scripts/voice/convert.py --voice soft
python scripts/voice/convert.py --voice cool
```

The environment was created empty and synced from the hash lock. `uv pip check` reported all 95 installed packages compatible. All six selected asset downloads passed size/hash verification. The bright conversion produced finite, non-silent 40 kHz mono audio from the 8.396644-second licensed English input; output duration was 8.3967 seconds, RMS 0.09991, peak 0.72660, clipped fraction zero. The [machine-readable result](local/voice/converted-bright.json) records hashes and the [actual WAV](local/voice/converted-bright.wav).

All three targets now pass that functional check. Soft produced RMS 0.10329 / peak 0.71608, cool RMS 0.10334 / peak 0.78302; both produced the same expected 8.3967-second duration with finite audio and zero clipped samples. [Soft evidence](local/voice/converted-soft.json), [cool evidence](local/voice/converted-cool.json), and the [combined retained report](voice-conversion-smoke.json) record distinct target/output hashes. No listening rating is inferred from those numerical differences. Re-running `provision.py --assets-only` verified every original input remained unchanged. Free disk space after provisioning was approximately 57.45 GiB.

That first successful eager CPU run took **31.64 seconds of inference for 8.40 seconds of audio** (real-time factor 3.77). Concurrent avatar/render work was running elsewhere in the project, so this is an uncontrolled functional check with model context, not a fair quiet-laptop benchmark or microphone-to-output latency test. It does not establish a live preset; TASK-024 must compare optimized/streaming configurations under controlled quiet and combined workloads. No cloud inference or user audio transmission occurred.

Checkpoint loading runs in a separate process with reduced environment variables, `weights_only=True`, forced weights-only loading, verified tensor-only derivatives and Python socket calls denied. Original target bytes are unchanged. This reduces accidental execution/network exposure without claiming an OS sandbox. User recordings and the avatar source are not inputs to the check.

## Remaining delivery work

TASK-023 owns user recordings, listening scores, meaningful timbre comparisons and preferred-voice selection. TASK-024 owns streaming/combined-workload measurements and backend choice. TASK-025/TASK-026 own routing, explicit mute/bypass, live controls and startup. A100 access details and subjective auditions remain unknown; they do not block this local setup. The exact English-control acquisition/training route and LUNAR's recorded HTTP 401 are in [voice-models](voice-models.md).

The user subsequently clarified the A100 access is likely a vLLM API at an internal IP reached through the laptop VPN. No address or served model has been supplied. Record this as tentative API-only access: it does not establish a deployable RVC GPU, an audio-conversion endpoint or training access. TASK-024 must inspect the supplied endpoint/model or obtain a separate supported RVC service; no internal-network scanning was performed.

## Subsequent isolated LLVC contingency

The [LLVC provisioner](../../../../scripts/voice/provision_llvc.py) subsequently retained pinned KoeAI MIT source and its 39,489,146-byte research checkpoint, plus SpeechBrain v1.0.3's Apache-2.0 positional-encoding source/license. The [13-artifact inventory](voice-llvc-provision.json) records exact revisions and hashes. A separate runtime copy redirects only that dependency import; original upstream files remain intact. It uses the existing CPU environment without adding packages or changing the active Voice Studio catalog, profiles or service.

Initial one- and three-thread, 52 ms chunk probes both missed incoming throughput. The [compiler comparison](voice-llvc-onnx.md) subsequently failed its recurrent-state parity gate; no graph was promoted or OpenVINO timing run. An exact eager repeat then processed all 577 chunks within their compute deadlines, with bit-identical audio to the original one-thread run. [LLVC measurements](voice-llvc-plan.md) preserve all results and the unexplained timing difference. This is one research voice, with no listening, three-timbre or live acceptance; paced and combined-workload reproducibility remain open.
