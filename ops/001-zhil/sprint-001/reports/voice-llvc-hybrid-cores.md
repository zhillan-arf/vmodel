# Hybrid P-core/E-core scheduling explains the LLVC timing discrepancy

2026-09-12. **Resolved: the long-unexplained slow/fast LLVC per-call difference is core placement, not power state.** A measured three-condition diagnostic, followed by a passing paced trial, identifies the mechanism and the fix. All runs below were on **battery (DC)**, which the earlier [power comparison](capture-power-comparison.md) had treated as the leading suspect.

## The open question

[TASK-024](../tasks/active/TASK-024.md) and [TASK-P01](../tasks/active/TASK-P01.md) carried an unexplained result: an exact-repeat 52 ms/one-thread LLVC run measured compute RTF **1.222** in [one file](llvc-cpu-1t-factor4.json) and **0.301** in a [bit-identical repeat](llvc-cpu-1t-factor4-post-soak.json), with identical PCM output. A DC-to-AC power change sat between them, so power was recorded as a confound rather than an established cause. Historical Chrome Energy Saver state was unavailable, and neither short capture control reproduced the effect.

## Measured host topology

This laptop is a **12th Gen Intel Core i7-1255U**: 10 cores, 12 logical processors, hybrid. Per-logical-CPU `% of Maximum Frequency` counters separate the two kinds unambiguously:

| Logical CPUs | Measured % of maximum frequency | Kind |
| --- | --- | --- |
| 0, 1, 2, 3 | 100 | Performance cores (2 physical, 2 threads each) |
| 4, 5, 6, 7 | 70 | Efficiency cores |
| 8, 9, 10, 11 | 50-51 | Efficiency cores |

The voice worker ran at process affinity mask `FFF`, so **the Windows scheduler was free to place the single Torch compute thread on either kind**. Core-kind labels here come from these measured counters on this host, not from a vendor topology API.

## Diagnostic: 200 steady-state calls per condition

[probe_llvc_affinity.py](../../../../scripts/voice/probe_llvc_affinity.py) runs the same pinned eager checkpoint over the same licensed public-domain English samples under three child-process affinity masks. Each condition warms the model for 32 chunks, resets, then times 200 consecutive 832-sample (52 ms) neural calls. It changes only its own child process affinity; no global power, priority or scheduler setting changed. [Full evidence](llvc-affinity-hybrid-dc-v2.json), [log](local/voice/llvc/llvc-affinity-hybrid-dc-v2.log).

| Condition | Mask | Median | p95 | Max | Min | Compute RTF | Deadline misses / 200 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Default, unchanged | `FFF` | 30.33 ms | 40.86 ms | **81.49 ms** | 23.90 ms | 0.606 | 2 |
| P-cores only | `00F` | 29.92 ms | **36.83 ms** | **42.71 ms** | 23.26 ms | 0.586 | **0** |
| E-cores only | `FF0` | **69.35 ms** | 82.65 ms | 91.62 ms | 60.12 ms | **1.352** | **200** |

Findings:

- **E-cores cannot run this model in real time.** Every one of 200 calls exceeded the 52 ms chunk budget, at RTF 1.352. The E-core median is **2.32x** the P-core median.
- **P-cores meet the budget with margin.** Zero misses, p95 36.83 ms and a worst call of 42.71 ms against a 52 ms budget.
- **The default mask is usually fine and occasionally not.** Its median matches the P-core median, but its worst call reached 81.49 ms and two calls missed. `executingCpuSamples` confirm the pins: the default and P-core conditions observed CPUs 0-3, the E-core condition observed CPUs 4-11.
- **The cost is real computation, not descheduling.** Aggregate process-CPU-to-wall ratios were 0.97, 0.99 and 0.96. A thread waiting for a busy core would show a ratio well below 1.

This accounts for the original 1.222-versus-0.301 discrepancy without invoking power state: an unpinned single-thread worker lands on a P-core most of the time and on an E-core some of the time, and the two placements differ by more than a factor of two before any contention or frequency cap is added. Power and ambient load remain plausible additional contributors — the P-core median measured here on DC is 29.92 ms against the 15.32 ms recorded in the fast AC run — but **placement alone is sufficient to cross the real-time boundary**, and these measurements were taken entirely on battery.

## Consequence for the paced pipeline

The first paced 30-second trial, run unpinned on DC under roughly 45% ambient Chrome load, failed after **410 ms**: [dc-busy-v1](llvc-paced-dc-busy-v1.json) stopped at `inference-or-packetizer` with an input packet past its 64 ms bounded queue age, after only 6 neural calls whose times climbed 45.4, 33.0, 38.9, 48.1, 63.8, 64.5 ms. A four-packet/64 ms input FIFO cannot absorb calls that exceed the 52 ms chunk they consume.

Its startup path nevertheless behaved: the first output packet was ready at 280 ms and published at 308 ms, and the modeled sink start of 348.14 ms met the software budget. Startup architecture was never the problem; sustained throughput was.

## Two recorded harness corrections

