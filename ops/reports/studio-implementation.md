# Studio implementation checkpoint

Date: 2026-10-04. Scope: P04 and P05. Status: implementation in progress; release acceptance remains open.

## Implemented changes

- Shared Studio, Library, and Tracking navigation preserves the application instances.
- Model preparation creates the retargeter before selection. Failed preparation retains the active model.
- The local repository uses IndexedDB transactions and a unique asset-hash index.
- A worker checks GLB structure, resource limits, required bones, embedded images, and original metadata.
- Library controls provide preview, terms review, save, temporary selection, rename, removal, and export.
- Binary backups preserve original bytes. Restore validates data before one database transaction.
- Output messages include session and selection revision. Peers report loading, ready, or error.
- Tracking diagnostics retain capture identity, task identity, task times, and optional face observations.
- A shared MotionSolver supplies the canonical skeleton and VRM retargeter.
- The inspector provides matched observations, separate depth estimates, accepted motion, and an isolated avatar preview.
- Trace recording has fixed duration, count, and byte limits. Cached task data use references.
- Replay resets solver history before each seek. Optional camera video excludes audio.

The implementation leaves the tracker schedule and motion thresholds unchanged.
TASK-057 and TASK-058 cannot select corrections before TASK-056 supplies physical diagnosis.

## Files and ownership

| Component | Files | Resource owner |
| --- | --- | --- |
| Contracts and navigation | `src/model-types.ts`, `src/studio-navigation.ts`, `src/style.css` | Application |
| Model preparation | `src/viewer.ts`, `src/model-selection.ts` | Active viewer or disposable preview |
| Storage and inspection | `src/library-db.ts`, `src/model-repository.ts`, `src/vrm-inspection.ts`, `src/vrm-inspection.worker.ts` | Repository and inspection operation |
| Library and backup | `src/library-panel.ts`, `src/library-backup.ts` | Library panel |
| Worker observations | `src/camera.ts`, `src/tracking.worker.ts`, `src/tracking-diagnostics.ts` | One camera tracker |
| Shared solver | `src/motion-solver.ts`, `src/canonical-rig.ts`, `src/retarget.ts`, `src/retarget-math.ts`, `src/limb-solver.ts` | Active or isolated solver |
| Inspector and replay | `src/tracking-inspector.ts`, `src/tracking-recording.ts`, `src/tracking-video.ts` | Inspector |
| Output | `src/main.ts`, `src/output-link.ts` | Application session |

`AvatarViewer.load` remains available for existing callers. New selection uses preparation and commit boundaries.
The implementation keeps replay functions in `tracking-recording.ts`; the plan proposed a separate replay file.
Import uses an inline panel. Native confirmation dialogs handle removal and download confirmation.
No custom modal dialog needs a focus trap.

## Automated evidence

The latest browser results are in [studio-features-smoke.json](studio-features-smoke.json).
The test uses Chromium 153.0.8010.12 on Linux. It does not establish Windows Chrome or Edge acceptance.

Commands:

```text
npm test -- --reporter=dot
npm run build
node scripts/studio_features_smoke.mjs
node scripts/library_storage_smoke.mjs
node scripts/output_failure_smoke.mjs
node scripts/replay_video_smoke.mjs
node scripts/recording_lifecycle_smoke.mjs
npm run verify
python scripts/task_audit.py
```

The latest unit suite passed 295 tests across 31 files. The production typecheck and build passed.
The build reports a JavaScript chunk above 500 kB. No measured startup or diagnostic-overhead claim follows from the build.

The browser test covers these cases with synthetic fixtures:

