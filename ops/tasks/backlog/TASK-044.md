# TASK-044: Commit model selection and report output state

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](TASK-P04.md)
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

- [ ] A studio preparation failure preserves the prior avatar, label, settings, and ID.
- [ ] Persistence failure shows session-only selection without undoing a successful load.
- [ ] Old peer messages and late loads cannot replace a newer revision.
- [ ] Failed output decode keeps the old output model and exposes the mismatch.
- [ ] A late or reloaded peer receives the latest committed bytes.
- [ ] Clean output contains no diagnostic or error interface.

## Verification

- Test rapid alternating selections with output open.
- Inject storage and peer decode failures and the 30-second deadline.
- Run existing output handshake, layout, and heartbeat checks.

## Evidence and completion

Write the result to `ops/reports/model-selection.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Planning is complete. Implementation has not started. Start after the listed dependencies pass.

