# TASK-003: Prove local webcam-to-avatar feasibility on the laptop

- Status: Todo
- Priority: P0
- Goal: G2
- Depends on: TASK-002
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Measure the risky tracking/render/OBS combination early using a licensed sample avatar.

## Work

- Scaffold TypeScript/Vite application under src and add basic build/typecheck commands.
- Run locally provisioned MediaPipe face inference and VRM rendering; use a person-operated camera test when available.
- Spike worker frame transfer, GPU delegate and CPU/WASM fallback, measuring render and inference time independently.
- Capture a minimal clean preview in OBS at 720p/30 and record approximate combined load.
- Write ops/reports/feasibility.md with tested versions, settings, bottlenecks and a proceed/fix decision. If camera access is unavailable, mark live measurements pending rather than fabricating them.

## Acceptance criteria

- [ ] A live head or mouth signal visibly drives the sample avatar; a recorded fixture also exercises the pipeline.
- [ ] Worker behavior and fallback are evidenced; frame work does not accumulate indefinitely.
- [ ] A short combined OBS run supports the baseline or produces an actionable fix before expensive polishing.

## Implementation notes

No Ene-specific dependency. This spike is not completion of either user goal.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

