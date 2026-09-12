# Ene VTuber implementation backlog

[Proposal and implementation plan](../../specs/ene-vtuber-plan.md)

This backlog covers both deliverables: **G1**, a reusable, rigged Ene VRM with editable source; and **G2**, a local webcam-driven VTuber application with OBS streaming/virtual-camera integration and landscape/portrait recording. All 21 tasks are unimplemented; the planning inspection is recorded as evidence in the specification.

The user has supplied the actual model package at `ops/resources/ENE/` and X excerpts at `ops/resources/x-posts.md`. There is no remaining missing-model blocker. Use **cyber legs**, the user's selected variant, as the baseline; preserve both PMX originals and address the known sphere-texture gaps during import. A licensed sample can support runtime development while Ene is prepared. Final avatar acceptance and recordings must use cyber legs.

## Work order

Start **TASK-001** and **TASK-002**. Once the toolchain is working, run **TASK-003** to prove laptop feasibility and **TASK-004** to begin model preparation. Follow the listed dependencies afterward. These are work branches, not a request to spawn agents.

- Avatar branch: 001 + 002 → 004 → 005 → 006 → 007.
- Runtime branch: 002 → 003 → 008 + 009 → 010 → 011 → 012 → 013 → 015 → 016.
- Motion investigation: 004 + 005 → 014; independent of live tracking.
- Output and handoff: 016 + 002 → 017; 007 + 017 → 018; 015 + 016 + 017 → 019; 007 + 012 + 013 + 018 + 019 → 020; 007 + 014 + 018 + 019 + 020 → 021.

Full dependencies in each task are authoritative. P0 identifies required delivery work; TASK-014 is P1 because VMD playback is not necessary for live tracking, but its bounded compatibility report is still included in the handoff.

## Task index

| Task | Title | Goal | Dependencies | Status |
| --- | --- | --- | --- | --- |
| [TASK-001](TASK-001.md) | Audit Ene variants, texture gaps and attribution | G1 | None | Ready |
| [TASK-002](TASK-002.md) | Select and provision a reproducible open source toolchain | G1, G2 | None | Ready |
| [TASK-003](TASK-003.md) | Prove local webcam-to-avatar feasibility on the laptop | G2 | TASK-002 | Todo |
| [TASK-004](TASK-004.md) | Import Ene and preserve an editable source scene | G1 | TASK-001, TASK-002 | Todo |
| [TASK-005](TASK-005.md) | Prepare Ene's humanoid rig and deformation | G1 | TASK-004 | Todo |
| [TASK-006](TASK-006.md) | Map and repair Ene facial expressions | G1, G2 | TASK-005 | Todo |
| [TASK-007](TASK-007.md) | Tune appearance and export the reusable Ene avatar | G1 | TASK-005, TASK-006 | Todo |
| [TASK-008](TASK-008.md) | Build the VRM viewer and avatar profile loader | G2 | TASK-003 | Todo |
| [TASK-009](TASK-009.md) | Implement camera capture and bounded tracking workers | G2 | TASK-003 | Todo |
| [TASK-010](TASK-010.md) | Implement calibrated head and face retargeting | G2 | TASK-008, TASK-009 | Todo |
| [TASK-011](TASK-011.md) | Implement torso and arm motion for seated performance | G2 | TASK-008, TASK-009, TASK-010 | Todo |
| [TASK-012](TASK-012.md) | Implement wrist and visible finger tracking | G2 | TASK-009, TASK-011 | Todo |
| [TASK-013](TASK-013.md) | Implement standing and visible full-body movement | G2 | TASK-011, TASK-012 | Todo |
| [TASK-014](TASK-014.md) | Validate the supplied VMD and document motion preview compatibility | G1 support | TASK-004, TASK-005 | Todo |
| [TASK-015](TASK-015.md) | Build calibration, settings and everyday controls | G2 | TASK-010, TASK-011, TASK-012, TASK-013 | Todo |
| [TASK-016](TASK-016.md) | Create clean landscape and portrait output views | G2 | TASK-008, TASK-015 | Todo |
| [TASK-017](TASK-017.md) | Set up OBS capture, streaming scenes and virtual camera | G2 | TASK-002, TASK-016 | Todo |
| [TASK-018](TASK-018.md) | Deliver landscape and portrait recordings with audio | G2 | TASK-007, TASK-017 | Todo |
| [TASK-019](TASK-019.md) | Package local launch, offline assets and beginner documentation | G2 | TASK-015, TASK-016, TASK-017 | Todo |
| [TASK-020](TASK-020.md) | Validate performance, recovery and local-only operation | G2 | TASK-007, TASK-012, TASK-013, TASK-018, TASK-019 | Todo |
| [TASK-021](TASK-021.md) | Complete Ene end-to-end acceptance and handoff | G1, G2 | TASK-007, TASK-014, TASK-018, TASK-019, TASK-020 | Todo |

## Completion rules

Each task contains its intended outcome, implementation work, dependencies, estimate and checkable acceptance criteria. Estimates are planning ranges, not elapsed-time commitments; repairs and hardware findings can change them.

- Preserve original source files and the user's brief. Keep character assets and recordings out of code distribution.
- Record exact changed artifacts and meaningful verification evidence before marking a task done.
- A licensed sample is a development aid. G1 and G2 must ultimately be accepted using **Ene**.
- A working head-tracking preview does not close the movement requirement: arms, visible hands and standing behavior are required.
- A render alone does not close the production workflow: playable portrait/landscape video with audio and demonstrated OBS Virtual Camera are required.
- Do not mark unavailable live-camera checks as passed. Keep defects, missing measurements and genuine limitations explicit.
- TASK-021 is the final acceptance gate; it maps both original goals to concrete artifacts and evidence.
