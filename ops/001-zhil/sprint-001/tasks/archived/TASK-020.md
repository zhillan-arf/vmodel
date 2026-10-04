# TASK-020: Validate performance, recovery and local-only operation

- Status: Done
- Priority: P0
- Goal: G2
- Depends on: TASK-007, TASK-012, TASK-013, TASK-018, TASK-019
- Estimate: L (2-3 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Verify the complete app with Ene and OBS on the actual target hardware.

## Work

- Run a 30-minute combined session and record render/inference percentiles, OBS dropped frames, memory trend, resolution and thermal degradation.
- Measure seated and standing+hands presets separately; fix queues, resource leaks and expensive rendering based on evidence. The selected Cyber legs source has 112,949 triangles and 49 material slots; the prepared runtime has 112,948 triangles after one degenerate triangle was removed. Profile the actual runtime before considering material merging or texture resizing; preserve facial shape keys and appearance during optimization.
- Exercise denied camera, busy camera, disconnect, model reload, tracking loss/reentry, output restart and corrupted profile.
- Inspect network behavior after provisioning and confirm no frame uploads or required remote requests.
- Run meaningful math/worker/browser regressions; estimate end-to-end latency with an external recording if available and label any unmeasured metric honestly.

## Acceptance criteria

- [x] Baseline 720p/30 target and frame-time gates from the spec pass, or this task stays open with measured defects. Both presets completed 900-second windows at 1280x720 with 30 output fps and cleared the specification's gate of median >= 30 fps and render frame interval p95 <= 50 ms: seated **58.48 fps / p95 49.1 ms** over 40,942 frames, standing **58.14 fps / p95 39.1 ms** over 43,707 frames, with **zero skipped OBS output frames** in both and zero blank captures. End-to-end camera-to-display latency remains unmeasured and is labelled as such.
- [x] No crashes or sustained post-warmup memory growth occur during the soak test. A full two-phase 30-minute soak completed with no errors and no cleanup errors, and the earlier 55-second browser termination **did not reproduce** in the same configuration — a non-reproduction, not an identified fix, with the original cause still unknown. Memory growth is shown to be **collectable garbage rather than retention**: one forced collection reclaimed 61.11 MiB against 50.70 MiB of seated growth and 59.65 MiB against 60.37 MiB of standing growth, with main-page JS heap growth of only 6.57 and 6.91 MiB per window. Worker heaps are not attributed.
- [x] Offline operation and recovery checks pass; standing-mode limitations and tested presets are documented in ops/001-zhil/sprint-001/reports/performance.md. Both completed windows recorded **zero external requests and responses** with zero blocked media requests under the real workload with OBS recording, under an enforced `default-src 'self'` policy with page and worker probes blocked. [Tracking recovery](../../reports/tracking-recovery-smoke.json) and [viewer recovery](../../reports/viewer-smoke.json) pass.

## Implementation notes

The corrected combined run executed after Blender and website measurements released the laptop. Both 15-minute windows and their recording inspections finished, but [performance evidence](../../reports/performance.md) failed the baseline: draw/worker delivery fell to approximately 1 Hz, and the seated-end plus both standing stills are pure white. The standing window also failed the script's minimum draw-sample guard. Geometry stayed current, and exact owned cleanup/OBS restoration passed. This task remains open with measured cadence and capture defects; no live or full-rate resource acceptance is claimed.

The run used the actual production Ene app, selected GPU delegate, private permitted positive photos, one temporary avatar-only OBS source, 640×480 input, Gentle springs and 720p30 recording. Seated/no-hands and standing+hands were separate workloads; the hand-positive crop excluded feet. The selected delegate does not identify the actual executing GPU device. Both production voice receivers remained idle/muted, their settings were preserved, and scene-item states were restored. A preceding periodic keepalive defect was isolated and corrected with [browser evidence](../../reports/output-layout-heartbeat.md), while the final capture/animation failure requires targeted diagnosis before another long run.

A [short targeted diagnostic](../../reports/capture-animation-diagnostic.md) subsequently retained Ene and normal animation past the prior failure point, with viewer/browser GL identifying Iris Xe/D3D11. It did not reproduce or fix the failure. Native-window matching was missing in that run; a strict exactly-one-owned-window preflight is now prepared for later reproduction. This evidence does not close the failed baseline or physical checks.

The [original-style passive control](../../reports/capture-passive-control.md) subsequently verified that native preflight, retained Ene and normal cadence on observed AC, and used no extra rAF observer or periodic native/GL probes. All compared tests used the same single Clean-mode viewer. Historical Chrome Energy Saver/native state at the original failure is unavailable. A future full AC baseline with failure-triggered evidence may test long-run stability under declared conditions; the short controls do not close this task or identify the earlier failure's cause.

Available preflight evidence: [positive-photo tracking](../../reports/tracking-positive-fixture.md) verifies both delegates after the SDK timestamp fix, and documents realistic landmark-task cost versus negative synthetic inputs. [Feasibility](../../reports/feasibility.md) collects component checks. This does not close any combined-session, physical movement or long-soak criterion below.

Do not substitute inference time for complete motion-to-display latency, or claim fixture-only tests prove live behavior.

Offline acceptance here covers G1/G2 and any selected local voice mode. TASK-028 separately exercises the full live voice workload and any explicitly selected A100 audio path; remote voice availability must not block local avatar startup.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

## Cadence-collapse diagnosis — 2026-09-12

Two candidate mechanisms for the draw-cadence collapse were investigated. **Neither closes this task, and no acceptance box changed.** The collapse toward 1 Hz and the blank-white OBS stills both remain without a demonstrated cause.

**Window occlusion: untested, not disproven.** A collapse to approximately 1 Hz matches Chrome's background throttling rate, and entirely white window captures are the classic symptom of a window that has stopped compositing, so one occlusion cause would explain both symptoms. The [production launcher](../../../../../scripts/start.ps1) does launch Chrome with no flags at all, leaving occlusion detection and renderer backgrounding active. Two probes were built and both failed to establish the condition they meant to measure: [capture_occlusion_probe.mjs](../../../../../scripts/capture_occlusion_probe.mjs) was invalid because Playwright keeps a debugger attached, which suppresses renderer backgrounding, and because it never started tracking (`inferences` was 0 in every phase); [raf_occlusion_check.mjs](../../../../../scripts/raf_occlusion_check.mjs) removed the automation confound using real non-automated Chrome, but `visibilityState` stayed `visible` throughout, proving the synthetic topmost occluder never triggered Chrome's occlusion calculation. Both measured a flat 60 fps, which therefore says nothing. Full record and its limits: [occlusion investigation](../../reports/capture-occlusion-investigation.md), evidence [occl-v2](../../reports/capture-occlusion-occl-v2.json) and [real-v1](../../reports/capture-raf-occlusion-real-v1.json). **No production change was made on the strength of this inconclusive work**; the launcher still passes no flags. Note that the original soak also ran under Playwright with a debugger attached and still collapsed, which is mild evidence against plain renderer backgrounding.

**Hybrid-core placement: rejected for the render path.** The [voice investigation](../../reports/voice-llvc-hybrid-cores.md) established that this host's efficiency cores are 2.32x slower per neural call than its performance cores, so the same mechanism was tested against rendering. [capture_core_placement_probe.mjs](../../../../../scripts/capture_core_placement_probe.mjs) ran the real viewer, real Ene avatar and real face/pose workers — GPU delegate selected, both present, no worker errors or overflow — under four affinity phases inside one session, applied to all nine owned Chrome processes and restored afterwards. [Evidence](../../reports/capture-core-placement-cores-v1.json), [report](../../reports/capture-core-placement.md). Draw rates were 58.78 (`FFF`), 51.11 (`FF0`), 58.95 (`00F`) and 58.38 (`FFF` restored) draws/s, with a worst draw interval of 53.9 ms in any phase. Confining every browser process to efficiency cores — far more severe than any realistic scheduler migration — costs 13% of cadence, not 98%, so it cannot explain the failure. Tracking is the more sensitive consumer: inference throughput fell 24% and inference p95 rose 38%. Pinning to performance cores gave no render benefit, so **no affinity change is recommended for the avatar runtime**; it would also take performance cores away from the voice worker, which does depend on them.

**Repository defect found and fixed.** The production typecheck was broken: `scripts/soak-health.mjs` had been added without the `.d.mts` declaration its sibling modules carry, so `npm run build` failed on `tests/soak-health.test.ts`. Added [soak-health.d.mts](../../../../../scripts/soak-health.d.mts) and narrowed the discriminated-union access in the test. Production build, 80 unit tests and the 33-file bundle audit now pass again.

**Next soak requirement.** Instrument continuously rather than reconstructing afterwards: record `visibilitychange`, `freeze`, `resume`, WebGL context-loss events and compositor state throughout the run. The existing [capture-animation probe](../../../../../scripts/capture-animation-probe.mjs) already listens for the first four. Drive occlusion the way the failure actually occurred — a real application or the OBS window brought to the front during a long run — rather than with a synthetic form.

## Instrumented full soak — 2026-09-12

A further full soak ran with the fail-fast draw-health guard and blank-capture detection armed, under recorded ordinary load (33-60% ambient CPU, 73% of maximum processor frequency, battery, 3,080 MB free of 16,002 MB at the end) rather than a coordinated quiet window. [Run evidence](../../reports/local/combined-soak/2026-09-12T14-15-58-634Z-0c607f43/report.json), [analysis](../../reports/performance.md).

**The 1 Hz collapse and blank-white captures did not reproduce.** The seated-no-hands phase completed its full 900-second window with the render gate passing: median cadence **58.48 fps**, frame interval p50/p95/p99/max 17.1/49.1/55.8/96.2 ms, inference p50/p95 130.3/230.6 ms, **0 skipped OBS render frames and 0 skipped output frames of 27,002**, OBS active fps constant at 30.0, and **0 blank captures across 31 capture-health samples**. Last-versus-first ratios were 0.996-1.004 across render interval, inference and both rates, so there was no degradation over the window. The recording verified at 962.5 s, 1280x720 h264, 14,858,612 bytes with its audio track silent at -91 dB. This is the first complete 900-second window to pass the render gate cleanly; it does not identify the earlier failure's cause, but it establishes that the failure is not reliably reproducible.

**A different defect appeared.** The standing-hands phase reached roughly 55 seconds and then ended with `page.evaluate: Target page, context or browser has been closed`, leaving no phase summary or recording verification. The crash cause was **not captured**: the Windows Application log holds no Chrome crash or hang event for the interval. System memory was under pressure with the soak browser near 1.9 GB private alongside the user's browser, editor and OBS, so an out-of-memory renderer termination is plausible but **unproven and is not recorded as the cause**.

Standing performance data from the eleven collected samples, independent of the crash: steady-state hand inference cost **169-303 ms** per result, pose 100-130 ms, face 55-115 ms, and a complete cycle with all three tasks fresh cost **418-464 ms**, so full standing tracking updates arrive at roughly 2.2 Hz. The single 5,047.9 ms hands reading in the `prepared` snapshot is a one-off cold model load, not a steady-state cost. This is a performance finding for TASK-012 and TASK-013. OBS recorded 65 skipped render frames of 523,277 in this phase against zero seated.

Cleanup passed with no cleanup errors; the owned recording stopped and the original OBS collection, profile, program scene, scene-item enable flags and recording destination were all restored.

Acceptance effect: the baseline and frame-time gates **pass for the seated preset** and remain unmeasured for standing, so the first criterion keeps this task open with measured defects. The no-crash criterion **fails** on the observed crash; post-warmup memory growth is not demonstrated either way, with Chrome private bytes up 39.01 MiB over 15 seated minutes while the working set fell 49.06 MiB. Offline and recovery checks were not part of this run.

Next work should capture the standing crash rather than re-run blind: record browser process exit codes and crash state, sample system-wide available memory throughout, and consider running the standing phase first so it does not inherit fifteen minutes of accumulated browser state.

### Standing-only reproduction — 2026-09-12

The standing workload was re-run alone using the new `--phase=<id>` selector, with fresh browser state and the newly added system-memory sampling. [Run evidence](../../reports/local/combined-soak/2026-09-12T14-38-42-211Z-c43a78e8/report.json).

It failed earlier and differently: `page.waitForFunction: Timeout 90000ms exceeded` while establishing the required consecutive face-plus-pose-plus-hands detections, producing no phase data. Cleanup passed with no cleanup errors.

The memory sampling supplies the missing context. That run began with **1,468.9 MiB free of 16,002.5 MiB and 25,237.9 MiB committed**, so the host was paging; the earlier 55-second termination occurred at 3,080 MiB free. The soak browser alone holds close to 2 GB private, on top of a baseline that includes the user's browser at 1,142 MiB across 11 processes, the editor, OBS and security services.

**The standing-plus-hands workload cannot be validated on this host while the user's normal working set is loaded.** Two attempts failed in two different ways, both consistent with memory pressure. This is **not** established as a code defect: no Chrome crash event, worker error, queue overflow or capture failure was recorded in either attempt, and hand tracking ran correctly at 169-303 ms per result when it ran. The seated workload passed its full window on the same host under the same load.

Required to close the standing gates: close the editor and other browser windows, then run `node scripts/combined_fixture_soak.mjs --run --quiet-window --phase=standing-hands`. Raising the 90-second preparation timeout would mask the condition and is not recommended. Until then the standing preset's frame-time and stability gates remain **unmeasured**, and no standing acceptance is inferred from the seated pass.

#### Correction to the standing-only entry above

The memory-pressure conclusion recorded immediately above is **wrong**, and is kept visible rather than deleted.

A third attempt failed identically at **1,512.1 MiB free** against 1,468.9 MiB on the previous one, so headroom could not explain the difference. The real cause was a defect in the `--phase=<id>` selector added during this session: the loop iterated `activePhases`, but the camera-start line still tested `phase === phases[0]`, which is always `seated-no-hands`. With a standing-only selection the camera was **never started**, so no tracking result arrived and the 90-second detection wait timed out. Fixed to `activePhases[0]`.

Both standing-only timeouts are artefacts of the diagnostic harness, not findings about the application or the host. They do not support any claim about memory, hand tracking or standing stability, and the statement that the standing workload "cannot be validated on this host while the user's normal working set is loaded" was **not supported by evidence** and is withdrawn.

Unaffected by this bug: the seated 900-second pass, and the 55-second browser termination in the full two-phase soak, which used the unfiltered phase list and did start its camera. That termination remains a real, uncaptured failure.

### Standing with hands, corrected harness — 2026-09-12

After both harness bugs were fixed, two further standing-only runs were made. [Run evidence](../../reports/local/combined-soak/2026-09-12T15-02-11-696Z-d86513bb/report.json), [analysis](../../reports/performance.md).

An intermediate run reached **802 of 900 seconds** with zero skipped OBS output frames and zero blank captures before the memory sampler's own PowerShell timeout ended it. That sampler now makes one combined call per tick instead of two, at a 15-second timeout.

The corrected run reached **690 seconds** and is the first capture of this failure class with instrumentation already running. For 689 seconds it was healthy: median cadence **30.03 fps**, draw interval p50/p95/p99 **33.3/34.3/35.5 ms** over 20,641 frames, draw CPU p50 3.7 ms, **render gate passed**, OBS at a constant **30.00 fps** and ~3.5 ms average frame render time, **0 skipped OBS output frames of 20,701**, and **0 blank captures of 23 samples**. Inference p50/p95 was 195.9/331.5 ms, full three-task cycle p50 287.6 ms, per-task p50 face 67.4, pose 69.8, hands 138.6 ms.

Then at **689.4 s** the browser draw loop recorded a single **1,227.2 ms** interval, and at the **690 s** sample OBS fell to **11.72 fps** with average frame render time **60.68 ms**, its skipped render frames going 98 to 137. The owned recording then would not stop. **Browser and OBS stalled at the same moment**, which does not fit either starving the other; a shared cause such as a GPU reset, paging burst or system scheduling event fits better but **is not evidenced and is not recorded as the cause**.

Memory is not implicated: Chrome private bytes rose 39.74 MiB across the window with no exhaustion before the stall.

The fail-fast draw guard did not fire, correctly per its rule — it needs three consecutive draws over 500 ms and this produced exactly one. A single stall over a second, followed by a wedged recording, is worth catching; the guard's shape should be revisited rather than its threshold simply lowered.

Standing remains **unmeasured against the full 900-second gate**, so that criterion stays open. It is no longer unmeasured in character: the workload sustains 30 fps with a passing render gate and no dropped output frames or blank captures for eleven and a half minutes, and its failure is a sudden whole-system stall rather than degradation. Cleanup passed with no cleanup errors in every run.

### Cause identified for the failure signature — 2026-09-13

**A minimized Chrome window delivers zero animation frames.** Measured with real non-automated Chrome: **60.04 fps before, 0.00 fps while minimized with `visibilityState` reporting `hidden`, and 59.91 fps after restoring.** [Evidence](../../reports/capture-raf-minimize-min-v1.json), [report](../../reports/capture-minimize-cause.md), [probe](../../../../../scripts/raf_minimize_check.mjs).

This reproduces both original symptoms from one mechanism. Animation frames stop entirely when hidden, so draw cadence collapses — the soak saw roughly 1 Hz rather than zero because interval-driven work still occasionally drove a draw. OBS window capture of a window producing no new frames has nothing current to sample, which yields the blank white stills. No other hypothesis explained both symptoms together.

It surfaced from two consecutive standing-run failures that looked unrelated: one tripped the clean-view check, and the next tripped the native window preflight with the owned window reporting **`minimized: true`** at rectangle `-21333,-21333`, the standard Windows minimized position at this display's 1.5 device pixel ratio. That same run recorded `ACLineStatus: 1` at 17:09:14 UTC, a change from battery to AC, so a person was physically at the machine when the window became minimized.

The [occlusion investigation](../../reports/capture-occlusion-investigation.md) missed this because it tested **covering** the window rather than minimizing it; its `visibilityState` never left `visible`. Its null result is still useful in the opposite direction: covering the output window measured a flat 60 fps, so working in front of it is harmless.

**Not claimed:** that the original soak failure *was* a minimize event. No visibility state was recorded at that time — exactly the gap now closed in the harness, where the clean-view assertion persists `clean`, `visibility`, `previewHidden`, view geometry and view events before failing. This is a mechanism that reproduces the signature, not a log of the original event. The blank-capture link is inferred from frame delivery stopping rather than re-observed against an OBS source.

Product consequence, since this is the failure mode most likely to be hit in normal use: covering the output window is safe, minimizing it freezes the avatar and blanks the capture, and recovery on restore is automatic and complete. The beginner documentation now states this, and the application should detect `visibilitychange` rather than leaving the user to discover a frozen stream.

### Power transitions explain the whole-system stalls; AC doubles standing cadence — 2026-09-13

The single-stall guard added after the previous run fired and collected the paired evidence earlier attempts had missed. [Run evidence](../../reports/local/combined-soak/2026-09-12T17-14-31-614Z-c8be2e10/report.json), [analysis](../../reports/performance.md).

**Standing on AC sustains 60.61 fps median**, against 30.03 fps for the same workload on battery, over 770 measured seconds with the **render gate passing**: draw interval p50/p95/p99 **16.5/33.8/44.8 ms** across 41,692 frames, **0 skipped OBS output frames of 23,106** (2 render skips), and **0 blank captures of 27**. Earlier measurements put the processor at 72-73% of maximum frequency on battery, consistent with the halved cadence.

The guard caught a single **1,017.3 ms** draw interval at 767.3 s. The evidence collected at that instant rules out every other candidate: the window was **not minimized** (`visible: true, minimized: false, foreground: true, cloaked: 0`), the OBS capture was **not blank** (`blank: false`), the **WebGL context was not lost** (ANGLE Intel Iris Xe D3D11, driver 31.0.101.4255), there were no worker errors, the GPU delegate was active with a 103.7 ms-old tracking result, and memory was not implicated.

What differed was the power source. **Both observed whole-system stalls occurred in runs containing an AC/DC transition**: the 767.3 s stall in a run that started on AC/`Balanced` and was on DC/`BetterBattery` at failure, and the 689.4 s stall in a run that started on DC/`BatterySaver` and ended on AC/`Balanced`. A platform re-negotiating CPU and GPU frequency stalls every process simultaneously, which is the one thing that explains a browser and OBS freezing together.

**Not established: exact temporal coincidence.** Power was sampled at run start, run end and once at failure, which brackets the transition within the run but does not prove it occurred at the stall instant. Two of two with a plausible mechanism is suggestive, not conclusive. Power state is now sampled on every memory tick so the next occurrence is bracketed to one interval.

Standing still has **no completed 900-second window**, so that gate stays open. It has twice been interrupted by a power transition rather than an application fault, and between interruptions it sustained a passing render gate with zero dropped OBS output frames and zero blank captures in every attempt. Measuring it cleanly requires leaving the charger connected or disconnected for the whole run.

### Standing completes 900 seconds; criteria 1 and 3 close — 2026-09-13

Under stable power (`BetterBattery` on DC before and after, no transition) the standing workload **completed its full 900-second window** with no errors and no cleanup errors. [Run evidence](../../reports/local/combined-soak/2026-09-12T17-32-10-491Z-61449bfc/report.json), [analysis](../../reports/performance.md).

The specification's gate is median render rate at least 30 fps and 95th-percentile render frame interval at most 50 ms. **Both presets now clear it**: seated 58.48 fps with p95 49.1 ms across 40,942 frames, standing 58.14 fps with p95 **39.1 ms** across 43,707 frames. OBS skipped **zero** output frames in both (27,002 and 27,000) and there were **zero blank captures** in both (31 samples each). The standing recording verified at 963.5 s, 1280x720 h264, 21,146,318 bytes with its audio track silent at -91 dB.

The standing window contained **no stall**: worst draw interval 68.0 ms, against 1,017.3 ms and 1,227.2 ms in the two runs that contained power transitions. This is the first standing window free of one, consistent with that explanation.

Standing inference is the expensive part: p50 127.3 ms, p95 476.3 ms, full three-task cycle p50 400.1 ms, so complete tracking updates arrive at roughly 2.5 Hz while drawing continues at 58 fps. The specification anticipates this, allowing 10-20 Hz inference interpolated into 30 fps output. Drift across the window was mild: render interval p95 up 12%, render rate down 8%, inference rate down 12%.

Offline and recovery evidence: both completed windows recorded **zero external requests and responses** with zero blocked media requests under the real workload with OBS recording, under an enforced `default-src 'self'` policy with page and worker probes blocked. [Tracking recovery](../../reports/tracking-recovery-smoke.json) confirms stop, restart and second release with no automatic camera acquisition across 70 seconds; [viewer recovery](../../reports/viewer-smoke.json) confirms stable GPU resources across reloads, a working avatar after invalid motion, and context restoration without reload at constant 49/69/7 geometry/texture/program counts.

**The no-crash-or-memory-growth criterion stays open.** No crash occurred in either completed window, but the earlier two-phase run terminated its browser at 55 seconds and that cause was never captured. Memory is ambiguous rather than clean: Chrome private bytes rose 39.01 MiB seated and 67.18 MiB standing (3.86 and 6.13 MiB/min) while the working set fell 49.06 and 37.77 MiB, with no forced GC or worker-heap attribution. That supports neither a leak nor a clean result, so it is not claimed either way.

End-to-end camera-to-display latency remains **unmeasured**; the specification permits that provided it is labelled rather than substituted with inference timing.

### Clean 30-minute two-phase soak closes the final criterion — 2026-09-13

A full two-phase soak completed under stable power with `completed: true`, **no errors and no cleanup errors**. [Run evidence](../../reports/local/combined-soak/2026-09-12T17-54-07-973Z-d719380c/report.json), [analysis](../../reports/performance.md).

Seated measured **58.14 fps** with p95 44.4 ms and **0 skipped OBS output frames of 27,069**; standing measured **58.48 fps** with p95 39.8 ms and **0 skipped of 27,002**. Both cleared the specification gate, both recorded zero blank captures across 31 samples, and both recordings verified at 720p h264 (966.0 s and 963.6 s). Drift was negligible or favourable: render rate ratios 0.992 and 1.134, p95 ratios 0.998 and 0.797. Power stayed `BetterBattery` on DC throughout with no transition, external requests were zero, and OBS was restored.

**The crash did not reproduce.** The single browser termination at 55 seconds occurred in an earlier two-phase run and its cause was never captured. This run used the same two-phase configuration for 30 minutes of measurement and completed without a crash. That is a non-reproduction, not an identified fix, and the original cause remains unknown.

**The memory growth is collectable garbage, not retention.** A forced `HeapProfiler.collectGarbage` with readings either side reclaimed **61.11 MiB** against 50.70 MiB of seated growth, and **59.65 MiB** against 60.37 MiB of standing growth — a single collection recovering as much as or more than the entire window's growth. Main-page JS heap growth was only 6.57 and 6.91 MiB per window. This collects the main page heap only; worker heaps are not attributed and one collection is not a longer-session leak audit.

Input throughout was permitted still photographs through the fake-camera path, not a live webcam, and end-to-end camera-to-display latency remains unmeasured and labelled as the specification permits. Live movement quality, physical latency and subjective assessment remain open in TASK-003, TASK-009 through TASK-013 and TASK-015; nothing here closes them.
