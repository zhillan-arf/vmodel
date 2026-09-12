# Prepared combined positive-fixture soak

2026-09-12. **The original full run failed; the updated failure-evidence harness is prepared for root review and has not run.** The failed run and two healthy short controls remain separately preserved. This supplies independent TASK-020 workload evidence while physical camera, movement and response checks remain pending. Do not mark TASK-020 or its live acceptance criteria complete from this script.

Implementation: [combined_fixture_soak.mjs](../../scripts/combined_fixture_soak.mjs), [private fake-camera adapter](../../scripts/positive-camera-fixture.mjs), [measurement summaries](../../scripts/soak-metrics.mjs). It reuses the production server helper, OBS WebSocket client and reviewed output crop calculation. No application, worker, avatar, OBS source settings or voice route keys are changed by preparation.

## Fixed workload

| Phase | Actual settings | Private camera input | Measured time |
| --- | --- | --- | --- |
| Seated, no hands | Seated, hands disabled, Balanced, Gentle springs, full-avatar framing | Whole permitted NASA portrait, aspect fitted with black letterboxing into 640×480 | 900 seconds after 60 seconds of recording/tracker warm-up |
| Standing + hands | Standing, hands enabled; all other settings unchanged | Proven positive face/pose/hand crop from the second permitted photo: source rectangle x150, y75, width520, height400, aspect fitted into 640×480 | 900 seconds after its own 60 seconds of warm-up |

The second phase is a **standing-preset workload**, not proof of standing performance: its crop excludes the feet. The report records detected face/pose/hands and visible-foot counts. Static photos cannot validate joint accuracy, movement quality, identity association, calibration, contact or capture latency. The full-body photo contains part of another person; no identity or sensitive-trait analysis is performed.

The actual installed production app loads the real Cyber legs VRM. Its real `CameraTracker` receives an owned canvas `MediaStream` requested at 30 fps; the canvas has a fixed 640×480 backing buffer. Its existing worker defaults to GPU and runs the installed models. A CPU fallback stops this specific GPU experiment and is reported. No fabricated tracking frames are fed into the avatar. A small wrapper observes the real worker results and real viewer draw calls without changing their arguments or results.

One native Chrome window displays Clean view. The real renderer backing buffer and existing **Ene Landscape** OBS profile must both be 1280×720, with OBS at 30 fps. There is one avatar renderer, one tracker and one uniquely named temporary OBS Window Capture source. The raw photo canvas stays unattached to the DOM; the camera preview remains hidden. OBS receives only the Ene window, cropped using its actual published geometry, with cursor and capture audio disabled.

## Photo provenance

The files remain in ignored `assets/testing`; only the owned Playwright context can fulfill their synthetic `/testing/soak-*.jpg` routes. They are not copied to `public`, `dist` or OBS sources. Source content is unchanged apart from ordinary camera-style crop, resize and letterboxing. Existing permissions and exact content were checked in the [positive-photo investigation](tracking-positive-fixture.md).

