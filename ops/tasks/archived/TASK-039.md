# TASK-039: Define shared studio views and model contracts

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](../active/TASK-P04.md)
- Depends on: None
- Estimate: 1-2 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: L01; U01 through U03; D03, D31, D32

## Outcome

Provide stable model types and the three studio views without a change to current performance behavior.

## Scope and files

Planned files: `src/model-types.ts`, `src/studio-navigation.ts`, `src/style.css`, `src/main.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Define entry, asset, capability, inspection, and registration types from L01.
- Extract navigation for Studio, Library, and Tracking without restarting the camera or output.
- Create CSS tokens and responsive panel rules from U01 and U02.
- Use the design specimen as a layout reference. Keep existing controls in Studio.
- Record ownership of viewer, repository, camera, and inspector resources.

## Acceptance criteria

- [x] Bundled Ene and Rei still load through the existing path.
- [x] All three views preserve active model, camera, settings, and output state.
- [x] Type definitions separate entry identity from asset hash.
- [x] Keyboard navigation, focus visibility, and required viewport sizes pass.
- [x] The implementation records any difference from the selected visual design.

## Verification

- Run focused navigation tests and the production build.
- Check both bundled models before and after each view change.
- Record screenshots at the three U02 sizes.

## Evidence and completion

Write the result to `ops/reports/studio-view-contracts.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Shared types, navigation, and responsive tokens are implemented. Actual bundled-model navigation checks pass. Human visual review remains open.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/studio-view-contracts.md).

## Windows software acceptance

Installed Chrome and Edge pass navigation, visible focus, and the three required viewport sizes.
See [the Windows record](../../reports/windows-continuation.md).
Human layout and appearance review belong to [TASK-061](../backlog/TASK-061.md).
TASK-047 and TASK-048 retain G5 release acceptance.
