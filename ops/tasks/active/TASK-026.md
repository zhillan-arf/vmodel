# TASK-026: Add voice profiles, audition controls and reliable startup

- Status: In progress
- Priority: P0
- Goal: G3
- Depends on: TASK-015, TASK-023, TASK-024, TASK-025
- Estimate: M-L (2-3 days)
- Specification: [Live English character voice](../../specs/voice-conversion-plan.md)

## Outcome

Make voice selection, comparison, mute and recovery part of the everyday VTuber workflow.

## Work

- Define and validate the versioned VoiceProfile described in the spec, including checkpoint hashes, supported controls, audio devices, backend, buffers and measured sync offset.
- Integrate a small adapter for the proven client's supported controls; provide native client presets/launcher integration first if no stable API exists. Keep Python/audio inference out of the renderer.
- Provide selectable voice presets, level-matched audition playback, save/reset, pitch controls where supported, visible Local/Remote status, microphone/output meters, monitoring and a prominent mute action.
- Switch models at a pause, mute while loading, flush stale buffers and warm models only within measured memory limits. Never send the raw mic on failure; natural-voice bypass requires an explicit action.
- Extend Start VModel.cmd to launch/stop the voice process hidden where appropriate, with device/port/checkpoint error handling and an optional private remote connection; avatar startup must work when remote voice is unavailable.
- Write beginner documentation and meaningful tests for profile compatibility, routing state, muted failure and stale-buffer handling. Keep settings local and secrets outside profiles.

## Acceptance criteria

- [x] At least three distinct voice presets can be selected, compared, saved and restored without editing code; unsuitable audition candidates are visibly labeled.
- [ ] Start/stop/restart, model-load failure, occupied devices and backend loss leave audio muted and release resources.
- [x] A user can distinguish local from remote conversion and deliberately enable natural voice; no automatic raw-mic fallback occurs.
- [x] Changing chunk/backend settings invalidates or recalibrates the corresponding sync offset.

## Implementation notes

The independent controls/startup component is implemented while TASK-023/024/025 retain their quality, live-performance and physical-route gates. [Voice Studio implementation report](../../reports/voice-routing.md), [beginner workflow](../../../docs/voice-quickstart.md), [profile validator](../../../scripts/voice/profiles.py), [launcher](../../../scripts/voice/launch.py) and [actual short eager-adapter check](../../reports/voice-live-adapter-smoke.json).

[Chrome reference UI tests](../../reports/voice-studio-ui-smoke.json) pass Bright/Soft/Cool selection, comparison, save/restore/reset, monitoring independent of the receiver, second-window rejection, Stop/controller-loss mute and mobile layout. All presets remain visibly provisional/Japanese-trained; no user choice, English suitability or live quality is inferred. No physical media calls or external requests occurred and tests used isolated settings.

Fifteen server/profile tests cover unsupported model/pitch/acceptance fields, gains, profile persistence, changed-context/device sync fingerprints, Host/Origin/route authorization, one producer, bounded backlog, late deadline stops, old results after Stop, model load/inference failures and the explicit natural-mode contract. The backend/chunk values are immutable and unsupported substitutions are rejected; supported context/device changes invalidate sync. No fabricated or unmeasured offset can be accepted. AudioWorklet tests cover underflow/overflow/stale-epoch silence and converted/natural frame separation. Two local mock remote-checker tests prove bounded explicit-URL discovery without audio upload, redirect following or logged API keys.

`Start Voice Studio.cmd` / `Stop Voice Studio.cmd` work with the pinned environment. Optional `Start VModel.cmd -Voice`, `-NoBrowser -Voice`, and `-StopVoice` are implemented; no-browser start/stop/restart was exercised with avatar/audition services retained. Stop targets only the identity-verified owned voice process. Remote failure does not gate default avatar startup. The real adapter successfully warms one pinned model and converts three public-domain file blocks, but its measured compute still misses live timing.

The [deliberate natural-voice mode](../../reports/voice-natural-mode.md) now has an explicit Start natural voice action, prominent NATURAL VOICE TO OBS state, a separate validated profile and resampling path without neural inference. Mutually exclusive producer modes, independent output keys/frame kinds and epoch flushing preserve the converted-only receiver. Conversion failure cannot enter natural mode. The [mocked browser workflow](../../reports/voice-natural-ui-smoke.json), two streaming resampler tests and the server/receiver tests pass without physical media or monitoring. The separate [natural OBS source](../../reports/voice-obs-natural-setup.json) is installed silently in both Ene scenes, preserving the converted source and existing calibration. The UI identifies the local backend; remote service support remains unconfigured and is never implied to be active.

The [bounded receiver-reconnect extension](../../reports/voice-receiver-reconnect.md) is applied and verified. Five deterministic reconnect groups, existing PCM checks, six mocked OBS groups and three launcher tests pass. The [actual isolated WebSocket restart](../../reports/voice-reconnect-browser.json) passes both natural/converted routes with mocked Web Audio, fresh state, no page navigation/producer and terminal rejection after replaced identities. The [existing-service launcher check](../../reports/voice-launcher-receiver-refresh.json) actually refreshes both verified silent OBS sources while preserving process identity, settings/sync and scene state. Final voice state remains idle/muted with no producer and two receivers; no OBS output, physical media or voice playback started. Cold-loaded/expired receiver pages use this best-effort launcher refresh; changed keys still require explicit reattachment. Physical recovery and automatic CEF reconnect after a production-service restart were not tested, so the combined device criterion remains unchecked.

Still required: physical device permission/occupied/unplug/recovery and headphone tests, accepted local/remote live backend and complete physical routing/sync. No physical mic capture was performed in this implementation checkpoint, so the combined device-recovery acceptance criterion remains unchecked.

When completing this task, record changed artifacts, exact validation commands/results or manual evidence, and unresolved limitations. Leave unperformed checks unchecked.

