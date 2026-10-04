# Minimal LLVC streaming adapter plan

2026-09-12. **Isolated adapter correctness now passes; paced/live integration remains pending.** The original source-only design was reviewed, the next quiet window was released, and three non-served experimental scripts were promoted. Three framing tests and one labeled eager parity/reset file probe pass. No served files/catalogs/profiles, active services, OBS or physical media were changed. The CPU window was released immediately afterward.

Use the existing pinned eager CPU LLVC research checkpoint as one experimental backend. Keep the three RVC candidates and explicit natural route unchanged. The [577-call repeat](llvc-cpu-1t-factor4-post-soak.json) measured median 15.32 ms, p95 17.41 ms and RTF 0.301 at 52 ms/one thread with zero compute misses; the earlier [same-preset run](llvc-cpu-1t-factor4.json) measured RTF 1.222. The large difference is unexplained, so the faster result justifies a paced proof, not live acceptance. The failed strict ONNX state-parity path is excluded. Root owns the [LLVC experiment record](voice-llvc-plan.md) and its overall performance decision.

## Preserve the exact eager streaming function

The installed [pinned upstream `infer_stream`](https://github.com/KoeAI/LLVC/blob/1627c5d358cf9bb2b92b0ccc513d8b36807c923d/infer.py) and [network](https://github.com/KoeAI/LLVC/blob/1627c5d358cf9bb2b92b0ccc513d8b36807c923d/model.py) were read locally. Their streaming behavior is more specific than splitting a waveform into independent windows.

| Quantity | Exact contract |
| --- | --- |
| Input/model output | Mono float32, 16,000 samples/second |
| Internal model chunk | `C = L × dec_chunk_size × factor = 16 × 13 × 4 = 832` samples, 52 ms |
| Global shift | Discard the first `L = 16` source samples once per stream, not once per packet |
| Per-call prefix | First call: 32 zero samples. Later calls: the previous shifted chunk's final 32 samples |
| Actual model input | `[1, 1, 864]` = 32 context + 832 shifted samples |
| Model call | `eval()`, `inference_mode()`, CPU float32, `pad=False` because the pinned model has `lookahead=True` |
| State | Preserve encoder, decoder, output-convolution and convolutional-prenet buffers across every call |
| Model output | Exactly 832 finite samples; no SOLA, pitch correction, overlap crossfade or model-state substitution |

For an original file of `N > 0` samples, set `M = ceil(N / 832) × 832`. Upstream pads the original input to `M`, then forms `u = padded_input[16:] + zeros(16)`. The online adapter discards the first 16 arriving samples, retains fewer than 832 pending shifted samples, and never adds zeros at ordinary packet boundaries. At file EOF it supplies `M + 16 - N` additional zero source samples, including any still-pending initial discard, converts the remaining full model chunk and trims total output to exactly `N`. This covers exact multiples and inputs shorter than 16 samples. Empty input is an explicitly local no-output case; upstream's empty-file helper is not invoked.

`reset()` must replace all four neural state buffers, the 32-sample prefix, pending shifted input, global-discard count, output count, resampler history and partial output packet. It must run serially with inference. File EOF is a separate operation from user Stop, connection loss or a preset change: those actions discard partial input/output immediately and must never flush extra speech into OBS.

An input sequence gap, malformed frame, overflow, inference failure or missed output deadline invalidates the stream. Stop/mute, change the epoch, discard late worker results and require an explicit restart. Do not silently continue recurrent state after skipped input, reset only part of the model, switch to RVC or send natural speech.

## Smallest practical transport change

The existing RVC/natural microphone processor sends 2,560 samples every 160 ms. After LLVC's initial 16-sample discard, the first packet permits only three 832-sample calls: **2,496 converted samples**, below the 2,560 samples needed for a 160 ms output packet. The first complete output must therefore wait for the second microphone packet, at 320 ms under ideal arrival. The current output sink then adds 40 ms of literal zero samples before speech, already exceeding the 350 ms target before inference/device/OBS time. Retaining the current input packet size cannot solve startup latency.

Prepare a separate experimental LLVC input contract of **256 samples / 16 ms**, leaving existing RVC and natural contracts unchanged. A future explicit LLVC Start action can create a dedicated input worklet with that fixed size. Its microphone remains browser-owned and permission-gated. Use a separately validated `/ws/llvc-input` with a distinct `VMIL` frame kind and the existing producer lease/epoch/sequence/rate fields; accept it only while the selected backend is the one LLVC research model. Host/Origin rules and a single mutually exclusive producer still apply. No input/control endpoint is added in this checkpoint.

Keep the installed converted receiver contract: `/ws/output`, `VMOA`, 40 kHz, 6,400 samples per packet and mode `live`. Only LLVC-produced PCM enters it. The separate natural `VMNA` receiver remains unchanged. A converted-output packetizer accumulates exactly 2,560 LLVC output samples at 16 kHz and applies the already validated causal 5:2 FIR resampler used by the PCM utility. That DSP reuse does not route natural microphone samples to the converted receiver. Its 101-tap filter contributes 0.625 ms group delay. For file-only EOF verification, trim a padded last packet to `ceil(5N/2)` valid 40 kHz samples; do not append an unbounded filter tail. Live Stop discards that partial packet.

Do not emit output packets in neural-completion bursts. `832` and `2560` have a greatest common divisor of 64: forty model calls span thirteen output packets, or 2.08 seconds. Completion-driven packets can have a 208 ms gap in this cycle despite a 160 ms audio duration. Pace completed packets on a fixed sample-index clock at 160 ms intervals. Initially hold the first ready packet for a provisional 16 ms scheduling reserve, then keep a single bounded unsent packet slot. If the next complete packet is unavailable by its deadline, mute/stop; do not conceal the miss by accumulating more latency or replaying old packets. The reserve is a test hypothesis, not an accepted setting.

The actual [output sink](../../../../scripts/voice/studio/pcm-player.js) writes 1,600 zero samples before appending the first 6,400-sample packet. Its 40 ms cushion is a real initial silence interval, **not a fill threshold that a 160 ms packet immediately satisfies**. Preserve that behavior for the first proof. Receiver sequence/freshness/epoch checks and its 9,600-sample/240 ms cap still apply.

An illustrative ideal-arrival startup calculation for 16 ms input is:

- Four internal chunks are required for the first 2,560 output samples, needing source sample `4 × 832 + 16 = 3344`.
- A 256-sample packet boundary makes those samples available at source sample 3,584, or 224 ms. Earlier calls can finish before that fourth call begins if the fast timings persist.
- Adding the observed p95 call time, proposed 16 ms publisher reserve, 0.625 ms FIR delay and existing 40 ms sink silence gives approximately **298 ms**.

This calculation excludes microphone/device buffers, packet scheduling/transport, main-thread delays, OBS/audio output and the distinction between processing dependency and audible model alignment. It is not measured physical latency. The paced test must report actual first-ready, first-published and ideal sink-start times; later physical latency and <=80 ms residual lip sync remain independent acceptance gates. No sync offset is invented from the estimate.

## Bounded worker and ownership

Use one owned, isolated LLVC worker with one Torch compute thread and one interop thread. The current RVC adapter changes process-wide Torch threading and imports a different engine namespace; loading LLVC into that existing executor would obscure provenance, reset behavior and timing. Retain the existing pinned environment, source/hash verification, strict `weights_only=True` checkpoint load and offline/no-network worker boundary. Loading/warmup remains muted; warm one second and then reset all state before input begins. The single research model is explicitly selected, not an automatic response to RVC failure.

| Buffer | Proposed bound and response |
| --- | --- |
| Input arrival FIFO | Four 256-sample packets, 64 ms, strict sequence order. Overflow/old epoch stops; never replace the oldest packet with a newer one |
| Model framing | Fewer than 832 pending shifted samples plus 32 context samples; one model call in flight |
| Converted sample assembly | Fewer than 2,560 pending 16 kHz samples between calls; one 832-sample result is checked/drained immediately |
| Publisher | One complete unsent 6,400-sample packet, paced every 160 ms; no unbounded catch-up burst |
| OBS receiver | Existing 240 ms PCM cap and freshness rejection, unchanged |

The current server's latest-packet mailbox and `engine.process(2560) -> 6400` interface are unsuitable for this stateful variable-output adapter. Add a backend-specific ordered ingress path and `push()/drain()` lifecycle only after the isolated proof passes; do not disguise LLVC as an RVC checkpoint. Stop takes priority at the controller, mutes immediately and invalidates the epoch while any in-flight native call finishes. Late results are discarded; a hung owned worker can be terminated using the project's process-identity checks. Avatar startup remains independent.

A future provisional profile must identify this one target, checkpoint/source hashes, eager CPU backend, thread settings, 16 ms input, 52 ms internal chunk, 160 ms output, scheduling reserve and resampler. All those fields invalidate prior sync calibration. It cannot claim three distinct voices, cheerful character fit, accepted English quality or user preference. No profile/catalog/UI change is authorized by this source checkpoint.

## Experimental artifacts and next bounded proof

The following files were prepared under `.cache/voice-llvc-streaming/`, reviewed and then promoted into `scripts/voice`. They remain outside the served application and runtime voice catalog:

- [llvc_stream_adapter.py](../../../../scripts/voice/llvc_stream_adapter.py): a standard-library framing core and explicit-load eager adapter, exact global shift/context/EOF accounting, four-buffer reset, poisoned-state rejection and per-call wall/process-CPU timing hooks. Module import itself has no Torch import. It accepts packet lengths up to the old 2,560-sample bound for parity work; future served LLVC ingress must enforce its distinct 256-sample contract.
- [test_llvc_chunker.py](../../../../scripts/voice/test_llvc_chunker.py): three passing fake-model tests for boundary lengths, arbitrary packet divisions, exact contexts/EOF, reset/poison handling and the existing 160 ms first-packet shortfall. They do not use Torch.
- [probe_llvc_stream_adapter.py](../../../../scripts/voice/probe_llvc_stream_adapter.py): isolated file-only eager parity probe. It compares 256-sample packet feeding against the pinned upstream helper bit-for-bit, checks a fresh reset, records exact expected/actual call counts and per-call/aggregate process CPU and wall time, and takes actual Windows thread-count/priority/process-affinity/power snapshots outside timing. It deliberately reports `paced: false`; it is the adapter correctness step, not the paced acceptance proof. A unique report and full stdout/error log are reserved before worker imports/load. Failures/timeouts update that record, mismatch WAVs are retained when available, and reused labels are refused. Failure/timeout injection was not part of this passing run.

The approved commands completed successfully:

```powershell
.tools/voice/venv/Scripts/python.exe scripts/voice/test_llvc_chunker.py
python scripts/voice/probe_llvc_stream_adapter.py --quiet-window --run-label eager-v1
```

The [eager-v1 report](llvc-stream-adapter-eager-v1.json) records **134,347 exact output samples**, bit-for-bit upstream equality including EOF, zero maximum absolute difference and 162 expected/upstream/adapter neural calls. A fresh reset then produces 3,328 identical samples from four expected calls. The [full log](local/voice/llvc/llvc-stream-adapter-eager-v1.log), [adapter waveform](local/voice/llvc/llvc-stream-adapter-eager-v1.wav) and [upstream waveform](local/voice/llvc/llvc-stream-adapter-eager-v1-upstream.wav) are retained. Waveform equality compares float samples directly; container-file hashes are recorded separately.

Forward calls total 2,590.02 ms wall and 2,500 ms process CPU time. The entire adapter interval, including packet handling, totals 2,646.35 ms wall and 2,546.875 ms CPU (aggregate CPU/wall ratio 0.962). Fourteen individual CPU readings are zero, so Windows per-call timer granularity prevents meaningful individual-call CPU ratios. Use the aggregate totals; this run does not establish the cause of earlier slow/fast measurements. Both outside-timing snapshots report one Torch compute thread, one interop thread, five actual process threads, Normal priority, process affinity mask `FFF`, AC online, battery 82%/charging and saver off. No priority, affinity or power setting changed. The worker exits zero within its 120-second cap; no paced, physical or listening acceptance is inferred.

The next **paced 256-sample input / 832-sample neural / 6,400-sample output** file-only trial is now implemented, initially 30 seconds with the same licensed English reference and the documented gaps. Its separately reviewed [pipeline](../../../../scripts/voice/llvc_paced.py), [retained-evidence wrapper](../../../../scripts/voice/probe_llvc_paced.py) and [tests](../../../../scripts/voice/test_llvc_paced.py) are promoted outside the served application. The acquisition thread enqueues packets on their scheduled sample clock independently of the inference worker; sequential sleeps inside inference would hide real arrival/backlog. The publisher also runs on its own fixed sample clock. No microphone, speaker, OBS or served catalog is involved. The paced Torch trial remains unrun at this source/test checkpoint.

All seven focused no-Torch tests pass in 0.930 seconds: [unit-v2 evidence](llvc-paced-unit-v2.json), [full log](local/voice/llvc/llvc-paced-unit-v2.log). They cover input gaps/epochs/lengths, four-packet FIFO overflow without replacement, retained high water, fixed output deadlines, one-slot identity/overflow, modeled sink underflow/bursts, causal FIR EOF counts/reset, and an injected exception through the actual threaded pipeline. That failure must join/reset, produce no output and never invoke file EOF or raw fallback. FIFO high water is captured inside the Queue mutex so a concurrent consumer cannot hide the peak. The earlier six-test [unit-v1 record](llvc-paced-unit-v1.json) is preserved.

The exact initial publisher reserve remains **16 ms**, with no automatic change to queue caps or deadlines. An additional acquisition wake more than 16 ms late stops this synthetic proof separately from the four-packet/64 ms FIFO bound; it does not prove a physical microphone lost samples. Neural calls over 52 ms are retained and reject acceptance after the paced interval, rather than interrupting the call. Queue, input-order and publication failures stop the epoch immediately. The ideal sink model includes the current literal 40 ms silence prefix and 240 ms cap, and reports its initial timestamp separately from the estimate with 0.625 ms FIR group delay. It does not exercise WebAudio or measure acoustic alignment.

Record scheduled versus actual input arrival, FIFO high water/overflow, sequence continuity, per-call wall and process CPU time, time waiting in the queue, first-output timestamps, per-packet readiness margin/lateness, output FIFO high water, missed publication deadlines and exact valid sample counts at EOF. Preserve thread count, process priority and process affinity before/after timing, plus source/output hashes and current backend settings. Process CPU time includes other threads within this owned process and is not a per-thread hardware-cycle counter. Compare it with wall time to investigate descheduling versus CPU cost; do not assert a cause for the slow/fast discrepancy without evidence.

Retain a complete continuous 16 kHz converted waveform and the derived 40 kHz stream for listening and boundary inspection; do not use numerical identity, compute RTF or absence of NaNs as a listening verdict. A paced miss, lost input, output gap, wrong sample count or state mismatch prevents live integration. Only after parity and paced proof pass should a separately labeled experimental LLVC UI/profile/worker adapter be proposed for the existing converted-only route. Combined avatar/OBS load, physical microphone/output delay, listening preference and both-orientation synchronization remain later gates.
