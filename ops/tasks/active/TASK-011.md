# TASK-011: Implement torso and arm motion for seated performance

- Status: In progress
- Priority: P0
- Goal: G2
- Depends on: TASK-008, TASK-009, TASK-010
- Estimate: L (2-3 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Make the avatar follow upper-body gestures, not only face movement.

## Work

- Solve torso/shoulder orientation and arm segments from pose landmarks with avatar proportions and rest transforms.
- Implement elbow bend-plane continuity, joint limits and confidence gating; use constrained IK where needed.
- Keep seated root stable and define channel ownership so body solving does not overwrite face controls.
- Add comfortable arm idle and per-limb tracking-loss fades.
- Test lean, arm raises, elbows bent, crossed/hidden arms and one arm out of frame using deterministic fixtures and a live check.

## Acceptance criteria

- [ ] Both arm raises and torso lean follow the correct side with stable elbows.
- [ ] Hidden limbs relax smoothly without stretching, snapping or moving the whole avatar off-screen.
- [x] Recorded synthetic failures do not produce NaN transforms or unbounded rotations.

## Implementation notes

Live acceptance with Ene is repeated in TASK-021 after avatar export.

2026-09-12 checkpoint: parent-first world solving and stable limb planes are integrated. [Audit/integration report](../../reports/retarget-audit.md), hierarchy/limb unit tests and [actual-Ene fixtures](../../reports/retarget-fixture-smoke.json) verify finite bounded transforms, unchanged segment lengths, sample expiry and recovery under synthetic inputs. Physical raises, lean and hidden-limb behavior remain unchecked.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

## Hidden-limb relaxation — 2026-09-13

Three system-level tests in [retarget-integration.test.ts](../../../tests/retarget-integration.test.ts) exercise the whole solver, not an isolated limb function, over a visible → hidden → visible sequence.

"Smooth, not snapping" is asserted as a **ratio rather than an absolute angle**: exponential smoothing always moves a bounded fraction of the remaining error, whereas a snap covers most of the travel in one frame. The worst single-frame step is therefore compared against the whole journey. An earlier absolute threshold of 0.2 rad failed at 0.239 rad, which on inspection was simply the configured smoothing factor's first step — correct behaviour that a badly-chosen threshold had labelled a defect.

With all six arm landmarks dropped to zero visibility:

- No single frame covers more than 35% of the total travel, and the last step is under a tenth of the first, so the motion decays rather than jumping.
- **Bone lengths are unchanged to ten decimal places** across `leftLowerArm`, `leftHand`, `rightLowerArm`, `rightHand` and both legs — no stretching.
- The avatar root does not move at all (under 1e-6), so nothing drifts off-screen.
- All resulting quaternions stay finite.

Reacquisition is covered by the same ratio test in reverse: restoring the landmarks produces no single-frame snap either.

**Boundary:** synthetic landmark frames through the real solver. This closes the numeric half of the criterion — no stretching, snapping or avatar displacement — but a person watching their own hidden arm relax is a separate judgement and the criterion stays open pending the operator check.

## Anatomical side and mirror independence — 2026-09-13

Three tests in [retarget-integration.test.ts](../../../tests/retarget-integration.test.ts) pin the side and mirror behaviour, because a mirror applied twice is a classic side-swap defect and a fixture can catch it where a person cannot easily tell.

- **The avatar raises the arm on the same anatomical side as the performer.** Raising MediaPipe's left arm landmarks lifts the avatar's left hand by more than 0.05 units and by more than the opposite hand moves; the same holds for the right.
- **Retargeting is byte-for-byte identical with mirroring on and off.** Across head, neck, spine and all six arm bones, the two solvers agree to within 1e-9 rad. Mirroring is a `scaleX(-1)` presentation transform on the canvas element and never reaches the solver, which [retarget-math.ts](../../../src/retarget-math.ts) states explicitly. A vacuity guard confirms the arm actually moved, so the agreement is not two motionless rigs matching.
- **The head turns the same way regardless of the mirror setting**, reaching past 0.35 rad in both and agreeing to within 1e-9.

A convention error in the first draft is worth recording: the raised arm initially moved **down**. Stored pose `y` follows the frame helper's convention where a smaller value is higher, and the test had used image-space intuition. The solver was correct; the fixture was upside down.

**Boundary:** synthetic landmark frames. Whether head and limbs *look* correct to a person watching the preview, mirrored or not, is the criterion's own wording and needs the operator, so no box is ticked.