| Local file | SHA-256 | Credit and exact source |
| --- | --- | --- |
| `assets/testing/jsc2021e037768_alt.jpg` | `7a7536821783691d1c7b58f5ee7cb601abbeaaa2f4703e755a15c5dbb4271b78` | NASA/Josh Valcarcel, [original image](https://images-assets.nasa.gov/image/jsc2021e037768_alt/jsc2021e037768_alt~orig.jpg) |
| `assets/testing/jsc2026e002116.jpg` | `194f6ba51f7bdeb090c9a47e7ab69d3fa191fbb6240cd4b6f118a215bc27caf0` | NASA/Robert Markowitz, [medium image](https://images-assets.nasa.gov/image/jsc2026e002116/jsc2026e002116~medium.jpg) |

These are private factual/informational inference checks under [NASA's media usage guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/). They are not training inputs, promotional character imagery, AI-generated images, identity analysis or public redistribution. NASA credit identifies the image source and implies no endorsement.

## Measurements and limits

- Every actual viewer draw yields its start-to-start render interval and CPU wall duration around VRM update plus render submission. Report nearest-rank p50/p95/p99, observed render rate and median cadence. The CPU wall duration is **not a GPU timer**; OBS supplies its own render-thread averages/skips.
- Every actual worker reply yields total inference time. Per-task distributions count only newly evaluated samples, not reused pose/hand results. Separate full-enabled-task frames from the mixed-cadence overall distribution. No landmark coordinate arrays are retained in the trace.
- Sample OBS at approximately five-second intervals: render/output total and skipped-frame counters, active fps, average render time, CPU/memory and recording bytes/duration. Differences are taken within each recording after warm-up; counter resets cannot become false zero-skip passes. Fields follow the [official obs-websocket protocol](https://raw.githubusercontent.com/obsproject/obs-websocket/5.7.0/docs/generated/protocol.json).
- About every 30 seconds, use this Chrome instance's [CDP process list](https://chromedevtools.github.io/devtools-protocol/tot/SystemInfo/#method-getProcessInfo) to query only those process IDs plus the exact project OBS executable. Report private bytes and working sets, process count and the main-page [CDP heap metric](https://chromedevtools.github.io/devtools-protocol/tot/Performance/#method-getMetrics). The heap excludes worker heaps; process totals cover this browser's processes. Working-set sums can count shared pages more than once. No GC is forced.
- Compare the first five and last five measured minutes **within each preset**. Report timing ratios, inference throughput and descriptive memory slopes/median differences. This does not identify thermal throttling or prove a memory leak. Temperature sensors, clock telemetry and end-to-end latency are unmeasured.
- The specification's render gate is assessed as median cadence at least 30 fps and render-interval p95 at most 50 ms. OBS skip fractions and memory trends remain visible for review. `completed` means the planned experiment finished; `taskAcceptance` remains false even if its render gate passes.

Instrumentation, synthetic canvas painting, JSON writes and periodic process queries add some workload. Per-frame telemetry drains every five seconds, with bounded in-browser buffers. The updated harness also samples a small OBS thumbnail as described below. The experiment measures this reproducible combined fixture, not an uninstrumented physical camera session.

## Prepared failure evidence and early stop

The unchanged workload and render/sample-count/OBS gates are retained. Before each recording, the read-only native helper must find exactly one window belonging to this Chrome browser PID, with either the exact unique document title or that title plus Chrome's verified ` - Google Chrome` suffix. It must be visible, unminimized and uncloaked; the second phase must retain the same HWND. A missing match is retained and stops setup before recording. Optional caption inspection is restricted to that exact owned PID. Native state is observed again after the workload; there is no periodic native query or page activation.

Current Windows power is saved before and after the workload. Actual owned launch arguments are saved with the temporary profile path redacted. No power/browser preference, security setting, desktop or driver is changed. Endpoint observations do not establish continuous AC power or Chrome Energy Saver state. Root may schedule a new baseline on observed AC to declare its conditions; this cannot retroactively explain or pass the earlier failed run.

The five-second trace drain now examines every adjacent draw interval, including streaks crossing two drains. Three consecutive intervals strictly greater than500 ms, or no completed viewer draw for more than2.5 seconds, trigger failure at the next existing drain. These checks apply after positive fixture readiness, including warm-up; the warm-up trace is saved separately and never included in the 900-second performance summary. An isolated long draw does not accumulate with later unrelated slow frames.

To detect blank OBS output independently of draw timing, a **160×90 thumbnail of only the owned OBS scene** is sampled at the existing approximately30-second boundary. PNG pixels are decoded in Node through the already pinned Playwright test utility; no extra browser page/canvas is created. An image that is at least99.5% near-white, near-black or transparent, or has at most3 levels of range in every RGB channel, is a conservative blank-output failure. The existing640×360 phase start/end stills use the same check. A nonblank result only establishes varied pixels; it does not prove Ene identity, motion or pose quality. Normal thumbnails contribute compact pixel statistics and are not saved as redundant images; a triggering thumbnail is preserved. This small OBS-only readback is an **added observer compared with the old baseline**, and blank detection can lag its onset by approximately30 seconds plus request time.

On either trigger, the script first writes the triggering timing/pixel facts. It then starts bounded, independent requests for an immediate-after-draw canvas image, an owned OBS still, native/input-desktop state, current power, the browser GPU description and current page state. Canvas/GL instrumentation is installed only at this failure boundary, with its extra rAF observer disabled. Each observation has a10-second host deadline; unavailable evidence is recorded, not invented. The recording stops and exact restoration runs without starting the next phase. A complete renderer stall therefore cannot turn into an additional30 minutes of white recording. These diagnostic interventions are excluded from the already-drained performance trace.

The same paired evidence is collected after both recordings stop if the full run finishes. No periodic canvas readback, WebGL query, independent rAF callback, native-state poll, page activation or wake request is added to measured phases. The original two-phase durations, inference/render instrumentation, existing five-second OBS queries and approximately30-second process-memory samples remain unchanged. Interrupted traces and recording paths remain labeled partial; endpoint diagnostic errors and cleanup failures remain explicit.

## Ownership and restoration

Preflight requires the existing **Ene Studio** collection, one project-owned OBS process, no global desktop/microphone inputs, and recording/streaming/virtual-camera/replay outputs stopped. Voice Studio at port5082 must be idle and muted before and throughout the run. Only existing Window Capture inputs and these exact named receivers are accepted:

| Input | Permitted origin/path |
| --- | --- |
| Ene Converted Voice Bridge | `http://127.0.0.1:5082/obs` |
| Ene Natural Voice Bridge | `http://127.0.0.1:5082/obs-natural` |

Private fragments are neither printed nor written to reports. The receivers' settings, monitoring, keys and routes are not changed. Existing scene-item enable flags are captured, all existing collection items are disabled temporarily, and only the unique temporary scene/capture is used. Original profile, collection, program scene, studio/preview mode and every original scene-item enable flag are restored; input-settings digests verify preservation. Only the Landscape recording directory and filename format are temporarily changed; their original values are restored and checked. The real encoder configuration is recorded and retained.

Cleanup stops only the recording started here, disables its capture before changing or closing Chrome, stops the fake tracks/worker, closes the owned browser, stops the owned ephemeral production server, removes the unique scene/input and restores the saved OBS state. It never terminates OBS, closes unrelated windows, stops unrelated outputs or touches shared 4173/5173/5081 servers. A unique lock prevents overlapping soak runs; incomplete cleanup retains it for review. Ctrl+C requests this cleanup rather than immediately abandoning the recording.

Each recording includes 60 seconds of warm-up plus 900 measured seconds, with a 975-second watchdog. A five-second monitor requests stop at 512 MiB; finalized files must stay within 600 MiB including polling/flush margin. Each trace has a 50 MiB ceiling. The run requires 3 GiB free space. These are monitored application limits, not hard container limits: a disconnected or unresponsive OBS can defeat a stop request; such cleanup is reported as incomplete and its lock retained rather than claiming success. No automatic OBS process termination is attempted.

## Execution order and commands

1. Root reviews the updated harness and checks, then coordinates a new quiet window after any voice or browser work. The prior web/Blender work is already complete. No new run is authorized by this preparation alone.
2. Reserve approximately **32–35 minutes**, with the owned Clean window kept visible and unminimized. The requested measured phases total exactly 30 minutes; warm-up/setup/finalization are additional. Do not change OBS scenes/profiles or start another output during this window.
3. Confirm the current production build is the intended revision. The script hashes its index, actual worker and avatar and records browser/SDK/OBS versions; it does not rebuild or restart shared services.
4. Inspect the fixed plan, then run the already reviewed workload:

```powershell
node scripts/combined_fixture_soak.mjs --plan
node scripts/combined_fixture_soak.mjs --run --quiet-window
```

There is no shortened duration switch that could be mistaken for the required soak. The script prints progress about every30 seconds. A full run writes two MKVs, four Ene-only phase stills, measured and warm-up traces, a restoration snapshot and a report beneath `ops/reports/local/combined-soak/<run-id>/`, plus the latest JSON at `ops/reports/combined-fixture-soak.json`. Failure or end evidence adds at most one paired capture set. FFprobe checks720p30 H.264 dimensions/timing; any profile-generated audio track is checked for silence. It does not create redundant MP4s or decode every recorded video frame during measurement.

After execution, inspect the actual Ene stills, numerical results, silence checks and exact restoration result, then write the measured performance report. Unmet gates remain reported defects. The first two attempts produced partial seated-phase measurements and restored OBS after the strict layout guard fired. The [heartbeat investigation](output-layout-heartbeat.md) records the reproduced keepalive defect and correction; those interrupted attempts do not count as a completed soak. The corrected retry retained the same geometry and workload gates and finished both 900-second windows, but failed cadence and captured-content checks: animation delivery fell to approximately 1 Hz and the capture became white. The standing sample-count guard also failed. [The resulting performance report](performance.md) preserves the measurements, white recording samples and successful exact restoration; TASK-020 remains open.
