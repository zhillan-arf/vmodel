# Local voice-conversion setup

All `.cmd` launchers are in the project's **deploy** folder.

Codex provisions this environment. It converts local files into three licensed character candidates, and [Voice Studio](voice-quickstart.md) supplies controls, explicit natural voice and separate installed OBS receivers. Preferred-voice auditions, physical device behavior, live character performance and sync still require acceptance; a successful file conversion does not establish a ready livestream setup.

The kit uses isolated Python 3.10.19 at `.tools/voice/venv`, a pinned deiteris RVC source checkout and local weights at `assets/voice`. It uses CPU inference and does not depend on an A100. The avatar launcher continues to work independently.

Double-click **Setup Voice.cmd**. It downloads the pinned public inputs and builds the isolated environment; the first run takes several minutes and needs an internet connection. When it finishes, **Start Voice Auditions.cmd** opens the listening room.

The launcher is a thin wrapper around the same command, if you would rather run it yourself:

```powershell
python scripts/voice/provision.py
```

The installed `uv` and Git utilities are used. The installer checks SHA-256 hashes, syncs the exact dependency lock, retains changed source instead of overwriting it, and downloads only the cataloged public inputs. It does not launch upstream's automatic sample/weight downloader. An internet connection is needed to restore missing dependencies/assets.

For a local conversion check:

```powershell
python scripts/voice/convert.py --voice bright
python scripts/voice/convert.py --voice soft
python scripts/voice/convert.py --voice cool
```

The default input is an official public-domain LJ Speech sample. WAV files and machine-readable results are saved in `ops/reports/local/voice/`. `--input` and `--output` accept other local project files; inputs must be at most 120 seconds. These commands never open a microphone or speaker. The conversion worker rejects changed catalog weights/source, uses weights-only checkpoint loading, verifies a safer tensor copy, and blocks Python socket connections. This is process isolation with reduced environment variables, not an operating-system sandbox.

The three labels are audition hypotheses. CHIHAYA is Japanese-trained; English intelligibility and this user's preferred character fit remain unverified. These checkpoints have **no F0 input** and their creator specifies **index ratio zero**. Pitch controls and a dummy retrieval index therefore do not belong to these presets. The file converter uses edge context; it is not a live-latency configuration.

The exact code/model terms and hashes are in [voice-toolchain](../ops/reports/voice-toolchain.md), [voice-models](../ops/reports/voice-models.md) and the [asset manifest](../config/voice/assets.json). Audio and model assets remain outside code distribution. No cloud credentials or remote endpoint are configured.

The installed receivers have bounded reconnect. If an OBS page stayed offline, stop voice playback and OBS outputs and run **Start Voice Studio.cmd** again; its optional helper refreshes only verified silent sources, preserving settings and calibration. This recovery does not block avatar/voice startup. Changed keys require explicit reattachment through the voice quickstart. [Recovery evidence](../ops/reports/voice-receiver-reconnect.md) records the browser restart and actual silent OBS checks.

## Performance experiments and listening

The local [reference listening room](http://127.0.0.1:5081/) compares the three voice timbres. The separate [complete-passage context page](../assets/voice/auditions/context-v1/review.html) opens directly as a local HTML file and compares three experimental speech-history settings for the bright voice. It uses the same complete public-domain source and matched playback volume; microphone access stays off. Neither page accepts live voice quality or delay on the user's behalf.

Codex has also provisioned separate optional environments: `.tools/voice/onnx-venv` for the bounded DirectML experiment and `.tools/voice/openvino-venv` for Intel CPU/GPU experiments. Their recovery commands are `python scripts/voice/provision_onnx.py` and `python scripts/voice/provision_openvino.py`. They do not replace the baseline CPU environment. DirectML's bundled Windows runtime has separate proprietary Microsoft terms; OpenVINO's selected inference components use Apache-2.0 with third-party notices retained. The [performance report](../ops/reports/voice-performance.md) records exact models, providers, numerical failures, timings and reproducible commands.

No live preset is selected: measured CPU variants are too slow, the bounded DirectML probe did not finish preparation, and OpenVINO's GPU output failed numerical equivalence. The GPU WAVs are retained for review; numerical mismatch alone is not a listening verdict. The avatar and existing timbre-audition server continue to work independently.

## English-control fallback

LUNAR's current target download is gated and returned HTTP 401 without an account. The independent fallback is a project-trained LJ Speech control, using the dataset publisher's [LJ Speech 1.1 archive](https://data.keithito.com/data/speech/LJSpeech-1.1.tar.bz2) and [public-domain statement](https://keithito.com/LJ-Speech-Dataset/). The 2.6 GB training archive has not been downloaded; the small conversion sample already is local.

TASK-023/TASK-027 can execute this route without purchasing voices:

1. Download the publisher's archive into `assets/voice/datasets/`, record its SHA-256 and extract with a traversal-safe reader. Preserve the original 22,050 Hz mono files and `metadata.csv`.
2. Sort clip IDs; choose 20 minutes of clean narration across chapters, hold out two minutes with disjoint clip IDs, and save exact IDs/transcripts/hashes in a split manifest. Listen for clipping, incidental sound and incomplete words before accepting the training subset.
3. Provision training separately from this inference environment. The inspected pure RVC source revision is `81eed5e8f68b6bed1789f682fe78cdd324495afc` in [RVC-Project/Retrieval-based-Voice-Conversion-WebUI](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI/tree/81eed5e8f68b6bed1789f682fe78cdd324495afc). Pin its own environment and audit the selected pretrained generator/discriminator and pitch weights before training. Target RVC v2, 40 kHz; use an F0-enabled control for comparison if its measured benefit justifies the extra estimator. This no-F0 smoke adapter will need that supported F0 path before converting the trained control.
4. On a machine with actual training access, start with batch size 4, seed 1234 and checkpoints every 25 epochs. Compare 100/200/300-epoch checkpoints on held-out English speech, stopping when quality plateaus or degrades. Record actual parameters, training logs, dataset/license manifest and exported target hash. The user currently describes probable vLLM API access over a VPN; that alone does not provide RVC deployment or training access. Obtain a supported training allocation/service if the remote training route is needed; none is configured now.
5. Evaluate the natural English control beside the three character candidates. A narration control establishes intelligibility, not a cheerful performance. User listening and live conversation determine acceptance.

Applio remains a separate optional training workbench. Its inspected revision `7b9f3fa0dde9f90946a5302b4ce4ab3410f12bb8` labels repository code/weights MIT but also references separate official-configuration terms; review those exact terms during training provisioning. It is not installed or required by the accepted local conversion configuration. [Inspected Applio README](https://github.com/IAHispano/Applio/blob/7b9f3fa0dde9f90946a5302b4ce4ab3410f12bb8/README.md).
