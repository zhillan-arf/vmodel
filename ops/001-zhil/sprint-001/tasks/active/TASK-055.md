# TASK-055: Verify inspector performance and visual clarity

- Status: In progress
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G6
- Parent controller: [TASK-P05](TASK-P05.md)
- Depends on: TASK-051, TASK-052, TASK-053, TASK-054
- Estimate: 2-3 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: T12; U07, U08; D18, D29, D32 through D34

## Outcome

Establish diagnostic correctness, overhead, lifecycle, and visual acceptance before motion tuning.

## Scope and files

Planned files: `scripts/tracking_inspector_smoke.mjs`, `ops/001-zhil/sprint-001/reports/tracking-inspector-acceptance.md`, `tests/tracking-*.test.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Run off, overlay, estimated-3D, and recording measurements under the T12 protocol.
- Check output payload isolation and live pause behavior.
- Test all required diagnostic visual states.
- Inspect typography, contrast, keyboard order, and viewport behavior.
- Record dense-face and video overhead separately.

## Acceptance criteria

- [x] Inspector-off and default-on results satisfy T12 limits in the Windows fixture measurements.
- [x] Required trace, transform, reason, and lifecycle fixtures pass.
- [x] No extra camera, inference backlog, or unbounded resource growth occurs in the resource tests and measured intervals.
- [ ] All U07 tracking states have reviewed screenshots.
- [ ] Human review confirms readable reasons and distinct raw versus constrained layers.
- [x] Live motion quality remains unclaimed by these component tests.

## Verification

- Run npm test, npm run build, and relevant existing verification.
- Record three measured samples per mode and actual browser versions.
- Review resource counts and aggregate process memory after closure.

## Evidence and completion

Write the result to `ops/001-zhil/sprint-001/reports/tracking-inspector-acceptance.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/001-zhil/sprint-001/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Windows software checks pass. The default overlay and the reference comparison with changed mode order meet T12 speed limits.
Nine tracking states have test images. TASK-061 owns human review and physical tests.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/tracking-inspector-acceptance.md).

Acceptance remains open until all required checks have direct evidence.
