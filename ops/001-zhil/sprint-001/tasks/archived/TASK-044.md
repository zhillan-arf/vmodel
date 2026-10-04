# TASK-044: Commit model selection and report output state

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](../active/TASK-P04.md)
- Depends on: TASK-040, TASK-041
- Estimate: 2-3 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: L08; D10, D11

## Outcome

Select a saved model safely and report whether each output window has the same selection.

## Scope and files

Planned files: `src/model-selection.ts`, `src/main.ts`, `src/output-link.ts`, `src/profiles.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Resolve and verify bytes before preparing the replacement.
- Commit viewer, retargeter, settings, and label as one synchronous state change.
- Persist the selected ID after successful commit.
- Add session and revision fields to output controls and acknowledgments.
- Keep the prior output model during peer preparation.
- Show pending, failed, and disconnected output states in the studio.

## Acceptance criteria

- [x] A studio preparation failure preserves the prior avatar, label, settings, and ID.
- [x] Persistence failure shows session-only selection without undoing a successful load.
- [x] Old peer messages and late loads cannot replace a newer revision.
- [x] Failed output decode keeps the old output model and exposes the mismatch.
- [x] A late or reloaded peer receives the latest committed bytes.
- [x] Clean output contains no diagnostic or error interface.

## Verification

- Test rapid alternating selections with output open.
- Inject storage and peer decode failures and the 30-second deadline.
- Run existing output handshake, layout, and heartbeat checks.

## Evidence and completion

Write the result to `ops/001-zhil/sprint-001/reports/model-selection.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/001-zhil/sprint-001/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Selection, failure, revision, deadline, and peer recovery checks pass. The browser report records synthetic fixture limits.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/model-selection.md).

This software task is complete. P04 retains actual-model and target-browser release checks.
