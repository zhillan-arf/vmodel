# Combined avatar, positive tracking and OBS workload

**The baseline is not accepted.** Both planned 900-second measurement windows ran, but avatar draw/inference delivery fell to approximately 1 Hz and OBS capture became white during the seated phase. The standing phase retained that failure. TASK-020 stays open. A valid 720p30 file and zero OBS encoder skips did not mean the captured avatar remained visible or updated smoothly.

The corrected run is [2026-09-12T11-55-00-927Z-0b91f283](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/report.json), from 11:55:00 to 12:27:55 UTC on 2026-09-12. The seated window ran 11:56:42–12:11:42 UTC; standing/hands ran 12:12:51–12:27:52 UTC. Each had its own 60-second warm-up. Both recording inspections finished. The final minimum-sample guard rejected standing's 891 draws, so the script exited 1 and `completed` remains false. The report separately records `measurementWindowCompleted: true` for both windows; no interrupted-window summary is substituted for these full measurements.

## Workload and evidence boundaries

The actual production app, actual permitted Ene Cyber legs avatar, installed MediaPipe Tasks Vision 1.0.1 worker and native OBS 32.2.2 Window Capture/recording ran together. Chrome was 152.0.7977.83. The runtime avatar has **112,948 triangles**, following removal of one degenerate triangle from the original 112,949-triangle Cyber legs source. The laptop's identified hardware is an i7-1255U/Iris Xe, but this run recorded the selected MediaPipe `GPU` delegate, not GL vendor/renderer or GPU device execution telemetry. It does not prove that every graph operation ran on Iris Xe.

Input was fixed 640×480 from two [permitted NASA photos](tracking-positive-fixture.md), supplied privately through owned browser routes and a canvas fake camera. The seated preset disabled hands; the standing preset enabled hands and used the previously proven upper-body crop. The latter excludes feet and is a workload/settings label, not proof of full-body standing behavior. Repeated still photos provide positive graph workload, not human motion or live tracking quality. Both phases used Balanced quality, Gentle springs, one landscape Clean view and native 1280×720/30 H.264 MKV recording. No physical camera, microphone, voice producer or public stream was opened.

The [execution plan](combined-fixture-soak-plan.md) describes instrumentation and resource limits. Render intervals are actual viewer draw start-to-start intervals; draw wall duration includes CPU update/submission and is not a GPU timer. Inference duration is worker computation, not complete motion-to-display latency. No temperature, hardware clock or end-to-end latency was measured.

## Recorded results

| Measurement over each 900-second window | Seated / no hands | Standing / hands |
| --- | ---: | ---: |
| Observed draw rate, total draws / elapsed time | **2.013 Hz** (1,812 draws) | **0.990 Hz** (891 draws) |
| Draw interval p50 / p95 / p99 | 37.3 / 1,017.5 / 1,019.1 ms | 1,014.6 / 1,017.7 / 1,018.8 ms |
| Median instantaneous draw cadence | 26.81 fps | 0.986 fps |
| CPU draw/submission wall time p50 / p95 | 4.1 / 6.8 ms | 2.3 / 3.5 ms |
| Observed worker result rate | 1.190 Hz | 0.991 Hz |
| All worker results: inference p50 / p95 / p99 | 79.3 / 169.0 / 205.6 ms | 55.9 / 184.6 / 196.6 ms |
| Full enabled-task results: inference p50 / p95 | 96.6 / 192.0 ms | 158.4 / 191.2 ms |
| Fresh positive face / pose / hand results | 1,071 / 536 / 0 (hands disabled) | 892 / 446 / 446 |
| OBS render skips / measured frames | 0 / 27,001 | 0 / 27,001 |
| OBS encode skips / measured frames | 0 / 27,001 | 0 / 27,001 |
| Spec render gate | **Fail** | **Fail** |

The seated median cadence is misleading in isolation: its initial burst supplied many short intervals, while long later gaps consumed most wall time. The observed rate and timeline expose the failure. OBS's counters were monotonic across every adjacent sample, and its active output cadence stayed 30 Hz; it could encode repeated white content without missing encoder deadlines.

