# Model library and tracking design decisions

Date: 2026-10-04. Status: selected for implementation. Author: Codex, under the user's request to make the design decisions.

This record resolves the design questions in both research documents. A conditional decision includes a test and a default result. It does not leave an implementation choice unspecified.

Use the [product specification](studio-product-spec.md) for exact data fields, limits, and acceptance. Use the [evaluation](../reports/studio-research-evaluation.md) for source evidence.

## Selection criteria

Prefer reliable local operation, visible failure states, and preservation of existing behavior. Then consider implementation cost, measured performance, recovery, and visual quality. A visual improvement cannot remove evidence or obscure a failure.

## Model library decisions

| ID | Question and alternatives | Evaluation | Selected decision | Owner and change condition |
| --- | --- | --- | --- | --- |
| D01 | Browser database, OPFS, local SQLite, or cloud? | IndexedDB fits the current browser. OPFS adds reconciliation. SQLite adds a write service. Cloud adds accounts and transfer. | Use IndexedDB with Blobs and atomic records. | P04; reconsider only after measured browser limits. |
| D02 | Which origin owns saved models? | Different ports and host names have separate storage. Automatic discovery is unavailable. | Use `http://127.0.0.1:4173` for normal launch. Explain export before an origin change. | P04; launcher change requires a migration procedure. |
| D03 | Entry identity or byte identity? | Names can change. Calibration depends on exact model bytes. | Use UUIDs for imported entries and SHA-256 for assets. Preserve `ene` and `rei`. | P04; schema migration requires compatibility tests. |
| D04 | Allow duplicate entries or merge identical bytes? | Duplicate entries confuse selection and waste storage. | One imported entry per hash. Offer select or rename. Treat changed bytes as a new entry. | P04; no automatic version chain in version 1. |
| D05 | Copy bundled bytes into the database? | Bundled files already exist. Copies increase storage and recovery work. | List bundled entries through the repository. Copy bytes only into an explicit portable backup. | P04; source assets remain immutable. |
| D06 | Migrate settings now or retain current keys? | Existing settings and calibration already use the right identity. | Retain localStorage keys. Back up settings as optional data. Exclude camera calibration from version 1 backups. | P04; recalibrate after restore. |
| D07 | Accept archives, MMD, or native VRM? | Runtime conversion adds tools and uncertain fidelity. | Accept one native `.vrm` per import. Keep authoring conversion separate. | P04; archive selection gets extraction guidance. |
| D08 | Validate after load or before decode? | A byte limit alone cannot bound decoded graphics allocation. | Add structural preflight and decoded resource ceilings. Reuse runtime bone policy. | P04; test limits with Ene, Rei, and VRM 1. |
| D09 | Replace the active model for preview? | Preview failure could stop an active performance. | Use one disposable preview. Keep the active model and output intact. | P04; reduce preview resolution before relaxing resource limits. |
| D10 | Save also selects, or separate actions? | Implicit selection can change a stream unexpectedly. | Save without selection. Offer a separate `Use model` action. | P04; no automatic selection after restore. |
| D11 | Commit model and output together? | Separate windows cannot share one atomic graphics commit. | Commit the studio first. Track output revisions and load results. Show output mismatch until recovery. | P04; never claim cross-window atomicity. |
| D12 | Infer permissions or preserve original terms? | Embedded metadata and attachments can disagree. | Preserve both. Require acknowledgment of displayed terms. Make no automatic legal conclusion. | P04; user publication remains outside import. |
| D13 | Delete active entries or require replacement? | Deletion can invalidate the current or remembered selection. | Disable removal for locally active entries. Require another successful selection first. | P04; remote deletion keeps current bytes until session end. |
| D14 | ZIP, JSON base64, or a binary backup? | ZIP needs decompression limits. Base64 expands bytes. A small binary container avoids both costs. | Use an uncompressed `VMLIB1` container with a bounded JSON manifest and binary segments. | P04; format details are fixed in L11. |
| D15 | Overwrite on restore or additive merge? | Overwrite can destroy usable local entries. | Validate all segments first. Restore all new entries in one transaction. Keep existing names and settings on conflict. | P04; reject unsupported schema versions without writes. |
| D16 | Automatic persistence and storage recovery? | Persistence can fail. Estimates do not reserve capacity. | Request persistence after the first explicit save. Show actual status and a backup reminder. | P04; quota failure leaves no partial entry. |

## Tracking decisions

