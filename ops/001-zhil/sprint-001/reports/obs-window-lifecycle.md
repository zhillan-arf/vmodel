# OBS window lifecycle evidence

OBS captures the selected browser **window**, including a different active tab after attachment. Exact title matching controls finding a window; it does not continuously restrict that window to Ene content. On this laptop, minimizing blanked the scene, hiding froze the last avatar frame, and closing the window blanked the scene until another window acquired the same title.

Measured 2026-09-12 at 09:29 UTC with OBS 32.2.2, obs-websocket 5.7.4, Chrome 152.0.7977.83 and Windows 11 25H2. The test used the actual cyber-legs Ene avatar, deterministic face rotations, native browser viewport sizing, and only test-owned synthetic alternate content. Evidence: [machine-readable results](obs-window-lifecycle.json), [reproducible script](../../../../scripts/obs_window_lifecycle_smoke.mjs), and [earlier landscape/portrait capture evidence](obs-capture-smoke.json).

| Change to the captured window | Observed scene output | Evidence |
| --- | --- | --- |
| Visible Ene; change deterministic head rotation | Avatar images changed; no controls or physical camera image | [Baseline A](local/obs-window-lifecycle/01-baseline-a.png), [baseline B](local/obs-window-lifecycle/02-baseline-b.png) |
| Cover Ene with a separate owned magenta window | Ene remained visible and changed; zero magenta pixels | [Covered window](local/obs-window-lifecycle/03-covered-by-owned-magenta.png) |
| Change the acquired window's title | Capture continued and the avatar changed | [Changed title](local/obs-window-lifecycle/04-title-changed-same-window.png) |
| Activate a synthetic magenta tab in that same native window | The alternate tab entered capture: 95.64% magenta pixels | [Different active tab](local/obs-window-lifecycle/05-other-tab-same-window.png) |
| Return to the Ene tab | Avatar returned | [Original tab](local/obs-window-lifecycle/06-original-tab-restored.png) |
| Minimize through Win32 `ShowWindow(SW_MINIMIZE)` | Two fully black scene images; source dimensions became 0 × 0 | [Minimized A](local/obs-window-lifecycle/07-minimized-a.png), [B](local/obs-window-lifecycle/08-minimized-b.png) |
| Restore after minimizing | Nonblank Ene returned | [Restored](local/obs-window-lifecycle/09-restored-after-minimize.png) |
| Hide through Win32 `ShowWindow(SW_HIDE)` without minimizing | Previous Ene frame froze; both images have exactly the same SHA-256 as the preceding restored image, despite another requested head rotation | [Hidden A](local/obs-window-lifecycle/10-hidden-a.png), [B](local/obs-window-lifecycle/11-hidden-b.png) |
| Show after hiding | Same frozen frame remained during the short observation | [Shown again](local/obs-window-lifecycle/12-shown-again.png) |
| Navigate that window to a synthetic cyan document after the hide/show test | Same frozen frame remained; this is not an independent successful navigation-capture test | [Navigation while already frozen](local/obs-window-lifecycle/12b-synthetic-navigation-same-window.png) |
| Close Ene's native window; keep a differently titled owned alternate open | Two fully black scene images, 0 × 0 source; unmatched alternate was excluded | [Closed A](local/obs-window-lifecycle/13-closed-unmatched-alternate-a.png), [B](local/obs-window-lifecycle/14-closed-unmatched-alternate-b.png) |
| Give the remaining owned alternate exactly the former capture title | OBS reacquired the alternate and showed its magenta content | [Same-title replacement](local/obs-window-lifecycle/15-same-title-owned-replacement.png) |

Each normal state settled for 1.5 seconds before a scene PNG was requested. Minimized and hidden states each had two samples 1.5 seconds apart; closure settled for two seconds before its first sample and another 1.5 seconds before the second. Same-title replacement settled for 2.5 seconds. Blank means over 99.5% of pixels had each RGB channel below 8; the measured blank cases were 100%. Frozen means identical PNG SHA-256 with nonblank pixels. The source was 1628 × 1009 physical pixels before cropping into the 1280 × 720 scene. The tab's native Chrome window ID was explicitly verified to equal the captured window's ID. Native hide/minimize/close state was verified against an HWND belonging to the newly launched Chrome process.

