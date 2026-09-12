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
- [ ] Stop and recenter are always available; manual expression controls do not fight automatic tracking.

## Implementation notes

Actual Ene default settings are finalized during TASK-021.

2026-09-12 checkpoint: [Studio/output report](../../reports/studio-output.md) records avatar/device/mode/format scoping, validated profile import/export, safe reset, manual expression transport and clean-view keyboard controls. Production browser restart checks and the current 58-test suite pass. First-time live calibration, physical camera switching and movement-quality acceptance remain open; this task stays active with its solver dependencies. Head movement range, mouth sensitivity and response speed are adjustable. Avatar reload/resource checks now pass in TASK-008.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

