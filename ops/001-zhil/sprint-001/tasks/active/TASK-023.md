# TASK-023: Audition English character voices and choose contrasting presets

- Status: In progress
- Priority: P0
- Goal: G3
- Depends on: TASK-022
- Estimate: M (1-2 days)
- Specification: [Live English character voice](../../specs/voice-conversion-plan.md)

## Outcome

Let the user hear the same English performance in several voices and select a cheerful default based on actual fit.

## Work

- Create the local 60-90 second audition passage from the spec and record normal speech, expressive speech, laughter, quiet phrases and spontaneous conversation with the user.
- Audition at least three distinct timbres: bright/cheerful, soft/gentle and cool/lower; include a natural English feminine control. Use compatible licensed candidates; do not count pitch offsets as different timbres.
- Evaluate CHIHAYA's crisp/soft/cool models as candidates, observing their no-F0/index-ratio-zero requirements. Test English and smaller live buffers; do not adopt the creator's multi-second buffering as conversational acceptance.
- If no usable English control checkpoint is available, make a bounded LJ Speech baseline training run through the audited toolchain, using the A100 when accessible; this is separate from final expressive voice training in TASK-027.
- Produce level-matched A/B files and retain originals locally. Score intelligibility, naturalness, character fit, effort and difficult sounds; do not assume source pitch or an exact character identity.
- Run a live conversation with the best two and record the user's preference in ops/001-zhil/sprint-001/reports/voice-auditions.md. If no voice meets the quality gate, complete the audition report with that explicit result and trigger TASK-027.

## Acceptance criteria

- [ ] At least three different timbres and an English control have comparable audio evidence and identifiable model/settings provenance.
- [ ] English consonants, reactions and normal speaking comfort are evaluated, not inferred from Japanese demos.
- [ ] The user's preferred default/alternatives are recorded, or a specific failed-fit report and custom-training brief are handed to TASK-027; unheard voices are not declared accepted.

## Implementation notes

This is implementation work, not completed by the research/design document.

When completing this task, record changed artifacts, exact validation commands/results or manual evidence, and unresolved limitations. Leave unperformed checks unchecked.

## Current implementation checkpoint — 2026-09-12

- Built a local reference comparison room at `http://127.0.0.1:5081/` with bright/soft/cool conversions of the same licensed English performance, source comparison, one-player-at-a-time playback, stop/rewind, provisional ratings and local save/export. Model weights are not exposed by its allowlist server; microphone/camera use and external connections are disabled.
- Prepared four RMS-matched 40 kHz WAVs under `assets/voice/auditions/reference-v1/`, retaining all originals. [Audition report](../../reports/voice-auditions.md), [reference manifest](../../reports/voice-reference-auditions.json), [page](../../../../../scripts/voice/audition/index.html), [server](../../../../../scripts/voice/serve_auditions.py), [operator passage](../../../../../docs/voice-audition-passage.md).
- Two Python validation/HTTP tests passed. Chrome/Playwright verified comparison playback, correct durations, no automatic playback, no concurrent players, stop/rewind, provisional notes/restoration, no horizontal overflow on mobile, zero camera/microphone calls, zero external requests and zero browser errors. [Browser evidence](../../reports/voice-audition-ui-smoke.json). Test notes were isolated and never written to the user's ratings file.
- All acceptance boxes remain open: this is an 8.397-second public-domain **reference**, not the user's required 60–90-second takes or a trained English-control target. User listening, meaningful timbre confirmation, speaking comfort, difficult sounds, actual control acquisition/training and live conversation still need evidence. No unheard voice is selected as a default.

## The listening room had no launcher — 2026-09-13

The handoff told the user to open `http://127.0.0.1:5081/` to choose a voice, and the audition server has run continuously since the session that started it. **Nothing could start it again.** `serve_auditions.py` was referenced only by its own test: no `.cmd` existed for it, so after a reboot the listening room would have been unreachable without developer tools.

That silently blocked this task's own criterion, which needs the user's preference, and by extension TASK-027's training decision.

**Start Voice Auditions.cmd** now starts the server and opens the page, matching the existing launcher pattern including the missing-environment guard. Both [remaining checks](../../../../../docs/remaining-checks.md) and the [voice quickstart](../../../../../docs/voice-quickstart.md) name it instead of a bare URL, and the documentation audit confirms the launcher exists and every link resolves.

Worth noting how it was missed: every automated check passed throughout, because the port was open and the page loaded. Nothing verifies that a service the documentation depends on can be *started* — only that it answers when already running. The gap was found by asking what a user would do after a reboot.

### Voice setup also needed a launcher — 2026-09-13

Following the same journey further found the next link in the chain. `Setup VModel.cmd` provisions only the studio: npm dependencies, runtime assets and the build. It does **not** set up voice. The voice launchers correctly detected the missing environment, but their guard pointed at `docs/voice-setup.md`, whose instruction was `python scripts/voice/provision.py` in PowerShell — a developer command in a kit where everything else is a double-click.

So a user on a fresh machine could reach the voice step and be told, in effect, to open a terminal.

**Setup Voice.cmd** now wraps the same provisioning, checks that Python is present with a message naming what to install, and points at `Start Voice Auditions.cmd` when it finishes. Both voice launchers name it in their guard, the setup guide leads with it, and the README lists both setup steps so the split between studio and voice provisioning is visible rather than implied.

Verified: the documentation audit reports no missing launchers and no unknown addresses across 69 documents, and all 24 README links resolve.

This is the fourth handoff gap found by walking the user's journey rather than testing code, after the listening room, the showcase and the README itself. The automated checks passed throughout each one.
