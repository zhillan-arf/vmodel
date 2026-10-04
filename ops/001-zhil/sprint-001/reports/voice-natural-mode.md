# Explicit natural voice implementation

Date: 2026-09-12. TASK-026's deliberate natural-voice mode is implemented. It is a separate, explicitly selected output, and is never entered on a conversion failure.

**Start natural voice → OBS** stops character/reference playback, changes the producer epoch, clears queued output, then requests the selected microphone. The interface displays **NATURAL VOICE TO OBS** and states that the person's own speech goes to OBS. Changing presets, Stop, connection loss, microphone denial or processing failure mutes both routes. Reload/startup remains idle. Only one producer mode can be active.

The natural profile is independent of the three character profiles, saved in the ignored `assets/voice/studio/natural-profile.json`. It records input device/gains and its own timing fingerprint, forbids automatic start/fallback and makes no physical sync claim. There is no voice model or neural inference in this path. The [stateful resampler](../../../../scripts/voice/natural_pcm.py) uses the existing NumPy/SciPy environment to convert 2,560 input samples at 16 kHz into 6,400 samples at 40 kHz. A causal 101-tap polyphase FIR retains 20 input samples across blocks and contributes 0.625 ms mathematical filter delay; that value is **not** a measured physical latency. The existing output gain bound, 40 ms playback cushion, 240 ms queue cap, frame freshness checks and mute-on-overflow behavior apply independently.

| Contract | Character conversion | Explicit natural speech |
| --- | --- | --- |
| OBS source | Ene Converted Voice Bridge | Ene Natural Voice Bridge |
| Receiver page | `/obs` | `/obs-natural` |
| Input WebSocket | `/ws/input` | `/ws/natural-input` |
| Input frame magic | VMIN | VMNI |
| Output WebSocket | `/ws/output` | `/ws/natural-output` |
| Output frame magic | VMOA | VMNA |
| Private output key | Existing converted key | Separate natural key |

Both receiver pages prohibit microphone access. Host/Origin checks, producer ownership and output-key authorization apply to both endpoint sets. A converted key cannot authorize the natural endpoint, a natural key cannot authorize the converted endpoint, and each player rejects the other output frame type. Natural PCM never passes through the converted source. Failure handling selects idle/muted, not another voice mode. The licensed natural reference file remains outside the broadcast catalog/static allowlist.

## Evidence

- Fifteen [server/profile tests](../../../../scripts/voice/test_studio.py) pass, including explicit natural acknowledgement, distinct route keys, wrong-kind input, natural/converted exclusivity, stale epoch rejection, Stop/disconnect mute, and no natural fallback after conversion failure. Fake inference and synthetic PCM avoid all physical media.
- Two [resampler tests](../../../../scripts/voice/test_natural_pcm.py) pass streaming-versus-continuous waveform equality, expected tone level/sample count, retained chunk-boundary history, reset-to-silence and invalid-input rejection. No neural engine is initialized by natural mode.
- [Receiver tests](../../../../scripts/voice/test_pcm.mjs) verify VMNA/VMOA separation as well as underflow, overflow, reset and stale-frame silence.
- The [mocked browser workflow](voice-natural-ui-smoke.json) passes explicit action, clear mode labels, natural-only packet delivery, preset-change track release, discarded old input, mocked occupied-device failure, Stop and reload-without-reopen. `getUserMedia`, AudioContext and AudioWorkletNode were mocked: **zero physical microphone requests, zero native audio contexts, zero monitoring/recording and zero external requests**. The [review image](local/voice/natural-active-mocked.png) shows the UI while synthetic natural mode was active; it is not a recording of the user.
- [Initial](voice-obs-natural-setup-initial.json) and [repeated](voice-obs-natural-setup.json) silent setup apply `node scripts/voice/configure_obs_voice.mjs --attach --natural`. Each Ene scene and the utility audio scene have exactly one natural source. The converted source's settings/sync/mute/tracks/monitor hash, avatar settings/items and current scene are preserved. Both sources use recording track 1, monitoring off; natural begins at the new source's zero offset and repeat setup preserves it. No automatic raw microphone/desktop capture source was added.
- The existing converted receiver was [refreshed after the service upgrade](voice-obs-receiver-refresh.json), preserving its settings and sync. Refresh invokes the official Browser Source property callback and does not start microphone input or change producer mode. [Official OBS Browser Source refresh property](https://github.com/obsproject/obs-browser/blob/master/obs-browser-plugin.cpp).

No OBS recording, physical monitoring, physical microphone test or heavy benchmark was run for this extension during Blender production. Natural-speech physical device behavior, sound quality and latency/sync still require user-assisted acceptance; character-voice live speed/quality remains separately unaccepted. Motion/soak coordination now recognizes both exact named silent routes and preserves their settings.

Final read-only handoff verification: Voice Studio is idle/muted with no producer and exactly two connected output receivers. OBS recording/streaming are inactive; its only inputs are the two existing avatar window captures and the two named voice Browser Sources. The final mocked UI rerun passes after pending-device-error/old-socket guards were tightened. No voice conversion, browser, routing or performance test remains running. The task audit passes with no errors; TASK-025/026 remain active, with TASK-026's deliberate natural-mode criterion now checked and physical recovery still unchecked.
