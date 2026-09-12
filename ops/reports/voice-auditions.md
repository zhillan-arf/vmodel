# Voice auditions: reference preview prepared

Updated 2026-09-12. TASK-023 is **In progress**. A local comparison page and four level-matched English reference clips are available. No user preference, speaking comfort, live voice or final default has been accepted.

Open **http://127.0.0.1:5081/** while the listening-room server is running. It offers the original public-domain English performance and bright/soft/cool CHIHAYA conversions, comparison buttons, ratings, local notes and export. Only one player plays at a time; Stop pauses and rewinds all clips. No microphone or camera permission is requested. The original speaker is explicitly labeled a **source reference**, not a trained English control.

## Existing artifacts

- [Reference manifest and audio hashes](voice-reference-auditions.json). All four clips use the same 8.397-second English passage, resampled to 40 kHz and matched to RMS 0.07 with common peak headroom. This is RMS matching, not a claim of equal perceptual LUFS. The three original conversions and the original source WAV remain unchanged.
- Local playback files: `assets/voice/auditions/reference-v1/source.wav`, `bright.wav`, `soft.wav`, `cool.wav`. The [model terms](voice-models.md) and [conversion evidence](voice-conversion-smoke.json) identify original weights, settings, source audio and hashes.
- [Preparation script](../../scripts/voice/prepare_auditions.py), [loopback server](../../scripts/voice/serve_auditions.py), and [audition page](../../scripts/voice/audition/index.html).
- [Operator passage](../../docs/voice-audition-passage.md) for later 60–90-second normal/expressive takes, quiet phrase, laugh and spontaneous speech. No operator recording was made during this preparation.

Saved notes go to `assets/voice/auditions/reference-v1/ratings.json` only after the user selects **Save this comparison**. The server records them as provisional reference impressions with `liveDefaultAccepted: false`, fixed audio hashes and a public-domain-reference source label. Export provides a separate JSON copy. No real user ratings file existed at the end of implementation verification.

To regenerate/start the listening room:

```powershell
.tools/voice/venv/Scripts/python.exe scripts/voice/prepare_auditions.py
python scripts/voice/serve_auditions.py
```

The server binds only `127.0.0.1:5081`. Its allowlist serves the page, its small static files, four audio clips, their manifest, health and provisional notes. It does not serve model weights or a browsable project directory. Host/origin checks protect note writes; CSP blocks external content/connections and Permissions-Policy disables camera/microphone access.

## Validation performed

`python scripts/voice/test_audition_server.py` passed **two tests** covering provisional score validation, rejection of live-acceptance claims/foreign hashes, allowlisted audio ranges, project/model path denial, host/origin checks and persistence in a temporary test directory. Simulated notes never touched the user's ratings file.

`node scripts/voice/audition_smoke.mjs` passed in installed Chrome/Playwright. It verified four correctly timed players initially paused, all three comparisons, one player at a time, Stop/rewind, provisional save payloads, restored local notes, zero microphone calls, zero external requests, zero browser errors and no horizontal overflow at 390 px width. The UI save request was intercepted in an isolated browser context to avoid recording a simulated user opinion. [Machine-readable browser evidence](voice-audition-ui-smoke.json), [desktop review](local/voice/audition-desktop.png), [mobile review](local/voice/audition-mobile.png).

These checks establish functioning playback and storage, not audible character fit. The underlying eager CPU conversions ran during other project rendering work and are not controlled live-performance measurements.

## Remaining TASK-023 acceptance

1. Capture the user's separate normal/expressive local takes with their participation, then convert identical material for all candidates. The existing reference clips do not establish how the user's voice will convert.
2. Acquire/train an actual natural English feminine control. LUNAR access returned HTTP 401; the independent [LJ Speech training route](../../docs/voice-setup.md#english-control-fallback) remains available. The user's probable VPN/vLLM API access does not itself establish training or RVC support.
3. Obtain listening ratings and evaluate consonants, reactions, quiet speech, laughter, naturalness and comfort. Confirm the candidates are meaningfully different to the listener; distinct checkpoint hashes alone cannot establish this.
4. Test the best two in a live conversation with the measured streaming settings. Record preferred default/alternatives only after the user hears and accepts them, or produce an explicit failed-fit/training brief for TASK-027.

Current preference: **unrecorded**. Current default voice: **unselected**. Existing clips are not silently substituted for the required user-specific audition or live gate.