The seated file is 960.9 seconds / 2,856,006 bytes, and standing is 960.7 seconds / 1,948,616 bytes. FFprobe verified 1280×720 H.264 at nominal 30/1 in both. Their single profile-generated audio tracks measured −91 dB maximum and passed the silence check. Format, duration and silence passed; content did not.

## Draw-gap and capture failure

The [saved draw-gap analysis](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/draw-gap-analysis.json) gives a sharp onset. During the first 30 measured seated seconds, 898 draws arrived (29.93 Hz), with interval median 33.3 ms and p95 36.1 ms, alongside 193 worker results (6.43 Hz). The first interval above 500 ms ended at **+32.641 seconds / 11:57:14.835 UTC**, following intervals of 46.6, 65.5 and 183.8 ms. From the second measured minute onward, draws and worker replies settled at 59–60 per minute. Every standing draw interval was at least 996 ms.

The fake-camera paint timer continued at approximately 30.18 Hz seated and 30.30 Hz standing. The viewer and CameraTracker both schedule through `requestAnimationFrame`; their approximately 1 Hz delivery differs from the still-running canvas paint timer and the much shorter worker computation. This points to an animation-delivery problem worth investigating, but does not identify its browser, compositor, desktop or graphics cause.

Actual visual inspection and [RGB pixel checks](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/still-pixel-analysis.json) show:

- [Seated start](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/seated-no-hands-start.png): recognizable Ene Cyber legs against the intended dark background.
- [Seated end](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/seated-no-hands-end.png), [standing start](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/standing-hands-start.png) and [standing end](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/standing-hands-end.png): every pixel is RGB 255/255/255. These are capture failures, not successful avatar stills.

[Thirteen bounded samples from the saved videos](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/recording-pixel-analysis.json) confirm this is recorded content, not only an OBS screenshot problem. The seated file has normal dark/colored pixels at file seconds 0, 60 and 90, but is uniformly RGB 253/253/253 at seconds 92, 94, 96, 120, 600 and 950 after video decoding/resizing. Thus its transition occurs between file seconds 90 and 92, around the onset of delayed animation delivery after the one-minute warm-up. Standing samples at 0, 60, 450 and 950 seconds are all uniformly 253/253/253. Sampling does not prove every unsampled frame is white, but the beginning/end stills and widely separated video samples establish a sustained content failure.

All 358 sampled browser states remained visible and focused with unchanged viewport, and no resize/focus/visibility events were recorded. The strict geometry heartbeat checks continued to pass; worker errors and external responses remained empty. No periodic native compositor/GL-context telemetry or contemporaneous input-desktop state was recorded, so those checks cannot establish why the pixels disappeared. The current [post-run desktop check](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/input-desktop-after.json), at 12:31:38 UTC, found the input and thread desktops both `Default` and the process in the active console session. Current [Balanced power policy](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/power-policy-after.txt) has AC/DC display and sleep timeouts set to zero (Never). Neither read-only check proves historical desktop/display state, and no setting was changed.

## First-to-last performance and memory

The seated first five minutes averaged 4.057 draws/s and 1.590 inferences/s; the last five averaged 0.990 for both. Standing began and ended near 0.990 for both. Seated full-task inference p95 fell from 200.9 to 93.3 ms while its draw cadence deteriorated. Standing full-task inference p95 was 192.3 then 192.2 ms. These measurements do not support calling the failure increasing inference cost or thermal degradation.

Across 31 process-memory samples per phase, Chrome private-byte medians increased from 1,581.66 to 1,606.54 MiB seated (+24.87 MiB; descriptive slope +1.46 MiB/min), and from 1,713.69 to 1,731.06 MiB standing (+17.37 MiB; +1.73 MiB/min). Main-page JS heap median changes were +1.47 and +1.75 MiB. OBS main-process private-byte changes were approximately −0.02 and −0.03 MiB. No forced GC or worker-heap attribution was performed. This growth is not proof of a leak; the sustained low cadence and failed capture also prevent treating it as a successful full-rate resource soak.

## Restoration and next bounded work

