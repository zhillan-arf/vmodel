# Window-occlusion hypothesis for the draw-cadence collapse: untested, not disproven

2026-09-12. **Inconclusive.** Two probes were built and run to test whether Chrome's Windows occlusion detection explains [TASK-020](../tasks/active/TASK-020.md)'s collapse toward 1 Hz draw delivery and its blank-white OBS stills. Neither probe succeeded in occluding the browser window, so the hypothesis remains open. This record exists so the attempt is not repeated blindly and so no unearned conclusion is carried forward.

## Why the hypothesis was raised

Two details made it worth testing. A collapse to approximately **1 Hz** matches Chrome's documented background throttling rate rather than a gradual performance decay, and **entirely white** window captures are the classic symptom of capturing a Chrome window that has stopped compositing. A single cause — the window being treated as occluded — would explain both symptoms at once.

The [production launcher](../../scripts/start.ps1) also genuinely launches Chrome with no flags at all:

```powershell
Start-Process -FilePath $browserPath -ArgumentList $studioUrl -WindowStyle Normal
```

For an application whose purpose is to have that window captured by OBS while the user works in other applications, occlusion and renderer backgrounding are plausible risks regardless of whether they caused this particular failure.

## Probe 1: automated browser — invalid by construction

[capture_occlusion_probe.mjs](../../scripts/capture_occlusion_probe.mjs) launched the real viewer under Playwright in two conditions, covered it with an opaque topmost form and measured draws before, during and after. [Evidence](capture-occlusion-occl-v2.json).

| Condition | Before | During occlusion | After |
| --- | --- | --- | --- |
| `production-default`, anti-throttling switches removed | 59.62 draws/s | 59.91 draws/s | 59.89 draws/s |
| `hardened`, plus `--disable-features=CalculateNativeWinOcclusion` | 59.95 draws/s | 59.92 draws/s | 59.91 draws/s |

Two independent defects make this result unusable:

- **Playwright keeps a debugger attached**, and Chrome does not background a renderer with an active DevTools/CDP session. The `production-default` condition therefore could not reproduce what the launcher actually starts, whatever the occluder did.
- **`inferences` was 0 in every phase.** The probe set the camera fixture but never started tracking, so it measured an idle render loop rather than the combined render-plus-worker workload that failed in the soak.

An earlier run failed outright because the permitted fixture still was not routed; it is retained as [occl-v1](capture-occlusion-occl-v1.json).

## Probe 2: real non-automated Chrome — occlusion never triggered

[raf_occlusion_check.mjs](../../scripts/raf_occlusion_check.mjs) removed the automation confound. It starts Chrome exactly as the launcher does, against a disposable user-data directory and a tiny self-reporting WebGL page, with no debugger attached. [Evidence](capture-raf-occlusion-real-v1.json).

| Condition | Before | During occlusion | After | `visibilityState` while covered |
| --- | --- | --- | --- | --- |
| `launcher-default`, no flags | 60.02 fps | 59.99 fps | 59.99 fps | **visible** |
| `hardened`, four flags | 59.97 fps | 60.06 fps | 59.94 fps | **visible** |

**The `visibilityState` column is the finding.** Chrome sets a natively occluded window's visibility to `hidden`; it stayed `visible` throughout. The opaque topmost maximized form produced by [occluder_window.ps1](../../scripts/occluder_window.ps1) — which runs correctly on its own — did not cause Chrome to consider the window occluded. The measured 60 fps therefore says nothing about behaviour under real occlusion.

## Honest status

- The occlusion hypothesis is **neither confirmed nor eliminated**. No probe here achieved the condition it set out to measure.
- No claim is made that the launcher flags fix anything. `flagsPreventThrottling` is recorded as `false` only because neither condition throttled, not because the flags were shown to be unnecessary.
- **No production change was made** on the strength of this inconclusive work. The launcher still passes no flags.
- The original soak ran under Playwright, with a debugger attached, and still collapsed to roughly 1 Hz. That is mild evidence *against* plain renderer backgrounding being the cause, since an attached debugger normally suppresses it.

## Better next steps than repeating this

1. A synthetic topmost form is an unreliable way to trigger Chrome's occlusion calculation. Either drive the condition the way the failure actually occurred — the OBS window, or a maximised real application, brought to the front during a long run — or capture `document.visibilityState` and the compositor state continuously during the next full soak and let the failure reveal itself.
2. Test the [hybrid-core hypothesis](voice-llvc-hybrid-cores.md) instead, which has a proven measurement method on this host. The renderer and tracking workers run unpinned on a machine whose efficiency cores measured **2.32x** slower per neural call than its performance cores. A migration to efficiency cores under sustained load is a mechanism for cadence collapse that this project has already demonstrated once, in a different subsystem.
3. Instrument the next soak to record `visibilitychange`, `freeze`, `resume`, WebGL context-loss events and executing processor numbers continuously, rather than reconstructing them afterwards. The existing [capture-animation probe](../../scripts/capture-animation-probe.mjs) already listens for the first four.

The blank-white capture symptom remains entirely unexplained and is not addressed by anything in this record.

---

## Resolved elsewhere: the action being tested was wrong

2026-09-13. This investigation tested **covering** the window. The mechanism that actually reproduces the TASK-020 signature is **minimizing** it: measured 60.04 fps before, **0.00 fps while minimized with `visibilityState` reporting `hidden`**, and 59.91 fps after restoring. See [minimizing the output window](capture-minimize-cause.md).

The null results below are retained and are not worthless: they measured a flat 60 fps under an opaque full-screen window in both automated and non-automated Chrome, which establishes that **working in front of the output window is harmless**. What they could not do was establish occlusion, because `visibilityState` never left `visible`.

The lesson worth keeping: a probe that never establishes its own condition produces a confident-looking null result. The `visibilityState` column was the tell, and it was in the table the whole time.
