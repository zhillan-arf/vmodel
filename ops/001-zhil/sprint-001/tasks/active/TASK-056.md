# TASK-056: Diagnose live motion through all tracker stages

- Status: In progress
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](TASK-P05.md)
- Depends on: TASK-055
- Estimate: 1-2 days plus physical access
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T13; D17, D29, D30, D36

## Outcome

Identify the first failed stage for each reproduced physical movement problem.

## Scope and files

Planned files: `docs/tracking-check.md`, `ops/001-zhil/sprint-001/reports/tracking-diagnosis.md`, `ops/001-zhil/sprint-001/reports/local/tracking/`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Run seated, standing, and close face/hand protocols with the user's camera.
- Record actual capture dimensions, light, power, delegate, and OBS load.
- Test separate arms, head turns, wrist rotation, fingers, crossings, loss, and recovery.
- Annotate clear video frames when video evidence is available.
- Select the primary failure metric before correction experiments.
- Write specific camera guidance when framing or light causes the fault.

## Acceptance criteria

- [ ] Each reported symptom has a reproduced failure or a documented non-reproduction result.
- [ ] The elbow demonstration identifies all four stages.
- [ ] Mirror on/off preserves anatomical sides in physical tests.
- [ ] Visible, hidden, and ambiguous joints remain separate in measurements.
- [ ] The report selects timing, association/filter, mapping, or sensing as the next test area.
- [ ] Unavailable physical checks remain unchecked with the required action named.

## Verification

- Review matched images, trace events, solver reasons, and actual avatar motion together.
- Repeat each relevant physical sequence three times.
- Map useful evidence to existing TASK-009 through TASK-013 without automatic closure.

## Evidence and completion

Write the result to `ops/001-zhil/sprint-001/reports/tracking-diagnosis.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/001-zhil/sprint-001/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-05. The user supplied thirteen images and three physical traces.
The missing-evidence blocker no longer applies to the observed finger and torso defects.
The [sprint-002 diagnosis](../../../sprint-002/research/001-physical-diagnosis.md) records confirmed causes and remaining uncertainty.
The [new plan](../../../sprint-002/specs/sprint-002-plan.md#sprint-001-transfer) replaces the remaining motion execution order.

The task remains incomplete because standing, mirror, crossing, and repeated physical checks lack full evidence.
The research completed replay on the canonical rig, Ene, and Rei.
The production schedule, solver, and model files remain unchanged.
Continue through sprint 002 rather than repeat the old evidence prerequisite.
