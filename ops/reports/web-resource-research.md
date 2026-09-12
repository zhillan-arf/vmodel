# Website resource research evidence

Inspection date: 2026-09-12. This report supports the [proposal](../specs/web-character-resources-plan.md); it does not certify produced animations.

## External reference inspection

- Direct GET of `https://kizunaai.com/en/` using PowerShell `Invoke-WebRequest -UseBasicParsing` succeeded. The response was saved locally to `.cache/web-research/kizunaai-en.html` (ignored research cache). The matching native video element has source `https://kizunaai.com/2026/wp-content/themes/ka_official/assets/mv/KA_HP_TOP_v1.2.mp4` and `loop`, `muted`, `autoplay`, `playsinline` attributes. This is evidence for the current homepage video, not the older screenshot. No movie was downloaded or reused.
- Browser research could not retrieve the supplied X status. Its workflow description is attributed to the user's pasted Japanese text. No unseen video, rigging helper, runtime or claimed model quality was independently verified.
- Official Tripo pricing was readable: free and paid tiers exist; the free offer is limited. Tripo is excluded entirely from the proposal.
- Official sources for MMD Tools, MMD's publisher, Khronos glTF, Three.js migration, Chrome WebM alpha, Apple HEVC alpha, WebP, FFmpeg and MDN were consulted and linked next to the corresponding claims in the proposal. Several Blender manual/license URLs failed retrieval; no conclusion depends on those failed page reads.

## Local inspection

- No applicable `AGENTS.md` was found in the workspace ancestor paths or `ops` tree.
- The working tree already contained extensive implementation and planning changes. Preserved these and used the existing task lifecycle (Ready/Todo in backlog, In progress in active, Done in archived).
- TASK-001 is Done with an asset audit; TASK-002 is In progress. Existing `source.blend`, `vrm-work.blend`, Ene VRM, import/export reports and browser/toolchain smoke evidence exist. Full artistic and integrated runtime acceptance remain open.
- Read the source inventory, import scripts/report, encoder availability, package versions, task controllers and task index. Viewed the existing front render. Measured the existing VRM file at 87,634,512 bytes; no new render or benchmark was run.
- `ffmpeg`/`ffprobe` were not found by PATH command lookup. Provisioning and encoder validation are assigned to TASK-029.

## VMD structural inspection

The [machine-readable result](web-resource-vmd-inspection.json) records the original SHA-256, section counts, frame extrema, exact-name matches and unmatched channels. The SHA-256 agrees with the prior specification: `d3abdedf45e36a55ad66e2546ec0a562054db8a6c11d4198fa8c6a773f39bea8`.

Method: read the original file without modifying it; decode fixed names as CP932; bounds-check each read; consume the 30-byte signature and 20-byte model field, little-endian section counts, 111-byte bone records, 23-byte morph records, 61-byte camera records, 28-byte light records, 9-byte shadow records, then variable IK/display records (frame, display byte, count, 20-byte name plus enable byte per entry). Compare channel names with `asset-inventory.json`'s Cyber legs model. Record remaining bytes. The installed MMD Tools VMD reader source was also inspected for format context.

Result: all optional section counts were present, zero trailing bytes, bone maximum frame 348, morph maximum 341; camera/light/shadow counts zero; one IK/display record at frame zero. Exact matches: 57 of 260 bone channels and 20 of 74 morph channels. This is structural reconnaissance, not a validation of interpolation values, visual motion, bone axes, rig behavior or greeting suitability. It does not close TASK-014. The 30 fps interpretation gives 11.6 seconds to the final keyed timestamp, not a frame-rate field stored in VMD.

## Verification boundary

Completed here: research, read-only source inspection, architecture decision, task decomposition and controller/index integration. Not completed: VMD visual preview, five authored performances, alpha encoding, new web server, size/performance benchmarks or target-device playback. These belong to TASK-029 through TASK-038.

Documentation validation passed: 38 unique implementation task files/index rows; task/index status agreement; all implementation dependency IDs resolve and the graph is acyclic; TASK-038 feeds TASK-021 without a reverse child dependency; relative links resolve across the 17 new/updated Markdown documents; the VMD report parses and its SHA-256 matches the unchanged source. `git diff --check` reported no whitespace errors (only existing LF/CRLF conversion notices). No runtime test was needed for this documentation-only change.
