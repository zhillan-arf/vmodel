# TASK-P01: Own implementation progress and delivery

- Status: In progress
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G1, G2, G3, G4, G5, G6
- Depends on: None to start; completion requires TASK-001 through TASK-062, including the TASK-021 acceptance gate.
- Estimate: Ongoing throughout implementation; included in delivery coordination.
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)
- Voice specification: [Live English character voice](../../specs/voice-conversion-plan.md)
- Implementation register: [Backlog index](../backlog/README.md)
- Voice controller: [TASK-P02](TASK-P02.md), coordinating TASK-022 through TASK-028 and the G3 handoff.
- Website specification: [Animated web character resources](../../specs/web-character-resources-plan.md)
- Website controller: [TASK-P03](../archived/TASK-P03.md), coordinating TASK-029 through TASK-038 and the G4 handoff.

## Outcome

Own the work from the current plan through delivery of the user's **Ene Cyber legs** avatar and working webcam-to-recording/streaming program. Maintain an accurate, resumable account of what is finished, what is active, what is blocked, and what should happen next.

This controller owns TASK-001 through TASK-062 across G1 through G6.
Children can start before this controller finishes.
TASK-061 collects the tests that need a person.

## Work

TASK-P03 maintains website-resource production, codec/quality measurements, showcase and browser acceptance. It closes after TASK-038 and its G4 handoff; TASK-021 consumes that evidence as the overall gate. G4 reuses the verified authoring subset without waiting unnecessarily for webcam/voice work.

TASK-P02 maintains the voice checkpoint and decisions. TASK-P01 coordinates G1 through G6. P02 closes after TASK-028; P01 remains open through TASK-021.

TASK-P04 maintains G5. TASK-P05 maintains G6. Both controllers supply evidence to P01 before the final acceptance gate.

- At the start of each implementation session, read this controller, the specification, the backlog index and relevant child tasks. Reconcile their recorded status with actual files and validation evidence before choosing the next dependency-ready task.
- Own execution, including installing/configuring the toolchain in TASK-002 and providing the everyday launcher in TASK-019. The user is not responsible for figuring out installations or rigging. Request their participation only for necessary interactions such as camera permission, calibration gestures, live acceptance or an installer prompt the assistant cannot handle.
- Keep individual task files authoritative for detailed status and acceptance evidence. Update their summaries in the backlog index and this controller together after task transitions, new blockers, material scope decisions and before handing off a session.
- Track statuses as Ready, Todo, In progress, Blocked or Done. Ready means dependencies are satisfied; Todo means waiting for dependencies. A task is Done only when its acceptance criteria have evidence, including required manual checks.
- For each blocker, record the affected tasks, concrete missing condition, evidence, unblock action and responsible party. Continue other dependency-ready work when possible. Do not treat a missing optional reference or incompatible VMD as a blocker for independent live-tracking work.
- Record decisions affecting architecture, dependency versions, performance targets, avatar variant or acceptance scope. Keep the specification and affected tasks consistent. Preserve cyber legs as the required variant and both source models unchanged.
- Track deliverables and measured results against G1 through G6.
- Require actual Ene movement and live voice evidence for their physical acceptance criteria.
- If implementation reveals missing work, add a clearly scoped follow-up task, link its dependencies and update this controller's scope/counts. Do not silently waive required acceptance criteria or expand into unrelated projects.
- End each implementation session with a checkpoint containing active work, artifact/evidence links, blockers and the exact next actions so another session can resume without reconstructing the conversation.
- Close this controller only after the in-scope child tasks and TASK-021 acceptance are complete and the user has the final model, launcher, quickstart, OBS setup and recording evidence.

## Current checkpoint

Date: 2026-10-05. Combined tracking software checks pass. Human acceptance remains open.

- Scope: 62 tasks, TASK-001 through TASK-062.
- Progress: 37/62 Done; 18 In progress; 1 Blocked; 1 Ready; 5 Todo.
- G5: [P04](TASK-P04.md) has library, preparation, selection, and backup code with synthetic browser evidence.
- G6: [P05](TASK-P05.md) has diagnostic, shared-solver, inspector, and replay code with component evidence.
- Storage and backup: TASK-041, TASK-044, and TASK-046 passed their software acceptance checks.
- Evidence: [implementation record](../../reports/studio-implementation.md) maps requirements and remaining checks.
- Blocker: TASK-056 needs actual camera movements after inspector acceptance.
- Model files: prepared Ene and Rei are available. The Windows reports record their actual hashes.
- Device work: Chrome and Edge pass model memory tests. Inspector speed comparisons pass. Human acceptance remains open in TASK-061.
- Corrections: TASK-057 through TASK-059 await physical diagnosis. Existing tracking thresholds remain unchanged.
- Replay: TASK-053 passed its recording and replay software checks.
- Release: TASK-041, TASK-044, and TASK-046 have complete storage, selection, and backup evidence. P04, P05, and TASK-021 remain open.
- Prior acceptance: earlier physical, voice, and recording gates retain their previous status.

