# TASK-015: Build calibration, settings and everyday controls

- Status: In progress
- Priority: P0
- Goal: G2
- Depends on: TASK-010, TASK-011, TASK-012, TASK-013
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Make the app operable by someone without rigging knowledge.

## Work

- Provide select-avatar, camera start/stop, seated/standing calibration, recenter and quality controls.
- Add sensible defaults, clear tracking-state feedback, manual expressions and optional hotkeys.
- Persist versioned avatar-specific settings locally; validate imported profiles and provide reset defaults.
- Keep camera preview and diagnostics out of the clean output; explain face/hand framing in plain language.
- Test keyboard operation, camera switching, model switching and invalid/stale saved settings.

## Acceptance criteria

- [ ] A first-time user can get from launch to a calibrated moving sample without developer tools.
- [x] Settings survive restart and do not apply incompatible calibration silently to a different avatar/device.
- [x] Stop and recenter are always available; manual expression controls do not fight automatic tracking. Stop and Recenter were verified present, enabled and visible in **every** state across four failure cases — before start, after a failed acquisition, while running and after stop — in [camera-denial-smoke.json](../../reports/camera-denial-smoke.json); no control in the studio is ever disabled, and Space stops from Clean view. Four deterministic tests cover the manual/automatic interaction.

## Implementation notes

Actual Ene default settings are finalized during TASK-021.

2026-09-12 checkpoint: [Studio/output report](../../reports/studio-output.md) records avatar/device/mode/format scoping, validated profile import/export, safe reset, manual expression transport and clean-view keyboard controls. Production browser restart checks and the current 58-test suite pass. First-time live calibration, physical camera switching and movement-quality acceptance remain open; this task stays active with its solver dependencies. Head movement range, mouth sensitivity and response speed are adjustable. Avatar reload/resource checks now pass in TASK-008.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

## Manual expressions and control availability — 2026-09-13

**Manual expression controls do not fight tracking.** The blend takes `Math.max(manualFloor, trackedGoal)`, so a held manual expression sets a 0.75 floor without suppressing anything tracked. Four deterministic tests in [retarget-integration.test.ts](../../../tests/retarget-integration.test.ts) pin the behaviour:

- A held manual smile leaves tracked blinking and mouth opening fully alive: `blinkLeft`, `blinkRight` and `aa` all exceed 0.7 while `happy` is held.
- Tracking can exceed the manual floor rather than being clamped to it.
- Returning the control to Neutral releases the floor, decaying below 0.05.
- A held manual expression persists when face tracking goes stale, so losing the face does not drop a deliberate expression.

**Stop and Recenter are always available.** Verified present, enabled and not hidden in four states — before start, after a failed acquisition, while running, and after stop — across all four injected camera failures in [camera-denial-smoke.json](../../reports/camera-denial-smoke.json). No control in the studio is ever disabled, and Space stops from Clean view while Escape leaves it.

**Boundary:** this covers control availability and the manual/automatic blending rule. The remaining criterion — a first-time user reaching a calibrated moving sample without developer tools — is a person-following-the-guide check and stays open.
