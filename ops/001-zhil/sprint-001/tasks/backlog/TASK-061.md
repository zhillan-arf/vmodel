# TASK-061: Complete human tests for studio acceptance

- Status: Ready
- Priority: P0
- Owner: User, with Codex test support
- Goal: G2, G3, G5, G6
- Depends on: None

## Outcome

Keep tests that need a person in one separate task.
Do not replace human review with automated results.
The original tasks retain their acceptance requirements.

## Work

1. Review the library images at widths of 390, 768, and 1440 pixels.
2. Review Ene and Rei with neutral poses, relaxed arms, expressions, and each framing setting.
3. Review all nine tracking states in the [inspector report](../../reports/tracking-inspector-acceptance.md).
4. Check text, contrast, keyboard order, and the distinction between observed and constrained motion.
5. Record the reviewer, date, browser, findings, and image paths.
6. After TASK-055 acceptance, perform the [physical test guide](../../../../../docs/tracking-check.md).
7. Record the first failed stage for each motion fault.
8. After each proposed correction, repeat the physical tests with the same settings.

Also test native browser zoom at 200% and screen-reader announcements.
Follow the [model library guide](../../../../../docs/model-library.md) through import, backup, and restore in a new profile.

## Checks transferred from implementation tasks

The user requested a separate task for human tests on 2026-10-04.
The implementation tasks retain their automated checks.
TASK-047, TASK-048, TASK-055, and TASK-060 retain the release requirements.

| Source task | Required human check |
| --- | --- |
| TASK-039 | Review the selected layout and model framing. |
| TASK-043 | Check screen-reader announcements, focus, and reduced motion during import and preview. |
| TASK-045 | Check cards and details at native 200% zoom and with keyboard navigation. |
| TASK-051 | Confirm that inspector pause preserves the physical camera stream and clean output. |
| TASK-051 | Check spoken joint announcements and the clarity of each diagnostic layer. |

Keep personal images and recordings under `ops/001-zhil/sprint-001/reports/local/`.
Commit aggregate results only.

## Acceptance criteria

- [ ] Human review covers U07 and U08 for the library and inspector.
- [ ] Physical tests cover seated, standing, and close views with both mirror settings.
- [ ] Results record camera dimensions, light, power, OBS state, browser, and model hashes.
- [ ] Required corrections have three physical repetitions and a measured verdict.
- [ ] TASK-047, TASK-055, TASK-056, and TASK-059 link the relevant results.
- [ ] A person completes the library guide without source edits.

## Other human tests

These tests retain their original acceptance requirements and task owners:

- Choose voice presets through the auditions for TASK-023 and TASK-027.
- Test the microphone, converted audio, and synchronization for TASK-024 through TASK-026.
- Complete the Windows permission step and consumer test for TASK-017.
- Record landscape and portrait clips with audio for TASK-018 and TASK-028.

See [the remaining checks](../../../../../docs/remaining-checks.md) for the launchers and guides.
Record each result in its original task.
Do not repeat the OBS permission prompt automatically.

- [ ] Voice preference and physical audio tests have recorded results.
- [ ] OBS Virtual Camera works in the intended consumer application.
- [ ] Final landscape and portrait recordings pass human review.