### Next actions

1. Complete the human library and inspector checks in TASK-061.
2. Record those results in TASK-047, TASK-048, and TASK-055.
3. After inspector acceptance, perform the physical diagnosis for TASK-056.
4. Use the diagnosis to select and test correction experiments.

## Historical checkpoint

Last updated: 2026-09-13. **Two TASK-020 mechanisms are now identified.** A minimized Chrome window delivers zero animation frames (60.04 fps before, 0.00 fps minimized with `visibilityState` hidden, 59.91 fps restored), which reproduces the original 1 Hz-plus-blank-capture signature. Separately, both observed whole-system stalls occurred in runs containing an AC/DC power transition, with every other candidate ruled out by evidence captured at the stall instant. Standing also measures **60.61 fps on AC against 30.03 fps on battery**. The seated soak also passed a full 900-second window with the render gate passing, zero skipped OBS frames and zero blank captures. The unexplained LLVC timing variability is resolved as hybrid-core placement; the paced voice proof passed once on a quiet machine but fails reproducibly under ordinary desktop load, and TASK-024 now has its combined-workload verdict as a measured defect. For TASK-020, core placement is rejected as the cadence-collapse cause and window occlusion remains untested because neither probe managed to occlude the window; the collapse and blank-white captures are still unexplained. A broken production typecheck was found and fixed. No live, physical-device or listening acceptance changed.

