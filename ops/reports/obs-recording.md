# Local OBS recording evidence

Both short recording checks passed on 2026-09-12. [Structured results](obs-record-smoke.json) record the files, codecs, dimensions, audio levels, changing frames and browser playback. The recordings use actual Ene Cyber legs with deterministic head/mouth movement and the locally converted public-domain English reference audio. They do not demonstrate physical gestures, live voice conversion or lip synchronization.

| Profile | File result | OBS observations during recording |
| --- | --- | --- |
| Landscape | 1280×720, H.264 at 30 fps, AAC stereo 48 kHz; 10.566 seconds | Zero render/encoder skips; 3.60% OBS CPU, 1.05 ms average render time at end |
| Portrait | 720×1280, H.264 at 30 fps, AAC stereo 48 kHz; 10.566 seconds | Zero render/encoder skips; 5.32% OBS CPU, 1.33 ms average render time at end |

The selected starter encoder is x264 CRF 23, veryfast, High profile, with two-second keyframes. AAC is 160 kbps. Each file has 53 distinct downsampled frames at the validation cadence and a nonsilent reference-audio track around −23.17 dBFS RMS. OBS records a recoverable MKV, then FFmpeg remuxes H.264/AAC into MP4 with fast-start metadata without re-encoding. Chrome decoded and played both MP4s. These short render/file-audio observations are not a sustained camera/voice/OBS benchmark.

Private test files:

- [Landscape MP4](local/obs/recordings/Ene-Landscape-2026-09-12_16-44-24.mp4) and [MKV](local/obs/recordings/Ene-Landscape-2026-09-12_16-44-24.mkv).
- [Portrait MP4](local/obs/recordings/Ene-Portrait-2026-09-12_16-44-37.mp4) and [MKV](local/obs/recordings/Ene-Portrait-2026-09-12_16-44-37.mkv).

`node scripts/obs_record_smoke.mjs` uses an owned visible Chrome window, blocks physical media access and refuses to start if OBS is already recording/streaming or the project collection contains unexpected inputs. It adds one temporary file-audio source, sets monitoring off and only track 1, then removes it. Both capture sources are disabled afterward, record directories and the prior profile/scene are restored, and the test browser closes. No raw microphone, desktop audio, public stream or social upload is involved. Browser playback is served only through a test-local file route; recordings are not added to the studio's served build.

The first attempt exposed a pre-existing OBS auto-configuration wizard, which prevented recording. The owned wizard was closed. Provisioning now writes `General.FirstRun=true` (meaning startup handled) and `Basic.ConfigOnNewProfile=false`; [OBS startup implementation](https://github.com/obsproject/obs-studio/blob/32.2.2/frontend/widgets/OBSBasic.cpp#L1173-L1182) documents the former behavior. A second attempt recorded both files but inspected portrait before its MKV index was flushed. The final script waits for recording to stop and valid duration metadata before validation or profile changes. The final complete run passed.

TASK-018 remains active: its required recordings are at least 60 seconds per orientation with actual speech, blinks, head turns and arm/hand gestures. Physical microphone levels, subjective audio clarity, measured lip sync, final voice selection and combined-load acceptance remain open. TASK-017 also still requires successful Windows Virtual Camera registration and moving-video consumer validation.
