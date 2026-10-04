# TASK-052: Build estimated body and hand views

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](TASK-P05.md)
- Depends on: TASK-051
- Estimate: 2 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T05; U04; D21, D34

## Outcome

Show estimated depth without hiding raw proportions or coordinate differences.

## Scope and files

Planned files: `src/tracking-inspector.ts`, `src/tracking-inspector-3d.ts`, `src/style.css`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Draw pose world landmarks through the specified display transform.
- Provide separate hand views and optional calculated wrist alignment.
- Add axes, units, orbit, zoom, and reset controls.
- Show face contours with an optional dense-point layer.
- Draw only the visible view and release graphics resources on close.

## Acceptance criteria

- [ ] Known points verify axis orientation and unit labels.
- [ ] Raw pose lengths remain unconstrained.
- [ ] Failed association removes calculated hand alignment.
- [ ] Missing landmarks never appear at the origin.
- [ ] Dense face display uses actual runtime point counts and no invented confidence.
- [ ] Keyboard controls and reduced motion preserve essential access.

## Verification

- Run coordinate-transform and wrist-alignment fixtures.
- Inspect front, side, and rotated views with known test poses.
- Check resource counts after repeated view changes.

## Evidence and completion

Write the result to `ops/reports/tracking-estimated-3d.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Planning is complete. Implementation has not started. Start after the listed dependencies pass.

