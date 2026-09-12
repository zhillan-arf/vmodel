# TASK-016: Create clean landscape and portrait output views

- Status: Todo
- Priority: P0
- Goal: G2
- Depends on: TASK-008, TASK-015
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Provide a stable frame for OBS with the correct composition and no control UI.

## Work

- Add a clean output window receiving timestamped avatar state from the control view without opening another camera.
- Provide a single-window clean mode for lower load; benchmark the two-view overhead.
- Add 16:9 and 9:16 presets, framing/zoom, opaque background and selectable chroma-key color.
- Handle output reconnect/close, resize and lost state; show useful operator diagnostics outside the captured frame.
- Verify character-safe key colors and explain that transparent canvas is not guaranteed Windows capture alpha.

## Acceptance criteria

- [ ] Clean 1280x720 and 720x1280 compositions contain animated avatar only, with no raw camera/control UI.
- [ ] Opening output creates no duplicate camera stream; close/reopen resumes state correctly.
- [ ] The lower-cost single-view path is usable when dual rendering exceeds the budget.

## Implementation notes

OBS Browser Source alpha transport is optional; Window Capture is the release baseline.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

