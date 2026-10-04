# TASK-052: Build estimated body and hand views

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](../active/TASK-P05.md)
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

- [x] Known points verify axis orientation and unit labels.
- [x] Raw pose lengths remain unconstrained.
- [x] Failed association removes calculated hand alignment.
- [x] Missing landmarks never appear at the origin.
- [x] Dense face display uses actual runtime point counts and no invented confidence.
- [x] Keyboard controls and reduced motion preserve essential access.

## Verification

- Run coordinate-transform and wrist-alignment fixtures.
- Inspect front, side, and rotated views with known test poses.
- Check resource counts after repeated view changes.

## Evidence and completion

Write the result to `ops/reports/tracking-estimated-3d.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Separate pose/hand depth views and keyboard view controls are implemented. Raw lengths, missing endpoints, original world details, keyboard controls, and resource disposal pass focused tests.
Dense face counts and calculated wrist alignment pass browser checks. Reviewed front, side, and rotated images show the complete test pose.
All required window widths and repeated graphics disposal pass.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/tracking-estimated-3d.md).

All task acceptance criteria have direct evidence. Physical tracking acceptance remains under TASK-055 and TASK-056.
