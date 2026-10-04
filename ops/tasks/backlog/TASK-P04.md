# TASK-P04: Own model library delivery

- Status: Ready
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P01](../active/TASK-P01.md)
- Depends on: None to start; completion requires TASK-039 through TASK-048.
- Estimate: Coordination throughout G5 implementation; included in child estimates.
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Design decisions](../../specs/studio-design-decisions.md)
- Implementation register: [Task register](README.md)

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

Date: 2026-10-04. Planning is complete. Implementation has not started.

- Scope: Ten implementation tasks, TASK-039 through TASK-048.
- Progress: 0/10 Done; 0 In progress; 0 Blocked; 1 Ready; 9 Todo.
- Ready: TASK-039.
- Current blocker: None for the next task.
- Physical evidence: Model appearance and fresh-profile recovery checks remain unperformed.
- Design: IndexedDB, original bytes, one candidate preview, explicit selection, and portable binary backups.
- Visual direction: Existing dark blue surfaces and cyan controls, with consistent cards and readable status text.

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

Start [TASK-039](TASK-039.md). Keep P05 informed of the shared contracts through its task records. P04 completion does not wait for TASK-021.
