# TASK-057: Evaluate and correct measured task scheduling faults

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](../active/TASK-P05.md)
- Depends on: TASK-056
- Estimate: 2-3 days when indicated; 0.5 day otherwise
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T14, T16; D27, D29

## Outcome

Improve a measured timing fault or retain the current scheduler with a clear verdict.

## Scope and files

Planned files: `src/tracking.worker.ts`, `src/camera.ts`, `ops/reports/tracking-scheduling.md`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Check TASK-056 for a timing fault before changing scheduling.
- If indicated, implement the bounded per-task deadline experiment in T14.
- Compare unique samples, p95 age, stale fraction, and renderer performance.
- Preserve one frame in flight, CPU fallback, watchdogs, and freshness limits.
- Adopt the candidate only if T16 passes. Otherwise remove the experimental change.

## Acceptance criteria

- [ ] The report states whether the experiment was applicable and why.
- [ ] An adopted scheduler passes the selected T16 improvement and regression gates.
- [ ] Cached results retain identity and disabled tasks do not run.
- [ ] No frame queue, automatic timeout increase, or unrelated model replacement enters the change.
- [ ] A failed or inapplicable experiment leaves the baseline intact.
- [ ] The report states actual results against 15 Hz and 150 ms targets.

## Verification

- Run baseline and candidate on identical traces and three live repetitions.
- Test low and balanced modes with OBS off and on.
- Repeat camera loss, restart, CPU fallback, and watchdog cases.

## Evidence and completion

Write the result to `ops/reports/tracking-scheduling.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Physical diagnosis is unavailable in this environment.
TASK-055 still needs measured overhead and human review. No scheduler or motion correction is eligible yet.
The baseline schedule and thresholds remain unchanged. No experiment verdict has been invented.

Required action: complete inspector acceptance, then perform the [physical protocol](../../../docs/tracking-check.md) on the target laptop.
The operator supplies the gestures. Codex records the failed stage and evaluates eligible corrections.
