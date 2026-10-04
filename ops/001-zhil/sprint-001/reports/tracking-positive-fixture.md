# Positive-photo tracking check and timestamp fix

Real-person photos exposed a tracking failure that negative synthetic images had missed: after a positive face result, the installed SDK rejected a later frame because its internal timestamps no longer advanced. The worker now gives MediaPipe a short session clock while preserving the original epoch timestamps in every external tracking frame and sample. The corrected production build processed **88 photo frames across GPU and CPU**, including simultaneous positive face, pose and hand results on both delegates.

Evidence: [before-fix epoch failure](tracking-positive-epoch-failure.json), [unchanged worker with relative timestamps](tracking-positive-relative-comparison.json), and [corrected worker with normal epoch input](tracking-positive-fixture.json). The [diagnostic script](../../../../scripts/tracking_positive_fixture_smoke.mjs), [worker](../../../../src/tracking.worker.ts), and [regression tests](../../../../tests/tracking-worker.test.ts) are reproducible local artifacts.

The failing graph reported a minimum timestamp of `2147483647001` and a received timestamp of `2147483647000` on its `free_memory` stream. The input was epoch milliseconds around `1.789 × 10¹²`. This is consistent with saturation of a smaller internal clock; the same built worker processed the photos successfully when the diagnostic supplied session-relative milliseconds. The fix records the first input timestamp as an SDK-only origin and supplies `input − origin + 1` to all three `detectForVideo` calls. External result/sample timestamps retain the caller's epoch, including cached pose/hand sample timestamps. The regression checks both the SDK boundary and the external freshness contract. Camera restarts already create a new worker and therefore a fresh origin.

The final run used Tasks Vision **1.0.1**, Chrome **152.0.7977.83**, and the production worker `tracking.worker-a-4NTgbs.js` (SHA-256 `37be54510b10b1a4748eed2c952fbd5b319d2b33373c592a80596191b8734686`). It ran on the laptop described in [feasibility.md](feasibility.md): Intel Core i7-1255U / Intel Iris Xe. This was a direct worker experiment, without an avatar renderer, webcam, microphone or OBS workload.

| Photo framing at 640 × 480 input | GPU warm full-task median | CPU warm full-task median | Positive detections in warm full frames |
| --- | --- | --- | --- |
| Original portrait, resized to fit | 123.6 ms | 351.1 ms | Both: face + pose; hands absent |
| Original full-body photo, resized to fit | 104.3 ms | 293.3 ms | Both: pose + hands; face absent |
| Upper-body crop `(130, 60, 670, 690)` | 131.0 ms | 255.5 ms | GPU: face + pose + hands; CPU: pose + hands |
| Closer face/hand crop `(150, 75, 520, 400)` | 156.4 ms | 276.8 ms | Both: face + pose + hands |

Crop coordinates are `(x, y, width, height)` in the second photo's original **1024 × 1280** pixels. The first photo is **4453 × 6680** pixels. Canvas preprocessing preserved aspect ratio, added black margins as needed, and performed only the stated crops/resizing. No photographic content was synthesized or retouched.

Each delegate had a new worker. Each framing received 11 repeated still-image frames; the first three responses after a framing change were excluded from the warm summary. Balanced cadence calls face every frame and pose/hands every second frame. Thus each table cell summarizes **four warm frames in which all three task calls actually ran**, with separate task timings retained in the JSON. For the closer crop, the median face/pose/hand times were **36.9 / 39.9 / 78.5 ms on GPU**, and **48.3 / 72.8 / 154.1 ms on CPU**. A positive face had a 16-value transform and 52 blendshape values; a positive pose had 33 image and 33 world landmarks; detected hands each had 21 image and 21 world landmarks. All returned coordinates were finite.

These medians are bounded feasibility measurements, not sustained frame rates or a strict delegate benchmark. Sampling was unpaced, GPU preceded CPU, the laptop's load/thermal state can vary, and detection counts differed: the closer crop's sampled GPU result contained two hands while its CPU result contained one. A second person is partly visible in the source body photo; this test does not validate ownership of a detected hand. Pose presence also does not mean every joint was visible or correctly estimated. The full-body framing's absent face and the CPU's need for a closer crop demonstrate a framing limitation, not acceptance of standing tracking.

Model initialization took 1.07 s for GPU and 1.68 s for CPU. The first photo inference then took **18.79 s on GPU** and **1.17 s on CPU**, including cold work. The application already allows a longer first-frame watchdog. Subsequent positive full-task measurements were materially slower than the earlier [negative synthetic CPU inputs](tracking-cpu.md); negative detection is not a useful estimate of full live landmark cost. CPU selection also retained SDK WebGL contexts, so this run does not prove operation without graphics support.

The two private fixture files and their publisher metadata are under ignored `assets/testing`; none is in `public/` or `dist/`:

| Fixture | Primary source and credit | Exact downloaded bytes |
| --- | --- | --- |
| `jsc2021e037768_alt.jpg` | [NASA photo page](https://www.nasa.gov/image-article/spacex-crew-4-mission-specialist-jessica-watkins/), [NASA metadata](https://images-api.nasa.gov/search?nasa_id=jsc2021e037768_alt), credit NASA/Josh Valcarcel; [publisher original JPEG](https://images-assets.nasa.gov/image/jsc2021e037768_alt/jsc2021e037768_alt~orig.jpg) | 1,634,876 bytes; SHA-256 `7a7536821783691d1c7b58f5ee7cb601abbeaaa2f4703e755a15c5dbb4271b78` |
| `jsc2026e002116.jpg` | [NASA metadata](https://images-api.nasa.gov/search?nasa_id=jsc2026e002116), credit NASA/Robert Markowitz; [publisher medium JPEG](https://images-assets.nasa.gov/image/jsc2026e002116/jsc2026e002116~medium.jpg) | 122,603 bytes; SHA-256 `194f6ba51f7bdeb090c9a47e7ab69d3fa191fbb6240cd4b6f118a215bc27caf0` |

NASA's current media guidelines permit factual informational uses subject to their conditions; they also distinguish third-party material and impose restrictions on promotional uses, identifiable people and agency identifiers. This check uses NASA-credited photographs solely as private informational inference fixtures, with no redistribution, promotional use, model training or generated imagery. The source acknowledgement is not a claim that NASA reviewed the test or endorses the program. All tracking outputs and conclusions are this project's MediaPipe test results. [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

Validation completed:

```powershell
npm test
npm run build
node scripts/audit_bundle.mjs
node scripts/tracking_positive_fixture_smoke.mjs --quiet-window
```

All **63 tests in 12 files**, the production typecheck/build, the 33-file bundle audit, and the final photo diagnostic passed. The build retained the existing chunk-size advisory. The browser and its newly launched production server on an ephemeral loopback port were closed afterward. No external network requests/responses or media requests occurred during measurement. The script serves the two private fixtures only through that test browser's route handler; the production server's designated-file boundary is unchanged.

TASK-003/TASK-020 can now cite positive installed-SDK execution, measured landmark workload and the fixed timestamp regression. This does not establish live movement, physical camera quality, anatomical accuracy, end-to-end motion latency, a long stability soak, or the combined camera/voice/OBS workload. Those acceptance items remain open.
