# TASK-043: Build the import preview and save flow

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](../active/TASK-P04.md)
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

- [x] Save creates an entry without selecting it.
- [x] Try without saving creates no database entry or persistent selection.
- [x] Cancel, timeout, and invalid input leave the previous model and output intact.
- [x] Save retries and duplicate files cannot create duplicate bytes.
- [x] Terms acknowledgment records metadata and attachment digests.
- [x] Automated focus, error-announcement attributes, and reduced-motion checks pass on Chrome and Edge.

## Verification

- Test every state transition and cancellation boundary in a browser.
- Inspect resource ownership after preview close and late decode.
- Check terms conflict, quota failure, and retry screenshots.

## Evidence and completion

Write the result to `ops/001-zhil/sprint-001/reports/library-import.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/001-zhil/sprint-001/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Preview, terms review, save, and temporary selection are implemented. The browser verifies save without selection, temporary selection without persistence, and preview cancellation.
Studio reload restores the saved model in Studio and output.
Browser checks cover cancellation and timeout during inspection and preview. Accessibility acceptance remains open.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/library-import.md).

## Windows software acceptance

Installed Chrome and Edge pass the import, cancellation, timeout, error-state, focus, and panel-motion checks.
Import uses an inline panel. Browser confirmation handles destructive actions.
See [the Windows record](../../reports/windows-continuation.md).
At the user's request, [TASK-061](../backlog/TASK-061.md) now owns human focus, screen-reader, and preview-motion checks.
The U05 and U06 release requirements remain unchanged under TASK-047 and TASK-048.
