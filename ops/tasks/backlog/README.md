# VModel implementation backlog

[Proposal and implementation plan](../../specs/ene-vtuber-plan.md)

[Voice-conversion research and design](../../specs/voice-conversion-plan.md)

[Website character resources research and proposal](../../specs/web-character-resources-plan.md)

[TASK-P03](../archived/TASK-P03.md) completed G4 and its ten tasks. The five animated resources and local showcase have delivered evidence.

[TASK-P02: Own character voice implementation and delivery](../active/TASK-P02.md) coordinates G3's seven tasks, TASK-022 through TASK-028, and reports voice progress and acceptance evidence to TASK-P01. Read it when starting voice work. Controllers are excluded from the implementation-task count and do not block child tasks from starting.

This register covers 60 implementation tasks across six goals. Controllers do not count as implementation tasks.

| Goal | Deliverable |
| --- | --- |
| G1 | Reusable Ene VRM and editable source |
| G2 | Local camera-driven studio and OBS output |
| G3 | Live English character voice |
| G4 | Five animated website resources and their showcase |
| G5 | Persistent local model library and recovery |
| G6 | Tracking Inspector, physical diagnosis, and measured correction verdicts |

The [research evaluation](../../reports/studio-research-evaluation.md), [action plan](../../specs/studio-evolution-plan.md), [decisions](../../specs/studio-design-decisions.md), and [product specification](../../specs/studio-product-spec.md) define G5 and G6.

[TASK-P04](TASK-P04.md) owns G5 and TASK-039 through TASK-048. [TASK-P05](TASK-P05.md) owns G6 and TASK-049 through TASK-060.

Checkpoint on 2026-10-04: 22 Done; 14 In progress; 0 Blocked; 2 Ready; 22 Todo. New feature implementation has not started.

[TASK-P01](../active/TASK-P01.md) coordinates all 60 implementation tasks. Individual tasks control detailed acceptance. P01 remains open through TASK-021 and does not block its children.

The user has supplied the actual model package at `ops/resources/ENE/` and X excerpts at `ops/resources/x-posts.md`. There is no remaining missing-model blocker. Use **cyber legs**, the user's selected variant, as the baseline; preserve both PMX originals and address the known sphere-texture gaps during import. A licensed sample can support runtime development while Ene is prepared. Final avatar acceptance and recordings must use cyber legs.

## Work order

Read **TASK-P01** at the start of each implementation session and reconcile the task rows with existing evidence before choosing work. TASK-001 is already Done; continue the active kit tasks according to their acceptance gaps and dependencies. These are work branches, not a request to spawn agents.

G4 is complete for its recorded local scope. Use TASK-P03 for its evidence and explicit device limits.

For G5, start TASK-039. For G6, start TASK-049. Follow child dependencies after these independent entry points.

Physical diagnosis in TASK-056 follows inspector acceptance. Do not alter tracking parameters before that diagnosis. TASK-060 requires the G5 handoff.

**TASK-022** is Done; continue **TASK-023** auditions and the dependency-ready voice work. Three functional English-reference conversions are available. Live performance and final voice fit remain untested. TASK-024's long-unexplained timing variability is resolved as [hybrid-core placement](../../reports/voice-llvc-hybrid-cores.md), but its paced streaming proof [passed only once and does not reproduce under ordinary load](../../reports/voice-combined-workload.md); its combined-workload verdict is recorded as a measured defect. The avatar is unaffected by the converter and needs no pinning. The conditional A100 option is currently described as VPN-accessible vLLM API access; its actual voice capabilities remain unknown.

- Avatar branch: 001 + 002 → 004 → 005 → 006 → 007.
- Runtime branch: 002 → 003 → 008 + 009 → 010 → 011 → 012 → 013 → 015 → 016.
- Motion investigation: 004 + 005 → 014; independent of live tracking.
- Output and handoff: 016 + 002 → 017; 007 + 017 → 018; 015 + 016 + 017 + 026 → 019; 007 + 012 + 013 + 018 + 019 → 020; 007 + 014 + 018 + 019 + 020 + 028 + 038 + 048 + 060 → 021.
- Website resources: 001 → 029 → 030; 030 → 031 + 032; 032 → 033 + 034 + 035; 031 + 032 + 033 + 034 + 035 → 036 → 037 → 038.
- Voice: 022 → 023; 003 + 022 → 024; 017 + 024 → 025; 015 + 023 + 024 + 025 → 026; 023 + 024 → 027; 007 + 018 + 019 + 020 + 026 + 027 → 028.