- Preparation before commit, failed preparation, canceled commit, and candidate disposal.
- Concurrent duplicate saves, transaction rollback, cancellation, rename, and exact-byte export.
- Backup hash rejection, corrupt-storage rejection, injected quota rollback, and restore in a new browser profile.
- Matched cached-body and current-face images, verified by canvas pixels. Inspector pause retains the displayed image.
- Save without selection, explicit selection, and output synchronization.
- Failed imports that preserve both studio and output models.
- Five warm-up selections followed by 20 alternating selections with output open.
- Constant renderer counts: one geometry and one texture for the synthetic selection fixture.
- Navigation at 390 × 844, 768 × 1024, and 1440 × 900 without horizontal page scroll.
- Canonical motion without a loaded model and inspector pause controls.

The backup test decodes a renderable synthetic VRM 1 fixture through the actual loader before restore.
The same fixture passes restore in a new browser profile. Original CP932 terms bytes also survive restore.
Neither fixture establishes licensed sample-model acceptance or Ene/Rei appearance.

## Visual examination

The assistant examined the initial desktop Tracking and narrow Library screenshots.
Controls and labels were readable. The narrow Library view also displayed unnecessary studio controls below its cards.
The implementation now hides those controls outside Studio. Tracking has separate camera buttons.
Camera error text now appears in Tracking. The earlier text was only in the hidden Studio footer.

Screenshots remain under `ops/reports/local/studio-features/`.
This examination does not replace the required human review of model appearance and diagnostic clarity.

## Requirement evidence map

| Requirements | Evidence | Open work |
| --- | --- | --- |
| L01–L03 | Repository, duplicate races, rollback, and fresh-profile synthetic restore | Target-browser release matrix |
| L04–L05 | [Licensed import](licensed-import-smoke.json), [Ene](ene-library-smoke.json), [Rei](rei-library-smoke.json), parser limits, and blocked external resources | Human terms-conflict and model review |
| L06–L07 | [Cancellation and deadlines](import-lifecycle-smoke.json), [decoder cleanup](avatar-decoder-failure-smoke.json), save and temporary selection | Target-browser matrix and human interface acceptance |
| L08 | [Native selection](model-selection-chromium.json), [output recovery](output-failure-smoke.json), revision ordering | Windows Chrome and Edge acceptance |
| L09 | [Two-tab management](library-management-smoke.json), [actual thumbnails](library-thumbnail-smoke.json), protected removal | Native zoom, screen-reader, and human card review |
| L10–L11 | Exact export hashes, strict binary backup validation, fresh-profile restore, restore focus | Actual-model release matrix on the target laptop |
| L12–L14 | Storage failures, network observations, served-bundle audit, and guides | Twenty-switch process memory, complete latency matrix, privacy review, and human handoff |
| T01–T02 | Sample identities, session clocks, [camera recovery](diagnostic-camera-smoke.json) | Inspector-off overhead against baseline on the target laptop |
| T03 | Solver branch reasons and [baseline comparison](solver-baseline.json) | Physical diagnosis |
| T04–T05 | [Overlay geometry and image matching](tracking-overlay-smoke.json), raw 3D, anatomical labels, alignment | Physical coordinate checks and human clarity review |
| T06–T07 | [Canonical/Ene/Rei replay](avatar-replay-smoke.json), [live isolation](inspector-live-smoke.json), comparison recovery | Target-laptop and physical acceptance |
| T08–T11 | Recorder bounds, strict imports, replay reset, [video and isolation](replay-video-smoke.json) | Physical video timing and target-laptop memory |
| T12 | Display limit, measured four-Hertz summary limit, resource cleanup | Three 60-second samples per mode after warm-up; process memory and baseline comparison |
| T13–T16 | Physical protocol and unchanged baseline | Physical diagnosis, eligible experiments, and measured correction verdicts |
| T17 | Guides, combined browser checks, and explicit failed verification results | Physical elbow demonstration and combined release acceptance |
| U01–U03 | Responsive layout, tokens, actual thumbnails, and native-model navigation | Full card review and recorded design comparison |
| U04–U06 | Summary rows, keyboard controls, focus recovery, alerts, transitions, and [accessibility matrix](studio-accessibility-smoke.json) | Native 200% zoom, essential-graphics contrast, screen-reader, and complete focus review |
| U07–U08 | Actual models and synthetic diagnostic screenshots | Every named failure-state image and human visual acceptance |

