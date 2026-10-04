# TASK-050: Expose solver rejection reasons without behavior changes

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](../active/TASK-P05.md)
- Depends on: TASK-049
- Estimate: 2-3 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T03; D23, D28

## Outcome

Explain each accepted, rejected, or limited channel at its actual decision branch.

## Scope and files

Planned files: `src/retarget.ts`, `src/retarget-math.ts`, `src/limb-solver.ts`, `src/tracking-diagnostics.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Add typed outcomes to silent early returns and clamp paths.
- Name stage, anatomical channel, joint, sample, value, and threshold.
- Record the first failed branch and distinguish clamping from rejection.
- Record raw, calibrated, limited, and applied head orientation.
- Keep existing thresholds, fallbacks, and parent-first solver order.

## Acceptance criteria

- [x] Every rejection path listed in T03 has a named fixture.
- [x] Reason values match the branch that rejected the sample.
- [x] Instrumentation preserves quaternion results within 0.0001 radians.
- [x] Confidence boundaries above 0.55 and ages from -50 through 499 ms remain unchanged.
- [x] Unavailable confidence differs from an applied runtime default.
- [x] No new tuning or hand-side swap enters this task.

## Verification

- Run existing limb, hand association, and retargeter tests.
- Compare accepted-channel sets before and after instrumentation.
- Inject stale, degenerate, folded, ambiguous, and missing-bone cases.

## Evidence and completion

Write the result to `ops/reports/solver-diagnostics.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Named reason fixtures and 720 updates against the committed solver pass. The maximum quaternion difference is 0.0000000516191365590357 radians.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/solver-diagnostics.md).

Software acceptance is complete. Actual-model and physical acceptance remain with TASK-054 through TASK-056.
