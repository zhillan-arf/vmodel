# TASK-027: Produce an original English character voice if auditions need it

- Status: Todo
- Priority: P0
- Goal: G3
- Depends on: TASK-023, TASK-024
- Estimate: S decision; M-L if triggered (2-5 days, excluding recording acquisition)
- Specification: [Live English character voice](../../specs/voice-conversion-plan.md)

## Outcome

Close the voice-fit gap with suitable expressive English material, or record why existing voices already satisfy it.

## Work

- If TASK-023 identifies a fitting licensed live voice, record the exact accepted checkpoint/preset and mark custom training unnecessary with evidence.
- Otherwise prepare an original cheerful English voice brief and 10-30 minutes of clean varied speech from an explicitly licensed source or willing performer. Record the grant for training, intended output use and weight distribution. Do not silently buy or scrape a performer pack.
- Run a bounded Applio/RVC training experiment on the available A100 after access and environment checks. Pin data splits, preprocessing, pretrained assets, config, seed, checkpoint and index; hold out phrases for evaluation.
- Export to the chosen live client and test normal speech, excited reactions, laughter and consonants on both held-out source samples and the user's microphone.
- Compare to the original auditions, select useful alternatives, and update profiles/model manifest. A trained file alone is not acceptance; record quality and live-latency evidence in voice-auditions.md.

## Acceptance criteria

- [ ] Either a documented existing voice meets the fit requirement or a reproducible original English checkpoint passes the audition criteria with the user's preference recorded.
- [ ] Training data and weight terms are explicit; appropriate notices and excluded asset locations are recorded.
- [ ] Any trained model works in the selected live client and passes its applicable latency/quality gates; unavailable data/access or rejected fit keeps the task open.

## Implementation notes

Training is conditional, but a documented disposition is required before G3 acceptance.

When completing this task, record changed artifacts, exact validation commands/results or manual evidence, and unresolved limitations. Leave unperformed checks unchecked.

