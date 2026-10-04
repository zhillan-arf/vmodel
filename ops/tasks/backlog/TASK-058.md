# TASK-058: Evaluate measured motion corrections

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](../active/TASK-P05.md)
- Depends on: TASK-056, TASK-057
- Estimate: 3-4 days when indicated; 0.5 day otherwise
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T15, T16; D28

## Outcome

Correct a measured association, confidence, filter, or mapping fault without concealing observation failures.

## Scope and files

Planned files: `src/retarget.ts`, `src/retarget-math.ts`, `src/limb-solver.ts`, `ops/reports/tracking-motion-corrections.md`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Use the accepted scheduler from TASK-057 as the fixed comparison baseline.
- Select only the fault classes established by TASK-056.
- Test association history, response speed, or confidence hysteresis one factor at a time.
- Preserve an ambiguous-hand outcome when identity remains uncertain.
- Record formulas and parameters before any adaptive filter comparison.
- Retain only candidates that pass T16 and remove failed experimental changes.
- If rig mapping causes the fault, repair the first incorrect transform and verify known anatomical rotations.

## Acceptance criteria

- [ ] Every changed parameter maps to a recorded cause and test.
- [ ] An adopted correction passes improvement and regression gates.
- [ ] Crossed hands and reappearance create no new wrong-side events.
- [ ] Head range, finger motion, and seated/standing behavior retain correct semantics.
- [ ] No stacked filter or global confidence reduction enters without isolated evidence.
- [ ] An inapplicable experiment closes with evidence and unchanged baseline behavior.
- [ ] Any mapping correction passes known-rotation fixtures on both avatars without an avatar-name condition.

## Verification

- Compare stationary jitter, deliberate motion lag, loss time, and recovery.
- Replay difficult and occluded traces on canonical, Ene, and Rei views.
- Run three live repetitions plus all existing solver regressions.

## Evidence and completion

Write the result to `ops/reports/tracking-motion-corrections.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Physical diagnosis is unavailable in this environment.
TASK-055 still needs measured overhead and human review. No scheduler or motion correction is eligible yet.
The baseline schedule and thresholds remain unchanged. No experiment verdict has been invented.

Required action: complete inspector acceptance, then perform the [physical protocol](../../../docs/tracking-check.md) on the target laptop.
The operator supplies the gestures. Codex records the failed stage and evaluates eligible corrections.
