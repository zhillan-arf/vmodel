# Ene Studio

A local VTuber kit built around Ene **Cyber legs**, with a reusable VRM avatar, webcam tracking, OBS capture and separate voice and website-resource workstreams.

## What to do next

**[Remaining checks](docs/remaining-checks.md)** lists the four things that still need you, in the order that unblocks the most work. The first one takes about ten minutes and clears seven tasks. Everything that can be finished without you is finished.

## Everyday launchers

Double-click these; none of them need a terminal.

| Launcher | What it opens |
| --- | --- |
| **[Start VModel.cmd](Start%20VModel.cmd)** | The studio, for camera tracking and the output view |
| **[Stop VModel.cmd](Stop%20VModel.cmd)** | Stops the studio server |
| **[Start OBS.cmd](Start%20OBS.cmd)** | OBS with the prepared scenes |
| **[Attach OBS Landscape.cmd](Attach%20OBS%20Landscape.cmd)** / **[Portrait](Attach%20OBS%20Portrait.cmd)** | Points an OBS scene at the output window |
| **[Install OBS Camera.cmd](Install%20OBS%20Camera.cmd)** | Registers OBS Virtual Camera (needs an administrator prompt) |
| **[Start Voice Auditions.cmd](Start%20Voice%20Auditions.cmd)** | The listening room, to compare candidate voices |
| **[Start Voice Studio.cmd](Start%20Voice%20Studio.cmd)** / **[Stop](Stop%20Voice%20Studio.cmd)** | The live voice controls |
| **[Start Web Showcase.cmd](Start%20Web%20Showcase.cmd)** | The website showcase with all five animations |
| **[Setup VModel.cmd](Setup%20VModel.cmd)** | Initial provisioning for the studio; already run on this laptop |
| **[Setup Voice.cmd](Setup%20Voice.cmd)** | Provisioning for the voice workstream; already run on this laptop |

Guides: **[quickstart](docs/quickstart.md)** for calibration, **[OBS setup](docs/obs-setup.md)** for capture, **[recording](docs/recording.md)** for clips, **[voice quickstart](docs/voice-quickstart.md)**, **[website showcase](docs/web-showcase.md)**.

**Keep the output window open while streaming.** Covering it with other windows is fine; minimizing it stops the avatar and blanks the capture, because a hidden window produces no frames. The studio says so if it happens.

## Assets and terms

The [validated avatar](assets/avatars/ene.vrm), [editable scene](assets/work/ene/vrm-work.blend) and [conversion recipe](docs/avatar-conversion.md) are available locally. Original and generated character assets remain private and are excluded from code distribution; retain AuroraYok's credits and the supplied model terms. See [third-party notices](docs/third-party-notices.md) for software and tracking-model licenses.

## Status

Implementation is in progress: 22 of 38 tasks are complete. Physical camera and gesture acceptance, a suitable live voice backend, Virtual Camera registration and final recordings remain open, and the local voice converter does not yet meet its timing gates under ordinary desktop load.

**[TASK-P01](ops/tasks/active/TASK-P01.md)** owns the current checkpoint and links all work; the [task register](ops/tasks/backlog/README.md) covers active and archived tasks. Component tests and short fixture recordings are documented there and do not imply live acceptance.

`npm run verify` runs every check that needs no device or person — twelve of them, about ninety seconds — and prints what it deliberately does not cover.