## Environment limits and blockers

The Rei VRM passes the revised pixel and combined resource limits.
Both model files and the pinned tracking model bundle are now installed.
Ene is a new Linux rebuild from the supplied PMX source; its earlier laptop acceptance does not transfer automatically.
It also lacks the earlier private scenes, media, recordings, and Windows voice environment.
The supplied Ene files contain PMX source models. The Rei archive contains a native VRM.

The combined verification command passed 27 checks and failed nine checks in this environment.
A corrected acceptance claim passes its follow-up audit. Separate Chromium selection and failure checks also pass.
The [verification record](studio-verification.json) preserves each result.
The bundle audit passes. Documentation has 135 missing links to earlier local evidence and assets.
Default legacy browser checks require installed Google Chrome.
Voice checks reference the absent Windows Python environment. These failures do not establish regressions in those delivered assets.
The first verification run also caught a new test-fixture alias error. That fixture was repaired; the unit suite then passed.

No physical-camera, Windows release-browser, target-laptop process-memory, or human visual acceptance has been claimed.
P04 and P05 remain open. No child task closes solely because its source code exists.

## Next actions

1. Complete the remaining visual-state and accessibility checks.
2. Run the actual-model lifecycle and memory matrix on the target laptop.
3. Measure inspector overhead under the T12 protocol.
4. Complete human review and TASK-056 physical diagnosis.
5. Select one eligible correction experiment at a time.
6. Complete the G5 and G6 handoffs before the combined acceptance gate.

## Storage, backup, and diagnostic checks

TASK-041, TASK-044, and TASK-046 are complete for their defined software scope.
Their reports record synthetic fixture limits and actual IndexedDB transaction results.

- [Repository evidence](model-repository.md): two-tab races, second visits, quota failures, schema recovery, and persistence states.
- [Selection evidence](model-selection.md): late loads, peer failures, deadlines, persistence failure, and peer recovery.
- [Backup evidence](library-backup.md): 37 format cases, sequential preparation, original terms, and two-entry transaction rollback.
- [Solver evidence](solver-diagnostics.md): named reason fixtures, correct task references, and separate confidence defaults.
- [Inspection evidence](vrm-inspection.md): limit boundaries and the combined-limit constraint.
- [Replay evidence](tracking-replay.md): cached face points, strict references, retained prefixes, and video lifecycle tests.

The latest focused checks pass. The earlier full verification record still lists missing assets and Windows tools.
TASK-050 and TASK-053 are complete for their software scope. Real-model and physical checks remain open.

## Supplied model check

The user supplied the Ene source files and Rei archives on 2026-10-04.
`python scripts/provision_rei.py` extracted the original Rei VRM and retained its terms.
`node scripts/rei_library_smoke.mjs` failed at the required pixel limit.
The file contains 145,752,064 decoded pixels across 43 images.
Estimated texture memory is 777,344,342 bytes, before geometry and browser overhead.
The specification permits 67,108,864 pixels and 536,870,912 combined bytes.
The limits remain unchanged. Graphics checks did not run.
See [Rei evidence](rei-library-smoke.json).

## Camera session checks

Diagnostic worker tests preserve task order and output for balanced and low quality settings.
Camera tests verify new session IDs, stale-response rejection, and retained-image ownership after restart.
Late image-copy completion and failure cannot replace or close the new session's image.
Final checks: 279 unit tests passed, production build passed, and task audit passed.
The existing large-chunk warning remains.
The whitespace check passes outside the supplied resource files. Those original files retain their supplied line endings.

Diagnostic metrics now expire without new samples and separate warm-up from later samples.
They count rejected uses separately from distinct rejected channel samples.
The focused metric tests pass. See [contract evidence](tracking-contract.md).

