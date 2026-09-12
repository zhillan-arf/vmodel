# TASK-024: Benchmark laptop conversion and the conditional A100 path

- Status: In progress
- Priority: P0
- Goal: G3
- Depends on: TASK-003, TASK-022
- Estimate: M-L (2-3 days)
- Specification: [Live English character voice](../../specs/voice-conversion-plan.md)

## Outcome

Determine whether live conversion should run on this laptop or the available remote A100 using complete-workload measurements.

## Work

- Benchmark CPU RVC first, then compatible ONNX/DirectML and deiteris alternatives if useful; log actual execution providers. Do not assume Iris Xe acceleration beats CPU.
- Sweep supported audio chunk/context/pitch settings and test converter alone and with the working avatar/tracking feasibility setup plus OBS. Repeat final measurements with Ene in TASK-028.
- Measure raw-to-converted end-to-end audio p50/p95 on a shared recording clock, distinguishing inference, buffering and routing. Log device rates, CPU/RAM, frame timing, dropout counts and thermal behavior.
- If local operation misses gates, obtain the remote endpoint/access configuration, inspect actual A100/host allocation and driver compatibility, and benchmark a pinned RVC service over an authenticated private connection. Keep capture/playback local and service ports private.
- Measure real audio return delay and jitter as well as network RTT; test timeout, disconnect and stale-buffer handling. Do not launch paid resources or make claims about an untested A100.
- Investigate LLVC only as a bounded CPU contingency if the RVC paths fail. Write ops/reports/voice-performance.md selecting a backend/preset or documenting unresolved defects; remote credentials may remain a clearly stated implementation dependency.

## Acceptance criteria

- [x] A reproducible measured laptop verdict includes converter-alone and combined-workload results. Converter-alone: five identical paced runs on battery, one pass on a quiet machine and four reproducible `ingress` failures at roughly 65 ms per call under ordinary load. Combined-workload: two runs with the real viewer, Ene avatar and face/pose tracking, both failing identically on the first neural call while the avatar retained 0.965 and 1.006 of its draw rate. Verdict: local LLVC does **not** meet the gates under ordinary desktop load, recorded as a measured defect in [combined workload and reproducibility](../../reports/voice-combined-workload.md) with the [hybrid-core mechanism](../../reports/voice-llvc-hybrid-cores.md). Earlier RVC/ONNX/OpenVINO converter-alone measurements remain in [voice-performance.md](../../reports/voice-performance.md).
- [ ] The selected path passes the spec's audio gates, including p95 <=350 ms, jitter spread <=100 ms and no audible breakup in a five-minute speech test; otherwise this task remains open.
- [ ] Remote operation is either measured with the same gates or marked unnecessary because local passed; an inaccessible required remote is not treated as validated.
- [ ] Local-only avatar startup remains possible, and the report names whether the accepted voice itself works offline.

## Implementation notes

2026-09-12: the specification's bounded [LLVC CPU fallback experiment](../../reports/voice-llvc-plan.md) now has initial measured results. Source/checkpoint terms, pinned revisions and the minimal inference dependency were reviewed. [Provisioning](../../reports/voice-llvc-provision.json) verifies 13 isolated artifacts and the 39,489,146-byte MIT research checkpoint; no active environment/service/profile changed. Sequential 30-second file probes at 52 ms chunks yield compute RTF 1.222 / 1.255 with one / three threads, so neither meets incoming throughput. Complete finite audio, exact buffer-reset checks and sample timings are retained. It is one research target voice; no live speed, user preference or three-timbre acceptance is inferred.

This is implementation work, not completed by the research/design document.

Subsequent evidence: the [fixed ONNX export](../../reports/voice-llvc-onnx.md) failed strict recurrent-state parity during silence, so no OpenVINO timing ran. After its worker and receiver browser checks closed, the exact eager 52 ms/one-thread [repeat](../../reports/llvc-cpu-1t-factor4-post-soak.json) measured median/p95 15.32/17.41 ms, compute RTF 0.301 and zero misses across 577 chunks. [PCM comparison](../../reports/llvc-eager-repeat-audio.json) is bit-identical to the original one-thread output; earlier files remain intact. The large timing difference is unexplained. Prepare a bounded streaming adapter, then verify paced and combined performance; do not close live, physical latency or listening criteria from one successful unpaced repeat.

