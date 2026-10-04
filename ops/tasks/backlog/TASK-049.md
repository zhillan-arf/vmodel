# TASK-049: Add task diagnostic envelopes and timing

- Status: Ready
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](TASK-P05.md)
- Depends on: None
- Estimate: 2-3 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T01, T02; D17 through D19

## Outcome

Expose distinct task samples and comparable clocks without changing tracker behavior.

## Scope and files

Planned files: `src/tracking-diagnostics.ts`, `src/types.ts`, `src/tracking.worker.ts`, `src/camera.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Implement demand-controlled DiagnosticEnvelope version 1.
- Retain TrackingFrame version 1 and the SDK's short session clock.
- Assign capture and per-task sample IDs with original cached times.
- Record worker start/end, main receipt, solver-use, and display times.
- Calculate distinct-sample rates and percentile windows.
- Include face observations only when inspector or recorder demand exists.

## Acceptance criteria

- [ ] Cached arrays never increment inference counts.
- [ ] Restart creates a new session and rejects old responses.
- [ ] Disabled hands produce no new detection count.
- [ ] Clock conversion preserves freshness boundaries and avoids epoch SDK input.
- [ ] Inspector-off execution has the same task order and output as before.
- [ ] Missing confidence fields remain unavailable in diagnostic data.

## Verification

- Test cached, disabled, out-of-order, restarted, and clock-boundary fixtures.
- Compare identical worker inputs with diagnostics on and off.
- Run existing camera recovery and positive-detection checks.

## Evidence and completion

Write the result to `ops/reports/tracking-contract.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Planning is complete. Implementation has not started. This task is ready to start.