Cleanup passed: the owned recording stopped, fake video track ended, worker count returned to zero, owned Chrome and ephemeral server closed, temporary scene/input were removed, and the original OBS collection/profile/program scene/scene-item enable flags/recording destination were restored. Input-settings hashes confirmed that both production voice bridges were preserved. Voice Studio stayed idle and muted; no shared server was stopped.

The two earlier interrupted runs and their independently reproduced keepalive defect remain in the [heartbeat report](output-layout-heartbeat.md). That fix passed focused tests, an accelerated actual-source browser regression, production build and bundle audit; the corrected 32-minute attempt retained live geometry heartbeats throughout. Fixing that defect did not resolve the later capture/draw failure.

Further work should correlate actual browser canvas pixels versus OBS source pixels, animation timing, GL context/vendor/renderer, browser GPU details and desktop/window state when a failure occurs. Preserve the production profile and exact privacy boundaries. Do not relax cadence/content gates or infer a graphics device, session lock or thermal cause from the selected delegate. A future full baseline under explicitly observed AC power can test stability under declared conditions, with strict native preflight and failure-triggered evidence, even if the earlier cause remains unresolved. Live gestures, physical permission/device checks, standing feet/knees and external latency acceptance remain separate outstanding work.

A subsequent [180-second passive plus 30-second activation diagnostic](capture-animation-diagnostic.md) did not reproduce the failure: paired canvas/OBS images retained Ene, viewer GL identified Iris Xe/D3D11, and no context loss occurred. Its native-window helper matched no window, a preserved limitation now guarded by an exactly-one-match preflight for future runs. This short good result is not an identified fix and does not supersede the failed full measurements.

The later [177-second original-style passive control](capture-passive-control.md) also stayed healthy after a60-second warm-up, with the corrected native preflight and pre/post AC power observations. It used no extra rAF observer, periodic native/GL probes, initial canvas readback or activation. The report verifies that all three tests used the same single Clean-mode viewer; no separate viewer was removed. It documents missing historical Chrome Energy Saver/native state and preserves the original long-run failure as unresolved.

## 2026-09-12 instrumented re-run: seated passes 900 seconds; standing crashes at 55 seconds

A further full soak ran with the fail-fast draw-health guard and blank-capture detection armed. [Run evidence](local/combined-soak/2026-09-12T14-15-58-634Z-0c607f43/report.json). **The earlier 1 Hz collapse and blank-white captures did not reproduce in the seated window.** A new and different defect appeared in the standing window.

Conditions were recorded and were deliberately **not** a coordinated quiet window: approximately 33-60% ambient CPU from the user's editor and browser, processor at 73% of maximum frequency, on battery, with 3,080 MB free of 16,002 MB at the end. This is ordinary working load, which makes the seated result stronger and the standing crash harder to attribute.

### Seated, no hands: full 900 seconds, render gate passed

| Measurement | Result |
| --- | --- |
| Measured window | 900 s completed, 40,942 render frames |
| Median cadence | **58.48 fps** |
| Frame interval p50 / p95 / p99 / max | 17.1 / 49.1 / 55.8 / 96.2 ms |
| Inference p50 / p95 / max | 130.3 / 230.6 / 270.7 ms |
| Proposed render gate | **passed** |
| OBS render skipped / total | **0 of 27,002** |
| OBS output skipped / total | **0 of 27,002** |
| OBS active fps | 30.0 at p50, p95 and p99 |
| OBS average frame render time | p50 3.39 ms, max 4.78 ms |
| Blank captures | **0 of 31 capture-health samples** |
| Recording | 962.5 s, 1280x720, h264, 14,858,612 bytes, audio track silent at -91 dB |

Degradation across the window was absent: last-versus-first ratios were 1.004 for render interval p95, 1.002 for inference p95, 0.996 for render rate and 0.998 for inference rate.

Memory over 29 samples is inconclusive rather than a leak. Chrome private bytes rose from a 1,696.62 MiB median to 1,735.63 MiB (+39.01 MiB, descriptive slope +3.86 MiB/min) while the working set **fell** from 2,069.58 to 2,020.52 MiB (-49.06 MiB). No forced GC or worker-heap attribution was performed.

