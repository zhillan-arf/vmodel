# Minimizing the output window stops frame delivery, and matches the TASK-020 failure signature

2026-09-13. **A minimized Chrome window delivers zero animation frames.** Measured: 60.04 fps before, **0.00 fps while minimized with `visibilityState` reporting `hidden`**, and 59.91 fps after restoring. This reproduces the signature of [TASK-020](../tasks/archived/TASK-020.md)'s long-unexplained failure — draws collapsing toward 1 Hz and entirely white OBS stills — and explains why the earlier occlusion probes found nothing.

## How this surfaced

It was not found by looking for it. Two consecutive standing soak runs failed in ways that initially looked unrelated:

- One tripped the clean-view check, which asserts `clean && visibility === 'visible' && previewHidden` but recorded none of the three, so which condition broke could not be reconstructed. That assertion now persists the observed values.
- The next tripped the native window preflight with the owned window reporting **`minimized: true`** at rectangle `-21333,-21333` — the standard Windows minimized position, scaled by this display's 1.5 device pixel ratio.

The same run's `powerBefore` recorded `ACLineStatus: 1` at 17:09:14 UTC, a change from battery to AC. Somebody plugged the laptop in at that moment, so a person was physically at the machine when the window became minimized. The two failures are one cause: **the window was minimized**, and a minimized window reports `visibilityState` as `hidden`.

## Measurement

[raf_minimize_check.mjs](../../scripts/raf_minimize_check.mjs) starts real, non-automated Chrome exactly as the launcher does, against a disposable user-data directory and a self-reporting WebGL page. It minimizes the window with `ShowWindow(SW_MINIMIZE)`, waits, then restores it. Frame counts arrive by `setInterval` beacon rather than by animation frame, so the reporting channel does not stop along with the thing being measured. [Evidence](capture-raf-minimize-min-v1.json).

| Phase | Frames/s | `visibilityState` |
| --- | --- | --- |
| Before | **60.04** | visible |
| Minimized | **0.00** | **hidden** |
| Restored | **59.91** | visible |

Frame delivery stops completely and recovers completely. The window handle confirmed `minimized: true` during the middle phase.

## Why this matches the original failure

Both original symptoms follow from one cause:

- **Draw cadence collapsing toward 1 Hz.** Animation frames stop entirely when hidden. The soak observed roughly 1 Hz rather than zero because the application's interval-driven work kept running and occasionally drove a draw; the render loop itself was dead.
- **Entirely white OBS stills.** OBS window capture of a window that is producing no new frames has nothing current to sample. Three consecutive blank captures follow directly.

No other hypothesis explained both symptoms with one mechanism.

## Why the earlier probes missed it

The [occlusion investigation](capture-occlusion-investigation.md) tested the wrong action. It covered the window with an opaque topmost form and concluded nothing, because `visibilityState` stayed `visible` throughout and Chrome never treated the window as occluded — a null result on a condition that was never established.

**Covering is not minimizing.** Those probes measured a flat 60 fps under an opaque full-screen window, which is now a useful positive result in its own right: working in front of the output window is harmless. Minimizing it is not.

## What this means for the product

This is the failure mode most likely to be hit in normal use. The application's entire purpose is for OBS to capture its window while the user does something else, and minimizing a window you are not looking at is the natural thing to do.

Consequences, in order of confidence:

1. **Covering the output window is safe.** Measured at 60 fps under a full-screen opaque window, in both automated and non-automated Chrome.
2. **Minimizing the output window breaks the stream.** Measured at 0 fps. The avatar freezes and the capture goes blank until the window is restored.
3. **Recovery is automatic and complete** once the window is restored: 59.91 fps against a 60.04 fps baseline, with no intervention.

The beginner documentation must state this plainly, and the application should detect it rather than leaving the user to discover a frozen stream. `document.visibilitychange` is the exact signal, and it is already listened for by the [capture-animation probe](../../scripts/capture-animation-probe.mjs).

## Boundaries

- This is a synthetic WebGL page, not the avatar runtime. It demonstrates browser frame scheduling, not application performance.
- The blank-capture link is **inferred** from frame delivery stopping. This probe did not photograph an OBS source; that inference is consistent with the three blank stills recorded in the original soak but was not re-observed here.
- Minimizing was done programmatically with `ShowWindow`. A user minimizing by hand, switching virtual desktops, or locking the session are similar but not identical actions and were not each measured.
- It is **not established** that the original soak failure was caused by a minimize event. No visibility state was recorded at that time, which is precisely the gap that has now been closed in the harness. This report shows a mechanism that reproduces the signature, not a log of the original event.
- One short run on one host, with ambient load recorded rather than controlled.
