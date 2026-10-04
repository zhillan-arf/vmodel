# TASK-P04: Own model library delivery

- Status: In progress
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P01](TASK-P01.md)
- Depends on: None to start; completion requires TASK-039 through TASK-048.
- Estimate: Coordination throughout G5 implementation; included in child estimates.
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Design decisions](../../specs/studio-design-decisions.md)
- Implementation register: [Task register](../backlog/README.md)

## Outcome

Deliver the local model library, safe model selection, recovery, and a consistent studio interface. Coordinate ten implementation tasks without absorbing the tracking correction scope.

## Work

- Read this controller, P01, the specification, and the current child before implementation.
- Keep decisions D01 through D16 and D31 through D35 consistent with implementation.
- Own shared visual tokens and navigation through TASK-039.
- Coordinate shared viewer changes with P05 before TASK-054.
- Preserve bundled selection, hash-based settings, calibration, and clean output.
- Require failed imports and selections to preserve the active performance.
- Require backup restoration, privacy checks, and actual model appearance review.
- Record changed artifacts, evidence, blockers, and next actions after each session.
- Update child status, this controller, P01, and the register together.
- Close after TASK-048 hands G5 evidence to P01 and TASK-021.

This controller is a coordination record, not a background process. It does not request sub-agents. It does not block its children from starting.

## Current checkpoint

Date: 2026-10-04. Windows software checks and model memory tests pass. Human acceptance remains open.

- Scope: Ten implementation tasks, TASK-039 through TASK-048.
- Progress: 8/10 Done; 2 In progress; 0 Blocked; 0 Ready; 0 Todo.
- Evidence: [implementation record](../../reports/studio-implementation.md) and [browser checks](../../reports/studio-features-smoke.json).
- Completed checks: unit suite, production build, and synthetic storage/selection/navigation tests.
- Model assets: local Ene and Rei pass Chrome and Edge selection and memory tests. The Windows reports record their actual hashes.
- Physical evidence: camera gestures and human review remain open. Actual-model browser images are available.
- Acceptance: TASK-039 through TASK-046 have complete software evidence. Human checks now belong to TASK-061. Controller release acceptance remains open.
- Coordination: both controllers use the same viewer preparation boundary and MotionSolver.
- Corrections: the tracker schedule and thresholds remain unchanged pending physical diagnosis.

## Milestones

| Milestone | Children | Exit evidence |
| --- | --- | --- |
| Contracts and preparation | TASK-039, TASK-040 | View state preservation and failed-load rollback |
| Storage and inspection | TASK-041, TASK-042 | Atomic writes, format fixtures, terms, and resource limits |
| User flow and output | TASK-043 through TASK-045 | Preview, explicit selection, revision results, and reviewed cards |
| Backup and acceptance | TASK-046, TASK-047 | Fresh-profile restore, measured lifecycle, and visual review |
| G5 handoff | TASK-048 | Guide and requirement evidence map |

## Boundaries and decisions

P04 owns the model repository, import states, persistence, and library interface. P05 owns tracker data and motion diagnosis. Both use the shared visual requirements.

Do not change solver thresholds to repair a model preview. Treat missing optional capabilities separately from invalid required bones. Preserve original terms without a legal conclusion.

If a model exceeds a selected ceiling, record its measured resources. Change the specification only with a documented reason and regression evidence.

## Acceptance criteria

- [ ] All ten children have complete acceptance evidence.
- [ ] L01 through L14 and applicable U requirements pass.
- [ ] Ene, Rei, and a licensed VRM 1 fixture pass their defined cases.
- [ ] Backup restore passes in a new browser profile.
- [ ] No failed or stale load replaces a valid active selection.
- [ ] Output mismatch states and recovery have evidence.
- [ ] TASK-048 hands G5 evidence to P01 and TASK-021.

## Next action

Complete the human library checks in [TASK-061](../backlog/TASK-061.md).
Record the findings in TASK-047 and TASK-048 before the G5 handoff.
The [Windows report](../../reports/windows-continuation.md) supplies software and memory evidence.

2026-10-04 preparation checkpoint: TASK-040 is complete. Both model versions and injected decoder failures have passing cleanup evidence.

## Windows continuation

Chrome and Edge pass the software checks. Both browsers pass L13 memory cleanup with output closed and open.
See [the Windows record](../../reports/windows-continuation.md).
TASK-039, TASK-043, TASK-045, and TASK-051 have complete software evidence.
[TASK-061](../backlog/TASK-061.md) owns their transferred human checks and the other physical acceptance tests.
The release requirements remain unchanged.