| ID | Question and alternatives | Evaluation | Selected decision | Owner and change condition |
| --- | --- | --- | --- | --- |
| D17 | Replace MediaPipe or expose current results? | The failed stage is unknown. Replacement would change several factors. | Instrument the current worker and solver first. | P05; replacement needs a separate measured proposal. |
| D18 | Always send diagnostics or make them optional? | Dense face data and copies can consume time and memory. | Use a separate versioned envelope only for inspector or recording demand. | P05; inspector-off behavior must remain equivalent. |
| D19 | Use render FPS or distinct task samples? | Cached arrays and skipped tasks inflate inferred rates. | Count unique task sequence IDs. Measure age at receipt, solver use, and display. | P05; keep legacy timestamps at the runtime boundary. |
| D20 | Overlay on live video or matched samples? | Delayed observations can appear wrong on a newer image. | Show the matched image for the selected task. Offer live context with an explicit age label. | P05; never imply cached tasks share one image. |
| D21 | Join all 3D points or separate coordinates? | Pose, hand, and face outputs have different coordinate meanings. | Separate pose and hand views. Label optional wrist alignment as calculated. | P05; calibrated global fusion is out of scope. |
| D22 | Use a VRM as the only motion reference? | Model rest axes and proportions can hide the cause. | Add a canonical skeleton with fixed proportions and the same solver code. | P05; compare semantic rotations with Ene and Rei. |
| D23 | Guess rejection reasons or instrument branches? | A still avatar does not identify a failed gate. | Return typed reasons from the actual rejecting branch. Preserve current thresholds initially. | P05; branch parity tests precede tuning. |
| D24 | Save video by default or save observations? | Video adds personal data and storage cost. Observations support solver replay. | Record bounded observations after an explicit action. Make video a separate optional action. | P05; no background recorder or upload. |
| D25 | Seek directly or replay solver history? | Smoothing and association history affect later results. | Record application events and delta times. Reset and replay from the start on seek. | P05; add checkpoints only if measured seek time requires them. |
| D26 | Pause the performance when the inspector pauses? | Diagnostic inspection must not interrupt live output. | Freeze inspector display only. Run replay through an isolated solver and viewer. | P05; live camera controls stay separate. |
| D27 | Raise stale limits or alter scheduling? | A larger timeout displays older motion. Task costs vary. | Retain the 500 ms gate. Test deadline scheduling only after a measured timing fault. | P05; retain current scheduling if the experiment fails. |
| D28 | Lower confidence globally or tune each cause? | Broad changes can produce wrong limb or hand motion. | Test association history, hysteresis, mapping repair, or head filters separately. Use 1€ only after fixed response speeds fail. | P05; accept only changes that pass regression limits. |
| D29 | Require 15 Hz immediately or measure first? | Existing evidence does not establish laptop capacity. | Use 15 Hz and 150 ms as experiment targets. Use relative correction gates in T16. | P05; report target misses without declaring success. |
| D30 | Buy cameras or first test monocular limits? | Extra cameras need calibration and time alignment. | Defer multi-camera and dedicated hand hardware. Record an escalation report only after repeatable sensing failures. | P05; no hardware purchase or extra service in this backlog. |

## Product and visual decisions

| ID | Question and alternatives | Evaluation | Selected decision | Owner and change condition |
| --- | --- | --- | --- | --- |
| D31 | New application or integrated views? | Separate applications duplicate selection and tracker state. | Add `Studio`, `Library`, and `Tracking` views within the existing application. | P04; output URLs remain dedicated to clean output. |
| D32 | New visual identity or extend current style? | Existing dark blue and cyan suit the studio and keep the avatar prominent. | Retain that palette. Add defined spacing, type sizes, surface levels, and focus states. | P04; visual acceptance uses U01 through U08. |
| D33 | Dense dashboard or progressive detail? | Persistent graphs crowd the stage and distract from motion. | Show summary states first. Put exact values and metadata in a detail panel. | P05; never hide the first failure reason. |
| D34 | Animated decoration or functional motion? | Decoration increases distraction and rendering cost. | Use short state transitions only. Respect reduced motion. Keep scene backgrounds quiet. | P04 and P05; no decorative camera or skeleton animation. |
| D35 | Expand old tasks or add bounded controllers? | Existing tasks retain unfinished physical acceptance. Large controller scope obscures ownership. | Add P04 for G5 and P05 for G6. Keep P01 as the overall controller. | P01; TASK-021 consumes both handoffs. |
| D36 | Ship diagnostics as proof of a tracking fix? | Better visibility does not establish better movement. | Accept the inspector separately. Require physical diagnosis and correction verdicts before G6 completion. | P05; leave unavailable live checks open. |

## Conditional outcomes

No product or architecture decision awaits a user answer. Physical evidence is still necessary for implementation acceptance.

| Condition | Test owner | Required decision after measurement | Default if the condition is absent |
| --- | --- | --- | --- |
| Timing is the first failing stage. | TASK-057 | Adopt deadline scheduling only if T16 passes. | Keep the current scheduler and record why. |
| Association or smoothing causes the fault. | TASK-058 | Adopt one tested correction at a time. | Keep the current association and filter behavior. |
| Camera placement causes the fault. | TASK-056 and TASK-059 | Add specific guidance and verify the same gesture again. | Do not prescribe new camera hardware. |
| Hidden joints or ambiguous depth remain the limit. | TASK-059 | Document sensing limits and a separate experiment proposal. | Do not add triangulation or learned temporal models. |
| Import exceeds the specified resource ceiling. | TASK-047 | Reject the file with the measured limit and recovery text. | Do not raise limits automatically. |

Any later design change must name the affected decision, requirement, evidence, and task. A failed experiment is useful evidence. It is not permission to claim an unmet acceptance result.

## D08 revision: required Rei compatibility

Date: 2026-10-04. Requirements: L04 and L13. Tasks: TASK-042 and TASK-047.
The unchanged Rei model exceeds the original pixel and combined ceilings.
Its measured estimates are 145,752,064 pixels and 797,235,598 resource bytes.
Select fixed ceilings of 201,326,592 pixels and 1,024 MiB combined resources.
All other ceilings remain unchanged. Files cannot raise these ceilings automatically.
Rei passes browser preparation with these ceilings and retains its original hash.
The [original rejection](../reports/rei-original-limits.json) and [revised check](../reports/rei-library-smoke.json) provide evidence.
This revision preserves original model bytes and terms. It does not establish target-laptop memory capacity.
TASK-047 must still measure process memory before release acceptance.
