# TASK-047: Verify library recovery performance and appearance

- Status: In progress
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](TASK-P04.md)
- Depends on: TASK-045, TASK-046
- Estimate: 2-3 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: L12, L13; U07, U08; D08, D16, D32

## Outcome

Establish measured library correctness, recovery, and visual acceptance.

## Scope and files

Planned files: `tests/library-*.test.ts`, `scripts/library_smoke.mjs`, `ops/reports/library-acceptance.md`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Run the L13 fixture and failure matrix on Chrome and Edge.
- Measure Ene and Rei import and selection with output closed and open.
- Run the 20-switch lifecycle test after warm-up.
- Inspect each required library visual state and actual model appearance.
- Observe network traffic and verify private assets stay local.
- Record fixed ceilings, actual measurements, failures, and device limits.

## Acceptance criteria

- [ ] All mandatory L13 correctness cases pass with linked evidence.
- [ ] No stale commit, leaked owned resource, blank committed avatar, or renderer crash occurs.
- [ ] Memory meets the L13 post-cleanup criterion.
- [ ] Backup restore passes in a fresh profile.
- [ ] Library screenshots and human review satisfy U07 and U08.
- [ ] No unperformed browser or physical check is marked passed.

## Verification

- Run npm test, npm run build, and applicable existing verification.
- Capture process memory, first-frame times, output recovery, and resource counts.
- Record reviewer findings for neutral pose, relaxed arms, expressions, and framing.

## Evidence and completion

Write the result to `ops/reports/library-acceptance.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Synthetic lifecycle checks and actual Ene and Rei load checks pass. Target-laptop memory, target browsers, and human review remain open.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/library-acceptance.md).

Acceptance remains open until all required checks have direct evidence.
