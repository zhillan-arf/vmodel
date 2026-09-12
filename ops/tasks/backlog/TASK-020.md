# TASK-020: Validate performance, recovery and local-only operation

- Status: Todo
- Priority: P0
- Goal: G2
- Depends on: TASK-007, TASK-012, TASK-013, TASK-018, TASK-019
- Estimate: L (2-3 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Verify the complete app with Ene and OBS on the actual target hardware.

## Work

- Run a 30-minute combined session and record render/inference percentiles, OBS dropped frames, memory trend, resolution and thermal degradation.
- Measure seated and standing+hands presets separately; fix queues, resource leaks and expensive rendering based on evidence. Profile the selected cyber-legs model's 112,949 triangles and 49 material slots before considering material merging or texture resizing; preserve facial shape keys and appearance during optimization.
- Exercise denied camera, busy camera, disconnect, model reload, tracking loss/reentry, output restart and corrupted profile.
- Inspect network behavior after provisioning and confirm no frame uploads or required remote requests.
- Run meaningful math/worker/browser regressions; estimate end-to-end latency with an external recording if available and label any unmeasured metric honestly.

## Acceptance criteria

- [ ] Baseline 720p/30 target and frame-time gates from the spec pass, or this task stays open with measured defects.
- [ ] No crashes or sustained post-warmup memory growth occur during the soak test.
- [ ] Offline operation and recovery checks pass; standing-mode limitations and tested presets are documented in ops/reports/performance.md.

## Implementation notes

Do not substitute inference time for complete motion-to-display latency, or claim fixture-only tests prove live behavior.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.