- Overall: Implementation in progress. G1 reusable Cyber legs avatar and G4 website resources are delivered, with their specific evidence. VMD investigation, viewer, clean output and packaging are accepted. Native OBS capture, short landscape/portrait MP4 fixtures and positive GPU/CPU tracking have evidence. Tested local RVC character-voice conversion is too slow for live acceptance. Combined avatar/OBS measurement, physical gestures and final voice/recordings remain open. The [G1-G4 acceptance matrix](../../reports/acceptance.md) links delivered components and missing checks.
- Historical scope: 38 implementation tasks, TASK-001 through TASK-038.
- Historical progress: 22/38 Done; 14 In progress; 0 Blocked; 0 Ready; 2 Todo. Controllers are excluded. TASK-001/002, TASK-004 through TASK-008, TASK-014/016/019, TASK-022 and TASK-029 through TASK-038 are archived; TASK-P03 is also Done. `task_state.py` recomputes controller counts after transitions; `task_audit.py` checks them, lifecycle storage, the register, links and dependency cycles.
- Active focus: TASK-020 render/capture diagnosis, now with two mechanisms eliminated and the cause still open; TASK-024 physical/combined voice measurement after its paced proof passed; TASK-021 evidence collation. TASK-026 receiver restart reliability now has component evidence, while physical device/recovery gates remain. TASK-003/009, TASK-010 through TASK-013 and TASK-015 await physical camera/solver checks; TASK-017/018 retain final OBS/recordings; TASK-023 through TASK-026 retain voice preference, live speed, physical device/routing and sync acceptance.
- Model: User-selected `ops/001-zhil/sprint-001/resources/ENE/ENE Cyber legs ver.pmx` is available. The earlier missing-model blocker is resolved.
- Completed cleanup: Missing additive sphere maps `s.bmp` and `spa-pi.bmp` were explicitly disconnected during import; available diffuse textures and original source files were preserved. The [import report](../../reports/ene-import.md) records the decision.
- User participation: A live camera/gesture check has been requested for the preview at `http://127.0.0.1:5173/`; no result is recorded yet. Continue automated work while awaiting that check. Voice selection and final recordings also require real user participation.
- Windows interaction: The reviewed OBS Virtual Camera registration attempt returned “operation was canceled by the user.” Neither camera architecture is registered. The saved `Install OBS Camera.cmd` helper is available; do not automatically repeat the prompt. Window capture/recording work continues independently.
- Completed evidence: [Avatar validation](../../reports/ene-avatar-validation.md), [VMD compatibility](../../reports/ene-vmd-compatibility.md), [camera reliability](../../reports/camera-reliability.md), [studio/output validation](../../reports/studio-output.md), [viewer reload/recovery](../../reports/viewer-smoke.json), [model notices](../../reports/model-notices.md), and [retarget fixtures](../../reports/retarget-fixture-smoke.json). Final avatar hash remains unchanged. The last full unit run passed **80 tests**. Production build/typecheck and the 33-file avatar bundle audit pass, after a repository defect was fixed: `scripts/soak-health.mjs` had been added without the `.d.mts` declaration its sibling modules carry, which broke `tsc --noEmit`; [soak-health.d.mts](../../../../../scripts/soak-health.d.mts) was added and the test's discriminated-union access narrowed. Actual-Ene fixtures cover torso/head, arms, blink/mouth, palms/fingers, knees and loss; physical gestures remain unverified. [Positive-photo execution](../../reports/tracking-positive-fixture.md) exposed and fixed an SDK clock failure after face detection; 88 corrected GPU/CPU frames pass. The [camera watchdog](../../reports/camera-reliability.md) now allows 30 seconds after startup for cold positive inference, with 60-second initial limits unchanged.
- Additional integration evidence: [Native OBS lifecycle](../../reports/obs-window-lifecycle.md), [two short MP4 recordings](../../reports/obs-recording.md), [installed CPU tracking](../../reports/tracking-cpu.md), [2.25-second camera release after server loss](../../reports/server-stop.md), [launcher ownership/restart checks](../../reports/launcher-smoke.json), and [bundle boundary/notices](../../reports/bundle-audit.json). OBS input is window content; title matching does not prevent later tab changes. The beginner guides record this limitation.
- Existing artifacts: [Editable imported scene](../../../../../assets/work/ene/source.blend), [export working scene](../../../../../assets/work/ene/vrm-work.blend), [validated Ene VRM](../../../../../assets/avatars/ene.vrm), [avatar mapping](../../../../../config/avatars/ene.json), [conversion recipe](../../../../../docs/avatar-conversion.md), [launcher](../../../../../deploy/Start%20VModel.cmd), and [quickstart](../../../../../docs/quickstart.md). Avatar preparation and packaging are accepted; live output and combined handoff remain in progress.
- Open technical checks: Both corrected [900-second fixture windows](../../reports/combined-fixture-soak.json) were observed and OBS restored exactly, but capture/render acceptance failed. Seated draw delivery fell toward 1 Hz around 32.6 seconds; standing/hands produced 891 draws in 900 seconds. Three later OBS stills are entirely white, despite current geometry and continued worker/paint activity. The [heartbeat repair](../../reports/output-layout-heartbeat.md) remains validated; this is a separate unresolved failure under targeted diagnosis. [Receiver reconnect and launcher refresh](../../reports/voice-receiver-reconnect.md) now pass their component checks. [LLVC evidence](../../reports/voice-llvc-plan.md) preserves the initial slow runs, failed ONNX state parity and a subsequent exact eager repeat at compute RTF 0.301 with no missed deadlines and identical PCM. **That timing variability is now explained**: [hybrid-core placement](../../reports/voice-llvc-hybrid-cores.md) measured efficiency cores at 2.32x the per-call cost of performance cores, missing 200/200 deadlines against 0/200, all on DC power. The [paced 30-second proof](../../reports/llvc-paced-pcore-thread-dc-v1.json) passed once with the inference thread pinned but [does not reproduce under load](../../reports/voice-combined-workload.md). Combined voice performance, physical camera quality, Virtual Camera and final recordings remain open.

Task storage follows the user's instruction: current work in `ops/001-zhil/sprint-001/tasks/active`, finished work in `ops/001-zhil/sprint-001/tasks/archived`, and unstarted work in `ops/001-zhil/sprint-001/tasks/backlog`. Use `python scripts/task_state.py TASK-xxx "In progress"` or `Done` to move files and preserve Markdown links. The backlog index remains the complete cross-directory register. Early integrated implementations are active, not accepted; toolchain initialization and live evidence still gate their completion.

