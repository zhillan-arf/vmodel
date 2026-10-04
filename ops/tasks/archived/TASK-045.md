# TASK-045: Build library cards and entry management

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](../active/TASK-P04.md)
- Depends on: TASK-043, TASK-044
- Estimate: 2-3 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: L09; U01 through U03, U05, U06; D13, D31 through D34

## Outcome

Present the library with clear selection, storage, and entry controls.

## Scope and files

Planned files: `src/library-view.ts`, `src/studio-navigation.ts`, `src/style.css`, `src/main.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Build responsive cards with consistent thumbnails and capability summaries.
- Show bundled, imported, temporary, selected, and unavailable states.
- Implement imported-entry rename and confirmed inactive removal.
- Refresh lists through the library channel and focus recovery.
- Keep essential errors visible without shifting primary controls.
- Document settings retention after entry removal.

## Acceptance criteria

- [x] Names obey L01 limits and display as text.
- [x] Removal never deletes bundled sources or an active local entry.
- [x] Removal and orphan-byte cleanup occur in one transaction.
- [x] A remote deletion preserves current decoded bytes and shows the missing saved state.
- [x] Cards and details pass automated viewport, CSS zoom, keyboard, and contrast checks.
- [x] No action silently changes the current performance model.

## Verification

- Test two-tab rename and delete behavior.
- Check long Unicode names and empty or bundled-only library states.
- Inspect real Ene and Rei thumbnails and selected-state clarity.

## Evidence and completion

Write the result to `ops/reports/library-interface.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Entry cards, rename, export, and protected removal are implemented. Responsive checks pass. Two-tab rename and removal preserve the active model.
Refresh preserves keyboard focus, open details, and backup selections.
Actual bundled thumbnails now pass image and layout checks. The full accessibility matrix remains open.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/library-interface.md).

## Windows software acceptance

Installed Chrome and Edge pass the card, management, thumbnail, selection, and 24 layout and contrast cases.
See [the Windows record](../../reports/windows-continuation.md).
At the user's request, [TASK-061](../backlog/TASK-061.md) now owns native browser zoom and human keyboard and appearance review.
TASK-047 and TASK-048 retain all G5 release requirements.
