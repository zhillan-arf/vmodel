# TASK-019: Package local launch, offline assets and beginner documentation

- Status: Done
- Priority: P0
- Goal: G2
- Depends on: TASK-015, TASK-016, TASK-017, TASK-026
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Make everyday use a launcher action instead of a terminal setup exercise.

## Work

- Provide idempotent setup support and Start VModel.cmd that starts a hidden loopback-only server and opens the supported browser.
- Build production assets and provision pinned ML/WASM files with checksum checks; handle missing dependencies and occupied ports clearly.
- Serve only designated build/runtime files; load avatar through explicit selection rather than exposing the workspace.
- Provide stop/cleanup behavior, settings reset, version information and third-party notices.
- Write docs/quickstart.md and troubleshooting for camera denial, black OBS capture, low FPS, calibration, missing model and offline startup.
- Integrate TASK-026's voice launcher/profiles and link the voice quickstart. Keep local avatar startup independent of the optional A100 connection and clearly identify whether the selected voice requires remote inference.

## Acceptance criteria

- [x] After documented setup, launch works without entering development commands or internet access.
- [x] Closing/stopping releases resources; restart and occupied-port handling are clean.
- [x] No source models, recordings, credentials or private data are unintentionally bundled.
- [x] Voice controls and documentation are packaged; remote voice failure does not prevent the offline avatar workflow.

## Implementation notes

Do not add Electron/Tauri packaging unless the browser launcher proves insufficient in measured acceptance.

2026-09-12 checkpoint: [Bundle audit](../../reports/bundle-audit.json) passes 33 designated files, exact prepared-avatar/runtime hashes and retained notices for 16 runtime packages. Source PMX/Blender files, recordings and private tool configuration stay outside the served build. Production server loss now stops the camera; [actual fake-camera evidence](../../reports/server-stop.md) records track/worker release in 2248 ms. [Launcher checks](../../reports/launcher-smoke.json) pass real Windows scripts from another working directory, repeated launch without duplicate processes, actual avatar loading with external network blocked, owned stop/restart, occupied-port preservation and refusal to kill a process behind a stale PID file. The existing [70-second tracking/network test](../../reports/camera-reliability.md) verifies local SDK assets and inference with external requests blocked. `Start VModel.cmd` targets the installed tested Chrome. Packaged voice controls remain open. [Quickstart](../../../docs/quickstart.md), [OBS](../../../docs/obs-setup.md), [recording](../../../docs/recording.md), [live check](../../../docs/live-check.md) and [notices](../../../docs/third-party-notices.md) are provided.

Packaging acceptance: all four task criteria have component evidence. This task consumes the implemented launcher/profile/guide portion of TASK-026; its physical device, live voice and sync gates remain open in TASK-025/026/028. The avatar's default launch does not call a voice backend. Optional voice launch failure is handled separately; no configured remote service exists, so no actual remote outage is claimed. The final natural workflow used mocked media, and the full interactive two-window launcher was not rerun after that addition. OBS voice receiver refresh after a service restart is documented; automatic receiver reconnection is not claimed.

2026-09-12 voice packaging checkpoint: [Start Voice Studio.cmd](../../../deploy/Start%20Voice%20Studio.cmd) / [Stop Voice Studio.cmd](../../../deploy/Stop%20Voice%20Studio.cmd) and optional `Start VModel.cmd -Voice`, `-NoBrowser -Voice`, and `-StopVoice` are implemented and the no-browser start/stop/restart path was exercised. Default avatar launch remains independent of local/remote voice. Three provisional presets, saved settings, comparison, monitoring and explicit mute/reconnect are available locally; [UI and state evidence](../../reports/voice-routing.md) records the exact limits. Production [OBS attachment](../../reports/voice-obs-setup.json) is now installed in both existing Ene scenes and verified idempotent, so setup no longer asks the user to add sources or private URLs manually. [Voice quickstart](../../../docs/voice-quickstart.md), [OBS instructions](../../../docs/obs-setup.md) and the main quickstart were updated. No physical media or OBS output was started by this installation. The dependent live-quality/device/sync acceptance in TASK-026 remains open.

2026-09-12 natural-voice packaging: Voice Studio now includes the explicit **Start natural voice → OBS** action and clear natural-speech state. A separate saved profile and natural-only receiver preserve the converted-only source contract. The natural source is [installed silently in both Ene scenes](../../reports/voice-obs-natural-setup.json), with existing avatar/converted settings and calibration preserved. [Mocked workflow evidence](../../reports/voice-natural-ui-smoke.json) verifies track release, Stop, occupied-device failure and no microphone reopening on reload; physical device and timing acceptance remains open. The quickstarts describe both installed routes and deliberate mode selection.

## Launcher guards completed — 2026-09-13

A pass over all twelve launchers, asking what each shows a user whose machine is not already set up.

- **Setup VModel.cmd** is the first thing anyone runs, and it called `npm.cmd` with no check. A machine without Node.js got a raw *"is not recognized"*. It now names Node.js and nodejs.org, states that nothing was changed, and on success points at **Setup Voice.cmd** as well, so the split between studio and voice provisioning is visible at the moment it matters.
- **Stop Voice Studio.cmd** had no guard while its Start counterpart did, so stopping a voice service that was never installed produced a path error. It now says there is nothing to stop and exits cleanly.
- **start.ps1** used `Get-Command node -ErrorAction Stop`, whose failure is a raw PowerShell *"term is not recognized"*. It now names Node.js and the setup step, matching the guards it already had for Chrome and the missing build. Its voice warnings now name **Setup Voice.cmd** instead of only a document.

The four launchers still without an inline guard — `Start VModel.cmd`, `Stop VModel.cmd`, `Start OBS.cmd`, `Install OBS Camera.cmd` — delegate to PowerShell scripts that check internally, and those were read to confirm it rather than assumed. `stop.ps1` already handled a missing pid file, an already-stopped server and a mismatched process.

Verified: all four PowerShell launchers parse, and `start.ps1` still starts and reuses a running studio (exit 0, `/health` 200).

This is the sixth handoff gap found by walking the user's journey rather than testing code, and it closes the first-run path: every launcher now fails with a sentence naming what is missing and what to run.