1. **Pin the inference thread, not the process.** A process-wide `F` pin ([pcore-dc-v1](llvc-paced-pcore-dc-v1.json)) reached 2002 ms and 37 calls with a healthy 30.98 ms median, then failed at `ingress` because the acquisition and publisher threads were confined to the same two physical cores as the neural call they feed. `run_paced` now exposes an `on_thread_start` hook, and the probe pins only `llvc-serial-inference`, recording the mask and the previous mask it replaced.
2. **Raise the harness timer resolution.** The synthetic pacer waits on `threading.Event`, whose default Windows granularity is about 15.6 ms — the same order as the 16 ms input packet it must schedule. The probe now optionally calls `timeBeginPeriod(1)` and restores it afterwards, recording the value in `harnessTimerResolutionMs`. **This affects the test harness only.** Real input is paced by the browser audio device clock, not by a sleep loop, so this is not a change to the contract under test.

Both settings are recorded in the report rather than applied silently, and the probe's stated limits were corrected to match. An unset mask or resolution keeps the original behaviour.

## Paced 30-second proof: passed

[pcore-thread-dc-v1](llvc-paced-pcore-thread-dc-v1.json), on battery, with the inference thread pinned to mask `F` (previous mask `FFF`) and 1 ms harness timer resolution. [Log](local/voice/llvc/llvc-paced-pcore-thread-dc-v1.log).

| Quantity | Result |
| --- | --- |
| Neural calls | 577 of 577 expected; count matches |
| Compute deadline misses | **0** |
| Per-call median / p95 / max | 32.09 / 39.69 / **49.36 ms** against a 52 ms budget |
| Compute RTF | 0.624 |
| Input packets consumed | 1875 of 1875; no gap, no loss, no overflow |
| Input FIFO high water | 3 of 4 packets |
| Output slot high water | 1 of 1 |
| Output packets | 188 of 188; exactly 1,200,000 valid 40 kHz samples |
| Publisher readiness margin | minimum 2.90 ms, median 42.19 ms |
| Publisher wake lateness | maximum 2.23 ms, median 0.72 ms |
| Input arrival lateness | maximum 4.80 ms |
| Modeled initial sink delay | 310.32 ms; signal-start estimate 310.94 ms |
| Software 350 ms budget | met |
| Paced wall / process CPU | 30,440.28 ms / 21,078.13 ms |
| State reset after termination | yes |

Complete continuous waveforms are retained for listening and boundary inspection: [converted 16 kHz](local/voice/llvc/llvc-paced-pcore-thread-dc-v1-converted16k.wav) and [published 40 kHz](local/voice/llvc/llvc-paced-pcore-thread-dc-v1-published40k.wav), 480,000 and 1,200,000 samples respectively.

The minimum readiness margin of 2.90 ms is the honest headroom figure. The pipeline never missed, but one packet came within 3 ms of its deadline, and that was with no browser, microphone, avatar or OBS load on the machine.

## What this does and does not establish

Established: the mechanism behind a previously unexplained measurement, a reproducible three-condition topology diagnostic, and a complete paced 30-second file trial that meets every framing, ordering, queue-bound, deadline and sample-count check with the inference thread pinned to measured P-cores.

Not established, and still gating [TASK-024](../tasks/active/TASK-024.md), [TASK-026](../tasks/active/TASK-026.md) and [TASK-028](../tasks/backlog/TASK-028.md):

- No microphone, speaker, browser, WebAudio, OBS or physical device was involved. The sink is a model, including the installed 40 ms silence prefix and 240 ms cap; 310.94 ms is a software scheduling estimate, not measured acoustic latency.
- No listening acceptance. The source is public-domain English reference speech, not the user's voice, and numerical completeness is not a quality verdict. The specification's p95 <= 350 ms, <= 100 ms jitter spread and five-minute no-breakup gates remain unmeasured on real audio.
- No combined workload. These runs had no avatar rendering, tracking workers or OBS capture competing for the same two P-cores. That contention is the central open risk, because the avatar runtime wants those cores too.
- This remains one research target voice. It does not supply three contrasting timbres, cheerful character fit or user preference.
- Thirty seconds is not five minutes, and DC results do not predict thermal behaviour over a long session.

## Recommended follow-up

1. Treat P-core placement as a **required setting** for any live LLVC route, not an optimisation. An unpinned worker is a latent sporadic failure: the default mask's 81.49 ms worst call is enough to break the 64 ms input bound.
2. Investigate whether the same mechanism contributes to [TASK-020](../tasks/archived/TASK-020.md)'s unexplained draw-cadence collapse toward 1 Hz. The renderer and tracking workers run unpinned under the same scheduler on the same hybrid host. This is an untested hypothesis; the separate blank-white capture failure is not explained by it.
3. Repeat the diagnostic on AC to separate the frequency-cap contribution from placement, now that placement is isolated. Expect a smaller effect than the 2.32x placement ratio.
4. Only after a combined avatar/OBS paced run and physical audio measurement should an experimental LLVC profile be proposed for the converted-only route.
