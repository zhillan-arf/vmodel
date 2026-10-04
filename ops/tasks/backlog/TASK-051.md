# TASK-051: Build the matched camera overlay and live controls

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](TASK-P05.md)
- Depends on: TASK-039, TASK-049, TASK-050
- Estimate: 2-3 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T04, T07; U04 through U06; D20, D26, D33

## Outcome

Show each task's landmarks on the correct image with clear rejection and age states.

## Scope and files

Planned files: `src/tracking-inspector.ts`, `src/camera.ts`, `src/studio-navigation.ts`, `src/style.css`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Retain and release at most four sampled images.
- Implement task-specific image selection and contain-fit coordinates.
- Apply display mirroring once to image and overlay.
- Draw accepted, rejected, stale, and missing states with text and line style.
- Add pause and resume that affect only inspector display.
- Expose joint details and summary channel reasons.

## Acceptance criteria

- [ ] Synthetic corner points align within one CSS pixel at all required sizes.
- [ ] Mirror changes keep anatomical labels stable.
- [ ] Cached body and hand results use their own matched images.
- [ ] Missing images produce a labeled plain background.
- [ ] Pause does not stop the live camera or clean output.
- [ ] Keyboard joint selection and live announcements pass U05.

## Verification

- Test wide, portrait, letterboxed, mirrored, and resized views.
- Test cached tasks with different capture sequences.
- Observe image resource counts during pause, resume, and close.

## Evidence and completion

Write the result to `ops/reports/tracking-overlay.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Planning is complete. Implementation has not started. Start after the listed dependencies pass.

