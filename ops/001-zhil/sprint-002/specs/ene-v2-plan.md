# Ene v2 implementation plan

Date: 2026-10-05.
Status: The first candidate and software checks are complete. User review and physical tests remain open.

This plan acts on the [Ene feasibility study](../research/005-ene-v2-feasibility.md).
Ene v2 is a separate edited copy of the current cyber-legs model.
It reuses the shared VModel controls from the [Rei v2 work](rei-v2-plan.md).
It retains the existing character proportions and cyber design.
The [verification report](../reports/ene-v2-verification.md) records the measured results.
The [review procedure](ene-v2-review.md) defines the remaining checks.
A cuff is the opening at the end of a sleeve.

## Required work

| Item | Change | Required evidence |
| --- | --- | --- |
| E1 | Preserve the original VRM, Blender scenes, and source terms. | Original hashes, separate output paths, and copied notices. |
| E2 | Produce a smaller VRM with editable source and a repeatable recipe. | Equal used accessor values before and after packing; preserved texture bytes; valid sparse arrays; repeat-build hash. |
| E3 | Improve expression bindings and add deliberate facial controls. | A mouth smile, brow controls, safe combined expressions, and preserved original shapes. |
| E4 | Author an `ee` shape and examine separate mouth controls. | New vertex changes and expression images; no claim of a complete ARKit rig. |
| E5 | Correct gaze metadata to use eye bones. | Left, right, up, and down checks in VModel and a separate viewer. |
| E6 | Tune materials separately for the main model parts. | Equal-camera front, side, back, and face comparisons. |
| E7 | Preserve transparent cyber parts and hair. | Dark and light backgrounds at different view angles; no new missing surfaces. |
| E8 | Correct cuff clearance for gestures and wrist turns. | Original and edited views; measured separation; preserved large cuff design. |
| E9 | Examine spring movement and collisions. | Fixed abrupt head and arm movement; recovery and finite rotation checks. |
| E10 | Preserve all 53 humanoid assignments and 30 finger controls. | Import, direct bone, connected-surface, and gesture tests. |
| E11 | Add the local asset to VModel. | Selection, thumbnail, terms, settings, and output checks. |
| E12 | Prepare appearance review and physical acceptance. | Comparison page, instructions, open result fields, and target-computer measurements. |

## Work order

1. Inspect the cuff geometry and facial shapes.
2. Create a guarded build script and an editable recipe.
3. Add expression bindings and correct gaze metadata.
4. Create targeted face and cuff shapes where existing shapes are insufficient.
5. Tune materials without changes to texture resolution or alpha modes.
6. Pack the export with standard glTF sparse accessors.
7. Save and reopen the editable Blender source.
8. Compare fixed views, expressions, gestures, wrist turns, and seated lean.
9. Test springs with equal movement and elapsed time.
10. Test model selection and output in the production application.
11. Prepare user review and the existing physical acceptance procedure.

Keep the first material experiment separate from proof of a finished appearance.
Do not accept a smaller file as proof of lower GPU memory or faster display.
Do not accept a bone rotation as proof that fingers remain outside a sleeve.
Keep failed experiments and their measurements in the report.

## Tools and terms

Use the existing Python, NumPy, Blender, VRM add-on, Three.js, three-vrm, and browser tools.
The work requires no Unity project, proprietary shader, or remote model service.
Keep the asset's existing restrictions and source credits.
Open-source tools do not make the character asset unrestricted.
Keep local model binaries, editable scenes, and images outside Git.

## Scope limits

The first result must improve the current model without a whole-body replacement.
Extensive changes to proportions, iris art, hair ends, or garment folds remain a separate design option.
The research does not make those optional changes a prerequisite.
The user must review the final appearance.
The existing [motion targets](sprint-002-plan.md#acceptance-targets) still require physical measurements on the intended computer.
Both v2 assets remain candidates until those reviews and tests are complete.