The subsequent [bounded capture diagnostic](../../reports/capture-animation-diagnostic.md) averaged 57.01 draws/s with visible Ene in canvas/OBS and identified its Iris Xe renderer. Its native-window helper matched no windows; the later [177-second passive control](../../reports/capture-passive-control.md) verifies the corrected native preflight and retains visible Ene at 57.82 draws/s after warm-up under observed AC power. Both use the same single viewer in Clean mode as the failed soak. [Power history](../../reports/capture-power-comparison.md) establishes a DC-to-AC change between the slow/fast LLVC tests without proving the cause; historical Chrome Energy Saver state is unavailable. Neither short capture check establishes a fix or long-run acceptance. [LLVC streaming preparation](../../reports/voice-llvc-streaming-plan.md) specifies a separate 16 ms input contract; three framing tests and the [isolated parity probe](../../reports/llvc-stream-adapter-eager-v1.json) pass exact 134,347-sample upstream output, EOF and reset checks. Independent paced proof remains before served integration.
- Voice: TASK-022 completed the pinned local RVC environment and three English-reference conversions; TASK-023 audition at `http://127.0.0.1:5081/` awaits preference feedback. RVC/ONNX/OpenVINO tests miss live deadlines; OpenVINO GPU output also fails numerical parity and has no listening acceptance. Voice Studio at `http://127.0.0.1:5082/` includes provisional presets and [explicit natural speech](../../reports/voice-natural-mode.md). Separate converted/natural receivers are installed in both OBS scenes; both remain idle/silent. Fifteen server/profile tests, two resampler tests, receiver checks and mocked browser workflows pass. Physical device/headphone checks, speech continuity, live timing and sync remain open. TASK-019 accepts the packaged controls/docs; TASK-025/026 retain live/device gates. User reports the A100 is likely an internal vLLM API over VPN. Its address/model are requested; API access does not establish a usable RVC backend or deployment permission. See [TASK-P02](TASK-P02.md).

- Website: G4 is 10/10 Done; TASK-038 and TASK-P03 are archived. The [final G4 handoff](../../reports/web-resource-acceptance.md) covers all 408 master frames, five measured/rebuildable media families, final website matrix and visual reviews. The 45-file isolated bundle has 11,725 bytes of gzipped JS/CSS. Emulated 10 Mbit/s / 100 ms cold animations appeared in 1531 ms as WebM and 1920 ms as WebP. Four 60-second playback checks passed; both WebM samples had zero measured-interval drops. The 602-second lifecycle check followed 20 complete-loop warm-up switches, with one active animation, constant DOM count and non-monotonic process memory. Real Safari/iOS/Android remain unverified. Production preview: `http://127.0.0.1:4180/`. See [TASK-P03](../archived/TASK-P03.md).

### Milestone tracker

| Milestone | Tasks | Current state | Required evidence |
| --- | --- | --- | --- |
| Asset/toolchain feasibility | 001-003 | 001/002 Done; 003 active | Asset audit, toolchain manifest, laptop feasibility report |
| Reusable cyber-legs avatar (G1) | 004-007 | Done; validated model and recipe available | Editable Blender source, mappings, validated VRM and appearance/rig checks |
| Live performance | 008-013 | 008 Done; 009-013 active, gestures unverified | Face, torso, arms, hands and standing behavior |
| Studio and recording | 014-018 | 014/016 Done; 015/017/018 active; short MP4 fixtures pass | VMD report, controls, clean output, OBS, landscape/portrait recordings |
| Packaging and local validation (G2) | 019-020 | 019 Done; 020 combined soak active | Launcher, offline/recovery/performance checks |
| Character voice (G3) | 022-028 | 022 Done; 023-026 active | English auditions, open-source stack, measured local/remote voice, presets, sync and final clips |
| Website resources (G4) | 029-038 | Done; G4 handed off to 021 | Five animated resources, source/recipe, measured codecs and local showcase |
| Combined handoff | 021 | Active evidence collation; live gates and 028 remain | G1/G2/G3/G4 evidence and beginner handoff |

### Historical next actions