Full dependencies in each task are authoritative. P0 identifies required delivery work; TASK-014 is P1 because VMD playback is not necessary for live tracking, but its bounded compatibility report is still included in the handoff.

TASK-027's training is conditional: close with evidence that an existing voice fits, or with an accepted trained voice. G1/G2 remain local; G3 remote audio must be explicitly identified. Required G3 output is OBS recording/livestreaming; an open-source virtual microphone for call apps is a separately reported compatibility investigation in TASK-025.

## Task index

| Task | Title | Goal | Dependencies | Status |
| --- | --- | --- | --- | --- |
| [TASK-001](../archived/TASK-001.md) | Audit Ene variants, texture gaps and attribution | G1 | None | Done |
| [TASK-002](../archived/TASK-002.md) | Select and provision a reproducible open source toolchain | G1, G2 | None | Done |
| [TASK-003](../active/TASK-003.md) | Prove local webcam-to-avatar feasibility on the laptop | G2 | TASK-002 | In progress |
| [TASK-004](../archived/TASK-004.md) | Import Ene and preserve an editable source scene | G1 | TASK-001, TASK-002 | Done |
| [TASK-005](../archived/TASK-005.md) | Prepare Ene's humanoid rig and deformation | G1 | TASK-004 | Done |
| [TASK-006](../archived/TASK-006.md) | Map and repair Ene facial expressions | G1, G2 | TASK-005 | Done |
| [TASK-007](../archived/TASK-007.md) | Tune appearance and export the reusable Ene avatar | G1 | TASK-005, TASK-006 | Done |
| [TASK-008](../archived/TASK-008.md) | Build the VRM viewer and avatar profile loader | G2 | TASK-003 | Done |
| [TASK-009](../active/TASK-009.md) | Implement camera capture and bounded tracking workers | G2 | TASK-003 | In progress |
| [TASK-010](../active/TASK-010.md) | Implement calibrated head and face retargeting | G2 | TASK-008, TASK-009 | In progress |
| [TASK-011](../active/TASK-011.md) | Implement torso and arm motion for seated performance | G2 | TASK-008, TASK-009, TASK-010 | In progress |
| [TASK-012](../active/TASK-012.md) | Implement wrist and visible finger tracking | G2 | TASK-009, TASK-011 | In progress |
| [TASK-013](../active/TASK-013.md) | Implement standing and visible full-body movement | G2 | TASK-011, TASK-012 | In progress |
| [TASK-014](../archived/TASK-014.md) | Validate the supplied VMD and document motion preview compatibility | G1 support | TASK-004, TASK-005 | Done |
| [TASK-015](../active/TASK-015.md) | Build calibration, settings and everyday controls | G2 | TASK-010, TASK-011, TASK-012, TASK-013 | In progress |
| [TASK-016](../archived/TASK-016.md) | Create clean landscape and portrait output views | G2 | TASK-008, TASK-015 | Done |
| [TASK-017](../active/TASK-017.md) | Set up OBS capture, streaming scenes and virtual camera | G2 | TASK-002, TASK-016 | In progress |
| [TASK-018](../active/TASK-018.md) | Deliver landscape and portrait recordings with audio | G2 | TASK-007, TASK-017 | In progress |
| [TASK-019](../archived/TASK-019.md) | Package local launch, offline assets and beginner documentation | G2 | TASK-015, TASK-016, TASK-017, TASK-026 | Done |
| [TASK-020](../archived/TASK-020.md) | Validate performance, recovery and local-only operation | G2 | TASK-007, TASK-012, TASK-013, TASK-018, TASK-019 | Done |
| [TASK-021](../active/TASK-021.md) | Complete Ene end-to-end acceptance and handoff | G1, G2, G3, G4, G5, G6 | TASK-007, TASK-014, TASK-018, TASK-019, TASK-020, TASK-028, TASK-038, TASK-048, TASK-060 | In progress |
| [TASK-022](../archived/TASK-022.md) | Audit and provision the open source voice-conversion toolchain | G3 | None | Done |
| [TASK-023](../active/TASK-023.md) | Audition English character voices and choose contrasting presets | G3 | TASK-022 | In progress |
| [TASK-024](../active/TASK-024.md) | Benchmark laptop conversion and the conditional A100 path | G3 | TASK-003, TASK-022 | In progress |
| [TASK-025](../active/TASK-025.md) | Route converted speech into OBS and calibrate lip sync | G3 | TASK-017, TASK-024 | In progress |
| [TASK-026](../active/TASK-026.md) | Add voice profiles, audition controls and reliable startup | G3 | TASK-015, TASK-023, TASK-024, TASK-025 | In progress |
| [TASK-027](TASK-027.md) | Produce an original English character voice if auditions need it | G3 | TASK-023, TASK-024 | Todo |
| [TASK-028](TASK-028.md) | Validate live character voice with Ene and hand off the workflow | G3 | TASK-007, TASK-018, TASK-019, TASK-020, TASK-026, TASK-027 | Todo |
| [TASK-029](../archived/TASK-029.md) | Verify web authoring sources and provision the render toolchain | G4 | TASK-001 | Done |
| [TASK-030](../archived/TASK-030.md) | Prove transparent animation delivery and lightweight budgets | G4 | TASK-029 | Done |
| [TASK-031](../archived/TASK-031.md) | Author the full-body VMD-informed homepage greeting | G4 | TASK-030 | Done |
| [TASK-032](../archived/TASK-032.md) | Author the shared desk pose and animated normal expression | G4 | TASK-030 | Done |
| [TASK-033](../archived/TASK-033.md) | Author the animated confused desk expression | G4 | TASK-032 | Done |
| [TASK-034](../archived/TASK-034.md) | Author the animated surprised desk expression | G4 | TASK-032 | Done |
| [TASK-035](../archived/TASK-035.md) | Author the animated excited desk expression | G4 | TASK-032 | Done |
| [TASK-036](../archived/TASK-036.md) | Produce all five web media families and their manifest | G4 | TASK-031, TASK-032, TASK-033, TASK-034, TASK-035 | Done |
| [TASK-037](../archived/TASK-037.md) | Build the local web showcase and reusable resource player | G4 | TASK-036 | Done |
| [TASK-038](../archived/TASK-038.md) | Validate web resources and deliver the G4 integration kit | G4 | TASK-037 | Done |
| [TASK-039](TASK-039.md) | Define shared studio views and model contracts | G5 | None | Ready |
| [TASK-040](TASK-040.md) | Separate avatar preparation from selection commit | G5 | TASK-039 | Todo |
| [TASK-041](TASK-041.md) | Implement the local model repository | G5 | TASK-039 | Todo |
| [TASK-042](TASK-042.md) | Inspect VRM structure capabilities and terms | G5 | TASK-040 | Todo |
| [TASK-043](TASK-043.md) | Build the import preview and save flow | G5 | TASK-041, TASK-042 | Todo |
| [TASK-044](TASK-044.md) | Commit model selection and report output state | G5 | TASK-040, TASK-041 | Todo |
| [TASK-045](TASK-045.md) | Build library cards and entry management | G5 | TASK-043, TASK-044 | Todo |
| [TASK-046](TASK-046.md) | Implement original export and portable backups | G5 | TASK-041, TASK-042 | Todo |
| [TASK-047](TASK-047.md) | Verify library recovery performance and appearance | G5 | TASK-045, TASK-046 | Todo |
| [TASK-048](TASK-048.md) | Deliver the library guide and G5 evidence | G5 | TASK-047 | Todo |
| [TASK-049](TASK-049.md) | Add task diagnostic envelopes and timing | G6 | None | Ready |
| [TASK-050](TASK-050.md) | Expose solver rejection reasons without behavior changes | G6 | TASK-049 | Todo |
| [TASK-051](TASK-051.md) | Build the matched camera overlay and live controls | G6 | TASK-039, TASK-049, TASK-050 | Todo |
| [TASK-052](TASK-052.md) | Build estimated body and hand views | G6 | TASK-051 | Todo |
| [TASK-053](TASK-053.md) | Implement bounded traces and deterministic replay | G6 | TASK-049, TASK-050 | Todo |
| [TASK-054](TASK-054.md) | Compare canonical motion with both avatars | G6 | TASK-040, TASK-050, TASK-052, TASK-053 | Todo |
| [TASK-055](TASK-055.md) | Verify inspector performance and visual clarity | G6 | TASK-051, TASK-052, TASK-053, TASK-054 | Todo |
| [TASK-056](TASK-056.md) | Diagnose live motion through all tracker stages | G6 | TASK-055 | Todo |
| [TASK-057](TASK-057.md) | Evaluate and correct measured task scheduling faults | G6 | TASK-056 | Todo |
| [TASK-058](TASK-058.md) | Evaluate measured motion corrections | G6 | TASK-056, TASK-057 | Todo |
| [TASK-059](TASK-059.md) | Accept motion corrections and state sensing limits | G6 | TASK-057, TASK-058 | Todo |
| [TASK-060](TASK-060.md) | Verify the combined studio and deliver G6 | G6 | TASK-048, TASK-059 | Todo |

