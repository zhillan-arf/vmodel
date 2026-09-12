# TASK-017: Set up OBS capture, streaming scenes and virtual camera

- Status: Todo
- Priority: P0
- Goal: G2
- Depends on: TASK-002, TASK-016
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Integrate the app into a real streaming and webcam-output workflow.

## Work

- Install/configure OBS if necessary; create importable scene/profile guidance for clean Window Capture.
- Provide opaque-background baseline and optional chroma key; test resize, source selection and hidden/minimized-window behavior.
- Configure microphone audio separately and document monitoring/echo prevention and any measured sync offset.
- Select measured hardware/software encoder settings; keep credentials out of exported profiles.
- Start OBS Virtual Camera and verify animated output in a compatible local consumer. Document selecting microphone separately.

## Acceptance criteria

- [ ] OBS captures the avatar without controls or raw-camera leakage.
- [ ] A consumer receives moving avatar frames from OBS Virtual Camera; audio routing is explicitly verified separately.
- [ ] Scene/profile instructions work without streaming to a public account or including stream keys.

## Implementation notes

Native webcam drivers and platform-specific broadcast authentication are outside this task.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