1. Incorporate the pending physical-camera feedback into TASK-003/009/010-013/015. Use the [operator check](../../../../../docs/live-check.md); synthetic fixtures do not close live quality criteria. **All 17 open tasks are now user-gated.** Every remaining unchecked criterion needs the physical camera, the user's listening preference, the cancelled Virtual Camera permission prompt, or the two final recordings. [Remaining checks](../../../../../docs/remaining-checks.md) orders those four for the user and names which tasks each one closes.
2. TASK-020's instrumented soak has now run. **The seated phase passed its full 900-second window** at 58.48 fps median, frame interval p95 49.1 ms, **0 skipped OBS render and output frames of 27,002** and **0 blank captures of 31 samples**, with last-versus-first ratios of 0.996-1.004, so the 1 Hz collapse and blank captures did not reproduce under ordinary recorded load on battery. **The standing phase then closed the browser at roughly 55 seconds**, with no Chrome crash event in the Windows Application log and memory pressure plausible but unproven; that cause is not recorded as known. Steady-state hand inference measured 169-303 ms and a full three-task cycle 418-464 ms, roughly 2.2 Hz, which is a separate finding for TASK-012/013. OBS restored with no cleanup errors. A `--phase=<id>` selector was added so the standing workload can be reproduced with fresh browser state, and system-wide free memory is now sampled. [Analysis](../../reports/performance.md), [run evidence](../../reports/local/combined-soak/2026-09-12T14-15-58-634Z-0c607f43/report.json). Previously eliminated for the original failure: [core placement is rejected](../../reports/capture-core-placement.md); [window occlusion is untested](../../reports/capture-occlusion-investigation.md) because neither probe occluded the window.
3. The independently paced LLVC proof **passed once and does not reproduce**: [pcore-thread-dc-v1](../../reports/llvc-paced-pcore-thread-dc-v1.json) ran the full 30 seconds with 577/577 neural calls, 0 deadline misses and a modeled 310.94 ms signal start, but four further identical attempts failed at `ingress` after two calls under roughly 47% ambient load, and two combined runs with the real avatar failed on the first call. The avatar is unaffected either way. See [combined workload and reproducibility](../../reports/voice-combined-workload.md); the binding constraint is the four-packet / 64 ms ingress bound, which is smaller than one slow call. The RTF 1.222-versus-0.301 mystery is explained by [hybrid-core placement](../../reports/voice-llvc-hybrid-cores.md), not power: efficiency cores measured 2.32x slower per call and missed 200/200 deadlines, while performance cores missed 0/200, all on DC. Treat a P-core pin as required for any live LLVC route. Next: physical microphone/speaker measurement, listening acceptance and a combined avatar/OBS paced run, which is the central open risk because the avatar wants the same cores. Strict LLVC ONNX state parity still fails, so that graph stays unselected. Assess the explicit remote API address/model when provided, without assuming vLLM supports RVC.
4. Finish Virtual Camera after successful interactive registration and record the required one-minute converted-speech clips. Update the TASK-021 acceptance matrix with actual performance and operator results; retain unmet gates.

## Session and decision log

| Date | Event | Evidence / consequence | Next action |
| --- | --- | --- | --- |
| 2026-09-12 | Controller created at the user's request | Specification and 21 child tasks reviewed; no implementation marked complete | Begin with TASK-001 and TASK-002 when implementation starts |
| 2026-09-12 | Voice research/design added at the user's request | Added G3 and TASK-022 through TASK-028; linked voice profiles into 019 and voice acceptance into 021; original local avatar requirement retained | Start TASK-022 alongside the original asset/toolchain work |
| 2026-09-12 | Third workstream researched and planned | Added G4, TASK-P03 and TASK-029 through TASK-038; transparent rendered media selected; TASK-038 feeds TASK-021; existing kit implementation preserved | Begin TASK-029 when resource implementation starts |
| 2026-09-12 | Implementation and task-directory migration reconciled | TASK-001 and TASK-004 archived with evidence; 14 numbered tasks active; original PMX files preserved | Complete remaining task-specific acceptance checks before archiving further work |
| 2026-09-12 | First Ene export and synthetic camera pipeline validated | VRM renders/reimports; worker processes local frames; Stop releases synthetic camera. No real gesture or production recording acceptance claimed | Verify rig quality, recovery, privacy and real performance |
| 2026-09-12 | Camera reliability and local-network enforcement implemented | Startup races, stale replies and hung workers handled; resolution/TrackingFrame v1 added; 14 unit tests and 70-second recovery check pass | Physical camera and integrated performance acceptance remain open |
| 2026-09-12 | TASK-005/006/007 completed and archived | Final hash `3657b97928638e7ada5f6639141fb63f555912049a2c6ec217851001e322cbcb`; 53 mappings, 11 expressions, 13 poses, independent reimport and spring controls verified; recipe provided | TASK-014 is Ready; continue live tracking/output work |