This is the first complete 900-second window with the render gate passing, zero dropped OBS frames and zero blank captures. It does not identify the earlier failure's cause; it establishes that the failure is not reliably reproducible under these conditions.

### Standing with hands: browser closed at approximately 55 seconds

The second phase reached roughly 55 seconds of its measured window and then ended with `page.evaluate: Target page, context or browser has been closed`. No phase summary, recording verification or capture-health conclusion exists for it.

What the eleven collected samples do show:

- Steady-state hand inference cost **169-303 ms** per result, pose 100-130 ms and face 55-115 ms. A complete cycle with all three tasks fresh cost **418-464 ms**, so full standing tracking updates arrive at roughly 2.2 Hz.
- The `prepared` snapshot recorded a single **5,047.9 ms** hands reading. That is a one-off cold model load, not steady-state, and should not be quoted as the running cost.
- Chrome private bytes moved only from 1,857.18 to 1,869.90 MiB across the observed 55 seconds, so a runaway allocation inside the window is not evidenced.
- OBS recorded 65 skipped render frames of 523,277 during this phase, against zero in the seated phase.

**The crash cause was not captured.** The Windows Application log contains no Chrome crash or hang event for the interval, only unrelated extension garbage-collection entries. System memory was under pressure at the end of the run (3,080 MB free of 16,002 MB) with the soak browser near 1.9 GB private alongside the user's own browser, editor and OBS, so an out-of-memory renderer termination is plausible but **unproven**. Do not record it as the cause.

Cleanup passed with no cleanup errors: the owned recording stopped, the temporary scene and input were removed, and the original OBS collection, profile, program scene, scene-item enable flags and recording destination were restored.

### Effect on acceptance

- The baseline and frame-time gates **pass for the seated preset** and are unmeasured for standing. The task stays open with measured defects, as its first criterion allows.
- The no-crash criterion **fails**: a crash occurred. Post-warmup memory growth is not demonstrated either way.
- Offline and recovery checks were not part of this run.

Next work should capture the standing crash rather than re-running blind: collect browser process exit codes and `chrome://crashes` state, record system-wide available memory throughout, and consider running the standing phase first so it does not inherit fifteen minutes of accumulated browser state. Hand-task cost of 169-303 ms per result is a separate performance finding for TASK-012 and TASK-013, independent of the crash.

### Standing-only reproduction: blocked by host memory pressure, not reproduced as a code defect

The new `--phase=standing-hands` selector re-ran that workload alone with fresh browser state, so it could not inherit fifteen minutes of accumulated state. [Run evidence](local/combined-soak/2026-09-12T14-38-42-211Z-c43a78e8/report.json).

It failed earlier and differently: `page.waitForFunction: Timeout 90000ms exceeded` while establishing the four consecutive face-plus-pose-plus-hands detections the phase requires before recording. No phase data, warm-up trace or prepared snapshot was produced. Cleanup passed with no cleanup errors.

The newly added system-memory sampling explains the context. At the start of that run the host had **1,468.9 MiB free of 16,002.5 MiB**, with **25,237.9 MiB committed** — committed memory well above physical, meaning the machine was paging. The previous run's crash at roughly 55 seconds occurred with 3,080 MiB free, and the soak browser alone holds close to 2 GB private.

Baseline consumption on this host, with none of it attributable to the soak: the user's browser at 1,142 MiB across 11 processes, the editor across many processes, OBS, security services and background tooling. The soak browser's approximately 2 GB lands on top of that.

Conclusion, stated at the strength the evidence supports:

- **The standing-plus-hands workload could not be validated on this host while the user's normal working set was loaded.** Two attempts failed in two different ways, both consistent with memory pressure: a browser termination at 55 seconds with 3,080 MiB free, and a failure to establish tracking at all with 1,468.9 MiB free.
- **This is not established as a code defect.** No Chrome crash event, no worker error, no queue overflow and no capture failure was recorded in either attempt. Hand tracking itself ran correctly when it ran, at 169-303 ms per result.
- **The seated workload is unaffected** and passed its full 900-second window on the same host under the same ordinary load.

