# Hybrid-core placement does not explain the draw-cadence collapse

2026-09-12. **Hypothesis rejected for the render path.** Confining the entire browser process tree to this host's efficiency cores degrades avatar cadence measurably but nowhere near the collapse toward 1 Hz reported in [TASK-020](../tasks/archived/TASK-020.md). The mechanism that resolved the [voice timing discrepancy](voice-llvc-hybrid-cores.md) does not transfer to rendering.

## Why it was worth testing

The same host measured a **2.32x** per-call penalty for LLVC inference on efficiency cores versus performance cores, enough to cross the real-time boundary and break the paced voice pipeline. The renderer and tracking workers run unpinned under the same Windows scheduler on the same hybrid i7-1255U, where logical CPUs 0-3 report 100% of maximum frequency and 4-11 report 50-70%. A migration to efficiency cores under sustained load was therefore a plausible mechanism for cadence collapse, and one this project had already demonstrated once in a different subsystem.

## Method

[capture_core_placement_probe.mjs](../../../../scripts/capture_core_placement_probe.mjs) runs the real viewer, the real Ene avatar and the real face/pose tracking workers, driven by the permitted NASA-credited still already used by the soak and passive control. Unlike the [occlusion probes](capture-occlusion-investigation.md), **tracking actually ran**: the GPU delegate was selected, face and pose were both present, and no worker errors or overflow occurred in any phase.

All four phases run **within one browser session**, so the comparison is not confounded by relaunch differences. Affinity is applied to all nine owned Chrome processes — browser, three renderers, GPU, network, storage, audio and video-capture services — and restored to `FFF` at the end. [Evidence](capture-core-placement-cores-v1.json).

## Results

Twenty seconds measured per phase, after a three-second settle.

| Phase | Mask | Draws/s | Draw interval median / p95 / max | Inferences/s | Inference median / p95 |
| --- | --- | --- | --- | --- | --- |
| Default, unchanged | `FFF` | 58.78 | 16.0 / 29.0 / 50.2 ms | 9.00 | 119.5 / 153.4 ms |
| Efficiency cores | `FF0` | **51.11** | 16.7 / 37.0 / 53.9 ms | **6.84** | 127.6 / **211.2** ms |
| Performance cores | `00F` | 58.95 | 15.7 / 28.5 / 50.4 ms | 8.99 | 120.2 / 152.4 ms |
| Restored | `FFF` | 58.38 | 16.2 / 30.1 / 46.7 ms | 8.80 | 117.4 / 154.2 ms |

- **No collapse.** Efficiency cores cost 13% of draw cadence, not 98%. The worst draw interval in any phase was 53.9 ms; the reported failure had draws arriving roughly a second apart.
- **Tracking is the more sensitive consumer.** Inference throughput fell 24% and inference p95 rose 38% on efficiency cores, against a 13% draw cost. This is consistent with the voice finding that landmark inference, not rendering, is what these cores struggle with.
- **Performance cores are not a win for rendering.** Pinning to `00F` matched the default within noise, so the scheduler was already placing the render-critical work well. This is the opposite of the voice result, where pinning was decisive.
- **The effect is fully reversible.** Restoring `FFF` returned cadence to 58.38 draws/s, confirming the probe measured placement rather than a progressive degradation.

## Consequence

- The hybrid-core hypothesis is **eliminated** as an explanation for the 1 Hz collapse. Forcing every browser process onto efficiency cores — considerably more severe than any realistic scheduler migration — does not come close to reproducing it.
- **No pinning is recommended for the avatar runtime.** There is no measured benefit, and pinning the browser tree would take performance cores away from the voice worker, which does depend on them. The two subsystems would contend for the same two physical cores.
- Efficiency-core placement remains worth recording as a contributor to inference variance, but not as a defect with a known fix.

## What remains unexplained

**Superseded on 2026-09-13:** a mechanism reproducing both symptoms was subsequently found — a minimized window delivers zero animation frames (60.04 fps before, 0.00 fps minimized, 59.91 fps restored). See [minimizing the output window](capture-minimize-cause.md). The rejection of core placement below still stands; it was simply not the cause. At the time of writing, the collapse toward 1 Hz and the entirely white OBS stills both remained without a demonstrated cause. Two hypotheses have now been handled: [window occlusion is untested](capture-occlusion-investigation.md) because neither probe managed to occlude the window, and core placement is rejected here. Neither this probe nor the short capture controls reproduced the original failure, so the next full soak should carry continuous instrumentation — `visibilitychange`, `freeze`, `resume`, WebGL context-loss events and compositor state — rather than relying on post-hoc reconstruction.

This probe used no OBS, no recording, no microphone and no physical camera, and closes no acceptance criterion.