Append substantive checkpoints here. Link actual artifact/report paths when they exist; distinguish planned evidence from completed validation. Keep the current checkpoint above concise and current rather than making the reader infer the latest state from the log.

2026-09-12 implementation checkpoint: TASK-014, TASK-022 and TASK-029/030 archived with task-specific evidence. Added scoped calibration/settings, resilient output reconnect, fixed landscape/portrait composition, same-frame world retargeting, palm/wrist association, phalanx limits, stable elbow/knee planes and bounded standing grounding. Fifty-five tests and eight actual-Ene fixture cases pass. TASK-023 is active; TASK-031/032 are ready. User clarified the tentative VPN/vLLM access path. No live gesture, voice preference, public stream or final creative-resource acceptance is claimed.

## Acceptance criteria

- [ ] Child task statuses, the backlog index and this controller agree; dependencies and blockers have been maintained throughout implementation.
- [ ] Every completed task links concrete artifacts and appropriate validation evidence; unperformed checks have not been marked passed.
- [x] G1 is delivered using Ene Cyber legs, with editable source, reusable VRM, mappings and conversion instructions.
- [ ] G2 is delivered with usable local camera tracking, required body/hand/standing behavior, OBS integration and landscape/portrait recordings with audio.
- [ ] G3 is delivered with an accepted cheerful English voice, alternative timbres, measured live performance and converted audio in both recording orientations.
- [x] G4 is delivered as five animated Ene website resources, including the VMD-informed greeting and four desk expressions, with measured transparent media, editable source and a runnable showcase accepted in TASK-038.
- [ ] TASK-021 is Done and its report covers G1 through G6.
- [ ] TASK-P04 and TASK-P05 have delivered their required evidence.
- [ ] No release-blocking defect remains unresolved.
- [ ] The final checkpoint links the model, app launcher, beginner documentation, OBS setup and acceptance evidence, and records known limitations.

## Implementation notes

This controller provides workflow ownership and persistent progress tracking. It does not create a background process or automatically run when no implementation session is active. Manage the existing scope autonomously within the user's authorization; this task does not request sub-agent delegation.


## Session checkpoint — 2026-09-13

**TASK-020 is complete and archived (22/38).** Three long-open mechanisms were resolved, six defects were found and fixed, and the automatable core of several movement criteria now has deterministic evidence. Every remaining gate needs the operator.

### Resolved mechanisms

| Question | Answer | Evidence |
| --- | --- | --- |
| Why did LLVC timing swing between RTF 1.222 and 0.301? | Hybrid-core placement, not power. Efficiency cores cost 2.32x per call and miss 200/200 deadlines; performance cores miss 0/200. All measured on battery. | [hybrid cores](../../reports/voice-llvc-hybrid-cores.md) |
| What produced 1 Hz draws and blank-white OBS stills? | A minimized window delivers **zero** animation frames: 60.04 fps before, 0.00 minimized, 59.91 restored. Both symptoms follow from one cause. Not proven to be the original event, since no visibility state was recorded then. | [minimize cause](../../reports/capture-minimize-cause.md) |
| What caused the two whole-system stalls? | Both occurred in runs containing an AC/DC power transition, with every other candidate ruled out by evidence captured at the stall instant. Temporal coincidence is not proven; power is now sampled per tick. | [performance](../../reports/performance.md) |

Two hypotheses were **eliminated**: [hybrid-core placement is rejected](../../reports/capture-core-placement.md) for rendering (efficiency cores cost 13% of cadence, not 98%), and the [occlusion probes](../../reports/capture-occlusion-investigation.md) never established their own condition — a null result whose inverse is useful, since covering the output window measured a flat 60 fps.

### Defects found and fixed

1. **Production typecheck broken** — `scripts/soak-health.mjs` shipped without the `.d.mts` its siblings carry.
2. **Missing-camera message** was raw exception text; `NotFoundError` and `OverconstrainedError` now read for beginners.
3. **Microphone failure reason erased** — `applyState` rendered a generic message over `failLive`'s explanation, so an occupied microphone reported nothing useful. Now a sticky notice.
4. **Draw guard missed lone stalls** — required three consecutive slow draws, so a single 1,227 ms stall that wedged a recording passed unnoticed. `singleStallMs` added.
5. **No warning for a hidden window** — the studio now reports duration and remedy on return.
6. Two harness bugs of my own, both caught and corrected in place rather than deleted.