To validate standing, the run needs headroom: close the editor and other browser windows first, then run `node scripts/combined_fixture_soak.mjs --run --quiet-window --phase=standing-hands`. Raising the 90-second preparation timeout would only mask the condition and is not recommended. Until then, the standing preset's frame-time and stability gates remain **unmeasured**, and no standing acceptance should be inferred from the seated pass.

#### Correction: the two standing-only failures were a defect in the new phase selector, not memory pressure

The memory-pressure conclusion recorded above is **wrong** and is retained only so the mistake is visible.

A third attempt failed identically with **1,512.1 MiB free**, against 1,468.9 MiB on the second - essentially the same headroom, so memory could not be the discriminator. Inspection then found the actual cause in the `--phase=<id>` selector added for these runs. The phase loop was changed to iterate `activePhases`, but the line that starts the camera still read:

```js
if (phase === phases[0]) await page.evaluate(() => document.querySelector('#start').click());
```

`phases[0]` is always `seated-no-hands`. With `--phase=standing-hands` selected, that condition was never true, **the camera was never started**, no tracking result ever arrived, and the 90-second wait for consecutive face-plus-pose-plus-hands detections timed out. The fix is `activePhases[0]`.

Both standing-only timeouts are therefore artefacts of the diagnostic harness introduced in this session, not observations about the application or the host. They say nothing about memory, hand tracking or standing stability.

What survives from the earlier analysis:

- The **55-second browser termination in the full two-phase soak** is unaffected by this bug, because that run used the unfiltered phase list and its camera did start. That failure remains real and its cause remains uncaptured.
- Host memory is genuinely tight - roughly 1.5 GiB free with the soak browser loaded, and committed memory above physical - but it is **not evidenced as the cause of anything**, and the claim that standing "cannot be validated on this host" was not supported.
- The seated 900-second pass is unaffected.

Recorded because the wrong conclusion was already committed, and because a harness bug that silently produces a plausible-looking failure is exactly the kind of thing that turns into a false finding.

### Standing with hands, corrected harness: 689 healthy seconds then a simultaneous stall

Two further standing-only runs were needed after the two harness bugs above were fixed. [Run evidence](local/combined-soak/2026-09-12T15-02-11-696Z-d86513bb/report.json).

An intermediate run reached **802 of 900 seconds** with zero skipped OBS output frames and zero blank captures before the memory sampler's own PowerShell timeout ended it; that sampler now issues a single combined invocation per tick instead of two, with a 15-second timeout. [Intermediate evidence](local/combined-soak/2026-09-12T14-45-26-887Z-cefca7c3/report.json).

The corrected run reached **690 seconds** and is the first time this class of failure has been captured with instrumentation already running.

For 689 seconds the workload was healthy and steady:

| Measurement | Result over 690 s |
| --- | --- |
| Median cadence | 30.03 fps, observed render 29.91 Hz |
| Draw interval p50 / p95 / p99 | **33.3 / 34.3 / 35.5 ms** across 20,641 frames |
| Draw CPU p50 / p95 | 3.7 / 5.3 ms |
| Proposed render gate | passed |
| OBS active fps | **30.00 constant** through sample 124 of 126 |
| OBS average frame render time | ~3.3-4.0 ms, p50 3.51 ms |
| OBS output skipped / total | **0 of 20,701** |
| Blank captures | **0 of 23 samples** |
| Inference p50 / p95 | 195.9 / 331.5 ms; full three-task cycle p50 287.6 ms |
| Per-task p50 | face 67.4 ms, pose 69.8 ms, hands 138.6 ms |

Then, abruptly:

- At **689.4 s** the browser draw loop recorded a single **1,227.2 ms** interval. Every preceding interval in that window was within 7.9-35.5 ms.
- At the **690 s** sample OBS reported `activeFps` **11.72** against a constant 30.00 beforehand, and `averageFrameRenderTime` **60.68 ms** against a 3.51 ms median. OBS skipped render frames jumped from 98 to 137.
- The owned recording then **would not stop**, failing the `Owned recording did not stop` assertion.

