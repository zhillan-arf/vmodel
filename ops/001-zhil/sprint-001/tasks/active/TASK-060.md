# TASK-060: Verify the combined studio and deliver G6

- Status: In progress
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](TASK-P05.md)
- Depends on: TASK-048, TASK-059
- Estimate: 2 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T17; L08; U07, U08; D35, D36

## Outcome

Deliver one coherent studio with verified library, diagnostics, corrections, and recovery.

## Scope and files

Planned files: `docs/tracking-inspector.md`, `ops/001-zhil/sprint-001/reports/studio-evolution-acceptance.md`, `README.md`, `ops/001-zhil/sprint-001/tasks/active/TASK-021.md`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Test model import and selection while tracking and output remain active.
- Test pause, trace replay, output reload, camera loss, and storage failure together.
- Repeat required viewport, focus, reduced-motion, and model appearance checks.
- Write the inspector guide and an evidence map for G5 and G6.
- Record performance results and remaining sensing limitations.
- Hand the complete scope to P01 and TASK-021 before P05 closes.

## Acceptance criteria

- [x] Combined interactions preserve clean output and committed selection.
- [ ] One elbow demonstration and canonical/Ene/Rei replay have linked evidence.
- [ ] Every L, T, and U requirement has a passing result or an explicit allowed limitation.
- [ ] No required physical or visual check remains unperformed.
- [x] The guide distinguishes observations, estimates, accepted motion, and avatar appearance.
- [x] P01, P05, TASK-021, and the task register agree on status and scope.

## Verification

- Run npm test, npm run build, and npm run verify.
- Run the combined failure matrix on installed Chrome and Edge.
- Check all guide links, evidence paths, task counts, and dependency cycles.

## Evidence and completion

Write the result to `ops/001-zhil/sprint-001/reports/studio-evolution-acceptance.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/001-zhil/sprint-001/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Installed Chrome and Edge pass the combined interaction test with simulated inputs.
The G5 handoff and physical G6 acceptance remain open.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/studio-evolution-acceptance.md).

Acceptance remains open until all required checks have direct evidence.
