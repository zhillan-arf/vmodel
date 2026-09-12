# TASK-008: Build the VRM viewer and avatar profile loader

- Status: Todo
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

- [ ] A licensed sample loads, resizes and reloads without growing resources indefinitely.
- [ ] Manual pose/expression controls move the expected bones and shapes.
- [ ] Invalid files produce actionable errors; .vmd files are rejected as motion rather than accepted as avatars.

## Implementation notes

Develop with the sample; integrate and verify actual Ene after TASK-007.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

