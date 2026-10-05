# Rei v2 and VModel appearance

Date: 2026-10-05.
Status: The first candidate and software checks are complete. User review and physical tests remain open.

This plan acts on the [Rei research](../research/004-rei-vrchat-feasibility.md).
The [verification report](../reports/rei-v2-verification.md) records the current result.
The [review procedure](rei-v2-review.md) defines the remaining checks.
Rei v2 is a separate edited copy of the supplied Rei VRM.
A recipe is a file that specifies repeatable asset changes.
A preset is a named group of settings.
Other terms follow the [research](../research/004-rei-vrchat-feasibility.md) and [sprint glossary](../README.md#terms).

## Scope and tools

Use Python, Blender, the VRM add-on for Blender, Three.js, three-vrm, and the existing browser tools.
These tools have open-source licenses.
The work does not require Unity, VRChat, a paid service, or automatic 3D generation.
Keep runtime dependencies local.

The Rei asset has separate terms from its tools.
The supplied readme permits changes and format conversion.
Its embedded metadata prohibits redistribution and commercial use.
Keep both records with the local edited copy.
Do not describe the asset as unrestricted open-source content.
Keep model binaries, source work, and rendered images in excluded local directories.
Keep recipes, software, and reports in Git.

## Required work

| Item | Change | Required evidence |
| --- | --- | --- |
| R1 | Keep the original asset and source terms. | Equal original hashes before and after creation; copied terms; separate output path. |
| R2 | Create an editable Rei v2 and a repeatable export. | Recipe, source work, separate VRM, change report, and repeat-build hash. |
| R3 | Adjust outlines for each selected material. | Fixed front, side, and face images; measured draw calls; no uniform outline on small face parts. |
| R4 | Examine face and eye treatment. | Same-camera images; retain character details; record changes and rejected changes. |
| R5 | Expose existing brow and mouth controls. | Preserve all original shapes; add explicit bindings; test each added control. |
| R6 | Map camera coefficients with calibration and limits. | Tests for neutral values, conflicting shapes, absent data, invalid data, and recovery. |
| R7 | Add light presets and camera controls. | Saved settings; equal settings in studio and output; original defaults remain available. |
| R8 | Add 1080p output in both orientations. | Actual canvas dimensions; output transfer; resize and settings tests. |
| R9 | Examine spring motion under fixed movement. | Original and edited models use the same movement; preserve colliders; record spring decisions. |
| R10 | Preserve model motion and import support. | All 30 finger controls, required bones, expressions, skin weights, and geometry checks. |
| R11 | Make the local model available in VModel. | Model selection, source terms, thumbnail, settings, and output tests. |
| R12 | Compare appearance and resource cost. | Front, side, smile, blink, mouth, raised arms, and peace sign; recorded settings and hashes. |
| R13 | Measure the intended computer and obtain appearance review. | User verdict, 1080p frame times, and the existing camera acceptance procedure. |

## Work order

1. Add the recipe and checks that preserve source data.
2. Create a first local Rei v2 with selected material changes and added expression bindings.
3. Add light, camera, and output settings.
4. Add facial calibration and conflict limits.
5. Test both avatars with fixed expressions and poses.
6. Inspect the comparison images.
7. Correct visible defects that the comparison shows.
8. Save the editable source and verification report.
9. Prepare the appearance review and physical test instructions.

Keep the existing sprint motion repairs in their current tasks.
A new model cannot establish camera accuracy or solve hidden-limb measurement.
Optional hand poses must identify selected motion clearly if later evidence requires this feature.
Do not replace measured hand motion silently.

## Acceptance limits

The initial result is an appearance candidate until the user accepts its appearance.
The exact edited VRChat source remains unavailable.
No screenshot proves its hidden geometry, shader settings, or tracking method.
Require useful visual changes in the fixed comparisons; a successful file export alone is insufficient.
Keep texture dimensions until a measured comparison supports a reduction.
Keep geometry and skin weights until a direct pose identifies a defect that needs an asset repair.
Change springs only when the fixed movement test supports the change.

Software graphics tests can prove loading, output dimensions, and control behavior.
They cannot prove performance on the intended GPU or live camera accuracy.
The [sprint targets](sprint-002-plan.md#acceptance-targets) remain unchanged.
Require the 15-minute combined test, 15 Hz body and hand results, 200 ms p95 visible delay, and 500 ms recovery.
Require at least nine correct holds from ten attempts for each specified hand gesture.
Keep physical acceptance open until those measurements exist.
