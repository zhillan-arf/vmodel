# Sprint 002 task register

Date: 2026-10-05.

The user authorized implementation through the next human test.
The [plan](../../specs/sprint-002-plan.md) defines the required targets.
The [implementation decisions](../../specs/implementation-decisions.md) record the selected corrections and conditional work.

**Next action:** run the [human test](../../specs/human-test.md) on Ene and Rei.
**Human test** means software preparation is complete and physical acceptance remains open.
It does not mean the motion targets passed.

| Task | Priority | Status | Result or next action |
| --- | --- | --- | --- |
| [S002-R01](../archived/S002-R01.md) | P0 | Done | Research and baseline evidence. |
| [S002-001](../archived/S002-001.md) | P0 | Done | Use task-specific confidence without changing raw observations. |
| [S002-002](../active/S002-002.md) | P0 | Human test | Add shoulder roll when hidden hips prevent the full torso estimate. |
| [S002-003](../active/S002-003.md) | P0 | Human test | Preserve valid arm goals through short rejected intervals. |
| [S002-004](../active/S002-004.md) | P0 | Human test | Apply the corrected hand contract to palm and finger controls. |
| [S002-005](../active/S002-005.md) | P1 | Human test | Run all enabled tasks on each Balanced submission. |
| [S002-006](../active/S002-006.md) | P1 | Human test | Prepare the same-camera reference comparison. |
| [S002-007](../active/S002-007.md) | P1 | Human test | Keep the working face mappings for the regression test. |
| [S002-008](../archived/S002-008.md) | P2 | Done | Defer VMC implementation until comparison evidence identifies a useful source. |
| [S002-009](../active/S002-009.md) | P0 | Human test | Prepare the build, automated evidence, physical procedure, and result sheet. |

P0 tasks address the supplied failures and the retest.
P1 tasks measure performance and remaining quality.
P2 is the conditional external-input branch.

Codex supplies software, model inspection, measurements, and test procedures.
The user supplies physical movements and appearance review.
No task requires the user to create an asset in Blender.

The [sprint-001 transfer](../../specs/sprint-002-plan.md#sprint-001-transfer) replaces the old motion execution queue.
The previous task states retain acceptance history.
Voice, OBS installation, library review, and final output recordings retain their separate requirements.
