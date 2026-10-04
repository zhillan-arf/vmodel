# TASK-048: Deliver the library guide and G5 evidence

- Status: In progress
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](TASK-P04.md)
- Depends on: TASK-047
- Estimate: 1 day
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: L14; D35

## Outcome

Hand a reproducible library workflow and its evidence to the overall controller.

## Scope and files

Planned files: `docs/model-library.md`, `README.md`, `ops/reports/library-handoff.md`, `ops/tasks/active/TASK-P01.md`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Write import, terms, selection, backup, restore, and removal procedures.
- Explain origin-specific storage and the need for a separate copy.
- List supported formats, resource limits, and recovery actions.
- Link measured acceptance and known limitations.
- Update P04, P01, TASK-021, and the task register.

## Acceptance criteria

- [ ] A person can follow the guide without source edits.
- [x] The guide identifies backup and restore paths and calibration exclusions.
- [x] G5 evidence maps every L requirement and applicable U requirement.
- [ ] No library release-blocking defect remains open.
- [ ] P01 and TASK-021 receive the handoff before P04 closes.

## Verification

- Check guide links and launcher addresses.
- Perform the documented import-to-restore procedure.
- Run the task audit after status updates.

## Evidence and completion

Write the result to `ops/reports/library-handoff.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. The guide links passing Chrome and Edge software checks and target-laptop memory results.
TASK-061 owns human guide and appearance review. Final G5 acceptance remains open.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/library-handoff.md).

Acceptance remains open until all required checks have direct evidence.
