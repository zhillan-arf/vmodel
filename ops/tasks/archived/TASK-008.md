# TASK-008: Build the VRM viewer and avatar profile loader

- Status: Done
- Priority: P0
- Goal: G2
- Depends on: TASK-003
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Provide a stable reusable renderer before connecting the full solver.

## Work

- Load selected local VRM files through three-vrm and validate supported format/profile schema.
- Implement lighting, stable camera framing, bust/full-body views, resize handling and neutral reset.
- Use explicit runtime update order for humanoid pose, expressions and spring motion.
- Dispose GPU resources on avatar change; handle malformed models, missing required controls and WebGL context loss clearly.
- Keep local model files out of public bundles and restrict the local server to app assets.

## Acceptance criteria

- [x] A licensed sample loads, resizes and reloads without growing resources indefinitely.
- [x] Manual pose/expression controls move the expected bones and shapes.
- [x] Invalid files produce actionable errors; .vmd files are rejected as motion rather than accepted as avatars.

## Implementation notes

Develop with the sample; integrate and verify actual Ene after TASK-007.

2026-09-12 completion: verified on the final, permitted Ene Cyber legs model. [Viewer smoke](../../reports/viewer-smoke.json) records four loads with stable GPU counts (49 geometries, 69 textures, seven programs), rejection of VMD while retaining the working avatar, and graphics-context loss/restoration without reloading Ene. [Retarget fixtures](../../reports/retarget-fixture-smoke.json) exercise eight actual-model pose/expression cases; [output checks](../../reports/output-smoke.json) cover resizing and manual expression transport. The required-humanoid check rejects incomplete avatars before replacing the current one. `node scripts/viewer_smoke.mjs` passed with zero page errors; production build passed. TASK-003's live/OBS feasibility remains an integration check and is not claimed complete by this viewer result.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

