# TASK-046: Implement original export and portable backups

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](../active/TASK-P04.md)
- Depends on: TASK-041, TASK-042
- Estimate: 3-4 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: L10, L11; D14, D15

## Outcome

Recover selected library entries from verified local files.

## Scope and files

Planned files: `src/library-backup.ts`, `src/library-view.ts`, `src/profiles.ts`, `tests/library-backup.test.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Implement the exact VMLIB1 header, manifest, offsets, and segment hashes.
- Export original VRM and attachment bytes without conversion.
- Validate the complete backup before any restore writes.
- Decode restored candidates sequentially and release each candidate.
- Merge new entries atomically with new UUIDs and existing-hash precedence.
- Apply optional settings only to missing keys after database commit.

## Acceptance criteria

- [x] Original exports are byte-identical to their stored assets.
- [x] A backup restores selected entries and terms in a new browser profile.
- [x] Corrupt hash, bounds, schema, count, and size fixtures write nothing.
- [x] Identical bundled bytes resolve to the bundle; changed bundled bytes become imported entries.
- [x] Duplicate restore preserves existing names and settings.
- [x] Settings failures report separately and never invalidate restored model records.
- [x] Restore does not select a model or copy camera calibration.

## Verification

- Run binary format and malformed-manifest fixtures.
- Interrupt restore before transaction, during transaction, and after commit.
- Compare exported and restored asset and attachment hashes.

## Evidence and completion

Write the result to `ops/001-zhil/sprint-001/reports/library-backup.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/001-zhil/sprint-001/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. Backup format, terms, settings, and atomic restore checks pass. Unit fixtures and real IndexedDB tests provide evidence.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/library-backup.md).

This task is complete. P04 retains actual-model, performance, and human review checks.
