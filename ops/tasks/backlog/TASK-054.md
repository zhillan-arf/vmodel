# TASK-054: Compare canonical motion with both avatars

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](TASK-P05.md)
- Depends on: TASK-040, TASK-050, TASK-052, TASK-053
- Estimate: 3-4 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T06, T07; D22, D25, D26

## Outcome

Separate observation, solver, and avatar effects through one shared motion implementation.

## Scope and files

Planned files: `src/motion-solver.ts`, `src/canonical-rig.ts`, `src/retarget.ts`, `src/tracking-inspector.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Extract MotionSolver with an explicit rest-rig adapter.
- Build the fixed canonical rig without VRM loading.
- Adapt the existing retargeter to shared solver results.
- Connect replay to isolated canonical and avatar comparison views.
- Keep trace time, calibration, settings, and model hash visible.

## Acceptance criteria

- [ ] Observations, Estimated 3D, and Accepted motion work without any VRM.
- [ ] Canonical and avatar adapters use the same solver implementation.
- [ ] Ene and Rei replay the same anatomical input without a side swap.
- [ ] Known bone rotations distinguish mapping errors from detector errors.
- [ ] All existing avatar fixtures pass after extraction.
- [ ] Replay never changes the active studio or clean output.

## Verification

- Compare pre-extraction and post-extraction avatar transforms.
- Run canonical, Ene, and Rei against identical traces.
- Inject model-load failure while using the first three layers.

## Evidence and completion

Write the result to `ops/reports/tracking-comparison.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Planning is complete. Implementation has not started. Start after the listed dependencies pass.

