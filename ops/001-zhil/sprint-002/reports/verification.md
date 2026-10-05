# Research verification

This document records the baseline before implementation.
Use [implementation verification](implementation-verification.md) for the current build.
The original replay probe expects the old defects and must use the recorded baseline source.

Date: 2026-10-05.

The research completed 18 replay conditions and 64 direct bone tests.
Both research commands returned exit code 0.
The browser probe reported no page errors.
The [file checks](artifact-checks.json) found no missing local links, line-ending errors, or hash changes.
The sprint-001 task audit reported no errors after the status update.
The research JavaScript passed its syntax check.
`git diff --check` reported no errors.

## Commands

Run these commands from the repository root:

```bash
python ops/001-zhil/sprint-002/research/tools/analyze_traces.py
node ops/001-zhil/sprint-002/research/tools/replay_probe.mjs
```

The first command writes [trace-analysis.json](trace-analysis.json).
The second writes [replay-probe.json](replay-probe.json) and two local model images.
The probe uses a temporary Vite server on an available port.
It closes its own browser and server when complete.

## Measured conditions

| Check | Result |
| --- | --- |
| Trace import | All three files pass the application's trace validation. |
| Cached observations | Analysis and replay resolve references to earlier task samples. |
| Replay conditions | Three traces × three rigs × two input variants. |
| Original hand data | Zero accepted finger goals in all nine original conditions. |
| Hand ablation | 960, 1,290, and 1,170 accepted finger goals per rig across the three traces. |
| Torso replay | Maximum local spine rotation below 0.000001 radians in all 18 conditions. |
| Direct model control | Spine, chest, and 30 finger bones rotate and move surface samples on each model. |
| Model preservation | The probe reads model files without changes. The reports record SHA-256 hashes. |
| Visual review | Both Ene images show the same replay event. The ablation moves fingers but does not show gesture accuracy. |

The installed SDK and relevant source files have hashes in the trace report.
Both reports record the source commit.
The model inventory records format versions and expression bindings.

## Interpretation limits

The ablation removes visibility and presence fields only from hand world points in memory.
No supplied point has a presence field.
Pose confidence, hand association, palm checks, and finger limits remain active.
The ablation identifies a rejection cause; it is not a complete production adapter.

The direct model test rotates one bone by 0.4 radians.
It samples up to 32 connected vertices per mesh.
It does not examine every vertex or certify deformation quality.

Replay starts from the current loader's reset pose and recorded settings.
The original recording can have earlier pose history that the trace does not contain.
The manifests contain no original model hashes.
Exact reconstruction of the user's displayed model state therefore remains uncertain.

No associated camera video exists in the supplied trace directory.
The research cannot rerun detectors or measure new camera-to-screen delay from these files.
The three recordings do not provide a complete labeled two-arm shake protocol.
Fresh camera, standing, mirror, gesture, and recovery acceptance remains open.

Production source files and model files were not changed.
The changed task records describe the new evidence and work order.
This verification does not claim industry parity or final motion acceptance.

## External research

The research documents link each external technical claim to its source.
Sources include Google MediaPipe, Warudo, VRChat, VRCFaceTracking, VMC, VRoid, Tripo, and the relevant project authors.
The option rankings are proposals; the research did not measure those external applications on the user's camera.
Tripo prices describe the pages checked on 2026-10-05 and can change.

The writing review used the official ASD-STE100 Issue 9 file.
A sentence and line-ending check supports the review.
Only a person can show full compliance with both parts of that standard.
