# Ene Studio

A local VTuber kit built around Ene **Cyber legs**, with a reusable VRM avatar, webcam tracking, OBS capture and separate voice and website-resource workstreams.

Double-click **[Start VModel.cmd](Start%20VModel.cmd)** to open the installed studio. Follow the **[quickstart](docs/quickstart.md)** for camera calibration and **[OBS setup](docs/obs-setup.md)** for capture. **[Stop VModel.cmd](Stop%20VModel.cmd)** stops the studio server. Initial provisioning is handled by **[Setup VModel.cmd](Setup%20VModel.cmd)**; the authoring tools and model conversion have already been prepared on this laptop.

The [validated avatar](assets/avatars/ene.vrm), [editable scene](assets/work/ene/vrm-work.blend) and [conversion recipe](docs/avatar-conversion.md) are available locally. Original and generated character assets remain private and are excluded from code distribution; retain AuroraYok's credits and the supplied model terms. See [third-party notices](docs/third-party-notices.md) for software and tracking-model licenses.

The separate [website showcase](docs/web-showcase.md) has welcome and desk layouts with all five final animations. Its production preview is available locally at `http://127.0.0.1:4180/`; use the guide for the server and reusable component. The [G4 acceptance report](ops/reports/web-resource-acceptance.md) records passing Windows loading, playback and lifecycle checks; actual Safari/iOS/Android remains untested.

Implementation is still in progress. Physical camera/gesture acceptance, a suitable live voice backend, Virtual Camera registration and final recordings remain open. **[TASK-P01](ops/tasks/active/TASK-P01.md)** owns the current checkpoint and links all work; the [task register](ops/tasks/backlog/README.md) includes active and archived tasks. Component tests and short fixture recordings are documented there and do not imply final live acceptance.