### Where TASK-020 landed

A clean 30-minute two-phase soak: seated **58.14 fps / p95 44.4 ms**, standing **58.48 fps / p95 39.8 ms**, **zero skipped OBS output frames** in both (27,069 and 27,002), zero blank captures, both recordings verified at 720p h264. Memory growth proved collectable — one forced collection reclaimed 61.11 MiB against 50.70 MiB of growth, and 59.65 against 60.37. Offline operation recorded zero external requests under load.

### Criteria closed this session

TASK-020 (all three, archived), TASK-013's seated framing, TASK-015's control availability, TASK-024's laptop verdict, TASK-025's component licensing.

### Evidence added without closing a criterion

Deterministic system-level tests now cover: hidden-limb relaxation and reacquisition (TASK-011), standing occlusion stability (TASK-013), hand identity through crossing, uncertainty and reentry (TASK-012), head noise damping and face loss/recovery (TASK-010), anatomical side and mirror independence (TASK-010/011), denied/missing/busy/overconstrained camera recovery (TASK-009), microphone failure states (TASK-026), avatar independence from the voice service (TASK-024), and beginner-guide accuracy (TASK-018).

Each stops short of its criterion's human half — whether motion *looks* right to a person — and no box was ticked on synthetic evidence alone.

### Verification state

105 unit tests, 15 Python studio tests and 7 paced LLVC tests pass. Production build and typecheck pass. The 33-file bundle audit, docs audit and task audit pass with no errors.

### What remains, and why it cannot be automated

All 14 in-progress and 2 todo tasks gate on four physical acts: **a person moving in front of the camera** (TASK-003/009/010-013/015), **the user listening and stating a voice preference** (TASK-023, which also determines whether TASK-027 needs a trained voice), **the cancelled Virtual Camera permission prompt** (TASK-017), and **two final recordings** (TASK-018, feeding TASK-021/026/028). [Remaining checks](../../../../../docs/remaining-checks.md) orders them by how much each unblocks; step one alone clears seven tasks.

The local voice path additionally does **not** meet its gates: the paced proof passes on a quiet machine and fails reproducibly under ordinary desktop load, recorded as a measured defect rather than a pass.

2026-10-04 solver checkpoint: TASK-050 passed 720 updates against the committed baseline. All 275 unit tests and the production build passed. Physical acceptance remains open.

2026-10-04 asset checkpoint: Rei was extracted unchanged. Inspection rejects its 145,752,064 decoded pixels. The prepared Ene VRM remains absent. Camera restart fixes pass regression tests.

2026-10-04 diagnostic checkpoint: TASK-049 is complete. Installed-worker positive detections and a 70-second fake-camera recovery check passed. Physical acceptance remains open.

2026-10-04 Rei checkpoint: D08 and L04 resource ceilings were revised after the original incompatibility was recorded.
The unchanged Rei file passes preparation, expressions, cancellation, export, and graphics disposal checks.
All 282 unit tests pass. Target-laptop memory and Ene acceptance remain open.

2026-10-04 Ene checkpoint: the supplied source was rebuilt with pinned add-ons in Blender 5.2.2 LTS.
Structural inspection and combined Ene/Rei browser selection checks pass.
A reload persistence race was reproduced and corrected. Physical and target-laptop acceptance remain open.

2026-10-04 preparation checkpoint: TASK-040 is archived. Resource ownership, late cleanup, native-model behavior, and failure regressions pass.

## Windows continuation

Chrome and Edge pass the software checks. Both browsers pass L13 memory cleanup with output closed and open.
See [the Windows record](../../reports/windows-continuation.md).
TASK-039, TASK-043, TASK-045, and TASK-051 have complete software evidence.
[TASK-061](../backlog/TASK-061.md) owns their transferred human checks and the other physical acceptance tests.
The release requirements remain unchanged.

## Combined tracking update: 2026-10-05

[TASK-062](../archived/TASK-062.md) adds the combined camera view, actual model bones, shoulder control, and gaze control.
The user requested these software changes before human tests.
This supersedes the earlier restriction on missing controls.
Scheduler and confidence experiments still require physical evidence.
See the [audit](../../reports/combined-tracking-audit.md).

TASK-062 is complete. All 39 software verification checks have passing results after follow-up runs.
The [verification record](../../reports/combined-tracking-verification.json) preserves the original failures and the final results.
