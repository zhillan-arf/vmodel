# Ene Voice Studio

All `.cmd` launchers are in the project's **deploy** folder.

Voice Studio now provides three provisional voices, local saved settings, a converted-reference demo, and an experimental microphone adapter. Live conversion on this laptop has **not** met its timing or English-quality acceptance gates. Use the reference demo to try the controls; it is prerecorded conversion of a licensed English sample, not your microphone.

## Start and listen

1. Double-click [Start Voice Studio.cmd](../deploy/Start%20Voice%20Studio.cmd). It starts a hidden local service and opens `http://127.0.0.1:5082/`. It starts muted and does not request microphone access.
2. Select **Bright**, **Soft** or **Cool**. Enable **Hear the active voice on this laptop** with headphones, then click **Play converted reference**. Each timbre uses the same public-domain English sentence. The separate [listening comparison](http://127.0.0.1:5081/) includes the natural source and provisional rating controls.
3. Use **Stop / mute** to clear audio. Change gain, past context or microphone selection, then **Save preset**. Presets restore locally; monitoring starts off on each new control connection. These no-F0 models have no pitch control. **Reset preset** restores the selected voice's defaults.
4. Close the control window to mute, or double-click [Stop Voice Studio.cmd](../deploy/Stop%20Voice%20Studio.cmd) to stop the service. The avatar and listening-room services remain available. Reconnect explicitly, then start audio again.

One control window owns the voice producer. If another window reports an owner conflict, use the original window or close it and wait 30 seconds before connecting a new one. Reconnect within the same tab restores its lease but never restarts the microphone automatically.

## Experimental microphone conversion

**Start experimental microphone** loads and warms one local model, then requests microphone access. Input is sent only to the loopback server. The OBS receiver has no microphone access. No audio is uploaded to an external service.

The current CPU implementation has a one-block pending input mailbox and discards outdated work. A conversion missing its 160 ms processing deadline is silent; three consecutive misses stop microphone input. On the tested laptop, slower-than-real-time results are expected. Stop, disconnect, permission/device loss, model failure and preset changes never replace converted audio with natural speech.

If the device cannot open, close the other application holding it, select an available microphone, save, and start explicitly. The device may resample internally; physical microphone and headphone performance still need a user-assisted test. Use the [performance report](../ops/reports/voice-performance.md) to distinguish measured inference time from unmeasured microphone-to-output latency.

## Use your natural voice deliberately

Click **Start natural voice → OBS** when you want your own speech. This stops character conversion, clears buffered sound, then requests the selected microphone. Your natural speech, with the selected gains and sample-rate conversion, goes to the separately installed **Ene Natural Voice Bridge**. No character model runs. The amber panel and **NATURAL VOICE TO OBS** status show that this mode is active.

**Stop / mute** mutes both routes. Selecting a character preset stops the microphone; start experimental character conversion explicitly when ready. A model/device/network failure never enables natural voice. Restarting or reloading never opens the microphone automatically. Natural and character routes have different private keys and only one mode can send audio at a time. Natural microphone and headphone behavior has been checked with mocks, not yet with physical devices; [implementation evidence](../ops/reports/voice-natural-mode.md) states the limits.

## OBS route

The route has passed a bounded converted-reference recording check. Continuous-speech quality, live performance and lip sync remain unaccepted; keep it out of a production livestream until those later gates pass. The [routing report](../ops/reports/voice-routing.md) records the initial failure, corrected capture and exact limits.

1. Start Voice Studio and OBS in the existing **Ene Studio** collection. **Ene Converted Voice Bridge and Ene Natural Voice Bridge are already installed in both Ene Landscape and Ene Portrait**. You do not need to add sources or copy URLs. They are separate transparent receivers; both remain silent until their corresponding explicit mode starts.
2. Select your usual avatar scene and attach its Ene output window as described in the [OBS guide](obs-setup.md). The separate **Ene Voice Studio** scene is an audio-only utility scene, not the scene to choose when you want the avatar visible.
3. **Control audio via OBS** is already enabled. If a source is accidentally removed, stop voice playback and OBS outputs, then run `node scripts/voice/configure_obs_voice.mjs --attach` for character conversion or add `--natural` for natural speech. The helper checks each source's distinct expected receiver URL, preserves existing sync offsets and the other voice source, and keeps avatar settings/current scene unchanged. See the [converted](../config/voice/obs-browser-source.example.json) and [natural](../config/voice/obs-natural-source.example.json) examples.
4. In Advanced Audio Properties, leave both sources on recording track 1 and **Monitor Off** if laptop monitoring is enabled. Keep automatic microphone/desktop capture disabled; the natural route gets speech only from Voice Studio's explicit natural action. A reference demo should reach OBS even while laptop monitoring is off.
5. Stop and replay a reference, then verify the saved recording before using live audio. A disconnected receiver mutes and retries for up to two minutes; it waits for fresh authorized state before receiving audio again. Voice Studio's controls and microphone still require explicit reconnect/start. Keep each private URL local; its fragment grants access to that voice route. Model files and natural source recordings are not exposed by the voice service.

If a receiver stayed offline too long or OBS opened before Voice Studio, stop voice playback and OBS outputs, then run **Start Voice Studio.cmd** again. It also works when the service is already running: a hidden helper refreshes the two verified silent OBS sources while preserving settings and sync. It skips recovery during active voice/recording/streaming/virtual camera, with changed keys, or when OBS is unavailable. Changed private route files require the explicit repair command in step 3. The [restart recovery report](../ops/reports/voice-receiver-reconnect.md) separates real WebSocket restart checks from the silent OBS refresh check.

Lip sync is **unmeasured**. No delay is applied or inferred from a reference recording. When a viable backend is available, measure the live paths together: delay the faster avatar video if voice arrives late, then save a calibration bound to the backend, chunk/context settings and input device. Both orientations still need the <=80 ms residual-sync check.

OBS Virtual Camera provides video. It does not create a microphone for Zoom, Discord or other call apps. This implementation supports an OBS audio route under test; an open-source, production-signed Windows virtual microphone has not been provisioned. The [compatibility investigation](../ops/reports/voice-routing.md) explains the specific limit. No test-signing or Secure Boot change is required or performed.

## Remote API and recovery

Remote conversion is not configured. The reported A100 access may be a vLLM API over the laptop VPN; its base URL and served model are still unknown. An ordinary text/chat endpoint does not establish RVC support.

Given an explicitly supplied endpoint, the bounded checker can inspect its model list and schema without sending audio:

```powershell
.tools/voice/venv/Scripts/python.exe scripts/voice/check_remote.py --base-url "http://EXPLICIT-HOST:PORT/v1"
```

Replace the placeholder only with the supplied address. The tool never discovers hosts, follows redirects or uploads audio. If needed, it reads `VMODEL_VOICE_API_KEY` from the environment and omits that value from output; do not put credentials in the URL or saved profiles. A separate voice-conversion contract or authorized RVC service may be required.

For startup failures, read `.cache/voice/server-error.log`. Do not replace an unrelated program occupying port 5082; stop only the owned Voice Studio instance. Saved profiles and private route identity live under `assets/voice/studio/`, outside distribution. Restore missing pinned dependencies/assets using [voice setup](voice-setup.md). Replacing the private route file changes the OBS URL and requires reattachment.

## Comparing the candidate voices

**Start Voice Auditions.cmd** opens the listening room at `http://127.0.0.1:5081/`, where the converted candidates and the unconverted English reference play at matched levels. It needs no microphone and starts no conversion. Leave the window open while you listen, then press Ctrl+C in it.

This is separate from Voice Studio on port 5082, which is the live conversion interface.