The synthetic browser suite passed after a source-reload interruption required one rerun.
It verified matched images, pause, storage, three viewport sizes, 20 model changes, and clean-output isolation.
`node scripts/provision_runtime.mjs` installed the three tracking models with the recorded checksums.
The runtime manifest has no changes. Installed-model inference checks can now proceed.

TASK-049 is complete for its software scope.
The installed CPU worker passed 44 photo frames, including simultaneous face, body, and hand detections.
The 70-second fake-camera check passed Stop, restart, image cleanup, and disabled diagnostic checks.
See [contract evidence](tracking-contract.md). Target-laptop and physical acceptance remain open.

## Rei compatibility

The original rejection is preserved in [the original-limit report](rei-original-limits.json).
D08 and L04 now define fixed ceilings of 201,326,592 pixels and 1,024 MiB combined resources.
The unchanged Rei file passes inspection and browser preparation. All 16 resource-boundary tests pass.
See [inspection evidence](vrm-inspection.md) for the reason and acceptance limits.
Target-laptop memory and Ene comparison remain open.

The synthetic browser suite also passes with Rei present in the bundled library. Fresh-profile checks count imported entries separately.

## Ene rebuild

Blender 5.2.2 LTS loaded both pinned add-ons and ran the existing import and export scripts.
The supplied source hash matches the recorded source. Its original files remain unchanged.
The new VRM has SHA-256 `dcb46b18c7c5c47e2a66a63826bad2772950cfe3ccd7c8bb11896c1ba7a05acc`.
Structural inspection passes with 74,248,248 geometry bytes and 135,636,000 estimated texture bytes.
The import preview shows the supplied cyber-legs model with its textures.
Earlier reports remain unchanged. New conversion evidence is under `ops/reports/local/ene-rebuild`.
See [rebuild provenance](ene-rebuild.json). Browser and target-laptop acceptance remain separate.

The rebuilt Ene and native Rei pass the complete browser selection sequence.
This check found and verified a fix for early readiness before selection persistence.
Reload now retains Rei. Failed and superseded loads preserve the current avatar.
See [selection evidence](model-selection.md).

## Preparation ownership

Prepared candidates now have a specific viewer owner. Foreign viewers cannot commit or dispose them.
Supersession and viewer disposal release uncommitted candidates once.
Injected post-decode failures preserve the active model and dispose rejected scene resources.
The full suite passes 291 tests across 30 files. Build and output-failure browser checks pass.
Partial decoder-failure cleanup now has passing real-loader evidence. TASK-040 is complete for its software scope.

The final resource owner covers completed allocations, late results, and material clones after decoder failure.
All 295 unit tests pass. The production build, native Ene/Rei checks, and integrated browser checks pass.
See [preparation evidence](avatar-preparation.md). Release acceptance remains open.

## Estimated 3D completion

TASK-052 is Done. The task report records raw coordinate, hand alignment, face count, keyboard, viewport, and graphics lifetime evidence.
Visual checks found and corrected the initial camera target and fixed canvas width.
All 305 unit tests across 32 files pass. Type checking passes.
P04 and P05 remain in progress. Physical tracking and target-laptop acceptance remain open.

## Native avatar comparison completion

TASK-054 is Done. Canonical, Ene, and Rei replay one 120-sample trace with no anatomical side swap.
All 52 normalized bones match the pinned solver baseline within 0.0001 radians and zero position difference.
Comparison details now follow replay time and calibration changes.
The replay browser check preserves Studio and output state.
Physical tracking and target-laptop acceptance remain open.

## Licensed import fixture completion

TASK-042 is Done. The pinned Seed-san VRM 1 fixture passes inspection, preparation, storage, and unchanged export.
Its original source notice and metadata remain intact.
Final viewer disposal now explicitly releases its graphics context, including renderer-owned lighting resources.
All 305 unit tests, the production build, Ene, Rei, licensed-import, and decoder-failure checks pass.
P04 and P05 remain in progress. Target-laptop, physical, and human acceptance remain open.
