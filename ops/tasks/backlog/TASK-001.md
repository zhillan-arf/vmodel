# TASK-001: Audit Ene variants, texture gaps and attribution

- Status: Ready; initial binary inspection completed during planning.
- Priority: P0
- Goal: G1
- Depends on: None
- Estimate: S (0.5-1 day)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Establish which files belong to Ene and which are motion/reference material before conversion.

## Work

- Preserve ops/resources/ene.vmd and verify its recorded SHA-256; produce ops/reports/asset-audit.md with file signatures, sizes and provenance.
- Audit the supplied ops/resources/ENE package and retain both PMX originals and readmes; use cyber legs as explicitly selected by the user and preserve Japanese filenames. No further model download is required.
- Confirm the initial counts in the specification with the import tools: both PMX 2.0 variants have 193 bones and 50 morph entries. Inspect weights, physics and duplicate morph names beyond the planning metadata check.
- Record missing active sphere maps s.bmp and spa-pi.bmp for repair in TASK-004. Record the normal variant's body01_s.bmp path separately as an optional-variant issue, not a cyber delivery blocker.
- Record the user's existing permission and attribution; keep asset distribution separate from application code.
- Preserve the reference analysis of ops/resources/x-posts.md: AITuberKit conversation, manual 3D work, and an incomplete 2D PSD workflow. Do not assume unseen replies or assign the unattributed excerpts to particular post URLs.

## Acceptance criteria

- [ ] The audit identifies both actual Ene PMX variants and all referenced textures, with each unresolved map assigned an explicit repair action; baseline variant is recorded.
- [ ] The VMD is classified as motion, including its differing embedded model name; originals are untouched.
- [ ] Reference availability and attribution are recorded; no repeated permission request is introduced.

## Implementation notes

The missing-model blocker was resolved by the user during planning. Bundled readmes credit yokkaulove and upstream contributors and prohibit redistribution; preserve their terms and keep model data out of code distribution. A licensed sample permits runtime tasks to proceed during Ene cleanup, but cannot certify Ene quality.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.
