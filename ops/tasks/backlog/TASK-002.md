# TASK-002: Select and provision a reproducible open source toolchain

- Status: Ready
- Priority: P0
- Goal: G1, G2
- Depends on: None
- Estimate: S-M (1-2 days)
- Specification: [Ene VTuber plan](../../specs/ene-vtuber-plan.md)

## Outcome

Create a known working authoring and runtime environment on the target Windows laptop.

## Work

- Inspect installed Blender, OBS, Node and browser versions before installing anything; prefer a supported Blender LTS compatible with both add-ons.
- Provision Blender, MMD Tools, VRM Add-on for Blender, OBS and development dependencies from official distributions.
- Record exact versions, licenses, download locations, hashes and compatibility assumptions in ops/reports/toolchain.md.
- Record separate provenance/terms for sample avatar and ML model files. Pin package resolution and local runtime model/WASM assets.
- Use Blender's bundled Python for conversion scripts; retain applicable component notices and document the proposed license for new code.

## Acceptance criteria

- [ ] Blender imports both add-ons and exports a trivial test VRM without an add-on error.
- [ ] The selected Three.js/three-vrm pair loads a test VRM; MediaPipe initializes; OBS can open.
- [ ] A reproducible manifest and setup instructions identify every dependency; unsupported or non-open-source core dependencies are absent.

## Implementation notes

Installation/initialization checks are required; the integrated performance decision belongs to TASK-003.

When completing this task, record changed artifact paths, exact validation commands/results or manual evidence, and any unresolved limitation in the task or its linked report. Leave unperformed checks unchecked.

