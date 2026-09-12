# TASK-018: Deliver landscape and portrait recordings with audio

- Status: Todo
- Priority: P0
- Goal: G2
- Depends on: TASK-007, TASK-017
- Estimate: S-M (0.5-1.5 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Prove that the user can produce stream-style footage and short videos.

## Work

- Create landscape and portrait OBS profiles with 30 fps baseline and unclipped avatar framing.
- Record at least 60 seconds per orientation with speech, blinks, head turns and arm/hand gestures.
- Use a recoverable recording workflow and produce an MP4 deliverable; check encoder/container compatibility with a local player/editor.
- Check microphone level, lip/audio alignment and clean output; document cropping and file locations.
- Keep raw camera footage and produced clips outside code distribution; write docs/recording.md.

## Acceptance criteria

- [ ] A playable 16:9 clip and 9:16 MP4 both show animated avatar and intelligible audio.
- [ ] Both final recordings use actual Ene; sample clips alone do not close this task or G2.
- [ ] The user has clear instructions to make another clip without developer tools.

## Implementation notes

Portrait baseline is 720x1280; 1080x1920 is conditional on measured headroom. No social upload is performed.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.
