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
