# TASK-040: Separate avatar preparation from selection commit

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](TASK-P04.md)
- Depends on: TASK-039
- Estimate: 2-3 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: L04 through L06; D08, D09, D11

## Outcome

Prepare a replacement avatar without disposal of the current model.

## Scope and files

Planned files: `src/viewer.ts`, `src/retarget.ts`, `src/model-types.ts`, `src/main.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Extract preparation, commit, and disposal APIs from AvatarViewer.load.
- Check required bones and construct the retargeter before the commit.
- Return the capability report with format and expression aliases.
- Apply VRM orientation handling once during preparation.
- Give every pending load an operation generation and cleanup owner.

## Acceptance criteria

- [ ] Decode, bone, or retargeter failure leaves the previous avatar usable.
- [ ] Commit replaces viewer and application state without an asynchronous gap.
- [ ] Cancelled and superseded candidates cannot commit.
- [ ] Each rejected candidate disposes its graphics resources once.
- [ ] Ene and Rei preserve neutral pose, relaxed arms, settings, and expressions.

## Verification

- Inject decode and retargeter-construction failures.
- Test late completion after cancellation and rapid Ene/Rei changes.
- Run viewer and retargeter fixtures, npm test, and npm run build.

## Evidence and completion

Write the result to `ops/reports/avatar-preparation.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Planning is complete. Implementation has not started. Start after the listed dependencies pass.

