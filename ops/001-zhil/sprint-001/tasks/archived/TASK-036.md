# TASK-036: Produce all five web media families and their manifest

- Status: Done
- Priority: P0
- Goal: G4
- Controller: [TASK-P03](TASK-P03.md)
- Depends on: TASK-031, TASK-032, TASK-033, TASK-034, TASK-035
- Estimate: S-M (1-2 days plus rendering)
- Specification: [Web character resources](../../specs/web-character-resources-plan.md)

## Outcome

Deliver five finished resources, each with large/small transparent animation renditions, posters and reproducible source.

## Work

- Bake/cache secondary motion with warm-up and stable frame evaluation; retain editable actions and record seeds, versions, cameras, frame ranges and color settings. Render all five character-only RGBA master sequences.
- Encode approved large/small VP9 alpha WebM and animated WebP for all five IDs; export transparent static WebP posters plus PNG fallbacks. No audio tracks or burned-in webpage UI.
- Generate the versioned public manifest described in the proposal, using measured duration/FPS/dimensions/bytes/hashes and normalized bounds/anchors; retain source/encoder provenance in a private build manifest.
- Validate decoded alpha on black/white/checkerboard, animation duration, family parity, beginning/end seams, consistent desk framing, recognizable expressions and proposed transfer budgets.
- Stage only media/manifest/posters in web-showcase/public/ene/ and update ignore/staging rules before production. Keep private scenes, source models and master PNG sequences outside served/distributed code paths.
- Write ops/001-zhil/sprint-001/reports/web-resource-production.md with per-rendition measurements, commands, final visual evidence and explicit budget deviations; provide commands to rebuild one resource.

## Acceptance criteria

- [x] Exactly five logical resource IDs exist, each with large/small WebM and animated WebP plus static WebP/PNG posters.
- [x] All required files decode, retain transparency, match documented timing/framing and pass meaningful visual/loop checks.
- [x] Manifest byte counts and SHA-256 values match actual files; approved size targets or explicit reviewed revisions are recorded.
- [x] Editable sources and deterministic bake/render/encode recipes are preserved; staged media exclude PMX/VMD/Blend/VRM and master sequences.

## Implementation notes

Completed 2026-09-12. [Production measurements and recipe](../../reports/web-resource-production.md), [final visual review](../../reports/web-resource-production-review.md), [exact staging/decode/hash audit](../../reports/web-production-audit.json), [single-resource rebuild proof](../../reports/web-production-rebuild.json), and [rebuild/local launch guide](../../reports/web-resource-rebuild.md). The final [manifest](../../../../../web-showcase/public/ene/manifest.json) advertises exactly five resource IDs. There are 408 private RGBA masters and 42 staged files totaling 26,066,834 bytes; all media/poster budgets pass without revision. All animated frames and posters were actually decoded with alpha. The complete large WebM set is 1,595,481 bytes. Original PMX/VMD and accepted G1 Blend/VRM hashes remain unchanged. Final UI/browser performance and unavailable real-device checks remain TASK-037/038.

Planned paths are not completed artifacts. Record exact output paths, commands/results and visual evidence before marking Done. Preserve original assets and existing work; keep source and generated character media separate from code distribution. Update TASK-P03 and the backlog after status changes, and summarize material shared dependencies in TASK-P01.

