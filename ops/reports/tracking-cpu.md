# Installed tracking SDK CPU diagnostic

The installed MediaPipe Tasks Vision **1.0.1** initialized the face, pose and hand tasks with the CPU delegate and returned seven actual `detectForVideo` results. This was a direct worker test with synthetic geometric bitmaps, no camera and no detected person. It establishes that the installed CPU task path runs; it does not establish live gesture quality, the cost of landmark inference after a person is detected, or operation on a machine without WebGL.

Evidence: [runtime results](tracking-cpu-smoke.json), [diagnostic](../../scripts/tracking_cpu_smoke.mjs), [worker implementation](../../src/tracking.worker.ts), [worker tests](../../tests/tracking-worker.test.ts). Measured 2026-09-12, 09:42 UTC with Chrome 152.0.7977.83 on this laptop. The built worker was `tracking.worker-CssJ7G00.js`, SHA-256 `9f7cc66943114fc084e9384158b93302f415bd40a083d6331dd5ba399c6e64e8`.

| Measurement | Observed result |
| --- | --- |
| Worker initialization of all three tasks | 633.1 ms |
| First frame, face + pose + hands | 311.6 ms inside worker; 312.5 ms round trip |
| Three subsequent frames running all three tasks | 50.5–54.7 ms inside worker |
| Three alternating face-only frames | 5.2–10.4 ms inside worker |
| Input and cadence | Seven 640 × 480 bitmaps; balanced cadence, hands enabled |
| Actual task calls represented by results | Face: 7; pose: 4; hands: 4 |
| Detection results | Face, pose and hands absent in every sample |
| External requests/responses and media requests | Zero |

The diagnostic requests `{ type: 'init', delegate: 'CPU' }` directly from the production worker. It verifies the returned CPU delegate, successful local model responses, and separate `face-CPU`, `pose-CPU`, and `hands-CPU` WASM loader URLs. Every task sample has positive measured inference time, and timestamps show the expected alternating pose/hand cadence. SDK logs contain three TensorFlow Lite XNNPACK CPU delegate creations. The SDK also creates WebGL contexts in this run, so CPU delegate selection should not be described as disabling every graphics dependency. Timings come from seven sequential requests, including warm-up; this is not a sustained frame-rate benchmark.

Only explicit diagnostic initialization changes. The normal `CameraTracker` sends an init message without a delegate, so the existing GPU-first initialization and CPU retry after GPU initialization failure remain in place. The installed SDK's [BaseOptions declaration](../../node_modules/@mediapipe/tasks-vision/vision.d.ts) supports `CPU` and `GPU`. New unit tests verify that explicit CPU initialization never attempts GPU, executes all three task APIs, and releases a partially created CPU task on failure. The existing test still verifies release of partial GPU resources before CPU fallback. Actual GPU initialization failure was not induced in the browser.

The diagnostic served the built worker, SDK/WASM files and three model bundles from a newly launched production server on loopback port 53390. Its minimal host document does not load the avatar or open a camera. The runtime JSON includes the exact asset inventory; the post-build [bundle audit](bundle-audit.json) verified every runtime hash against the pinned manifest, the avatar hash, all designated served files, and notices for 16 runtime packages. The model licensing evidence is in [model notices](model-notices.md).

Validation completed successfully:

```powershell
npx vitest run tests/tracking-worker.test.ts tests/camera.test.ts tests/server-watch.test.ts
npm run build
node scripts/audit_bundle.mjs
node scripts/tracking_cpu_smoke.mjs --quiet-window
node scripts/server_stop_smoke.mjs --quiet-window
```

The focused test run passed **14 tests in three files**. The build/typecheck passed, with Vite's existing bundle-size advisory. The bundle audit passed for 33 files and 16 runtime packages. Both actual browser diagnostics passed and closed their owned browsers and temporary servers. [Server-loss results](server-stop.md) separately prove release of an acquired fake camera stream by the production application's health watcher.

TASK-003 can now cite real installed-SDK CPU execution alongside its existing mocked fallback and camera backpressure checks. Its live person-driven acceptance and final combined recording evidence still require their own evidence; this report does not close that task.