The capture settings came from [configure_obs.mjs](../../../../scripts/configure_obs.mjs): `window_capture`, `method: 2`, `priority: 1`, client area enabled, cursor/audio disabled and SDR forced. OBS defines method 2 as Windows Graphics Capture; its priority enum defines 1 as title matching. [OBS 32.2.2 method definitions](https://github.com/obsproject/obs-studio/blob/32.2.2/plugins/win-capture/window-capture.c#L59-L63), [priority definitions](https://github.com/obsproject/obs-studio/blob/32.2.2/libobs/util/windows/window-helpers.h#L10-L14).

The official source explains the result: `wc_tick` searches when its HWND is absent or invalid, and does not compare the title on every tick of an existing window. It returns early for minimized or invisible windows. Source dimensions and rendering exclude minimized windows, while hiding alone does not meet that exclusion. [OBS capture lifecycle](https://github.com/obsproject/obs-studio/blob/32.2.2/plugins/win-capture/window-capture.c#L547-L600), [size checks](https://github.com/obsproject/obs-studio/blob/32.2.2/plugins/win-capture/window-capture.c#L375-L397), [render checks](https://github.com/obsproject/obs-studio/blob/32.2.2/plugins/win-capture/window-capture.c#L720-L740).

At acquisition, the title-priority branch compares titles case-insensitively; that branch does not require matching the originally recorded executable or class. Therefore the saved title is not a unique process identity. Our replacement test used a second owned Chrome window, not a different application. [OBS window matcher](https://github.com/obsproject/obs-studio/blob/32.2.2/libobs/util/windows/window-helpers.c#L400-L435). WGC draws its existing texture when a texture has been written; this supports the possibility of a retained frame when new frames stop. The experiment demonstrates freezing here, without identifying whether the browser, Windows capture session, or their interaction prevented subsequent updates. [OBS WGC renderer](https://github.com/obsproject/obs-studio/blob/32.2.2/libobs-winrt/winrt-capture.cpp#L483-L528).

OBS's user documentation also describes title matching as the rule used when the previously captured window cannot be found, and explicitly allows a same-title replacement. Its description of capturing a covered window agrees with the owned-window test. [OBS Window Capture documentation](https://obsproject.com/kb/window-capture-sources).

Use the following operating sequence:

1. Open Ene's dedicated output in its own browser window, keep that window on Ene, select the intended landscape or portrait layout, and attach it using the project's OBS helper. Check moving avatar frames in OBS before starting output.
2. Keep the output window visible and unminimized. A separate covering window was excluded in this test, but minimizing stops the picture and hiding can leave a stale picture. This short check does not establish long-term animation performance while covered.
3. Before leaving Clean view, switching the captured window to another tab, navigating, hiding, or closing it, stop recording/streaming/virtual-camera output and disable the Ene Window source in OBS. An altered title does not disable an already acquired capture.
4. After restoring or reopening the output, return to Ene, reattach, and check that deliberate movement changes the OBS picture before resuming. Repeat attachment after resizing so the helper can recalculate the crop. Reattachment is the proposed recovery procedure; automatic recovery from the Win32 hide case was not established by this test.
5. Keep unrelated browsing in a separate window. Do not reuse the output's title for other content while its OBS source is enabled.

The existing [setup script](../../../../scripts/setup_obs.py) creates portable video-only profiles/scenes and preserves saved profile edits; [start-obs.ps1](../../../../scripts/start-obs.ps1) launches that project instance without starting recording or streaming. Its `-Background` option hides **OBS's own UI**, which is distinct from hiding the browser being captured. The reviewed [baseline capture script](../../../../scripts/obs_capture_smoke.mjs) already verifies both aspect ratios with native viewport geometry. This lifecycle script extends those checks rather than changing the shared configuration.

Reproduce after coordinating an idle CPU/GPU window and starting the local app plus project OBS:

```powershell
node --check scripts/obs_window_lifecycle_smoke.mjs
node scripts/obs_window_lifecycle_smoke.mjs --quiet-window
```

Both commands completed successfully. Runtime results contain no errors. The fixture blocked physical/display media access, counted zero media requests, started no recording, public stream or virtual camera, and captured no unrelated desktop content. Both Ene capture sources were verified disabled afterward; their prior input settings, transforms, profile and program scene were restored, and the owned browser was closed. Virtual Camera was unavailable during this run. This report covers the lifecycle portion of TASK-017; it does not establish virtual-camera consumer acceptance, live tracking quality, microphone routing or recording/audio synchronization.
