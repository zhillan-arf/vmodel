# Voice receiver restart recovery

Date: 2026-09-12. TASK-026 remains active. The reviewed staging hashes matched all eight production destinations before application; the implementation and prepared tests are now applied and pass.

The two OBS receiver pages can recover from a short voice-service interruption without a manual page refresh. [The player](../../scripts/voice/studio/player.js) opts into this behavior only on `/obs` and `/obs-natural`. Control-window ownership and laptop monitoring still require explicit reconnection; this change never claims a producer, starts a voice mode or requests a microphone.

On error or disconnect, the receiver immediately clears its playback permission, epoch, producer identity, sequence and PCM queue. Old socket callbacks are rejected by socket identity and generation. A new connection sends only the same private receiver credentials to the same output endpoint and waits for valid matching route/frame-kind state. Natural and converted output remain separate. The existing packet-age, sequence and bounded PCM checks still apply.

Only one reconnect timer/socket exists per receiver. Retry delays are 0.5, 1, 2, 4, 8 and then 10 seconds, capped at twelve retries or two minutes per outage. Connection/initial-state timeout is five seconds; a missing state heartbeat mutes and reconnects after three seconds. Five stable authenticated seconds reset the outage budget. Authentication/protocol rejection, page closure or the retry limit stops retries; errors remain labeled for the correct natural/converted route.

The [launcher](../../scripts/voice/launch.py) also starts a hidden, best-effort [OBS receiver refresh helper](../../scripts/voice/refresh_obs_receivers.mjs) after the local service is healthy, including an already-running service. This covers a page that loaded while HTTP was unavailable or exhausted its retry budget. The helper checks the existing local OBS connection, reviewed collection, idle/muted voice, inactive OBS outputs, exact named receiver origins/paths/private identities and disabled monitoring. It invokes only `refreshnocache`, never a settings write. Canonical hashes verify preserved settings, nonzero sync offsets, tracks, volume/mute and scene state. It runs for at most fifteen seconds, inherits a reduced environment, and cannot block avatar/voice startup. Missing OBS/Node, changed keys, active voice/output or mismatched sources cause a skip. The refresh callback is part of the [official OBS Browser Source implementation](https://github.com/obsproject/obs-browser/blob/master/obs-browser-plugin.cpp).

## Actual verification

- Five deterministic reconnect test groups pass both routes, fresh-state gating, stale socket callbacks, malformed state/authentication failure, timer bounds, heartbeat/connection timeout, cleanup, stable recovery and manual-only monitoring. Existing PCM tests pass with the complete state contract.
- Six mocked OBS-helper groups pass exact ownership, preserved settings and nonzero sync, response key ordering, active/unrelated state rejection, changed state during refresh and absent optional receiver/virtual-camera support. Three launcher tests pass hidden asynchronous invocation, reduced environment and nonfatal missing dependency/spawn behavior. [Recorded command results](voice-reconnect-unit.json).
- The [real-WebSocket browser check](voice-reconnect-browser.json) restarts an owned isolated service while both pages remain loaded. Both reconnect without navigation, receive a fresh epoch and remain muted without a producer. Each retains one mocked AudioContext. Replacing both isolated route identities and restarting again causes terminal authentication rejection and stops retries. The test opens no native audio context, producer, microphone, OBS connection, monitoring, recording or external request.
- The [actual existing-service launcher check](voice-launcher-receiver-refresh.json) returns successfully and invokes the hidden helper. Both installed OBS receivers refresh; their source settings/sync and scene state are unchanged, and the production voice process identity is preserved. Final state is idle/muted with no producer and two receiver connections. Recording/streaming/virtual-camera outputs are inactive. This check starts no voice/audio playback or physical media.

Reproduction commands for the isolated checks:

```powershell
node scripts/voice/test_reconnect.mjs
node scripts/voice/test_pcm.mjs
node scripts/voice/test_refresh_receivers.mjs
.tools/voice/venv/Scripts/python.exe scripts/voice/test_launcher_refresh.py
node scripts/voice/reconnect_browser_smoke.mjs
```

The actual launcher refresh is best-effort and runs only when its state guards pass. A changed private identity still requires explicit source reattachment; disabled/missing sources, active output/voice and unavailable audio devices are never overridden. A cold-page failure was not deliberately induced in OBS CEF, and production-service restart/CEF automatic reconnection was not tested: the real restart evidence uses Chrome with mocked Web Audio, while OBS evidence verifies the silent refresh callback. No physical sound/device recovery, live character speed/quality or lip-sync acceptance is inferred. The coordinated window was released back to root after the browser and OBS checks completed.
