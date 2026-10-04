# Production server loss releases camera resources

The built production app released its acquired video track, detached the preview stream, cleared tracking data and terminated its tracking worker when its local server stopped. Release was observed **2,248 ms** after the stop request, following two failed health probes. The check used Chrome's fake camera; no physical camera, microphone, OBS instance or existing shared server was accessed.

Evidence: [measured results](server-stop-smoke.json), [integration diagnostic](../../../../scripts/server_stop_smoke.mjs), [owned-server helper](../../../../scripts/isolated-studio-server.mjs), [production watcher](../../../../src/server-watch.ts), and [watcher unit tests](../../../../tests/server-watch.test.ts).

The diagnostic launched `scripts/server.mjs` as its own child process, PID 14300, on `127.0.0.1:51531`, then opened the actual production app in Chrome 152.0.7977.83. Before pressing Start, no camera request occurred. After Start, the real installed tracker returned at least two frames and reported GPU tracking. Its single video track was `fake_device_0`, live, with no stop calls; the request explicitly set `audio: false`. Four successful production `/health` responses were recorded before server termination.

Only that newly created server process was stopped. Its next two health requests failed, and the app displayed “Local studio server disconnected. Camera stopped; reopen Start VModel.cmd to continue.” The track then had `readyState: ended` and exactly one `stop()` call; the video element's `srcObject` was null, tracked sequence returned to zero, and the browser reported zero remaining workers. No second media acquisition occurred. The diagnostic then closed its own browser and confirmed its own server had exited.

The production watcher polls every 1.5 seconds while a camera is active and stops after two consecutive failed checks. The exact observed delay depends on where server termination falls within that cycle and request failure timing. The focused unit tests also verify tolerance of a recovered health request, no idle polling, and no delayed stop after watcher disposal. The original Stop/restart camera tests remain separate evidence for normal session ownership.

Run after coordinating a quiet browser/CPU window and producing the current build:

```powershell
node scripts/server_stop_smoke.mjs --quiet-window
```

The actual run passed with no page errors or external network responses. A connection-refused browser console message is expected after the owned server exits. The helper reserves an ephemeral loopback port, refuses the project's shared ports 4173/5173/5081, and retains its own child-process object for cleanup; it does not search for or terminate another process occupying a port.

This provides the server-stop camera-release evidence for TASK-019. It is not a physical camera test, an operating-system permission test, or full acceptance of TASK-019's remaining voice packaging, offline launcher and occupied-port behavior.
