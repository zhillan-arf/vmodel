# Optional exact RVC CPU repeat: reviewed execution plan

2026-09-12. **Prepared only; no repeat, Torch import, browser, OBS or power-setting operation ran.** Root decides whether to execute after the queued LLVC paced test and a fresh coordinated quiet-window release. The reviewed launcher and manifest are now at `scripts/voice/repeat_rvc.py` and `config/voice/rvc-repeat-review.json`; the production benchmark, profiles, upstream checkout and old outputs are unchanged.

## Assessment

A single repeat of `cpu-q8-eager-3t` is justified to measure the best old candidate under documented current conditions. It is not a demonstrated DC-to-AC comparison of RVC, and the LLVC speed ratio cannot be transferred to another architecture/preset as a prediction.

The [old RVC report](voice-performance.md) selects the int8 encoder/eager generator at three threads as the best of its three candidates: compute p50/p95 **418.31 / 578.21 ms**, RTF **2.889**, 66 processed blocks and 121 dropped input blocks; all 66 processed blocks missed their 160 ms deadline. The report records a 10.77% baseline system CPU sample, not an entirely idle computer.

Neither the [aggregate JSON](voice-performance.json) nor the individual run records contains an AC/battery/effective-mode measurement or per-run wall-clock timestamp. Available file modification times place the saved RVC reports at approximately **08:52–08:57 UTC**; those are filesystem metadata, not independent power telemetry. The available [power comparison](capture-power-comparison.md) retains `AcOnline=false` at **10:05:43 UTC** and `AcOnline=true` at **12:03:00 UTC**. Its earlier query deliberately selected only the latest event before the later 11:45 UTC window. **The power source during the earlier RVC measurements is unknown.** Do not backdate the 10:05 DC event to those runs.

The later exact 52 ms/one-thread LLVC repeat ran about four times faster with byte-identical audio, showing that the old measurements should not be generalized to all current conditions. The associated power history is a concrete confound across the broader period; CPU/GPU frequency, thermal limits and scheduling were not measured. One unchanged RVC repeat can establish current paced behavior while retaining those limits.

## Minimal wrapper changes

[repeat_rvc.py](../../../../scripts/voice/repeat_rvc.py) imports the actual hash-pinned [original benchmark module](../../../../scripts/voice/benchmark.py), then calls its **unchanged `worker()`**. It only redirects that worker's private module-level `OUTPUT` variable into a new run directory. The original process/model function, quantizer cache read, ten-chunk warm-up, random seed, 48 kHz replay, 160 ms chunks, 1,600 ms past context, 40 ms crossfade, 10 ms SOLA search, one-slot mailbox, discontinuity flush and late-output muting remain unchanged. The nominal 30-second test still schedules **187 full chunks / 29.92 seconds of input**, as before.

The wrapper adds an optional unique `--run-label`; existing run folders are rejected, so old artifacts cannot be overwritten. Only `cpu-q8-eager-3t` is exposed. No alternate backend, context, precision, thread count or preparation-only mode is offered.

[review manifest](../../../../config/voice/rvc-repeat-review.json) pins the original benchmark source, preset/catalog files, old best report/output files, source audio, original target, safe tensor copy, original ContentVec encoder, cached int8 encoder and cache metadata. The released worker verifies these before and after the benchmark. It also recomputes the existing encoder's xxh128 cache key **before invoking the original loader**, preventing a missing/stale-cache regeneration. Missing or changed assets stop the experiment; no download or quantization is performed by this wrapper. Original numerical/provider hashes must match the old result.

The hidden child uses the same installed Python environment and original isolated working directory/environment whitelist. Explicit Python `-B` prevents writing import bytecode into upstream folders; it does not alter benchmark arithmetic. The parent bounds the entire worker at **180 seconds**, uses the exact System32 `taskkill.exe` with its own ten-second bound, reserves its report/log before launch, writes PID metadata separately to avoid boot races, and terminates only that owned worker tree on timeout/interruption/failure. Logs and errors remain in the unique run directory. No production service is launched or changed.

## Power and CPU evidence

Worker snapshots before and after the complete load/warm-up/benchmark procedure read current Windows AC/battery/battery-saver status, active **base** power-scheme GUID, process priority/affinity, process CPU totals, system cumulative CPU counters, CPU identity and logical-processor count. After imports the snapshot also reads actual Torch intra/inter-op thread counts. These calls occur outside the unchanged benchmark timers and invoke no setters.

The base scheme is not the effective power overlay. Endpoint snapshots do not prove continuous power state through the interval and do not measure frequency/temperature. The benchmark's original process-CPU/system-CPU and wall/compute/deadline records remain separately intact. A timeout may retain only a parent-side after-cleanup power snapshot; its PID/scope distinguish it from the worker's missing final snapshot.

## Proposed single command — not executed

After root explicitly selects the repeat and voice releases its hardware window:

```powershell
python scripts/voice/repeat_rvc.py --preset cpu-q8-eager-3t --run-label power-reviewed-01 --quiet-window
```

Use a new label for any separately approved retry. Planned outputs are under `ops/001-zhil/sprint-001/reports/local/voice/rvc-repeat/power-reviewed-01/`: `run-report.json`, `launch.json`, `worker.log`, and the original worker's `cpu-q8-eager-3t.json`, computed WAV and deadline WAV. **No repeat run or result exists yet.**

Review current power snapshots, source/runtime equality, processed/dropped/late totals, compute and capture-to-ready tails, process CPU and elapsed wall time. Even a mean RTF below 1 would not excuse deadline misses, muted/dropped audio or unmeasured physical latency. Faster scheduling changes which source blocks are processed and consumes stochastic generator calls differently, so bit-identical WAVs are not an expected acceptance condition for this paced RVC comparison. No live or audible-quality gate is accepted automatically.

## Preparation verification

The promoted launcher passes static AST parsing/compilation without executing the compiled code and has no top-level Torch/NumPy/ONNX imports. The original benchmark remains SHA-256 `1ca5f6479d1a76cd7f25d2b643368b6243ac19d6d1e4509c09d06a74c54cc949`. Large-model hashes in the staged manifest come from retained provenance and will be checked by the released worker; models were not reloaded during preparation. Every launcher exit also terminates and waits for its owned child if it is still running.
