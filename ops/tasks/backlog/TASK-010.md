# TASK-010: Implement calibrated head and face retargeting

- Status: Todo
- Priority: P0
- Goal: G2
- Depends on: TASK-008, TASK-009
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Drive head orientation, blinks and mouth movement with stable, model-aware controls.

## Work

- Define canonical coordinates and calibrated neutral head orientation; convert to avatar parent-local/rest space.
- Map face coefficients into profile expressions with clamping, smoothing and user-adjustable range.
- Resolve head/neck distribution and blink, mouth and manual-expression priority.
- Fade lost face input to idle and blend on reacquisition; clear stale calibration on incompatible device settings.
- Add deterministic fixtures for axis direction, left/right blink, neutral pose, range limits and loss/recovery.

## Acceptance criteria

- [ ] Head left/right/up/down follows correctly with preview mirroring enabled or disabled.
- [ ] Independent blinks and mouth opening animate on the sample and, during integration, Ene.
- [ ] Noise is damped without a visibly long response delay; loss/recovery creates no abrupt extreme rotation.

## Implementation notes

Uses face output as measurements, not direct arbitrary Euler assignments to the source MMD bones.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

