# TASK-009: Implement camera capture and bounded tracking workers

- Status: In progress
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
- [x] Synthetic/recorded input confirms timestamp ordering, dropped stale frames and bounded queue behavior.
- [x] Normal operation works without CDN access once runtime assets are provisioned.

## Implementation notes

Physical camera checks remain pending until performed; fixture tests alone cannot certify device behavior.

2026-09-12 checkpoint: [Camera reliability report](../../reports/camera-reliability.md) links the 70-second built-app test and lifecycle/fallback tests. All three tracking tasks initialize locally, synthetic Stop/restart releases tracks, and external probes are blocked in page and worker. Added resolution selection and TrackingFrame v1 per-task sampling diagnostics. Physical camera acceptance remains open; this task is still active.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

## Denied, missing and busy camera states — 2026-09-13

[camera_denial_smoke.mjs](../../../../../scripts/camera_denial_smoke.mjs) injects the exact DOMException the platform raises for each failure, then lets the retry through, so the application's handling and recovery path is exercised for states a physical webcam cannot produce on demand. [Evidence](../../reports/camera-denial-smoke.json).

All four states report a clear message, leave no page errors, and **recover on a plain Start retry with no reload**:

| Injected state | Message shown | Recovered |
| --- | --- | --- |
| `NotAllowedError` | Camera permission denied. Allow camera access for this local app, then retry. | yes |
| `NotFoundError` | No camera found. Connect a webcam, then press Start camera. | yes |
| `NotReadableError` | Camera is busy. Close the other camera app, then retry. | yes |
| `OverconstrainedError` | This camera cannot provide the selected resolution. Choose another resolution, then retry. | yes |

**Defect found and fixed.** A missing device previously fell through to the raw exception text, showing `Camera unavailable: NotFoundError: Injected NotFoundError` — accurate but useless to a beginner, and the most likely first-run failure for someone without a webcam connected. [src/camera.ts](../../../../../src/camera.ts) now names the missing-device and unsatisfiable-resolution cases explicitly, in the same style as the two that were already handled.

**Boundary:** these are injected exceptions, not a physical device. A real denial also involves the browser permission prompt and the Windows camera privacy setting, neither of which is touched here, and recovery is verified against the fake device rather than a real camera re-acquiring. This strengthens the recoverability criterion but does not by itself certify the physical device stack; the criterion stays open pending the operator check.
