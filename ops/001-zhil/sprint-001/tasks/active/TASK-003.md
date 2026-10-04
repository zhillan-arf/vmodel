# TASK-003: Prove local webcam-to-avatar feasibility on the laptop

- Status: In progress
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
- Write ops/001-zhil/sprint-001/reports/feasibility.md with tested versions, settings, bottlenecks and a proceed/fix decision. If camera access is unavailable, mark live measurements pending rather than fabricating them.

## Acceptance criteria

- [ ] A live head or mouth signal visibly drives the sample avatar; a recorded fixture also exercises the pipeline.
- [x] Worker behavior and fallback are evidenced; frame work does not accumulate indefinitely.
- [x] A short combined OBS run supports the baseline or produces an actionable fix before expensive polishing.

## Implementation notes

No Ene-specific dependency. This spike is not completion of either user goal.

2026-09-12 checkpoint: [Feasibility report](../../reports/feasibility.md) consolidates real local SDK initialization/recovery, render-only measurements and native OBS capture evidence. Actual Ene is used under existing permission. [Installed SDK CPU diagnostic](../../reports/tracking-cpu.md) now verifies all three CPU tasks and seven synthetic bitmap results; the default GPU-to-CPU failure sequence and one pending frame have unit coverage. [Recording fixtures](../../reports/obs-recording.md) prove the renderer/file-audio/OBS path, without live ML or voice. The operator's live gesture check and full combined recording/latency evidence remain open.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

Positive-photo follow-up: [88 installed-SDK GPU/CPU results](../../reports/tracking-positive-fixture.md) include simultaneous face/pose/hand detections and exposed a real timestamp crash hidden by negative synthetic frames. The worker now rebases its SDK clock while preserving external epochs. All 63 tests/build/bundle checks passed after that fix. Positive-task cost and 18.79-second cold GPU inference are documented; this is not a live or combined workload verdict.

Combined-fixture follow-up: two actual Ene + installed face/pose worker + native OBS recording attempts produced approximately five measured seated minutes each before a strict geometry guard interrupted them. The [heartbeat investigation](../../reports/output-layout-heartbeat.md) isolated and fixed an exhausted keepalive request allowance; actual geometry remained unchanged and both attempts restored OBS successfully. The corrected publisher passed 12 focused tests, a 500-heartbeat browser regression, production build/typecheck and bundle audit. This supplies the specified actionable-defect evidence for the short combined criterion. It does not complete the 30-minute soak, live gestures or end-to-end latency acceptance.

