# Ene Cyber legs conversion recipe

The reusable model is [assets/avatars/ene.vrm](../assets/avatars/ene.vrm). The [export scene](../assets/work/ene/vrm-work.blend) contains the humanoid assignments, facial expressions, MToon materials and spring settings. The separate [imported scene](../assets/work/ene/source.blend) preserves the original MMD rig, morphs and physics for future authoring. Both original PMX files remain unchanged.

Codex has provisioned the tools and performed this conversion. Everyday use starts with [Start VModel.cmd](../deploy/Start%20VModel.cmd); the commands below are the reproducible authoring workflow, not an installation task for the user.

## Reproduce from the supplied package

Run from the repository root in PowerShell. The tested installed Blender is 5.1.1; the isolated add-ons are MMD Tools 4.5.14 and VRM Add-on 4.7.1. Exact download hashes and runtime versions are in the [toolchain report](../ops/reports/toolchain.md).

```powershell
python scripts/provision_tools.py
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/audit_assets.py
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/import_ene.py
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/export_ene.py
Copy-Item -LiteralPath assets/avatars/ene.vrm -Destination public/avatars/ene.vrm
npm.cmd run build
```

The scripts enable isolated add-ons for that Blender process without changing saved user preferences. Running the import/export steps regenerates the derived scenes; preserve any later hand edits under a separate filename before regenerating.

## Deliberate conversion decisions

- Required variant: `ops/resources/ENE/ENE Cyber legs ver.pmx`, original SHA-256 `226fe9075f25c7dd2e6474fdd6acb77ff71c45900fb2d5c8794e08647aa9dbe4`.
- Import scale is 0.08. The imported armature is Z-up in Blender; glTF/VRM is Y-up. The runtime uses three-vrm's normalized humanoid bones. Original rest matrices, head/tail locations and all 53 assignments are recorded in [export preparation](../ops/reports/ene-export-preparation.json) and the [avatar profile](../config/avatars/ene.json).
- The export scene uses an FK humanoid hierarchy. MMD IK/copy-transform constraints are removed there; they remain in the imported source. The D leg deform bones are reparented to their corresponding FK leg bones. Weighted twist, hair, skirt, eyebrow and headphone bones remain attached to the relevant humanoid ancestors. MMD-specific SDEF data keys are excluded from facial export.
- One source triangle repeats vertex 21535. Blender validation removes that degenerate triangle and its edge in the export scene. All 63,278 vertex indices and facial shape arrays remain intact; the export has 112,948 triangles. The source PMX and imported scene are preserved.
- Two unavailable additive sphere maps are disconnected, retaining the available diffuse textures. MToon materials classify actual texture alpha as opaque, mask or blend; fractional cyber-leg transparency is preserved. The blue cheek markings and fading leg ends belong to the source design.
- Springs and sphere colliders are explicitly generated from MMD rigid bodies before the working scene is saved. Baseline stiffness 3.0 and drag 0.8 reduce excessive hair movement. The studio defaults to Gentle; Full and Off are available. Its delta cap protects simulation after a suspended tab.
- Only the explicit expression mappings are exported; automatic additional preset assignment is disabled so the editable scene and VRM agree.

## Facial controls

The profile records each source morph name and source index, including when unrelated source names are duplicated. All weights use 0–1. Use `blink` or the independent `blinkLeft`/`blinkRight` pair, rather than summing both methods. Use one vowel at a time; live visual jaw opening drives `aa`.

| VRM control | MMD source | Use |
| --- | --- | --- |
| blink | まばたき | Both eyes |
| blinkLeft / blinkRight | ウィンク左 / ウィンク右 | Independent eyelids |
| aa / ih / ou / oh | あ / い / う / お | Available mouth shapes |
| happy / angry / sad | にこり / 怒り / 困る | Authored expression shapes |
| surprised | びっくり | Authored surprise |

An `ee` vowel is not supplied. This is a useful MMD expression set, not full ARKit 52-shape compatibility. Manual Smile/Surprise supplies a 0.75 minimum for that expression; Neutral releases the override. Mouth opening and blinks remain available together.

## Validate changes

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/audit_rig.py
node scripts/validate_avatar.mjs
```

With the studio server running on port 4173, `node scripts/pose_sweep.mjs` produces reproducible body/face images; `node scripts/spring_smoke.mjs` checks abrupt motion, pause/resume and all spring modes. Reimport with `scripts/render_views.py -- vrm` in Blender for an independent viewer check. Review the actual images as well as the JSON checks; a finite bone transform alone does not prove attractive deformation.

Keep character assets private and preserve the bundled readmes and contributor credits. The user's existing conversion permission is recorded in the [asset audit](../ops/reports/asset-audit.md); the model is not relicensed as open-source software. Derived assets, local review images and recordings are excluded from code distribution by default.
