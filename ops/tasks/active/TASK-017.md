# TASK-017: Set up OBS capture, streaming scenes and virtual camera

- Status: In progress
- Priority: P0
- Goal: G2
- Depends on: TASK-002, TASK-016
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Integrate the app into a real streaming and webcam-output workflow.

## Work

- Install/configure OBS if necessary; create importable scene/profile guidance for clean Window Capture.
- Provide opaque-background baseline and optional chroma key; test resize, source selection and hidden/minimized-window behavior.
- Configure microphone audio separately and document monitoring/echo prevention and any measured sync offset.
- Select measured hardware/software encoder settings; keep credentials out of exported profiles.
- Start OBS Virtual Camera and verify animated output in a compatible local consumer. Document selecting microphone separately.

## Acceptance criteria

- [x] OBS captures the avatar without controls or raw-camera leakage.
- [ ] A consumer receives moving avatar frames from OBS Virtual Camera; audio routing is explicitly verified separately.
- [x] Scene/profile instructions work without streaming to a public account or including stream keys.

## Implementation notes

Native webcam drivers and platform-specific broadcast authentication are outside this task.

2026-09-12 checkpoint: [OBS capture report](../../reports/obs-capture.md) and [native Windows evidence](../../reports/obs-capture-smoke.json) verify moving actual Ene in both profiles with automatic browser/margin crop and physical media disabled. Starter scripts create portable profiles/scenes and attach only one matching visible output. Lifecycle and recording/audio checks remain active. Virtual-camera modules pass exact hash and OBS signature checks, but Windows canceled the administrator registration prompt; [install status](../../reports/obs-virtual-camera-install.json) records both registrations absent. `Install OBS Camera.cmd` is ready for a later interactive attempt; no automatic retry. Consumer acceptance remains unchecked.

The voice extension joins this working OBS baseline in TASK-025, which replaces direct microphone capture with isolated converted speech in voice scenes and calibrates sync. TASK-028 validates the final voice clips. Do not treat OBS Virtual Camera as an audio device.

2026-09-12 production voice setup: the [guarded helper](../../../scripts/voice/configure_obs_voice.mjs) was run with `--attach`, installing one shared **Ene Converted Voice Bridge** Browser Source in both reviewed scenes, **Ene Landscape** and **Ene Portrait**. [Initial](../../reports/voice-obs-setup-initial.json) and [repeat](../../reports/voice-obs-setup.json) verification preserve avatar settings/transforms/visibility, current scene and existing sync offset, with no duplicate membership. Monitoring is off, service is idle/muted, no raw microphone/desktop source exists, and no OBS output or physical media was started. Same-name sources require the expected local `/obs` URL before modification. The user no longer has to add voice sources manually. Reference transport was checked separately; live quality, physical sync and virtual-camera consumer acceptance remain open. [Updated OBS guide](../../../docs/obs-setup.md).

2026-09-12 explicit natural-voice extension: **Ene Natural Voice Bridge**, at the separate local `/obs-natural` receiver, is also [installed and repeat-verified](../../reports/voice-obs-natural-setup.json) in both Ene scenes. Its route/key/frame kind are separate from converted speech, and the existing converted-source settings and calibration remain unchanged. Both bridges are silent with monitoring off until a deliberate Voice Studio action. The [mode tests](../../reports/voice-natural-mode.md) used synthetic PCM and mocked microphone APIs only; this setup does not establish physical audio or virtual-camera acceptance.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

## Launcher failure messages — 2026-09-13

Continuing the walk through the user's journey reached the OBS launchers, and found two rough edges rather than defects in the capture path itself.

- **`node` was not guarded.** Both Attach launchers called `node scripts\configure_obs.mjs` directly, so on a machine where setup had not run the user would see Windows' raw *"'node' is not recognized as an internal or external command"*. They now check first and say **"Node.js was not found. Run Setup VModel.cmd first."**, matching the guard the other launchers already had.
- **An unreachable OBS said only "Local OBS connection closed."** Accurate, and it leaves the user nowhere. Connection failures now read **"Could not reach OBS. Open Start OBS.cmd, leave it running, then try this again."** with the original detail appended. Genuine OBS API errors — a rejected request, a bad scene item — pass through **unchanged**, so the fix does not mask real faults.

Both message branches were exercised directly. `--attach` was deliberately **not** run: it mutates the OBS scene configuration, and re-running it would have changed the user's installed setup for no verification gain.

Checked while here: `Attach OBS Landscape.cmd` and `Attach OBS Portrait.cmd` are not duplicates — Portrait passes `--portrait` and the script selects 720x1280 accordingly.

Nothing about capture, recording or Virtual Camera acceptance changes; those still need the administrator prompt and the operator.

### Virtual Camera messaging and unreadable evidence — 2026-09-13

Two findings while following the launcher chain to this gate.

**The declined prompt said what happened, not what to do.** Cancelling the Windows elevation produced *"OBS camera registration was not completed: The operation was canceled by the user."* Since declining is the common outcome and is exactly what happened here, that message now says nothing was changed, that running **Install OBS Camera.cmd** again and choosing Yes is the fix, and that window capture and recording work without it — only the virtual camera for call apps needs it. Other registration errors are unchanged, so genuine faults are not papered over.

**The evidence file for this gate could not be parsed.** `obs-virtual-camera-install.json` was written with a UTF-8 byte-order mark, making it the one report of 170 that strict JSON parsers rejected. The writer now emits UTF-8 without a mark and the file was regenerated; its content is unchanged (`registration-required`, neither architecture registered).

Checking that systematically then found a **second** unreadable file. `asset-inventory.json` contained literal `NaN` rotations from the Blender asset audit. Python accepts `NaN`, which is why an earlier scan reported the file as fine; strict JSON does not. The six values are now `null` — JSON's representation of no value, which preserves the observation rather than inventing a number — and the writer emits `null` with `allow_nan=False` so it cannot recur. A structural comparison confirmed exactly six differences and nothing else moved.

[audit_reports_readable.mjs](../../../scripts/audit_reports_readable.mjs) now checks all **171** reports parse with no byte-order marks, and runs in `npm run verify`. Evidence nothing can read is not evidence.

The gate itself is unchanged: registration still needs the administrator prompt.
