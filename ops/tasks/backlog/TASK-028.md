# TASK-028: Validate live character voice with Ene and hand off the workflow

- Status: Todo
- Priority: P0
- Goal: G3
- Depends on: TASK-007, TASK-018, TASK-019, TASK-020, TASK-026, TASK-027
- Estimate: M (1-2 days)
- Specification: [Live English character voice](../../specs/voice-conversion-plan.md)

## Outcome

Prove the complete G3 workflow alongside the existing avatar and recording requirements.

## Work

- Run a thirty-minute session with Ene Cyber legs, real camera tracking, the selected voice and OBS. Measure local or selected remote path, memory/thermal trend, p50/p95 audio latency, render intervals, audio breakup and OBS drops.
- Produce at least 60 seconds each of portrait and landscape video containing intelligible cheerful English converted speech, expressions and movement, with <=80 ms residual lip/audio mismatch.
- Test three distinct voice presets, saved settings, mute, microphone disconnect, worker crash, invalid model and remote outage if applicable. Ensure no unconverted microphone reaches the recording on failures.
- Verify offline local voice after provisioning if supported; otherwise explicitly distinguish offline G1/G2 from the selected remote-dependent G3 voice. Check private transport and absence of camera uploads.
- Have the user follow docs/voice-quickstart.md from launcher to audition, selected voice, record, stop and restart; record preference and concrete troubleshooting limitations.
- Add the G3 evidence matrix to ops/reports/acceptance.md and link performance/audition/model/OBS evidence. External-call virtual-microphone support is a separate documented compatibility result.

## Acceptance criteria

- [ ] All G3 acceptance rows in the voice specification are evidenced with actual Ene and the user's selected voice.
- [ ] The thirty-minute soak, audio latency/jitter, original avatar performance and final clip sync gates pass; unresolved misses remain open.
- [ ] A beginner can reproduce the workflow and try alternative timbres, and the handoff accurately states local/remote and virtual-microphone limitations.
- [ ] No unperformed microphone, remote or subjective preference checks are marked passed.

## Implementation notes

This is implementation work, not completed by the research/design document.

When completing this task, record changed artifacts, exact validation commands/results or manual evidence, and unresolved limitations. Leave unperformed checks unchecked.

