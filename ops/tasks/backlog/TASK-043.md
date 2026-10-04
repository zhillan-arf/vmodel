# TASK-043: Build the import preview and save flow

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](TASK-P04.md)
- Depends on: TASK-041, TASK-042
- Estimate: 2-3 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: L06, L07; U05, U06; D09, D10, D12

## Outcome

Let the user inspect and save one VRM without changing the active performance.

## Scope and files

Planned files: `src/library-import.ts`, `src/library-view.ts`, `src/viewer.ts`, `src/style.css`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Implement the L07 state machine with named phases and clear recovery actions.
- Show disposable preview, capabilities, metadata, attachments, and acknowledgment.
- Enforce one pending operation and the 30-second preparation deadline.
- Save only after acknowledgment and transaction completion.
- Provide Try without saving through the prepared selection boundary.
- Release preview resources before a separate selection load.

## Acceptance criteria

- [ ] Save creates an entry without selecting it.
- [ ] Try without saving creates no database entry or persistent selection.
- [ ] Cancel, timeout, and invalid input leave the previous model and output intact.
- [ ] Save retries and duplicate files cannot create duplicate bytes.
- [ ] Terms acknowledgment records metadata and attachment digests.
- [ ] Modal focus, error announcements, and reduced motion meet U05 and U06.

## Verification

- Test every state transition and cancellation boundary in a browser.
- Inspect resource ownership after preview close and late decode.
- Check terms conflict, quota failure, and retry screenshots.

## Evidence and completion

Write the result to `ops/reports/library-import.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Planning is complete. Implementation has not started. Start after the listed dependencies pass.

