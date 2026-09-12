# TASK-010: Implement calibrated head and face retargeting

- Status: In progress
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

## Noise damping, face loss and recovery — 2026-09-13

Two tests in [retarget-integration.test.ts](../../../tests/retarget-integration.test.ts) measure the numeric halves of the third criterion through the full solver.

- **Noise is damped while the signal is still followed.** Six hundred frames of deterministic pseudo-noise of +/-0.15 rad around a 0.3 rad target: after warm-up the output spread is **under half** the input spread, and the settled mean stays between 0.2 and 0.4 rad, so damping does not come at the cost of tracking the real angle.
- **Loss and recovery produce no abrupt extreme rotation.** With face and pose samples stale for 240 frames the head relaxes to within 0.05 rad of neutral, with no single-frame step above 0.15 rad. Reacquiring at the opposite extreme moves it more than 0.3 rad, with the worst single frame under 35% of the total travel, ending past -0.3 rad.

### A measurement mistake worth recording

The loss test first reported zero travel on reacquisition. The head's **local** quaternion stays near identity because the yaw is carried through the torso chain, so measuring the head bone locally reports no movement however far the avatar actually turns. Measuring in world space gives the real figure. The solver was correct; the measurement was not.

**Boundary:** synthetic frames through the real solver. Whether response feels quick enough — the criterion's "without a visibly long response delay" — is a human judgement this cannot supply, and the first two criteria need a person turning their head and blinking in front of a camera. No box is ticked.
