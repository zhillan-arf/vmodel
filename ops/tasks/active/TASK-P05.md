# TASK-P05: Own tracking diagnosis and correction delivery

- Status: In progress
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P01](TASK-P01.md)
- Depends on: None to start; completion requires TASK-049 through TASK-060 and the G5 handoff in TASK-048.
- Estimate: Coordination throughout G6 implementation; included in child estimates.
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Design decisions](../../specs/studio-design-decisions.md)
- Implementation register: [Task register](../backlog/README.md)

## Outcome

Deliver a model-independent Tracking Inspector, repeatable trace replay, physical diagnosis, and measured correction verdicts. Verify the combined studio after the G5 handoff.

## Work

- Read this controller, P01, the specification, and the current child before implementation.
- Keep decisions D17 through D30 and D33 through D36 consistent with implementation.
- Preserve current tracker and solver behavior through TASK-055.
- Require reasons from actual solver branches and images from matching samples.
- Separate raw observations, estimated depth, accepted motion, and avatar appearance.
- Keep diagnostic data, replay, and camera images out of clean output.
- Require physical diagnosis before scheduler, association, or filter changes.
- Test one correction at a time against a fixed baseline.
- Record failed and inapplicable experiments without hiding their results.
- Coordinate viewer and visual changes with P04 through the linked tasks.
- Preserve TASK-009 through TASK-013 acceptance until their exact physical checks pass.
- Update child status, this controller, P01, and the register together.
- Close after TASK-060 hands G6 and combined evidence to P01 and TASK-021.

This controller is a coordination record, not a background process. It does not request sub-agents. It does not block its children from starting.

## Current checkpoint

Date: 2026-10-04. Windows software checks and inspector speed comparisons pass. Human and physical acceptance remain open.

- Scope: Twelve implementation tasks, TASK-049 through TASK-060.
- Progress: 6/12 Done; 2 In progress; 1 Blocked; 0 Ready; 3 Todo.
- Evidence: [implementation record](../../reports/studio-implementation.md) and [browser checks](../../reports/studio-features-smoke.json).
- Completed checks: unit suite, production build, solver diagnostics, trace limits, and video lifecycle tests.
- Model assets: local Ene and Rei pass Chrome and Edge selection and memory tests. The Windows reports record their actual hashes.
- Physical evidence: camera gestures and human review remain open. Actual-model browser images are available.
- Acceptance: TASK-049 through TASK-054 have complete software evidence. Human checks now belong to TASK-061. Controller release acceptance remains open.
- Coordination: both controllers use the same viewer preparation boundary and MotionSolver.
- Corrections: the tracker schedule and thresholds remain unchanged pending physical diagnosis.

## Milestones

| Milestone | Children | Exit evidence |
| --- | --- | --- |
| Diagnostic contract | TASK-049, TASK-050 | Clock, sample identity, rejection reasons, and behavior parity |
| Visible stages | TASK-051, TASK-052 | Matched overlay, coordinate tests, and separate depth estimates |
| Repeatable comparison | TASK-053, TASK-054 | Bounded traces, deterministic replay, canonical/Ene/Rei results |
| Inspector acceptance | TASK-055 | Performance, privacy, lifecycle, and reviewed visual states |
| Physical diagnosis | TASK-056 | First failing stage and selected experiment metric |
| Measured corrections | TASK-057 through TASK-059 | Adopt/reject verdicts and physical regression evidence |
| Combined handoff | TASK-060 | G5 integration, guide, and requirement evidence map |

## Boundaries and decisions

P05 owns observation contracts, solver diagnostics, replay, and correction experiments. P04 owns stored model identity and active selection. TASK-054 depends on P04 preparation work.

The 15 Hz and 150 ms values are experiment targets. Missing measurements do not prove a target passes. A sensing limit needs repeatable physical evidence.

If physical access is unavailable, record the affected task and required gesture. Continue other dependency-ready work. Do not close live acceptance with synthetic fixtures.

Do not install multi-camera infrastructure, buy hardware, replace MediaPipe, or add cloud processing under this controller.

## Acceptance criteria

- [ ] All twelve children have complete acceptance evidence.
- [ ] T01 through T17 and applicable U requirements pass.
- [ ] The inspector works without a VRM for its first three layers.
- [ ] Replay preserves reasons, accepted channels, and defined rotation tolerances.
- [ ] Physical tests establish correction results or allowed sensing limits.
- [ ] No confirmed in-scope software defect remains unresolved.
- [ ] TASK-060 verifies the combined studio and hands evidence to P01 and TASK-021.

## Next action

Complete the human inspector checks in [TASK-061](../backlog/TASK-061.md).
After TASK-055 acceptance, collect physical gestures for TASK-056.
The [Windows report](../../reports/windows-continuation.md) supplies software, memory, and performance evidence.

## Windows continuation

Chrome and Edge pass the software checks. Both browsers pass L13 memory cleanup with output closed and open.
See [the Windows record](../../reports/windows-continuation.md).
TASK-039, TASK-043, TASK-045, and TASK-051 have complete software evidence.
[TASK-061](../backlog/TASK-061.md) owns their transferred human checks and the other physical acceptance tests.
The release requirements remain unchanged.