2026-09-12 isolated LLVC adapter correctness: the [streaming plan and non-served adapter](../../reports/voice-llvc-streaming-plan.md) are reviewed and promoted. Three framing tests pass. One [labeled eager parity/reset probe](../../reports/llvc-stream-adapter-eager-v1.json) matches all 134,347 upstream samples bit-for-bit, exact EOF and 162 expected calls; a four-call fresh reset also matches. Aggregate adapter wall/process CPU is 2,646.35/2,546.875 ms; per-call CPU quantization is documented, with actual outside-timing thread/priority/process-affinity/power snapshots. Report/log creation precedes heavy work and earlier labels are preserved. This is an unpaced licensed-file correctness check, with no active backend/catalog/profile/service/OBS or physical-media change. The separately paced ingress/publisher proof, combined workload, accepted sound quality and physical latency/sync remain open; no acceptance box is closed by this step.

When completing this task, record changed artifacts, exact validation commands/results or manual evidence, and unresolved limitations. Leave unperformed checks unchecked.

## Partial implementation checkpoint — 2026-09-12

- Activated for the independent local CPU spike after TASK-022, while TASK-003 and combined OBS prerequisites remain open. All acceptance boxes remain unchecked.
- Implemented [paced benchmark](../../../scripts/voice/benchmark.py) and [three exact presets](../../../config/voice/benchmark-presets.json), using only the existing public-domain English file. Ten-chunk warmups precede three nominal 30-second intervals with 160 ms chunks, 1.6 s past context, 40 ms crossfade and 10 ms SOLA search. A bounded mailbox counts skipped input and mutes late output.
- Coordinated a Blender-free measurement window. The FP32/4-thread, int8/3-thread and int8/1-thread configurations all missed every output deadline. Best median/p95 compute was 418.3/578.2 ms, real-time factor 2.89. Baseline system activity remained about 11%; results are not a claim of a completely idle OS. [Performance report](../../reports/voice-performance.md), [per-block evidence and hashes](../../reports/voice-performance.json).
- Provisioned the fork's supported int8 ContentVec derivative, preserving the original and its GPL-3.0 provenance. No-F0 TorchScript compilation failed on missing pitch-module and variable ModuleList-indexing code; no JIT preset/source modification was accepted.
- Exported a fixed-shape full ONNX generator from the original eager no-F0 submodules. Adapter parity is exact; actual CPU ONNX output differs by at most 2.68e-6. Five repeated speech windows measured 327.5/355.1 ms median/p95 compute, RTF 2.08: still no live pass. [Export evidence](../../reports/voice-onnx-export.json), [CPU probe](../../reports/voice-onnx-cpu.json).
- Provisioned a separate 15-package DirectML environment. After roughly four minutes of session preparation without completed conversion, terminated only the owned probe. Provider availability is recorded; actual model GPU execution/speed remain unverified. Its proprietary Windows redistributable terms are distinguished from MIT ONNX Runtime code and it is not selected as the OSS baseline. [Bounded attempt](../../reports/voice-onnx-directml.json), [package/native notices](../../reports/voice-onnx-environment.json).
- OpenVINO CPU FP32 matched the original output but remained slower than live input (RTF 2.13). Actual Iris Xe GPU kernels executed (RTF 1.30-1.36), but waveform parity failed even with the documented accuracy/Winograd correction. GPU WAVs/RMS/spectral diagnostics are retained; numerical difference is not an audible-quality verdict. No backend selected. [OpenVINO results](../../reports/voice-performance.md), [retained audio diagnostics](../../reports/voice-probe-audio-comparison.json).
- Generated complete English comparison clips with 1.6 / 0.8 / 0.4 s past context, identical target/noise sequence, 160 ms chunks and SOLA. Fifty-three blocks preserve the full source plus final silence padding. CPU RTF was 3.37 / 2.25 / 1.83 respectively; every compute block remained >160 ms. Boundary metrics, raw WAVs, RMS-matched review clips and a local [listening page](../../../assets/voice/auditions/context-v1/review.html) are ready. Numerical graph checks passed; human quality, live latency and combined-workload acceptance remain open. [Comparison evidence](../../reports/voice-context-comparison.json).
- Verified schedule accounting, finite numeric output, WAV durations and output hashes. No actual microphone/speaker, A100, physical end-to-end delay, subjective quality, thermal/soak or combined Ene/OBS acceptance was performed. Silent deadline WAVs demonstrate missed deadlines, not usable voice output.
- Remote remains tentative VPN/vLLM API access without a supplied endpoint/model. Do not treat that as RVC deployment/training access, and do not scan the internal network. The avatar and `http://127.0.0.1:5081/` reference listening room remain available independently.


