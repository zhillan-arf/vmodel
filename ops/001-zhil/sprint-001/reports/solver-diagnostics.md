# TASK-050 implementation evidence

Date: 2026-10-04. Status: Done for the defined software scope.

Diagnostics report reasons at the solver decision branch. Motion thresholds, task schedules, and hand labels remain unchanged.

Changed files: `src/motion-solver.ts`, `src/retarget-math.ts`, `src/limb-solver.ts`, `src/finger-solver.ts`, and `src/tracking-inspector.ts`.
Tests: `tests/solver-diagnostics.test.ts`, `tests/tracking-diagnostics.test.ts`, and `scripts/solver_baseline_check.mjs`.

## Decision checks

Named fixtures exercise every reason in T03.

| Branch | Evidence |
| --- | --- |
| Missing or invalid observations | Missing landmarks, nonfinite coordinates, and invalid palm points have distinct reasons. |
| Confidence | The strict 0.55 boundary remains unchanged. Missing confidence has a separate default-of-1 outcome. |
| First failure | Confidence and grounding fixtures stop at the first failed check. Unused defaults are absent. |
| Freshness | Ages -51, -50, 499, and 500 ms preserve the existing boundaries. Outcomes include age and threshold. |
| Mode and settings | Root, limb, and hand fixtures report disabled channels and missing samples. |
| Hand association | Score, distance, ambiguity, and palm limits report actual values and task samples. |
| Rig and geometry | Missing bones, invalid rest data, invalid parameters, folded limbs, and plane changes have named fixtures. |
| Limits | Root position, grounding, facial coefficients, and head limits report applied limits. |
| Head orientation | Raw, calibrated, limited, and applied orientations remain available. Missing face data clears old diagnostics. |

## Baseline comparison

Command: `node scripts/solver_baseline_check.mjs`.
Baseline commit: `da48542e991aa202a1b9eaafc1a4f1cbb22ef7b9`.
The script loads the original solver from that commit into a temporary test directory.
It compares 720 updates across canonical, missing-head, missing-arm, and opposite-orientation rigs.
The cases include settings changes, calibration, missing samples, stale samples, and manual expressions.

- Maximum quaternion difference: 0.0000000516191365590357 radians; required limit: 0.0001 radians.
- Maximum position difference: 0.
- Accepted goal sets: equal.
- Expression values: equal.

The [machine-readable result](solver-baseline.json) records the comparison.
The source fixture is `tests/fixtures/tracking-motion.ts`. The script pins the original source commit.
A separate 90-frame test compares diagnostics enabled and disabled.

## Verification and limits

`npm test -- --reporter=dot`: 275 tests passed across 29 files.
`npm run build`: typecheck and production build passed. The existing large-chunk warning remains.
The verification entry point includes the baseline comparison.

These checks use synthetic motion and rig variants.
Actual-model comparison, camera use, and human review remain with TASK-054 through TASK-056.
These checks do not close P05 release acceptance.