The browser and OBS stalled **at the same moment**. This is not one component starving the other: a renderer slowdown would not stop OBS's own compositor from running, and an OBS slowdown would not freeze the page's animation callbacks. A shared cause — GPU driver reset, a disk or paging burst, or a system-wide scheduling event — fits the shape better, but none of those is evidenced and none should be recorded as the cause.

Two further observations:

- **The fail-fast draw guard did not fire, correctly but unhelpfully.** It requires three consecutive draws over 500 ms; this failure produced exactly one. A single stall of over a second followed by a wedged recording is worth catching, so the guard's shape should be revisited rather than its threshold lowered.
- **Memory is not implicated.** Chrome private bytes rose 39.74 MiB over the window (slope 6.27 MiB/min) and the working set 40.59 MiB. Nothing resembling exhaustion preceded the stall.

Standing is therefore **still unmeasured against the full 900-second gate**, but it is no longer unmeasured in character: the workload itself sustains 30 fps with a passing render gate, zero dropped output frames and zero blank captures for eleven and a half minutes, and the failure is a sudden whole-system stall rather than degradation.

Cleanup passed with no cleanup errors in every run above.

### Both whole-system stalls coincide with an AC/DC power transition, and AC doubles standing cadence

The new single-stall guard fired during a further standing run and collected the paired evidence that every previous attempt had missed. [Run evidence](local/combined-soak/2026-09-12T17-14-31-614Z-c8be2e10/report.json).

#### Standing on AC power: 60.61 fps

Measured over 770 seconds before the stall, with the render gate passing:

| Measurement | On AC (this run) | On battery (earlier run) |
| --- | --- | --- |
| Median cadence | **60.61 fps** | 30.03 fps |
| Draw interval p50 / p95 / p99 | **16.5 / 33.8 / 44.8 ms** | 33.3 / 34.3 / 35.5 ms |
| Frames observed | 41,692 | 20,641 |
| OBS output skipped / total | **0 of 23,106** | 0 of 20,701 |
| OBS render skipped | 2 | 39 |
| Blank captures | **0 of 27** | 0 of 23 |
| Render gate | passed | passed |

**Power state doubles standing cadence.** The battery run was capped near 30 fps; on AC the same workload sustains 60 fps. Earlier measurements recorded the processor at 72-73% of maximum frequency on battery, which is consistent.

#### The stall is a power-source transition

The guard caught a single **1,017.3 ms** draw interval at 767.3 s. At that moment the collected evidence shows the system was otherwise healthy:

- Window **not minimized**: `visible: true, minimized: false, foreground: true, cloaked: 0`.
- OBS capture **not blank**: `blank: false`, near-white fraction 0.00067.
- WebGL context **not lost**, renderer ANGLE Intel Iris Xe D3D11, driver 31.0.101.4255.
- No worker errors, GPU delegate active, last tracking result 103.7 ms old.
- Memory not implicated.

What had changed was the power source:

| Run | Power at start | Power at/after failure | Transition |
| --- | --- | --- | --- |
| Stall at 767.3 s | **AC**, `Balanced` | **DC**, `BetterBattery` | unplugged during the run |
| Stall at 689.4 s | **DC**, `BatterySaver` | **AC**, `Balanced` | plugged in during the run |

**Both observed whole-system stalls happened in runs where the charger was connected or disconnected mid-run**, and in both cases Windows also changed effective power mode. A platform re-negotiating CPU and GPU frequency stalls every process at once, which is exactly the simultaneity that neither browser-starves-OBS nor OBS-starves-browser could explain.

An earlier `ACLineStatus` change was recorded at 17:09:14 UTC in a different run, so someone has been physically connecting and disconnecting the charger through this period.

#### What is and is not established

Established: two of two whole-system stalls occurred in runs containing an AC/DC transition; at the one stall with a snapshot taken at the moment of failure, the power source differed from the run's start; and every other candidate — minimized window, blank capture, lost GL context, worker error, memory exhaustion — was directly measured and ruled out at that instant.

