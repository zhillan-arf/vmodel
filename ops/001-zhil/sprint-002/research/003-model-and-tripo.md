# Model findings and Tripo assessment

Date checked: 2026-10-05.
Terms: [Sprint glossary](../README.md#terms).

Keep the current Ene and Rei files for the first correction cycle.
There is direct evidence that their existing bones can move the required body parts.
Tripo does not address the measured software rejection of those movements.

## Inspection of the actual models

The browser probe loads each local VRM through the application's current loader.
It rotates each finger bone, spine, and chest by 0.4 radians.
It then measures the raw bone rotation and samples the connected model surface.

| Result | Ene | Rei |
| --- | ---: | ---: |
| VRM version | 1.0 | 0.0 |
| Mapped humanoid bones | 53 | 53 |
| Directly tested finger bones | 30 | 30 |
| Additional directly tested torso bones | 2 | 2 |
| Tested bones with raw rotation and surface movement | 32/32 | 32/32 |
| Smallest maximum surface displacement among tested bones | 0.00501 m | 0.00606 m |

The surface metric samples up to 32 affected vertices per mesh for each test bone.
It shows a working bone-to-surface connection.
It does not measure ideal anatomy, weight quality, or absence of intersections.

The probe also replays all three traces on both models and the canonical rig.
Original data yields no accepted finger goals on any rig.
The hand-confidence ablation produces the same goal counts on all three rigs.
This is stronger evidence for a shared software defect than an unrelated dance video.
The [full report](../reports/replay-probe.json) contains individual results.

| File | SHA-256 |
| --- | --- |
| `assets/avatars/ene.vrm` | `dcb46b18c7c5c47e2a66a63826bad2772950cfe3ccd7c8bb11896c1ba7a05acc` |
| `assets/avatars/rei.vrm` | `07037243141d9c3f260c6ef09419f1225ca64ffb7791204b4aef0b817ebc1735` |

These are the files examined in this environment.
The user traces do not identify their original model hashes.
Older sprint-001 reports can refer to an earlier Ene export.

## Ene v2 decision

**Decision: do not create Ene v2 during this research phase.**

The missing finger and torso motion already occurs on the canonical rig.
Direct bone control works on the existing Ene file.
A new model would keep the confidence and hidden-hip defects.
There is no measured local asset repair that resolves those defects.

Reconsider Ene v2 if a later direct pose test identifies one of these conditions:

- A finger bends around an incorrect axis after correct model-relative conversion.
- A joint has incorrect weights or a reproducible surface collapse.
- A needed expression exists in the PMX source but the export loses it.
- A hair or clothing chain has a reproducible spring or collision fault.
- A material or normal defect remains under fixed lighting and correct motion.

For such a repair, use a separate `ene-v2.vrm` and editable scene.
Keep the original files and their hashes.
Compare identical direct poses and identical traces before registration.
The user would review the result; the assistant would perform the model work.

## What the MMD evidence means

Smooth MMD motion supports the user's view that the models can articulate.
MMD motion files supply authored bone movement without live landmark rejection.
They therefore bypass the current failure path.

The repository already contains an Ene VMD investigation.
It records coherent torso and arm poses on the original PMX rig.
It also records incomplete motion-channel matches and differences between source-specific controls.
See the [sprint-001 investigation](../../sprint-001/reports/ene-vmd-compatibility.md).

That historical result does not show complete equivalence between the PMX rig and the current VRM export.
The new direct VRM tests address the relevant bone connections in the current files.
No additional MMD video or motion file was necessary for this diagnosis.
The supplied Rei file is native VRM; a Rei dance video could use a different model or export.

## Tripo value

The user specified that “Triton” means Tripo.
Tripo provides generation, model processing, automatic rigging, and animation services.
Its rig API accepts existing model inputs and returns GLB or FBX.
It offers Tripo or Mixamo bone names. [Tripo rig API](https://developers.tripo3d.ai/en/docs/animations-rig).

This capability can help with a new static character that lacks a rig.
Ene and Rei already have mapped humanoid rigs, fingers, expressions, and surface weights.
Replacing those rigs can introduce new conversion work.

The reviewed API documents do not show all of these requirements:

- A complete VRM export with avatar metadata and expression bindings.
- Independent, correctly weighted joints for all ten fingers in the selected output.
- Preservation of the existing model's facial shapes and toon materials.
- A tested set of facial shapes for detailed live tracking.
- Correct hair, clothing, and collision behavior for the supplied characters.
- Preservation of Ene's appearance after generative processing.

Absence from the reviewed documents is not proof that a capability is unavailable.
A sample export and an inspection must resolve these questions.
The [UniRig research repository](https://github.com/VAST-AI-Research/UniRig) also separates skeleton generation from skin-weight prediction.
Neither operation alone shows complete VTuber suitability.

## Cost findings

The API page lists 1 credit as USD 0.01 and automatic rigging at 25 credits.
That implies about USD 0.25 for one listed rig operation, before other tasks or account requirements.
The billing table lists a free rig check and 10 credits for an animation retarget operation.
The API example shows 30 consumed credits.
Examine the selected operation before expenditure. [Tripo API pricing](https://developers.tripo3d.ai/), [billing table](https://platform.tripo3d.ai/docs/billing), [rig API example](https://developers.tripo3d.ai/en/docs/animations-rig).

The Studio pricing page displays Pro at USD 20 per month with USD 240 annual billing.
It lists 3,000 monthly credits and private models for that plan.
The page also contains a monthly price column, so the selected checkout term needs confirmation.
The free plan lists 200 credits and public models. [Tripo Studio pricing](https://www.tripo3d.ai/pricing).

Studio and API access have separate account and billing questions.
Do not assume that a Studio subscription supplies API credits.
Use the API account balance and current plan details before an automated experiment. [Tripo developer page](https://developers.tripo3d.ai/).

**Recommendation: spend nothing on Tripo to repair the current symptoms.**
If a new avatar becomes a separate objective, propose a small sample experiment first.
Set a USD 10 experiment limit as a proposed budget, not an approved charge.
Use an original or permitted test asset and a private account mode where required.
Require usable fingers, keepd facial controls, and a validated VRM conversion before further spending.

## What automatic model work can and cannot show

The existing import and export scripts demonstrate a path for automatic Blender work in this repository.
Scripts can examine bones, adjust mappings, change weights, create controlled shapes, and export a separate model.
These operations still need measured and visual checks.

A generated mesh can look correct in one still image while failing at shoulders, fingers, or facial expressions.
A single generation does not show production motion quality.
The cost of validation and repair can exceed the generation cost.

Detailed face motion needs compatible expression shapes as well as useful tracking values.
VRCFaceTracking's Unified Expressions defines model shapes separately from control parameters.
This distinction also applies to any proposed expression expansion here. [Unified Expressions](https://docs.vrcft.io/docs/tutorial-avatars/tutorial-avatars-extras/unified-blendshapes).

For Ene, examine existing source shapes before generating new ones.
For Rei, keep the supplied expressions and test their mappings first.
The current solver drives only a subset of the available face controls.
Extra facial detail is later work; it does not explain frozen fingers or the upright torso.
