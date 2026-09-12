# TASK-009: Implement camera capture and bounded tracking workers

- Status: Todo
- Priority: P0
- Goal: G2
- Depends on: TASK-003
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Turn the feasibility spike into reliable local camera and inference infrastructure.

## Work

- Add device selection, start/stop, resolution choice, permission errors, busy-device guidance and disconnect/reconnect.
- Own one stream and route frames to locally provisioned face/pose/hand tasks using timestamped worker messages.
- Allow one inference job in flight, drop stale work, close frame resources and provide tested delegate fallback.
- Expose per-task cadence and confidence data through a versioned TrackingFrame contract.
- Keep raw preview optional in the control view; no uploads, telemetry, microphone access or default raw-video recording.

## Acceptance criteria

- [ ] Start/stop/restart releases camera tracks and workers; denied or missing camera states are recoverable.
- [ ] Synthetic/recorded input confirms timestamp ordering, dropped stale frames and bounded queue behavior.
- [ ] Normal operation works without CDN access once runtime assets are provisioned.

## Implementation notes

Physical camera checks remain pending until performed; fixture tests alone cannot certify device behavior.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