**Not established: exact temporal coincidence.** Power was sampled at run start, at run end and once at the failure. That brackets the transition within the run but does not prove it occurred at the stall instant. Correlation is two of two with a plausible mechanism, which is suggestive, not conclusive.

Power state is now sampled on every memory tick, alongside free and committed memory, so the next occurrence brackets the transition to within one sampling interval instead of a whole run.

#### Consequence

Standing still has **no completed 900-second window**. It has now twice been interrupted by a power transition rather than by any application fault, and in between it sustained a passing render gate at 60 fps on AC and 30 fps on battery, with zero dropped OBS output frames and zero blank captures in every attempt.

To measure the standing gate cleanly, leave the charger alone for the duration of the run.

### Standing completes its 900-second window: both presets now pass the specification gate

Under stable power — `BetterBattery` on DC before and after, with no transition — the standing workload completed its full measured window with no errors and no cleanup errors. [Run evidence](local/combined-soak/2026-09-12T17-32-10-491Z-61449bfc/report.json).

The specification's gate is *median render rate at least 30 fps and 95th-percentile render frame interval at most 50 ms*, at 1280x720 with 30 output fps. Both presets clear it:

| Measurement | Seated, no hands | Standing with hands |
| --- | --- | --- |
| Measured window | 900 s, 40,942 frames | 900 s, 43,707 frames |
| Median cadence | **58.48 fps** | **58.14 fps** |
| Draw interval p50 / p95 / p99 / max | 17.1 / **49.1** / 55.8 / 96.2 ms | 17.2 / **39.1** / 49.1 / **68.0 ms** |
| Specification gate | **passed** | **passed** |
| OBS render skipped / total | 0 of 27,002 | **0 of 27,001** |
| OBS output skipped / total | 0 of 27,002 | **0 of 27,000** |
| Blank captures | 0 of 31 | **0 of 31** |
| Recording | 962.5 s, 720p h264 | 963.5 s, 720p h264, 21,146,318 bytes, audio silent at -91 dB |

The standing window had **no stall at all**: its worst draw interval was 68.0 ms, against the 1,017.3 ms and 1,227.2 ms stalls seen in the two runs that contained power transitions. That is consistent with the power-transition explanation and is the first standing window free of one.

Standing inference remains the expensive part: p50 127.3 ms, p95 476.3 ms, and a full three-task cycle at p50 400.1 ms, so complete tracking updates arrive at roughly 2.5 Hz while drawing continues at 58 fps. The specification anticipates this, allowing 10-20 Hz inference interpolated into 30 fps output.

Mild drift across the window: render interval p95 rose 12%, render rate fell 8% and inference rate fell 12% from first five minutes to last. Nothing approaching the earlier collapse.

#### Offline operation and recovery

Both completed 900-second windows recorded **zero external requests and zero external responses**, with zero blocked media requests, under the real workload with OBS recording. The enforced policy is `default-src 'self'` with no remote origins, and both page-level and worker-level external probes are blocked.

Recovery checks pass independently: [tracking recovery](tracking-recovery-smoke.json) confirms stop, restart and a second release with no automatic camera acquisition and no external requests across a 70-second run, and [viewer recovery](viewer-smoke.json) confirms stable GPU resources across reloads, a working avatar after invalid motion, and WebGL context restoration without reload, with geometry, texture and program counts constant at 49/69/7.

#### Acceptance

- **Baseline and frame-time gates: pass.** Both presets measured at 1280x720 with 30 output fps and zero skipped OBS output frames. End-to-end camera-to-display latency remains **unmeasured**, which the specification explicitly permits provided it is labelled rather than substituted with inference timing.
- **Offline operation and recovery: pass**, with standing limitations and tested presets documented above.
- **No crashes or sustained memory growth: not closed.** No crash occurred in either completed window, but the earlier two-phase run did terminate its browser at 55 seconds and that cause was never captured. Memory is genuinely ambiguous rather than clean: Chrome private bytes rose 39.01 MiB seated and 67.18 MiB standing (slopes 3.86 and 6.13 MiB/min) while the working set **fell** 49.06 and 37.77 MiB. No forced GC or worker-heap attribution was performed, so this supports neither a leak nor a clean bill of health.
