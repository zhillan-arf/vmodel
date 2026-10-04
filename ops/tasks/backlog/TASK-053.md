# TASK-053: Implement bounded traces and deterministic replay

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](TASK-P05.md)
- Depends on: TASK-049, TASK-050
- Estimate: 3-4 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T08 through T11; U05, U06; D24, D25

## Outcome

Record and replay the same observations and application history within fixed limits.

## Scope and files

Planned files: `src/tracking-recording.ts`, `src/tracking-replay.ts`, `src/tracking-diagnostics.ts`, `src/camera.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Implement the versioned manifest and sample/apply/settings/calibration/reset events.
- Record unique samples once and preserve application delta times.
- Enforce count, duration, byte, and memory limits while recording.
- Validate imported traces before replay.
- Reset and replay history on seek or backward step.
- Add optional bounded video with visible controls and timestamp mapping.

## Acceptance criteria

- [ ] Repeated replay preserves reason enums and accepted channels.
- [ ] Quaternion results meet the 0.0001-radian tolerance.
- [ ] Seek produces the same state as forward replay from the start.
- [ ] Every T08 and T10 limit stops cleanly with a valid retained prefix.
- [ ] Default exports contain no video, device IDs, or absolute paths.
- [ ] Unsupported video recording leaves landmark traces usable.
- [ ] Invalid traces cannot publish live frames or modify live settings.

## Verification

- Test time gaps, settings changes, calibration, loss, seek, and malformed imports.
- Test recorder errors and camera loss with optional video.
- Compare output messages during replay to confirm isolation.

## Evidence and completion

Write the result to `ops/reports/tracking-replay.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Planning is complete. Implementation has not started. Start after the listed dependencies pass.

