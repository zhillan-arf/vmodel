# Remaining human checks

[TASK-061](../ops/tasks/backlog/TASK-061.md) collects the tests that need a person.
The original tasks retain their acceptance requirements.
Automated test results do not establish physical or human acceptance.

## Model library and inspector

1. Review Ene and Rei in each required pose, expression, and framing setting.
2. Review the library and tracking images at 390, 768, and 1440 pixels.
3. Check native browser zoom at 200%.
4. Check keyboard order and screen-reader announcements.
5. Follow the [model library guide](model-library.md) through backup and restore in a new profile.
6. Record findings in TASK-061.

The [library report](../ops/reports/library-acceptance.md) identifies the required library states.
The [inspector report](../ops/reports/tracking-inspector-acceptance.md) identifies the nine tracking states.
Human review must confirm model appearance, readable reasons, and distinct observation and accepted-motion layers.

## Physical motion

After TASK-055 acceptance, follow the [physical test guide](tracking-check.md).
Test seated, standing, and close views with both mirror settings.
Record the first failed stage before a correction experiment.
Repeat each baseline and candidate three times under the same conditions.

Keep personal recordings under `ops/reports/local/`.
Commit aggregate measurements only.

## Voice selection and audio

All `.cmd` launchers are in `deploy`.

1. Run `Start Voice Auditions.cmd`.
2. Listen to the converted voices and the reference.
3. Select a default voice and alternatives.
4. Record the reason for each rejected voice.

Use the [audition passage](voice-audition-passage.md) for a consistent comparison.
TASK-023 and TASK-027 need these results.
TASK-024 through TASK-026 also need microphone, audio-route, and physical synchronization tests.
Existing file-conversion results do not establish live audio acceptance.

## OBS Virtual Camera

The previous registration attempt ended after the user canceled the Windows permission prompt.
Do not repeat that prompt automatically.

1. When ready, run `Install OBS Camera.cmd`.
2. Complete the Windows permission step.
3. Test OBS Virtual Camera in the intended consumer application.
4. Record the result in TASK-017.

## Final recordings

After motion and voice acceptance, follow the [recording guide](recording.md).
Record one landscape clip and one portrait clip with the Ene avatar and selected voice.
Check the movement, intelligible audio, synchronization, and playback.
Record the results in TASK-018 and TASK-028.
Short silent test clips do not satisfy these requirements.

## Automated verification

Run `npm run verify` for the software checks.
The command does not test physical gestures, voice preference, device latency, or final recordings.
A passing software result does not close TASK-061 or final studio acceptance.
