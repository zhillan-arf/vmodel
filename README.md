# VModel

A local VTuber app with selectable Ene **Cyber legs** and Rei models, webcam tracking, OBS capture and separate voice and website-resource workstreams.

## What to do next

**[Remaining checks](docs/remaining-checks.md)** lists the checks that need a person. The original delivery still needs those checks. New library and tracking tasks can start without physical-device access.

## Everyday launchers

Docker can serve the studio on this computer or a local network server.
See [Docker setup](docs/docker.md) for browser camera access and HTTPS setup.

All launchers live in the **deploy** folder. Double-click these; none of them need a terminal.

In the studio, choose **Ene** or **Rei** with the model selector. Camera tracking, calibration, expression controls and the output view work with either model.

| Launcher | What it opens |
| --- | --- |
| **[Start VModel.cmd](deploy/Start%20VModel.cmd)** | The studio, for camera tracking and the output view |
| **[Stop VModel.cmd](deploy/Stop%20VModel.cmd)** | Stops the studio server |
| **[Start OBS.cmd](deploy/Start%20OBS.cmd)** | OBS with the prepared scenes |
| **[Attach OBS Landscape.cmd](deploy/Attach%20OBS%20Landscape.cmd)** / **[Portrait](deploy/Attach%20OBS%20Portrait.cmd)** | Points an OBS scene at the output window |
| **[Install OBS Camera.cmd](deploy/Install%20OBS%20Camera.cmd)** | Registers OBS Virtual Camera (needs an administrator prompt) |
| **[Start Voice Auditions.cmd](deploy/Start%20Voice%20Auditions.cmd)** | The listening room, to compare candidate voices |
| **[Start Voice Studio.cmd](deploy/Start%20Voice%20Studio.cmd)** / **[Stop](deploy/Stop%20Voice%20Studio.cmd)** | The live voice controls |
| **[Start Web Showcase.cmd](deploy/Start%20Web%20Showcase.cmd)** | The website showcase with all five animations |
| **[Setup VModel.cmd](deploy/Setup%20VModel.cmd)** | Initial provisioning for the studio; already run on this laptop |
| **[Setup Voice.cmd](deploy/Setup%20Voice.cmd)** | Provisioning for the voice workstream; already run on this laptop |

Guides: **[quickstart](docs/quickstart.md)** for calibration, **[OBS setup](docs/obs-setup.md)** for capture, **[recording](docs/recording.md)** for clips, **[voice quickstart](docs/voice-quickstart.md)**, **[website showcase](docs/web-showcase.md)**.

**Keep the output window open while streaming.** Covering it with other windows is fine; minimizing it stops the avatar and blanks the capture, because a hidden window produces no frames. The studio says so if it happens.

## Assets and terms

The [prepared Ene avatar](assets/avatars/ene.vrm), [editable scene](assets/work/ene/vrm-work.blend) and [conversion recipe](docs/avatar-conversion.md) are available locally. [Rei](assets/avatars/rei.vrm) is extracted unchanged from the supplied native VRM archive; its [original readme](public/avatars/rei-notices/readme.txt), [change log](public/avatars/rei-notices/log.txt) and [provenance](public/avatars/rei-notices/provenance.json) are retained. Original and generated character assets remain private and are excluded from code distribution; retain each creator's credits and supplied model terms. See [third-party notices](docs/third-party-notices.md) for software and tracking-model licenses.

## Status

Design proposals: [VRM library and registration](ops/001-zhil/sprint-001/research/vrm-library-and-registration.md) and [tracking diagnosis and model-independent visualization](ops/001-zhil/sprint-001/research/tracking-diagnostics-and-improvement.md). The [action plan](ops/001-zhil/sprint-001/specs/studio-evolution-plan.md), [design decisions](ops/001-zhil/sprint-001/specs/studio-design-decisions.md), and [product specification](ops/001-zhil/sprint-001/specs/studio-product-spec.md) define the proposed implementation. The current app supports bundled selection and temporary VRM loading.

Implementation and human acceptance remain separate. The task register records the current status. Physical camera and gesture acceptance, a suitable live voice backend, Virtual Camera registration and final recordings remain open, and the local voice converter does not yet meet its timing gates under ordinary desktop load.

**[TASK-P01](ops/001-zhil/sprint-001/tasks/active/TASK-P01.md)** owns the current checkpoint and links all work; the [task register](ops/001-zhil/sprint-001/tasks/backlog/README.md) covers active and archived tasks. Component tests and short fixture recordings are documented there and do not imply live acceptance.

`npm run verify` runs the automated checks that need no device or person, including switching between both models, and prints what it deliberately does not cover.

## Studio library and tracking

The studio includes Library and Tracking views.
Use the [model library guide](docs/model-library.md) for import, selection, backup, and recovery.
Use the [Tracking Inspector guide](docs/tracking-inspector.md) for observations, traces, and replay.
The [implementation evidence](ops/001-zhil/sprint-001/reports/studio-implementation.md) records automated checks and open acceptance work.

## Combined camera and model view

Open **Tracking**, then select **Camera and model** from **Layer**.
Select **Ene** or **Rei**, then select **Start camera**.
The camera image shows face triangles, body lines, and both detected hands.
The model appears with its actual bones.
Use **Model view** for a close view of the face or either hand.

Both models contain the bones for shoulders, eyes, hands, and all ten fingers.
The solver now includes shoulder and gaze controls.
See the [audit](ops/001-zhil/sprint-001/reports/combined-tracking-audit.md) and [instructions](docs/tracking-inspector.md).
Physical camera and gesture acceptance remain open.
