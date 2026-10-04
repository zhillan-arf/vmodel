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

**Manual expression controls do not fight tracking.** The blend takes `Math.max(manualFloor, trackedGoal)`, so a held manual expression sets a 0.75 floor without suppressing anything tracked. Four deterministic tests in [retarget-integration.test.ts](../../../../../tests/retarget-integration.test.ts) pin the behaviour:

- A held manual smile leaves tracked blinking and mouth opening fully alive: `blinkLeft`, `blinkRight` and `aa` all exceed 0.7 while `happy` is held.
- Tracking can exceed the manual floor rather than being clamped to it.
- Returning the control to Neutral releases the floor, decaying below 0.05.
- A held manual expression persists when face tracking goes stale, so losing the face does not drop a deliberate expression.

**Stop and Recenter are always available.** Verified present, enabled and not hidden in four states — before start, after a failed acquisition, while running, and after stop — across all four injected camera failures in [camera-denial-smoke.json](../../reports/camera-denial-smoke.json). No control in the studio is ever disabled, and Space stops from Clean view while Escape leaves it.

**Boundary:** this covers control availability and the manual/automatic blending rule. The remaining criterion — a first-time user reaching a calibrated moving sample without developer tools — is a person-following-the-guide check and stays open.

## Choosing an unusable avatar file — 2026-09-13

Selecting the wrong file is an ordinary beginner mistake, and [avatar_load_failure_smoke.mjs](../../../../../scripts/avatar_load_failure_smoke.mjs) drives three bad inputs through the real file input: a text file renamed `.vrm`, an empty file, and a glTF header with the body cut off. [Evidence](../../reports/avatar-load-failure-smoke.json).

In every case the working avatar is retained, rendering continues, the message names an action, no raw exception text appears, and a good file afterwards recovers without a reload.

**Defect found and fixed.** The load path reported failures with `String(error)`, which did two things to the user. It prefixed this application's own guidance with `Error:`, and for a malformed file it surfaced the parser's exception verbatim — the observed example being `RangeError: Offset is outside the bounds of the DataView`, which a beginner cannot act on. [load-failure.ts](../../../../../src/load-failure.ts) now keeps guidance that already names the file kinds and substitutes an actionable sentence otherwise, with four unit tests including one asserting the result never looks like raw exception text.

This is the third instance of the same defect shape this session, after the camera's `NotFoundError` and the microphone's erased failure reason: error handling that looks correct when read, and surfaces something useless when actually driven.

**Boundary:** three malformed inputs, not an exhaustive corpus, and it judges whether a message names an action rather than whether the wording is ideal. The remaining criterion — a first-time user reaching a calibrated moving sample without developer tools — still needs a person.

### The same defect in two more places — 2026-09-13

A deliberate sweep for `String(error)` reaching the status bar found two further sites beyond the avatar loader:

- **Loading a settings file.** A malformed file throws a JSON `SyntaxError`, which the user saw verbatim.
- **The prepared avatar missing on first run.** A failed fetch throws `TypeError: Failed to fetch`, shown as-is.

Both now use a shared `readableError(error, fallback)`: it keeps a message this application raised and substitutes an actionable sentence for a parser, fetch or platform exception. The settings path offers *"Choose a file this app saved with Save settings."*; the first-run path offers *"Run Setup VModel.cmd, or use Load another VRM."*

The guard is deliberately **narrow** — it matches only `vrm`, `pmx`, `vmd`, `avatar` and `settings`. An earlier draft also matched `file`, `camera` and `preparation`, which was unnecessary (every message this application raises already names one of the five) and actively harmful, since it would have let a platform error such as `Failed to fetch file` through as if it were guidance. A test now asserts exactly that case falls back.

Worker-level messages keep their raw detail: they are prefixed with context such as *"Tracking could not start:"* and are diagnostic rather than a user action, so removing the detail would cost more than it gained.
