# TASK-025: Route converted speech into OBS and calibrate lip sync

- Status: In progress
- Priority: P0
- Goal: G3
- Depends on: TASK-017, TASK-024
- Estimate: M (1-2 days)
- Specification: [Live English character voice](../../specs/voice-conversion-plan.md)

## Outcome

Capture only the converted voice with the avatar in OBS using an open-source audio path.

## Work

- Configure a dedicated voice-client process/browser instance and OBS Application Audio Capture; verify it isolates the intended audio and works after restart. Disable direct raw-microphone and duplicate desktop-audio sources in voice scenes.
- Provide a verified switchable headphone-monitor path and prevent feedback; confirm changing monitoring does not silence recording. If application capture fails, implement a small open-source PCM-to-OBS bridge instead of silently adding proprietary routing.
- Measure lip/audio alignment and delay the faster path: when voice is late, delay avatar video rather than adding positive audio delay. Store measured offsets per backend/buffer preset.
- Check portrait and landscape recording with speech and lip movement; measure residual mismatch <=80 ms. Mark latency gates separately from sync gates.
- Document OBS Virtual Camera's separate audio requirement. Perform a bounded open-source virtual-microphone compatibility investigation for call apps, checking actual loopback behavior, build license and signing. Report unsupported external-call routing explicitly; do not require test-signing/Secure Boot changes.
- Write OBS scene/profile guidance and the route/monitor/sync section of docs/voice-quickstart.md.

## Acceptance criteria

- [ ] A local test recording contains converted speech and avatar video without raw voice, doubled audio, unrelated application sound or feedback.
- [ ] Monitoring, mute and restart are verified; both output orientations meet the measured <=80 ms residual sync target.
- [x] The required OBS route uses approved open-source components; virtual-microphone support or its specific limitation is documented independently. Every route component is enumerated with hashes and a known open-source licence in [voice-obs-route-licences.json](../../reports/voice-obs-route-licences.json) — OBS and its Browser Source under GPL-2.0-or-later, CEF under BSD-3-Clause, the bridge as project source — and the server's only third-party imports (`aiohttp`, `numpy`, `soundfile`) are covered by the 127-entry licence inventory. **No proprietary virtual-audio product is involved**: no VB-CABLE, Voicemeeter, Synchronous Audio Router or Virtual Audio Cable is installed. The virtual-microphone limitation is documented independently in [voice routing](../../reports/voice-routing.md) and [the quickstart](../../../docs/voice-quickstart.md): stock SysVAD is MS-PL, returns a generated tone rather than real application audio, and requires development test signing, so external-call routing is explicitly unsupported and nothing was installed or re-signed. One gap is recorded: this portable OBS distribution ships no separate CEF licence or credits file, which final packaging must retain.

## Implementation notes

The independent converted-PCM bridge component is implemented while TASK-024's accepted live backend remains open. [Voice routing report](../../reports/voice-routing.md), [configuration helper](../../../scripts/voice/configure_obs_voice.mjs), [private-URL example](../../../config/voice/obs-browser-source.example.json), [quickstart](../../../docs/voice-quickstart.md).

Actual OBS Browser Source/CEF recording of the licensed preconverted English reference is verified in a temporary owned scene: [corrected capture](../../reports/voice-obs-bridge-smoke.json), 13.233 seconds, 1280×720/H.264 + 48 kHz/AAC, zero skipped render/encode frames, reference correlation 0.8697 and digital silence before/after. The [first capture](../../reports/voice-obs-bridge-initial-failure.json) failed continuity at 0.4307 correlation; a bounded 40 ms playback cushion improved the result. Local window metrics and their weaker segment remain documented; continuous-speech quality is unaccepted. Test sources/scenes were removed and original OBS state restored. No physical microphone or public stream was used.

The dedicated output receives converted PCM only, has no microphone permission, and uses a separate output route key. Server/API/state and receiver tests verify bounded queues, stop/stale-frame mute and producer isolation. Browser UI verification shows headphone monitoring can be disabled without stopping the separate receiver. This does not replace physical feedback/device tests or deliberate unrelated-application/raw-mic challenges.

The production source is now [installed and repeat-verified](../../reports/voice-obs-setup.json) in both Ene Landscape and Ene Portrait through `configure_obs_voice.mjs --attach`. One shared source is reused; avatar settings/current scene and existing sync offset are preserved, monitoring is off and the service remains muted. The helper rejects unrelated same-name Browser Source URLs. No manual source addition is required and no recording/performance test was run during this setup.

TASK-026 adds [deliberate natural voice](../../reports/voice-natural-mode.md) through a separately keyed natural-only receiver/source. Its [silent setup](../../reports/voice-obs-natural-setup.json) preserves the converted source and avatar settings. Natural PCM cannot enter the converted receiver, and no error switches modes. Only an explicit Start natural voice action may open its microphone; the natural route's physical sound/latency acceptance remains open alongside the converted route's gates.

The bounded SysVAD investigation is documented with official MS-PL/source/build/signing references: the stock sample simulates loopback using a tone and requires development test signing, so it was not installed. External-call virtual microphone remains unsupported; no boot/security setting was changed.

Still required: viable live conversion, physical monitoring/isolation/restart, both moving-avatar orientations and measured <=80 ms residual lip sync. No sync offset has been applied. Acceptance boxes remain unchecked because the full criteria have not been performed.

When completing this task, record changed artifacts, exact validation commands/results or manual evidence, and unresolved limitations. Leave unperformed checks unchecked.