## New work dependencies

- G5: 039 → 040 + 041; 040 → 042; 041 + 042 → 043 + 046; 040 + 041 → 044.
- G5 delivery: 043 + 044 → 045; 045 + 046 → 047 → 048.
- G6: 049 → 050; 039 + 049 + 050 → 051 → 052; 049 + 050 → 053.
- G6 comparison: 040 + 050 + 052 + 053 → 054; 051 + 052 + 053 + 054 → 055 → 056.
- G6 correction: 056 → 057; 056 + 057 → 058; 057 + 058 → 059; 048 + 059 → 060.

## Completion rules

Close P04 after TASK-048. Close P05 after TASK-060. TASK-021 consumes both handoffs without a controller dependency cycle.

Conditional experiments require an evidence-backed verdict. An inapplicable experiment can finish with unchanged behavior. Missing physical evidence cannot satisfy diagnosis or acceptance.

For website resources, maintain TASK-P03 alongside this index and TASK-P01. Close TASK-P03 after TASK-029 through TASK-038 have evidence and G4 is handed to TASK-P01; TASK-021 consumes TASK-038 and remains the overall gate. Media size/browser claims require measurements, and five posters do not satisfy five animated resources.

For voice work, maintain TASK-P02's checkpoint, decisions and blockers alongside this index and TASK-P01. Close TASK-P02 after TASK-022 through TASK-028 are evidenced and the G3 handoff is recorded in TASK-P01; TASK-021 remains the combined delivery gate.

Each task contains its intended outcome, implementation work, dependencies, estimate and checkable acceptance criteria. Estimates are planning ranges, not elapsed-time commitments; repairs and hardware findings can change them.

- Preserve original source files and the user's brief. Keep character assets and recordings out of code distribution.
- Record exact changed artifacts and meaningful verification evidence before marking a task done.
- A licensed sample is a development aid. G1 and G2 must ultimately be accepted using **Ene**.
- A working head-tracking preview does not close the movement requirement: arms, visible hands and standing behavior are required.
- A render alone does not close the production workflow: playable portrait/landscape video with audio and demonstrated OBS Virtual Camera are required.
- Do not mark unavailable live-camera checks as passed. Keep defects, missing measurements and genuine limitations explicit.
- G3 requires actual English auditions, the user's voice preference and measured combined performance; a downloadable model or converter screenshot does not close it.
- TASK-021 is the final acceptance gate. It maps G1 through G6 to artifacts and evidence.
- Update TASK-P01 and this index when child task status changes and before session handoff. Close TASK-P01 only after the in-scope implementation tasks and TASK-021 acceptance are complete.
