# TASK-049: Add task diagnostic envelopes and timing

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](../active/TASK-P05.md)
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

- [x] Cached arrays never increment inference counts.
- [x] Restart creates a new session and rejects old responses.
- [x] Disabled hands produce no new detection count.
- [x] Clock conversion preserves freshness boundaries and avoids epoch SDK input.
- [x] Inspector-off execution has the same task order and output as before.
- [x] Missing confidence fields remain unavailable in diagnostic data.

## Verification

- Test cached, disabled, out-of-order, restarted, and clock-boundary fixtures.
- Compare identical worker inputs with diagnostics on and off.
- Run existing camera recovery and positive-detection checks.

## Evidence and completion

Write the result to `ops/001-zhil/sprint-001/reports/tracking-contract.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/001-zhil/sprint-001/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Optional diagnostic envelopes, task identities, session clocks, and metrics are implemented. Rolling metrics and unit checks pass. The installed worker passed positive detection checks. A 70-second fake-camera run passed Stop, restart, and diagnostic cleanup checks.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/tracking-contract.md).

Software acceptance is complete. Physical-camera and target-laptop acceptance remain with TASK-055 and TASK-056.
