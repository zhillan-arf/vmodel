# TASK-042: Inspect VRM structure capabilities and terms

- Status: Todo
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G5
- Parent controller: [TASK-P04](TASK-P04.md)
- Depends on: TASK-040
- Estimate: 3-4 days
- Specification: [Studio product specification](../../specs/studio-product-spec.md)
- Decisions: [Selected design decisions](../../specs/studio-design-decisions.md)
- Requirements: L04, L05; D07, D08, D12

## Outcome

Reject unsafe or incompatible candidates before selection and preserve their original terms.

## Scope and files

Planned files: `src/vrm-inspection.ts`, `src/vrm-inspection.worker.ts`, `src/model-types.ts`, `tests/vrm-inspection.test.ts`.

These paths identify implementation work. They do not claim that new modules or reports already exist. Estimates describe effort, not delivery dates.

## Work

- Implement GLB bounds, JSON depth, URI, extension, and allocation checks.
- Calculate SHA-256 in the inspection worker.
- Read image headers and accessor allocations with checked arithmetic.
- Preserve VRM 0 and VRM 1 metadata as separate typed formats.
- Produce required and optional capability results through TASK-040.
- Support plain-text terms and CP932 decoding without changing attachment bytes.

## Acceptance criteria

- [ ] Each L04 ceiling has a passing boundary and a rejected over-limit fixture.
- [ ] Malformed offsets, external resources, and unsupported required extensions fail before graphics allocation.
- [ ] Ene, Rei, and a licensed VRM 1 fixture pass the applicable checks.
- [ ] Missing required bones reject; absent optional expressions disable only their controls.
- [ ] Metadata and terms cannot execute HTML or script.
- [ ] Reports retain original versions, hashes, terms, and alias resolution.

## Verification

- Run parser fixtures for integer overflow, truncation, nesting, and URI cases.
- Observe network requests while inspecting external-resource fixtures.
- Record actual fixture hashes and source notices.

## Evidence and completion

Write the result to `ops/reports/vrm-inspection.md`. Record changed files, commands, measurements, fixture hashes, and remaining limits.

Keep personal recordings under `ops/reports/local/`. Do not mark unperformed checks as passed. Update the controller and register after each status change.

## Current checkpoint

Planning is complete. Implementation has not started. Start after the listed dependencies pass.

