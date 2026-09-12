# TASK-019: Package local launch, offline assets and beginner documentation

- Status: Todo
- Priority: P0
- Goal: G2
- Depends on: TASK-015, TASK-016, TASK-017
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Make everyday use a launcher action instead of a terminal setup exercise.

## Work

- Provide idempotent setup support and Start VModel.cmd that starts a hidden loopback-only server and opens the supported browser.
- Build production assets and provision pinned ML/WASM files with checksum checks; handle missing dependencies and occupied ports clearly.
- Serve only designated build/runtime files; load avatar through explicit selection rather than exposing the workspace.
- Provide stop/cleanup behavior, settings reset, version information and third-party notices.
- Write docs/quickstart.md and troubleshooting for camera denial, black OBS capture, low FPS, calibration, missing model and offline startup.

## Acceptance criteria

- [ ] After documented setup, launch works without entering development commands or internet access.
- [ ] Closing/stopping releases resources; restart and occupied-port handling are clean.
- [ ] No source models, recordings, credentials or private data are unintentionally bundled.

## Implementation notes

Do not add Electron/Tauri packaging unless the browser launcher proves insufficient in measured acceptance.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

