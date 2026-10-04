# TASK-013: Implement standing and visible full-body movement

- Status: In progress
- Priority: P0
- Goal: G2
- Depends on: TASK-011, TASK-012
- Estimate: L (2-4 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Address the user's movement goal beyond a seated talking avatar.

## Work

- Add a standing calibration mode with head-to-feet framing guidance and an explicit mode switch.
- Solve hips, leg segments and knee bend planes; constrain root translation and ground/foot behavior.
- Use observed confidence for legs; keep stable planted/idle fallback when lower body is outside frame.
- Measure hands+standing task scheduling separately and offer a tested lower-cost preset.
- Record a movement checklist: lean, both arm raises, knee bends and small steps; distinguish limitations from failures.

## Acceptance criteria

- [ ] A person fully visible to the camera can demonstrate the prescribed movements with recognizable avatar response.
- [ ] No explosive knees, uncontrolled root drift or limb stretching occurs during occlusion/reacquisition.
- [x] Seated framing remains stable without inventing foot tracking; standing limitations are documented. With hips, knees, ankles and toes all clearly visible and moving for 240 frames, every leg and foot bone stays within **1e-6 rad of rest** in seated mode, while the identical input in standing mode does move them — a counter-check so the seated result is not vacuous. Across four phases of legs appearing and disappearing, hips and root drift stay below **1e-6** because seated never applies grounding. Standing limitations are documented for the user in [live-check.md](../../../../../docs/live-check.md) (simple grounding, feet not locked to the floor, jumps not captured reliably, hands behind the body unreliable) and measured in [performance.md](../../reports/performance.md) (full three-task tracking updates at roughly 2.2-2.5 Hz while drawing continues at 58 fps).

## Implementation notes

Required for release. Exact dance choreography and studio-quality full-body mocap are not claimed.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

## Occlusion and reacquisition stability while standing — 2026-09-13

A system-level test in [retarget-integration.test.ts](../../../../../tests/retarget-integration.test.ts) drives the solver in **standing** mode through four phases — knees hidden, restored, hips and knees hidden, restored — at 120 frames each, measuring continuously.

- **No explosive knees.** The worst knee rotation across every frame of all four phases stays under 135 degrees.
- **No uncontrolled root drift.** Maximum hip displacement from its pre-occlusion position stays under 0.5 units across the whole sequence.
- **No limb stretching.** Bone lengths for both lower legs, both feet and both arms are unchanged to ten decimal places from before occlusion to after reacquisition.

**Boundary:** synthetic landmark frames through the real solver, so this establishes the numeric stability the criterion names. It does **not** establish that a person moving in front of a camera produces recognisable standing motion, which is the separate first criterion and needs the operator. The criterion stays open pending that check.

## Seated framing and foot tracking — 2026-09-13

Two tests in [retarget-integration.test.ts](../../../../../tests/retarget-integration.test.ts) close the third criterion.

Seated mode gates out both leg solving and root grounding in the solver, and the tests confirm the effect on the rig rather than trusting the gate. With hips, knees, ankles and toes all clearly visible and oscillating for 240 frames, every leg and foot bone stays within **1e-6 rad of rest**. The same input under standing mode **does** move them, which is the counter-check that makes the seated result meaningful rather than a test that would pass against a solver doing nothing at all.

Across four phases of legs appearing and disappearing, hips and root drift both stay below **1e-6**, since seated never applies the grounding path that standing uses.

The remaining two criteria need a person: demonstrating the prescribed movements with recognisable response, and the occlusion behaviour whose numeric half was covered separately on 2026-09-13. Those stay open.
