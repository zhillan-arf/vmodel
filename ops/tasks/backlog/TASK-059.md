# TASK-059: Accept motion corrections and state sensing limits

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](../active/TASK-P05.md)
- Depends on: TASK-057, TASK-058
- Estimate: 1-2 days plus physical access
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T13, T16; D29, D30, D36

## Outcome

Establish which changes improve physical movement and which limits remain.

## Scope and files

Planned files: `ops/reports/tracking-correction-acceptance.md`, `docs/tracking-check.md`, `ops/tasks/active/TASK-009.md through TASK-013.md`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Repeat the diagnosis protocol with the selected final configuration.
- Compare final motion against the original baseline and intermediate experiments.
- Verify the original symptom, difficult poses, and loss recovery.
- Separate fixed software defects from measured monocular sensing limits.
- Prepare a separate sensing experiment proposal only if necessary.
- Update old task evidence only where their exact acceptance criteria pass.

## Acceptance criteria

- [ ] Each experiment has an adopt, reject, or inapplicable verdict with evidence.
- [ ] Final adopted changes satisfy T16 on actual physical movement.
- [ ] No confirmed in-scope software defect remains hidden by a fallback.
- [ ] Any sensing-limit conclusion has repeated observations and named uncertainty.
- [ ] Hardware escalation remains a proposal without purchase or integration.
- [ ] Old physical acceptance remains open wherever evidence is insufficient.

## Verification

- Review before/after traces, clips, aggregate metrics, and final settings.
- Repeat both avatar comparisons while keeping Ene as the original delivery avatar.
- Check that missing physical evidence cannot close this task.

## Evidence and completion

Write the result to `ops/reports/tracking-correction-acceptance.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Physical diagnosis is unavailable in this environment.
TASK-055 still needs measured overhead and human review. No scheduler or motion correction is eligible yet.
The baseline schedule and thresholds remain unchanged. No experiment verdict has been invented.

Required action: complete inspector acceptance, then perform the [physical protocol](../../../docs/tracking-check.md) on the target laptop.
The operator supplies the gestures. Codex records the failed stage and evaluates eligible corrections.
