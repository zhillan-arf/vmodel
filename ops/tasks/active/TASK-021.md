# TASK-021: Complete Ene end-to-end acceptance and handoff

- Status: In progress
- Priority: P0
- Goal: G1, G2, G3, G4
- Depends on: TASK-007, TASK-014, TASK-018, TASK-019, TASK-020, TASK-028, TASK-038
- Estimate: M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Demonstrate the avatar/application, live character-voice and website-resource goals, leaving a usable model, recording workflow, five animated website resources and a runnable showcase.

## Work

- Re-run rig/appearance and live head, blink, mouth, torso, arms, hands and standing checks with the user's selected Ene Cyber legs variant; use it in all final recordings and virtual-camera evidence.
- Have a person follow the beginner quickstart from launcher through calibration to landscape/portrait recording.
- Verify final MP4 audio and image, OBS scene and virtual-camera consumer with Ene; preserve local evidence.
- Confirm editable .blend, VRM, mapping profile, conversion recipe, reproducible toolchain and app launch are present.
- Verify TASK-028's selected cheerful English voice, alternative timbres, synced portrait/landscape clips, open-source component inventory and local/remote performance verdict.
- Verify TASK-038's five animated media families, VMD-informed greeting, four desk expressions, measured alpha/browser/performance evidence, editable sources, integration kit and local showcase. TASK-P03 hands off G4 before this gate closes.
- Write ops/reports/acceptance.md mapping each G1/G2/G3/G4 requirement to evidence, known limitations and remaining defects; resolve release-blocking defects.

## Acceptance criteria

- [ ] G1/G2 acceptance in the avatar spec and G3 acceptance in the [voice spec](../../specs/voice-conversion-plan.md) are satisfied using actual Ene, not only a sample avatar.
- [x] G4-A through G4-E in the [web-resource proposal](../../specs/web-character-resources-plan.md) are satisfied with all five animated resources and the simple web showcase; TASK-038 is Done.
- [ ] A beginner can reproduce launch, calibrate, record, stop and restart without code edits.
- [x] The handoff lists artifact locations and limitations; unperformed checks remain visibly incomplete.

## Implementation notes

This is the release gate. Do not mark complete because a preview renders or because planning documents exist.

2026-09-12: the [G1-G4 acceptance matrix](../../reports/acceptance.md) links delivered artifacts, component measurements and exact missing live checks. [TASK-038's final report](../../reports/web-resource-acceptance.md) delivers G4 and TASK-P03 is archived. Final-media functional, loading, playback and lifecycle gates pass on the documented Windows targets; actual Safari/iOS/Android remain untested. G1/G2/G3's combined operator/voice/recording gates and ongoing avatar/OBS performance work keep this overall task open.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.
