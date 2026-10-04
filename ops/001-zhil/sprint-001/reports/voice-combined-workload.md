# Combined workload and paced reproducibility: the voice pipeline fails under ordinary desktop load

2026-09-12. **The paced LLVC proof passes only on a quiet machine and does not reproduce under ordinary load.** This record corrects an overstatement: an earlier checkpoint reported the paced proof as passing on the strength of one successful run. Four subsequent attempts, including two with the avatar running, all failed within 200 ms. The avatar is not the cause.

## What was claimed, and what is actually true

[pcore-thread-dc-v1](llvc-paced-pcore-thread-dc-v1.json) genuinely passed: 577/577 neural calls, zero deadline misses, first call 35.91 ms, no call above 52 ms, modeled signal start 310.94 ms. That result stands as recorded.

What it does **not** establish is reproducibility. Its input FIFO high water was **3 of 4 packets**, meaning even the clean pass held only one spare slot. Under the measured 52 ms chunk budget, that is not margin.

## Reproducibility series

Identical command and settings — inference thread pinned to mask `F`, 1 ms harness timer resolution, same licensed source — run repeatedly on battery.

| Run | Ambient load | Result | Calls | Per-call median | Max | Failure |
| --- | --- | --- | --- | --- | --- | --- |
| [dc-v1](llvc-paced-pcore-thread-dc-v1.json) | quiet | **passed** | 577 / 577 | 32.09 ms | 49.36 ms | none |
| [dc-v2](llvc-paced-pcore-thread-dc-v2.json) | ~47% | failed at 192.7 ms | 2 / 577 | 65.46 ms | 67.87 ms | ingress |
| [dc-v3](llvc-paced-pcore-thread-dc-v3.json) | ~47% | failed | 2 / 577 | 65.76 ms | 68.86 ms | ingress |
| [dc-v4](llvc-paced-pcore-thread-dc-v4.json) | ~47% | failed | 2 / 577 | 64.78 ms | 66.52 ms | ingress |
| [dc-v5](llvc-paced-pcore-thread-dc-v5.json) | ~47% | failed | 2 / 577 | 66.76 ms | 71.63 ms | ingress |

Four of five attempts failed, and the four failures are near-identical: the pipeline stops after exactly **two** neural calls, each costing roughly **65 ms** against a 52 ms budget, and the four-packet/64 ms ingress FIFO fills before a third call can start.

Ambient conditions during the failures: approximately 47% system CPU load from an open editor and browser, processor at **72% of maximum frequency**, on battery. This is not an artificial stress condition — it is what the machine looks like while someone is using it.

## Combined workload with the avatar

Two runs paired the paced converter with the real viewer, real Ene avatar and real face/pose tracking, driven by the permitted NASA-credited still. [Unpinned avatar](combined-voice-avatar-combo-v1.json), [avatar confined to efficiency cores](combined-voice-avatar-combo-split-v1.json).

| Measurement | Avatar unpinned | Avatar on efficiency cores |
| --- | --- | --- |
| Avatar draws/s before → during | 49.63 → 47.91 | 48.58 → 48.87 |
| Avatar draw retention | 0.965 | **1.006** |
| Avatar inference retention | 0.964 | 1.046 |
| Avatar recovered afterwards | yes | yes |
| Voice result | failed at 145.2 ms | failed at 145.3 ms |
| Voice calls completed | 1 of 577 | 1 of 577 |
| First call cost | **122.37 ms** | **99.32 ms** |

Findings:

- **The avatar is essentially unaffected by the converter.** It retained 96.5% of its draw rate unpinned and 100.6% when separated, and recovered fully both times. Whatever the voice problem is, it is not the voice starving the avatar.
- **Separating the two subsystems onto different core kinds does not fix the voice.** Confining all nine Chrome processes to efficiency cores (verified `FFF` → `FF0`) left the voice failing at the same point, only 23 ms cheaper on its first call. The contention that matters is not avatar-versus-voice.
- **The failure is a startup transient, not a throughput collapse.** Every combined failure occurred on the *first* neural call, before any output packet existed. The first call cost 99-122 ms against a 35.91 ms first call in the clean pass.

## What actually explains it

The [hybrid-core diagnosis](voice-llvc-hybrid-cores.md) established that efficiency cores cost 69.35 ms per call and miss every deadline, while performance cores cost 29.92 ms and miss none. The failures here cost 65-122 ms *while pinned to performance cores*.

Pinning to mask `F` selects the two physical performance cores and both of their hyperthreads. It does not reserve them. Under ordinary desktop load those same cores run the editor, the browser and the compositor, and the processor drops to 72% of maximum frequency. The result is that a P-core-pinned thread performs like an E-core thread. Pinning removes the *worst* placement; it does not deliver a quiet core.

## Consequence for TASK-024

This supplies the reproducible measured combined-workload verdict the task's first criterion asks for, as a **measured defect** rather than a pass:

- Converter alone, quiet machine, pinned: meets every deadline with one spare FIFO slot.
- Converter alone, ordinary load: fails within 200 ms, reproducibly, 4 of 4.
- Converter with avatar: fails identically; the avatar is unaffected.

The specification's audio gates — p95 <= 350 ms, <= 100 ms jitter spread and no audible breakup over five minutes — are **not met**, and no listening or physical-device acceptance is claimed. The task stays open.

## Recommended next steps, none of them applied here

1. **Two distinct failures are present, and only one is a startup problem.** In the combined runs the pipeline died on its first call (99-122 ms) while steady-state was healthy, so a startup allowance — not starting the input clock until the adapter has produced its first output — would address those. In the solo-under-load runs both completed calls cost about 65 ms, a **sustained** cost above the 52 ms budget; no startup allowance fixes that, because the converter simply does not have enough CPU under that load. Do not treat the ingress bound as the single root cause. Any contract change must be reviewed, not slipped in.
2. **Investigate the slow first call directly.** It cost 35.91 ms in the clean pass and 99-122 ms under load. Whether that is allocator behaviour after `reset()`, frequency ramp, or scheduling is unresolved.
3. **Do not pursue core separation.** It measurably does not help the voice, and the avatar needs no help.
4. Re-run the series on AC power to separate the 72% frequency cap from raw contention.
5. Treat any future single passing run as provisional until it repeats under stated load.

No microphone, speaker, WebAudio sink, OBS, physical camera or served catalog was involved in any run above, and no acceptance box is closed.
