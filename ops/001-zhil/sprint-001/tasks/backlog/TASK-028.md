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
- Add the G3 evidence matrix to ops/001-zhil/sprint-001/reports/acceptance.md and link performance/audition/model/OBS evidence. External-call virtual-microphone support is a separate documented compatibility result.

## Acceptance criteria

- [ ] All G3 acceptance rows in the voice specification are evidenced with actual Ene and the user's selected voice.
- [ ] The thirty-minute soak, audio latency/jitter, original avatar performance and final clip sync gates pass; unresolved misses remain open.
- [ ] A beginner can reproduce the workflow and try alternative timbres, and the handoff accurately states local/remote and virtual-microphone limitations.
- [ ] No unperformed microphone, remote or subjective preference checks are marked passed.

## Implementation notes

This is implementation work, not completed by the research/design document.

When completing this task, record changed artifacts, exact validation commands/results or manual evidence, and unresolved limitations. Leave unperformed checks unchecked.

## Automated guard on unperformed-check claims — 2026-09-13

The fourth criterion — that no unperformed microphone, remote or subjective preference check is marked passed — is now enforced by a check rather than by care alone. [audit_acceptance_claims.py](../../../../../scripts/audit_acceptance_claims.py) scans every ticked acceptance criterion across all task folders for language that only a person, a device or a remote service can honour, and reports any tick that makes such a claim without disclaiming it. [Evidence](../../reports/acceptance-claims-audit.json).

Current result across **41 tasks and 103 ticked criteria: one tick mentions physical work, and it is defensible.** TASK-025's component criterion contains the word "virtual-microphone" because the criterion is *about documenting that limitation*, not about exercising a microphone; its own text states the limitation is documented, external-call routing is explicitly unsupported, and nothing was installed or re-signed.

That single flag was worth having. The first version of the check reported it as undefended, and the correct response was to teach the check that a criterion can legitimately be about documenting a physical limitation — not to quietly untick a defensible box or loosen the physical-language patterns until nothing matched.

This is a **language scan, not a proof**. It cannot tell whether a check actually happened, only whether a tick claims one; a box could still be wrongly ticked in wording it does not match; and a tick that disclaims in words while overstating elsewhere would pass. It reduces the chance of an accidental overclaim after a long session of synthetic evidence, which is exactly when that mistake is easiest to make.

The criterion itself stays open: it belongs to TASK-028's final handoff, which needs the user's selected voice, actual Ene and the live workload.
