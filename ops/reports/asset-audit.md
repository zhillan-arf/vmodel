# Ene source asset audit

Date: 2026-09-12. Required variant: **ENE Cyber legs ver.pmx**.

The pinned MMD Tools 4.5.14 parser successfully read both full PMX models in Blender 5.1.1, including rigid bodies and joints. The reproducible command is:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/audit_assets.py
```

Exit code: 0. Both add-ons loaded. [Structured inventory](asset-inventory.json) contains the exact hashes, materials, bones, morph index/name pairs, texture paths, rigid bodies and joints.

| Variant | Vertices | Triangles | Materials | Bones | Morphs | Rigid bodies | Joints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cyber legs (required) | 63,278 | 112,949 | 49 | 193 | 50 | 81 | 78 |
| Normal legs (preserved alternative) | 63,964 | 113,971 | 50 | 193 | 50 | 81 | 78 |

Both contain blink, left/right wink and vowel expressions. Morph names are not unique: toon adjustment appears twice, so conversion must use source index and name. Existing helpers, twist bones, leg D bones and physics need export-specific handling; successful parsing is not visual rig validation.

## Texture repair register

| Variant/material index | Missing file | Role | Assigned action |
| --- | --- | --- | --- |
| Both / 10 | `s.bmp` | Additive sphere map | TASK-004: explicitly disable the absent additive reflection layer, preserve diffuse map, compare appearance; tune replacement MToon shading in TASK-007 |
| Cyber / 47, normal corresponding material | `spa-pi.bmp` | Additive sphere map | Same |
| Normal / shoes 2 | `body01_s.bmp` | Sphere map | Candidate exists at `sph/body01_s.bmp`; optional variant repair, outside required cyber delivery |

No unresolved diffuse-map reference was found by the parser/path audit. Image contents and UV appearance still require the import/render checks.

## Provenance and original files

The user's original archive, extracted model package and VMD remain unchanged. The user's stated AuroraYok permission authorizes this project. The bundled Ene readme identifies editor `yokkaulove (DA)`, requests credit, permits editing and prohibits redistribution. Preserve that name alongside the user's attribution and retain all bundled contributor readmes. The application distribution excludes the models, archive, generated avatars and recordings through project ignore rules; these rules do not remove anything already tracked in Git.

The VMD signature is `Vocaloid Motion Data 0002`, with embedded model field `八雲紫(773)`, rather than Ene. It is motion data; full motion/channel compatibility belongs to TASK-014. Its planning SHA-256 is recorded in the specification and will be checked there.

The supplied [X excerpts](../resources/x-posts.md) were reviewed: AI conversation via AITuberKit, manual 3D authoring observations, and an incomplete 2D layered-PSD workflow. They do not replace the available PMX model or establish webcam performance. Original post/video access remains unverified as described in the specification.

## Result

Asset intake is complete with explicit repair ownership. No model-acquisition blocker remains. Model appearance, deformation, spring behavior and VRM portability remain separate unperformed checks.
