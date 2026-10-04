# Studio controls and output validation

Validated 2026-09-12 against the production server at `http://127.0.0.1:4173/`, Chrome 152, and the final Ene Cyber legs VRM SHA-256 `3657b97928638e7ada5f6639141fb63f555912049a2c6ec217851001e322cbcb`.

## Delivered behavior

The stage retains a 16:9 or 9:16 camera composition when its window changes shape. The clean view and output window render at exactly 1280×720 or 720×1280; their canvas is fitted inside the available client area. A mismatched window shape adds margins outside the composition. Windows may limit a requested popup size, so OBS must capture and fit the canvas area; canvas dimensions alone do not certify the final Windows recording dimensions.

The separate output receives the current avatar, settings, neutral calibration, manual expression and timestamped measurements over a session-specific local BroadcastChannel. It contains no camera element or controls and never requests a camera stream. Reopening an output or reloading either window performs a new handshake. Model data is sent when needed; normal frames do not resend the model. Disconnected tracking decays to idle. The operator sees connection status outside the captured frame.

Settings are versioned and scoped by the avatar file's SHA-256. Calibration additionally requires the actual camera device identifier, actual capture dimensions, and seated/standing mode. A changed device, model, mode or capture format does not silently inherit another neutral pose. Unsupported/corrupt values fall back safely. Settings files are restricted to the current avatar and version; calibration remains local to its original device. Reset removes every saved neutral for the current avatar. Storage denial leaves session controls usable.

Clean view uses one renderer and keeps camera tracking in the same page. Escape restores controls, Space stops camera capture, and C recenters when valid measurements are available. It has no transient instructional overlay. Zoom, mirror, full-body/bust framing, stage color and a green-screen preset are available in the controls.

## Executed evidence

- `npm.cmd test`: 58 tests passed, including settings isolation/reset/corruption/storage failure, composition fitting, late output-channel teardown, retargeting and local capture geometry. Vitest is restricted to this application's `tests/`, excluding separately installed third-party source trees.
- `npm.cmd run build`: passed; the existing large-bundle advisory remains.
- `node scripts/output_smoke.mjs`: passed with zero page errors. [Structured results](output-smoke.json) record exact canvas dimensions, matching avatar/settings/calibration, expression values, no duplicate camera, output reload/reopen, controller restart with scoped calibration, clean-view keyboard controls and reset.
- Visually inspected [portrait output](local/output/portrait.png); [landscape output](local/output/landscape.png) also saved. Both use actual Ene and the green background. The faint/digital leg endings are part of the selected model.

The first browser pass revealed a late update reaching a closed channel; teardown now ignores queued handshakes and late frames, with a regression test. The final browser pass completed successfully.

## Performance and remaining acceptance

The repeat with heavy provisioning/render work paused reached approximately 60 fps in both output views. The single clean view measured 51 fps during the transition and approximately 60 fps in the following four samples. The earlier concurrent-work observations were 15–19 fps in each of two views and 23–26 fps in the single clean view. Together these establish a working single-renderer fallback and the sensitivity to other laptop workloads. They do not certify the combined camera/voice/OBS production target: the fixture supplies measurements without running ML inference. TASK-003/020 owns that combined benchmark. Keep the active control page visible; minimized-window behavior is measured separately in TASK-017.

The browser test used a synthetic camera and injected face measurements. It establishes output transport, composition and controls, not actual face/arm/finger accuracy or user-operated calibration quality. Those acceptance checks remain in TASK-010 through TASK-015 and final acceptance. TASK-016's output component is accepted with those integration limits recorded.

Opaque Window Capture is the release baseline. Green is distinct from Ene's blue/cyan clothing, but the character's partially transparent hair and digital leg edges already blend with that background. Chroma key can remove green fringes or lose faint details depending on tolerance. Actual OBS key settings must be measured; an opaque scene background preserves those details without keying. A transparent WebGL canvas would not by itself provide Windows capture alpha.
