# TASK-041: Implement the local model repository

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](../active/TASK-P04.md)
- Depends on: TASK-039
- Estimate: 2-3 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: L01 through L03; D01 through D06, D16

## Outcome

Store imported entries atomically while preserving bundled and temporary access.

## Scope and files

Planned files: `src/model-repository.ts`, `src/library-db.ts`, `src/avatars.ts`, `src/profiles.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Implement version 1 stores and the unique assetHash index.
- Combine bundled and imported entries behind ModelRepository.
- Prepare all asynchronous data before a database write transaction.
- Handle quota, denied storage, abort, versionchange, and blocked upgrades.
- Read the existing bundled preference when the new preference is absent.
- Keep current settings and calibration keys unchanged.

## Acceptance criteria

- [x] A second visit restores imported entries from the same origin.
- [x] Concurrent duplicate saves produce one imported entry and one asset.
- [x] A failed transaction leaves no asset, entry, or attachment residue.
- [x] Unavailable storage leaves bundled and temporary loading available.
- [x] A newer database schema produces a recovery message without data deletion.
- [x] Storage estimates and persistence results remain advisory and visible.

## Verification

- Use real browser IndexedDB tests for commit, rollback, and two-tab races.
- Test blocked upgrade and unavailable storage explicitly.
- Compare existing profile keys before and after repository initialization.

## Evidence and completion

Write the result to `ops/001-zhil/sprint-001/reports/model-repository.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/001-zhil/sprint-001/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Date: 2026-10-04. All repository acceptance checks pass in Chromium on Linux. Two-tab races, storage failures, schema recovery, and persistence states have evidence.

Evidence: [implementation record](../../reports/studio-implementation.md) and [task report](../../reports/model-repository.md).

The repository task is complete. P04 release checks for actual models and the target browser remain open.
