# TASK-020: Validate performance, recovery and local-only operation

- Status: In progress
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

- [ ] Baseline 720p/30 target and frame-time gates from the spec pass, or this task stays open with measured defects.
- [ ] No crashes or sustained post-warmup memory growth occur during the soak test.
- [ ] Offline operation and recovery checks pass; standing-mode limitations and tested presets are documented in ops/reports/performance.md.

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

**Window occlusion: untested, not disproven.** A collapse to approximately 1 Hz matches Chrome's background throttling rate, and entirely white window captures are the classic symptom of a window that has stopped compositing, so one occlusion cause would explain both symptoms. The [production launcher](../../../scripts/start.ps1) does launch Chrome with no flags at all, leaving occlusion detection and renderer backgrounding active. Two probes were built and both failed to establish the condition they meant to measure: [capture_occlusion_probe.mjs](../../../scripts/capture_occlusion_probe.mjs) was invalid because Playwright keeps a debugger attached, which suppresses renderer backgrounding, and because it never started tracking (`inferences` was 0 in every phase); [raf_occlusion_check.mjs](../../../scripts/raf_occlusion_check.mjs) removed the automation confound using real non-automated Chrome, but `visibilityState` stayed `visible` throughout, proving the synthetic topmost occluder never triggered Chrome's occlusion calculation. Both measured a flat 60 fps, which therefore says nothing. Full record and its limits: [occlusion investigation](../../reports/capture-occlusion-investigation.md), evidence [occl-v2](../../reports/capture-occlusion-occl-v2.json) and [real-v1](../../reports/capture-raf-occlusion-real-v1.json). **No production change was made on the strength of this inconclusive work**; the launcher still passes no flags. Note that the original soak also ran under Playwright with a debugger attached and still collapsed, which is mild evidence against plain renderer backgrounding.

**Hybrid-core placement: rejected for the render path.** The [voice investigation](../../reports/voice-llvc-hybrid-cores.md) established that this host's efficiency cores are 2.32x slower per neural call than its performance cores, so the same mechanism was tested against rendering. [capture_core_placement_probe.mjs](../../../scripts/capture_core_placement_probe.mjs) ran the real viewer, real Ene avatar and real face/pose workers — GPU delegate selected, both present, no worker errors or overflow — under four affinity phases inside one session, applied to all nine owned Chrome processes and restored afterwards. [Evidence](../../reports/capture-core-placement-cores-v1.json), [report](../../reports/capture-core-placement.md). Draw rates were 58.78 (`FFF`), 51.11 (`FF0`), 58.95 (`00F`) and 58.38 (`FFF` restored) draws/s, with a worst draw interval of 53.9 ms in any phase. Confining every browser process to efficiency cores — far more severe than any realistic scheduler migration — costs 13% of cadence, not 98%, so it cannot explain the failure. Tracking is the more sensitive consumer: inference throughput fell 24% and inference p95 rose 38%. Pinning to performance cores gave no render benefit, so **no affinity change is recommended for the avatar runtime**; it would also take performance cores away from the voice worker, which does depend on them.

**Repository defect found and fixed.** The production typecheck was broken: `scripts/soak-health.mjs` had been added without the `.d.mts` declaration its sibling modules carry, so `npm run build` failed on `tests/soak-health.test.ts`. Added [soak-health.d.mts](../../../scripts/soak-health.d.mts) and narrowed the discriminated-union access in the test. Production build, 80 unit tests and the 33-file bundle audit now pass again.

**Next soak requirement.** Instrument continuously rather than reconstructing afterwards: record `visibilitychange`, `freeze`, `resume`, WebGL context-loss events and compositor state throughout the run. The existing [capture-animation probe](../../../scripts/capture-animation-probe.mjs) already listens for the first four. Drive occlusion the way the failure actually occurred — a real application or the OBS window brought to the front during a long run — rather than with a synthetic form.
