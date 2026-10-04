# TASK-021: Complete Ene end-to-end acceptance and handoff

- Status: In progress
- Priority: P0
- Goal: G1, G2, G3, G4, G5, G6
- Depends on: TASK-007, TASK-014, TASK-018, TASK-019, TASK-020, TASK-028, TASK-038, TASK-048, TASK-060, TASK-061
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Deliver the avatar, studio, voice, and website resources with verified evidence. Include the model library, Tracking Inspector, and measured correction results.

## Added scope for G5 and G6

Date: 2026-10-04. The [studio specification](../../specs/studio-product-spec.md) adds the model library and Tracking Inspector.

Consume [TASK-048](TASK-048.md) for G5 and [TASK-060](TASK-060.md) for G6. Their controllers close before this overall gate.

Require verified backup recovery, safe selection, tracking diagnosis, correction verdicts, and combined visual acceptance. Preserve all earlier physical and voice requirements.

## Work

- Re-run rig/appearance and live head, blink, mouth, torso, arms, hands and standing checks with the user's selected Ene Cyber legs variant; use it in all final recordings and virtual-camera evidence.
- Have a person follow the beginner quickstart from launcher through calibration to landscape/portrait recording.
- Verify final MP4 audio and image, OBS scene and virtual-camera consumer with Ene; preserve local evidence.
- Confirm editable .blend, VRM, mapping profile, conversion recipe, reproducible toolchain and app launch are present.
- Verify TASK-028's selected cheerful English voice, alternative timbres, synced portrait/landscape clips, open-source component inventory and local/remote performance verdict.
- Verify TASK-038's five animated media families, VMD-informed greeting, four desk expressions, measured alpha/browser/performance evidence, editable sources, integration kit and local showcase. TASK-P03 hands off G4 before this gate closes.
- Map G1 through G6 to evidence, limits, and defects in `ops/reports/acceptance.md`.
- Resolve release-blocking defects before final acceptance.

## Acceptance criteria

- [ ] G5 passes L01 through L14 and applicable U requirements; TASK-048 is Done.
- [ ] G6 passes T01 through T17 and applicable U requirements; TASK-060 is Done.
- [ ] The final acceptance report maps G1 through G6 to actual evidence.

- [ ] G1/G2 acceptance in the avatar spec and G3 acceptance in the [voice spec](../../specs/voice-conversion-plan.md) are satisfied using actual Ene, not only a sample avatar.
- [x] G4-A through G4-E in the [web-resource proposal](../../specs/web-character-resources-plan.md) are satisfied with all five animated resources and the simple web showcase; TASK-038 is Done.
- [ ] A beginner can reproduce launch, calibrate, record, stop and restart without code edits.
- [x] The handoff lists artifact locations and limitations; unperformed checks remain visibly incomplete.

## Implementation notes

This is the release gate. Do not mark complete because a preview renders or because planning documents exist.

2026-09-12: the [G1-G4 acceptance matrix](../../reports/acceptance.md) links delivered artifacts, component measurements and exact missing live checks. [TASK-038's final report](../../reports/web-resource-acceptance.md) delivers G4 and TASK-P03 is archived. Final-media functional, loading, playback and lifecycle gates pass on the documented Windows targets; actual Safari/iOS/Android remain untested. G1/G2/G3's combined operator/voice/recording gates and ongoing avatar/OBS performance work keep this overall task open.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

## G5 and G6 implementation checkpoint

Date: 2026-10-04. The [implementation record](../../reports/studio-implementation.md) supplies initial code and synthetic evidence.
P04 and P05 remain open. Their release handoffs require real models, target-laptop measurements, physical diagnosis, and human review.
No earlier physical acceptance changed.

## Windows continuation

The [Windows report](../../reports/windows-continuation.md) supplies Chrome and Edge software checks and actual-model memory measurements.
It also records inspector speed comparisons on the laptop.
[TASK-061](../backlog/TASK-061.md) collects human review, physical gestures, voice preference, and final recordings.
The G5 and G6 release gates remain open for their required human and physical evidence.
