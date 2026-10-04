# TASK-051: Build the matched camera overlay and live controls

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](../active/TASK-P05.md)
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

- [x] Synthetic corner points align within one CSS pixel at all required sizes.
- [x] Mirror changes keep anatomical labels stable.
- [x] Cached body and hand results use their own matched images.
- [x] Missing images produce a labeled plain background.
- [x] Pause preserves the simulated camera stream and clean output.
- [x] Keyboard joint selection and live-region attributes pass automated U05 checks.

## Verification

- Test wide, portrait, letterboxed, mirrored, and resized views.
- Test cached tasks with different capture sequences.
- Observe image resource counts during pause, resume, and close.

## Evidence and completion

Write the result to `ops/001-zhil/sprint-001/reports/tracking-overlay.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/001-zhil/sprint-001/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Matched observations, joint controls, and inspector pause are implemented. All 18 browser coordinate cases pass. Mirror changes preserve anatomical labels. Missing images have a labeled background.
Keyboard joint selection and announcement attributes pass. The test camera and output continue during inspector pause and view changes. Full accessibility acceptance remains open.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/tracking-overlay.md).

## Windows software acceptance

Installed Chrome and Edge pass matched images, keyboard controls, pause, resume, and clean-output continuity.
See [the Windows record](../../reports/windows-continuation.md).
At the user's request, [TASK-061](../backlog/TASK-061.md) now owns physical-camera confirmation and human announcement review.
TASK-055 and TASK-060 retain all G6 release requirements.

The pause check passes with simulated Chromium camera input. Physical-camera confirmation remains open.
