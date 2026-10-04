# TASK-053 implementation evidence

Date: 2026-10-04. Status: Done.

Bounded traces preserve observations, apply times, settings, calibration, and task identities.
Replay resets solver history before each seek. Optional video follows the selected task sample time.

Changed files: `src/tracking-recording.ts`, `src/tracking-video.ts`, `src/replay-video.ts`, and `src/tracking-inspector.ts`.
The [inspector guide](../../../../docs/tracking-inspector.md) explains recording, export, replay, and video import.

## Verification

Commands:

```text
npm test -- --reporter=dot
npm run build
node scripts/replay_video_smoke.mjs
node scripts/recording_lifecycle_smoke.mjs
```

The unit suite passes 265 tests. Type checking and the production build pass.
The build retains its warning for a JavaScript chunk above 500 kB.
Browser tests use Chromium 153.0.8010.12 on Linux.

Evidence:

- [Replay and video results](replay-video-smoke.json).
- [Recording lifecycle results](recording-lifecycle-smoke.json).
- `tests/tracking-recording.test.ts`, `tests/replay-motion.test.ts`, `tests/tracking-video.test.ts`, and `tests/replay-video.test.ts`.

| Acceptance check | Evidence |
| --- | --- |
| Repeated replay | Reasons and accepted channels match the forward run across repeated seeks. |
| Quaternion tolerance | Differences remain below 0.0001 radians. Bone positions remain equal. |
| Seek history | Settings, calibration, resets, tracking loss, and time gaps produce the expected state. |
| Trace limits | Duration, capture count, apply count, total event count, and encoded size retain an importable prefix. |
| Video limits | Size and duration stop paths retain files that play in the browser. |
| Default export | Video is off by default. Exported trace data contain no video, device ID, or absolute path. |
| Unavailable video | A visible message accompanies continued trace recording. The retained trace passes import validation. |
| Replay isolation | Live model, settings, calibration, expression, and peer output remain unchanged. No tracking frames are published. |
| Invalid trace | Invalid input does not change the live or output state. |

## Motion fixture

The synthetic fixture records 90 captures and 180 apply events.
It includes head limits, hand motion, low confidence, sample loss, stale pose data, settings changes, calibration, reset, and an 800 ms gap.
Each apply event receives its referenced task identities, including after reset.
Cached face observations are restored without modifying the stored trace.
A canvas pixel check confirms that replay uses the recorded mirror setting.

## Video and lifecycle

New traces store the session-relative recording start time and video SHA-256 hash.
Video import rejects a different file. Cached tasks retain their earlier image time.
Samples outside video coverage use a plain background.
Older traces remain readable. Video alignment requires a recording start time.
A video without a recorded hash displays an identity limitation.

Real MediaRecorder tests use a 160 by 120 canvas stream without audio.
Saved video plays after normal stop, simulated camera loss, recorder error, size-limit stop, and duration-limit stop.
Seeking reaches 0.2 seconds. Cleanup releases both created URLs and removes the video source.

Leaving Tracking stops recording and retains the trace. Camera loss also stops trace recording.
The interface requests confirmation before it discards an earlier trace.
Disposal clears retained traces, video bytes, and images. Late images are closed.
The recording label remains visible when optional video is unavailable.

## Test limits

Camera loss and recorder error use injected events.
The video size test overrides Blob.size. It does not allocate 64 MiB.
The browser duration test triggers the callback after 1.25 seconds. Fake-timer tests verify the 60-second deadline.
The trace byte-limit test uses actual encoded data near 32 MiB.
A separate memory guard limits all trace events to 10,000.

These tests do not establish physical camera timing, actual encoder failure recovery, or Windows release-browser acceptance.
P05 retains those release checks and target-laptop memory measurements.