## Paced LLVC proof and the resolved timing discrepancy — 2026-09-12

The previously unexplained slow/fast LLVC per-call difference is **resolved: it is hybrid-core placement, not power state**. Full evidence and limits are in [hybrid-core diagnosis](../../reports/voice-llvc-hybrid-cores.md).

- This host is a 12th Gen i7-1255U. Measured per-logical-CPU frequency counters separate logical CPUs 0-3 (100% of maximum, performance cores) from 4-11 (50-70%, efficiency cores). The worker ran at mask `FFF`, so the scheduler could place its single Torch thread on either kind.
- The new [three-condition diagnostic](../../../scripts/voice/probe_llvc_affinity.py) timed 200 steady-state calls per affinity mask on battery: [evidence](../../reports/llvc-affinity-hybrid-dc-v2.json). P-cores `00F` gave median 29.92 ms, p95 36.83 ms, max 42.71 ms and **0/200** deadline misses. E-cores `FF0` gave median 69.35 ms, RTF 1.352 and **200/200** misses. The unchanged default `FFF` matched the P-core median but reached a **81.49 ms** worst call with 2 misses. Aggregate CPU-to-wall ratios of 0.96-0.99 show real computation, not descheduling. An earlier ctypes handle-truncation failure is retained as [hybrid-dc-v1](../../reports/llvc-affinity-hybrid-dc-v1.json).
- The first paced trial, unpinned on battery under roughly 45% ambient load, failed after 410 ms on the 64 ms input-queue bound: [dc-busy-v1](../../reports/llvc-paced-dc-busy-v1.json). Its startup path still met the software budget at a modeled 348.14 ms, so sustained throughput, not startup, was the defect.
- Two harness corrections are recorded rather than applied silently. A process-wide pin confined the pacing threads and failed at ingress after 2002 ms ([pcore-dc-v1](../../reports/llvc-paced-pcore-dc-v1.json)), so `run_paced` gained an `on_thread_start` hook and the probe now pins only `llvc-serial-inference`. The sleep-based synthetic pacer also needed `timeBeginPeriod(1)`, because the default ~15.6 ms Windows granularity is the same order as the 16 ms input packet; this affects the harness only, since real input is paced by the audio device clock. Both are reported in `inferenceThreadAffinityMask` and `harnessTimerResolutionMs`, and the probe's stated limits were corrected.
- The **paced 30-second file proof passes only on a quiet machine and does not reproduce under ordinary load**; see [combined workload and reproducibility](../../reports/voice-combined-workload.md), which corrects an earlier overstatement in this file. One run passed on battery with the inference thread pinned to mask `F`: [pcore-thread-dc-v1](../../reports/llvc-paced-pcore-thread-dc-v1.json). 577/577 neural calls with **0 deadline misses**, median/p95/max 32.09/39.69/49.36 ms against 52 ms, compute RTF 0.624; 1875/1875 input packets with no gap or overflow and FIFO high water 3 of 4; 188/188 output packets totalling exactly 1,200,000 valid 40 kHz samples; publisher wake lateness at most 2.23 ms and minimum readiness margin 2.90 ms; modeled signal start 310.94 ms, meeting the 350 ms software budget. Continuous [16 kHz](../../reports/local/voice/llvc/llvc-paced-pcore-thread-dc-v1-converted16k.wav) and [40 kHz](../../reports/local/voice/llvc/llvc-paced-pcore-thread-dc-v1-published40k.wav) waveforms are retained for listening.
- Ten focused LLVC tests pass (seven paced, three chunker).

