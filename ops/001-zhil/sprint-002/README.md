# Sprint 002: Motion correction and physical retest

Date: 2026-10-05.
Phase: The first implementation is complete. The software checks passed. The next human session remains open.

The main defects occur in the software between MediaPipe observations and model movement.
The evidence does not justify a new Ene model for these defects.

The objective is the best practical motion quality that approaches established VTuber and VRChat systems.
The user must not need to create or repair 3D assets manually.
The [plan](specs/sprint-002-plan.md) defines separate targets for camera motion, model appearance, and optional external tracking.

**Next action:** follow the [human test procedure](specs/human-test.md).
The build uses `motion-solver-3` and `task-confidence-2`.

## Start here

| Document | Purpose |
| --- | --- |
| [Physical diagnosis](research/001-physical-diagnosis.md) | Explain the images, traces, defects shown by tests, and remaining uncertainty. |
| [Industry options](research/002-industry-options.md) | Compare software repair, established applications, and better sensors. |
| [Models and Tripo](research/003-model-and-tripo.md) | Assess the actual models, automatic asset work, Tripo, and the Ene v2 decision. |
| [Rei and VRChat](research/004-rei-vrchat-feasibility.md) | Trace the reference avatar, test the existing Rei asset, and assess webcam limits and conversion. |
| [Sprint plan](specs/sprint-002-plan.md) | Define work order, acceptance targets, and sprint-001 transfer. |
| [Task register](tasks/backlog/README.md) | Track completed software work and open physical requirements. |
| [Implementation decisions](specs/implementation-decisions.md) | Explain the implemented correction and conditional deferrals. |
| [Human test](specs/human-test.md) | Perform the next camera session and export paired evidence. |
| [Implementation verification](reports/implementation-verification.md) | Check the tested build and its limits. |
| [Verification](reports/verification.md) | Reproduce the measurements and state their limits. |

## Baseline findings before implementation

- All 2,751 world points from 131 different hand observations contain `visibility: 0`.
- The solver rejects every finger goal from the original traces.
- A test that omits that hand field produces 3,420 accepted finger goals per rig across the three traces.
- Direct rotation moves all 30 finger bones and the connected surface on both models.
- Hidden hips prevent every spine goal in the traces.
- Body and hand sample rates range from 5.73 to 6.35 Hz.
- Frequent arm rejection and immediate return toward rest can contribute to unstable motion.
- The inspector can show incomplete reasons between new samples.

These findings support software repairs first.
They do not show that a repaired solver meets the motion targets.
The research test changed data only inside its own replay process.
The implementation now corrects production motion conversion. Both model files remain unchanged.

## Terms

| Term | Meaning in this sprint |
| --- | --- |
| Avatar | The character model that the application displays. |
| Landmark | A point that a detector estimates from an image. |
| Rig | Model bones and the controls that move them. |
| Skin weights | Values that specify how each bone moves the model surface. |
| Retargeting | Conversion from measured movement to model controls. |
| Solver | Code that calculates model motion from observations. |
| Goal | A target rotation for a model bone. |
| Trace | A file with observations, settings, times, and solver reasons. |
| Replay | Application of recorded observations in their recorded order. |
| Ablation | A test that removes one input or operation to measure its effect. |
| Canonical rig | The simple reference skeleton that does not use Ene or Rei. |
| Regression | A failure in a function that worked before the change. |
| Confidence | A detector value with a defined meaning for one output type. |
| Handedness | The left or right classification of a detected hand. |
| Inference | A detector calculation from an image. |
| Sample age | Time from image capture to use of its result. |
| Latency | Delay from an action to its visible result. |
| Jitter | Unwanted small motion when the person holds a pose. |
| Occlusion | A condition in which another object hides a body part. |
| IK | Inverse kinematics: calculation of joint rotations from target positions. |
| Blendshape | A stored change to the model surface, usually for a facial expression. |
| VRM | A file format for humanoid avatars. |
| MMD | MikuMikuDance, an animation system with model and motion formats. |
| VMD | An MMD motion file. |
| VMC | Virtual Motion Capture Protocol, a format for transfer of avatar motion. |
| OSC | Open Sound Control, a message protocol that some tracking systems use. |
| p95 | The value at or below which 95 percent of measured values occur. |

## Evidence rules

The images in the user message form groups by pose, not thirteen different movements.
The diagnosis keeps those groups.
The raw traces remain at `research/trace/`.
The local Git rules exclude personal traces and generated model images from code distribution.

The reports distinguish direct measurements, code findings, likely causes, and proposed targets.
Missing evidence does not count as a passed test.
The [transfer table](specs/sprint-002-plan.md#sprint-001-transfer) replaces the motion work order from sprint 001.
Unrelated voice, library, accessibility, and recording requirements remain open.