No acceptance box is closed by this step. There was no microphone, speaker, browser, WebAudio, OBS or physical device; the sink is a model and 310.94 ms is a software estimate, not measured acoustic latency. No listening acceptance, user preference, three-timbre coverage, combined avatar/OBS workload or five-minute continuity was performed, and a 2.90 ms minimum margin was measured with nothing else competing for the same two performance cores. P-core placement should be treated as a required setting for any live LLVC route rather than an optimisation.


## Combined-workload verdict and paced reproducibility - 2026-09-12 (corrects the entry above)

**The paced proof is not reproducible under ordinary desktop load.** Four of five identical attempts failed. Full record: [combined workload and reproducibility](../../reports/voice-combined-workload.md).

- Reproducibility series, same command and settings on battery: [dc-v1](../../reports/llvc-paced-pcore-thread-dc-v1.json) passed on a quiet machine (577/577 calls, 0 misses, first call 35.91 ms), while [dc-v2](../../reports/llvc-paced-pcore-thread-dc-v2.json), [dc-v3](../../reports/llvc-paced-pcore-thread-dc-v3.json), [dc-v4](../../reports/llvc-paced-pcore-thread-dc-v4.json) and [dc-v5](../../reports/llvc-paced-pcore-thread-dc-v5.json) all failed at `ingress` after exactly two calls costing 64.78-71.63 ms against the 52 ms budget. Conditions during the failures were approximately 47% ambient CPU load from an editor and browser, processor at 72% of maximum frequency, on battery - ordinary working conditions, not an artificial stress test. Even the passing run held only one spare ingress slot, at input FIFO high water 3 of 4.
- Combined workload with the real viewer, real Ene avatar and real face/pose tracking: [avatar unpinned](../../reports/combined-voice-avatar-combo-v1.json) and [avatar confined to efficiency cores](../../reports/combined-voice-avatar-combo-split-v1.json). **The avatar is essentially unaffected**, retaining 0.965 and 1.006 of its draw rate and recovering fully. **The voice failed both times on its first neural call**, which cost 122.37 ms and 99.32 ms against a 35.91 ms first call in the clean pass. Core separation is therefore not a fix and is not recommended; the avatar needs no help and the voice is not being starved by it.
- Mechanism: pinning to mask `F` selects the two physical performance cores but does not reserve them. Under ordinary load those cores also run the editor, browser and compositor at 72% of maximum frequency, so a pinned thread performs like an efficiency-core thread. Pinning removes the worst placement; it does not deliver a quiet core.
- The binding constraint is the deliberate four-packet / 64 ms ingress bound, which is smaller than one slow call. A reviewed startup allowance - not starting the input clock until the first output exists - would address the transient without weakening the steady-state guarantee. **No such contract change was made here.**

This supplies the first acceptance criterion's reproducible measured laptop verdict covering converter-alone and combined-workload results, recorded as a **measured defect**. The specification's p95 <= 350 ms, <= 100 ms jitter spread and five-minute no-breakup gates are **not met**, no microphone, speaker, OBS or physical device was involved, and no listening acceptance is claimed. The task remains open.

## Avatar independence from the voice service — 2026-09-13

[local_only_startup_smoke.mjs](../../../scripts/local_only_startup_smoke.mjs) starts the studio and drives it through load, tracking and stop while watching every request the page makes. [Evidence](../../reports/local-only-startup-smoke.json).

The avatar loaded, rendered at **59.88 draws/s** over 8 seconds with 64 GPU inferences, and **contacted no origin other than its own server** — no worker errors, no page errors.

This ran with **both voice services listening** on 5081 and 5082, which makes the result stronger rather than weaker: the avatar had a running voice service available and never reached for it. The application source contains no reference to a voice port at all.

The distinction is recorded rather than blurred: this is independence observed under availability, **not** a cold boot with the voice service absent. An earlier version of the probe skipped entirely when voice was running, which would have reported nothing useful; it now runs and labels which kind of evidence it obtained.

This supports the fourth criterion's first clause. The clause after it — naming whether **the accepted voice** works offline — cannot be answered while no voice is accepted, so the criterion stays open. For the record, every candidate measured so far is local: the pinned RVC checkpoints, the ONNX and OpenVINO variants and the LLVC research model all run from local files with no network inference, and the only non-local option ever discussed is the tentative VPN-reached remote API, which has never been supplied or tested.
