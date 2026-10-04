# TASK-P03: Own animated website resources and showcase delivery

- Status: Done
- Priority: P0
- Owner: Codex (implementing assistant)
- Goal: G4
- Parent controller: [TASK-P01](../active/TASK-P01.md)
- Depends on: None to start; completion requires TASK-029 through TASK-038 and the G4 handoff to TASK-P01.
- Estimate: Ongoing throughout website-resource implementation; included in delivery coordination.
- Specification: [Web character resources research and proposal](../../specs/web-character-resources-plan.md)
- Implementation register: [Backlog index](../backlog/README.md)

## Outcome

Deliver five lightweight animated Ene resources for the user's personal website: a full-body greeting informed by `ops/001-zhil/sprint-001/resources/ene.vmd` and four screenshot-inspired desk performances with normal, confused, surprised and excited expressions. Then deliver a simple local web UI server that showcases the completed resources in homepage and streaming-interface contexts.

This is the third workstream, tracked as G4 because G1/G2 cover the original avatar/performance kit and G3 already denotes voice. This controller coordinates TASK-029 through TASK-038. It runs alongside its children and is not a prerequisite that must complete before they start. Research and task creation do not constitute animation production.

## Work

- At each website-resource session, read this controller, the web specification, TASK-P01, the backlog index and relevant child tasks. Reconcile recorded status with actual artifacts and evidence before selecting dependency-ready work.
- Maintain the selected baseline: existing Ene Cyber legs rig, Blender/MMD Tools authoring, transparent pre-rendered WebM/WebP/poster media, and an isolated Vite showcase. Exclude Tripo and paid services/tools; no character regeneration is needed.
- Own source reuse, tool provisioning, VMD interpretation, animation art direction, expression quality, baking, rendering, encoding, component/server implementation, verification and beginner handoff within the authorized scope.
- Keep the five named performances explicit. Extra codecs/resolutions/posters are renditions, not extra creative resources. All four desk states retain the screenshot-inspired common camera/pose and distinct expressions; do not close them with still images or CSS-only motion.
- Use the first screenshot as a pose/composition reference while allowing the site's layout to change. Keep room/desk/chat/player chrome out of the character renders. Preserve actual Ene identity; do not claim a pixel-exact recreation of the AI illustration.
- Treat `ene.vmd` as reference motion for another model. Require visual inspection and documented adaptation in TASK-031; coordinate findings with TASK-014. An incompatible direct import does not remove the greeting requirement or block the other four animations.
- Reuse existing G1 source/toolchain evidence and coordinate needed shared fixes with TASK-004/005/006. Work in a separate source scene. G4's rendering subset must not wait unnecessarily for tracking/OBS/voice acceptance, and no G1-G3 task is marked Done by G4 evidence alone.
- Keep child tasks authoritative for status and acceptance. Maintain Ready, Todo, In progress, Blocked and Done consistently, recording concrete blockers, affected tasks, evidence, unblock action and responsible party. Lifecycle location follows the existing task-state helper.
- Require TASK-030's measured alpha/encoding spike before final production. Record actual sizes/performance and browser paths; proposals, `canPlayType()`, metadata and Playwright WebKit alone cannot certify transparent playback on Safari/iOS hardware.
- Track browser/device gaps honestly while continuing independent work. Default fallbacks must preserve animation when normal playback is expected; posters serve reduced-motion, pause, failure and loading states. Budget changes require reasons and updated proposal/task evidence.
- Prepare isolated player/layout code during TASK-036 rendering; final integration and TASK-037 acceptance require all five completed media families. Keep an isolated public/build directory so the existing VRM/tracking assets are not shipped with the showcase. No webcam/microphone/API/streaming backend is required.
- Preserve originals, existing authorization and required credits. Separate software notices, character terms, motion provenance and rendered output. Keep private source models and master frames out of the served media/code distribution. No repeated permission request is needed for the already authorized project work.
- End each session with changed artifacts, validation, current settings, blockers and exact next actions. Distinguish planned output paths from files that actually exist. Update this controller and index; summarize material G4/shared changes in TASK-P01.
- Close only after all ten children have evidence, TASK-038 passes, and G4 is handed to TASK-P01/TASK-021. Do not wait for TASK-021 to complete: it consumes G4 evidence as the overall gate, avoiding a circular dependency.

## Current checkpoint

Last updated: 2026-09-12, all ten children accepted and G4 handed to TASK-P01/TASK-021 for the tested local Windows scope.

- Scope: Ten implementation tasks, TASK-029 through TASK-038; controller excluded from implementation counts.
- Progress: 10/10 Done; 0 In progress; 0 Blocked; 0 Ready; 0 Todo.
- Active: None. TASK-029 through TASK-038 are archived. The [final G4 acceptance report](../../reports/web-resource-acceptance.md) has been delivered to TASK-P01/TASK-021 coordination; it preserves actual Safari/mobile and screenshot-reference gaps.
- Showcase checkpoint: [Final UI/build/browser report](../../reports/web-showcase.md), [launch and integration guide](../../../../../docs/web-showcase.md), and [isolated bundle/hash audit](../../reports/web-bundle-audit.json). Final Chrome/Edge/Firefox functional cases pass with WebM; Windows Playwright WebKit's applicable cases pass with animated WebP. Initial JS/CSS is 11,725 gzip bytes. Actual Safari/iOS/Android remains unverified.
- Measurement checkpoint: [Cold final-showcase load](../../reports/web-showcase-measurement-cold.json) passes at 10 Mbit/s and 100 ms with cache disabled: small WebM visible in 1,531 ms, animated WebP fallback in 1,920 ms. Selected-only family requests pass. [Four playback samples](../../reports/web-showcase-measurement-playback.json) exceed 61 seconds each, with zero measured-interval WebM drops at both sizes and actual WebP motion/CPU/memory evidence. [Lifecycle](../../reports/web-showcase-measurement-lifecycle.json) passes 20 full-loop warm-up switches plus 602.21 seconds and 20 additional switches: one active animation and exactly 160 DOM elements throughout; non-monotonic private-memory samples, with +87.07 MiB (7.7%) early/late median change. All owned measurement browsers/servers are closed.
- Final production: [Measured production report](../../reports/web-resource-production.md), [final source/codec visual review](../../reports/web-resource-production-review.md), [exact 42-file audit](../../reports/web-production-audit.json), [unchanged single-resource rebuild](../../reports/web-production-rebuild.json), and [rebuild guide](../../reports/web-resource-rebuild.md). All 408 RGBA masters and five large/small media families are complete; total staged bytes are 26,066,834, all budgets pass, and original PMX/VMD/G1 Blend/VRM hashes remain unchanged.
- Production checkpoint: [Four-frame timing run](../../reports/web-production-timing.json) completed in 24.67 seconds; steady full-size frames took 3.15–3.78 seconds. [Resumable renderer](../../../../../scripts/render_web_masters.py) verifies cached RGBA PNGs, uses four CPU threads and stops between frames on the private pause flag. [Sequential batch](../../../../../scripts/produce_web_resources.py) renders and encodes one family at a time; only completed files enter the partial manifest, and the final manifest requires all five.
- Four-state evidence: [Confused](../../reports/web-resource-desk-confused.md), [surprised](../../reports/web-resource-desk-surprised.md), [excited and four-state comparison](../../reports/web-resource-desk-excited.md), [private playback](../../reports/local/web-resources/desk-states-review.html), [decoded-alpha/playback checks](../../reports/web-desk-states-browser.json).
- Greeting evidence: [Adaptation/animation report](../../reports/web-resource-greeting.md), [all-frame audit](../../reports/home-greeting-audit.json), [actual browser playback/seek/alpha](../../reports/web-drafts-browser.json).
- Normal baseline evidence: [Desk report](../../reports/web-resource-desk-normal.md), [locked baseline](../../../../../config/web-resources/desk-baseline.json), [private playable drafts](../../reports/local/web-resources/review.html).
- Feasibility evidence: [Measured report](../../reports/web-resource-feasibility.md), [encoding sweep](../../reports/web-spike-encoding.json), [small browser paths](../../reports/web-spike-browsers.json), [large Chrome path](../../reports/web-spike-browsers-large.json), and [selected settings](../../../../../config/web-resources/encoding.json).
- Implementation evidence: [Toolchain report](../../reports/web-resource-toolchain.md), [reopened source/control audit](../../reports/web-source-audit.json), [RGBA render measurements](../../reports/web-spike-render.json), and [real encoder smoke](../../reports/web-encoder-smoke.json).
- Research evidence: [Cited proposal](../../specs/web-character-resources-plan.md), [research record](../../reports/web-resource-research.md), and [VMD structural inspection](../../reports/web-resource-vmd-inspection.json).
- Existing shared artifacts: Imported Ene source, 83.6 MiB VRM and import/toolchain/preview reports exist. These are inputs, not accepted G4 resources.
- Selected configuration: Blender/MMD Tools RGBA masters, explicit RGBA resize intermediate, 24 fps WebM CRF34 plus animated WebP Q65/compression4, Q85 posters. Three-second desk loops and five-second greeting. All final rendition/poster byte ceilings pass without revision. Small rendition is preferred at ordinary display sizes; large WebP has higher browser memory cost. No Tripo.
- Key finding: Current Kizuna AI homepage embeds a looping MP4; the older screenshot's implementation is unverified. The supplied VMD targets another model, with 57/260 exact bone-name matches and 20/74 morph-name matches to Ene.
- Remaining evidence gaps: Actual macOS Safari, iOS Safari and Android Chrome are untested/unpassed; the original screenshot attachment cannot be compared directly. No local Windows release-blocking defect remains. No byte-budget revision was needed. Future subjective art-direction changes remain possible without being represented as already requested.
- User input currently required: None for the delivered local kit. Physical-device access would be needed to establish the explicitly missing device results.
- Verification boundary: All five resources have editable 24 fps actions and final large/small transparent WebM/WebP/poster media. Every final frame decodes with alpha and correct timing; 320/640 CSS px source comparisons, exact file/build audits and final local Windows loading/playback/lifecycle gates pass. This closes G4's delivered local scope, not G1/G2/G3 or final TASK-021. The original screenshot attachment was unavailable; composition follows the written brief and direct visual comparison is unverified. No Safari/iOS/Android hardware coverage is claimed.

### Milestone tracker

| Milestone | Task | Current state | Required evidence |
| --- | --- | --- | --- |
| Reusable source and encoders | [TASK-029](TASK-029.md) | Done | Isolated source/reopen audit, pinned encoders, terms and alpha smoke |
| Lightweight alpha feasibility | [TASK-030](TASK-030.md) | Done | 48-frame sample; encoder sweep, decoded alpha, Chrome/Firefox/WebKit fallback and laptop measurements |
| Full-body greeting | [TASK-031](TASK-031.md) | Done | New VMD-informed five-second action; editable pre-secondary scene, corrected palm return, exact loop, full silhouette and animated preview |
| Common desk/normal | [TASK-032](TASK-032.md) | Done | Editable pre-secondary/baked actions, exact loop, stable wrist/guide, 320 CSS px and animated playback review |
| Confused | [TASK-033](TASK-033.md) | Done | Distinct expression/action and visual evidence |
| Surprised | [TASK-034](TASK-034.md) | Done | Distinct expression/action and visual evidence |
| Excited | [TASK-035](TASK-035.md) | Done | Distinct expression/action and four-state comparison |
| Five final media families | [TASK-036](TASK-036.md) | Done | 408 RGBA masters, 42 staged files, exact hashes, every-frame alpha/timing, 320/640 px visual review, unchanged cache rebuild |
| Web showcase/server | [TASK-037](TASK-037.md) | Done | Final all-five HTTP browser matrix, responsive UI, fallback/error/lifecycle controls and exact isolated build/hash audit |
| G4 acceptance/handoff | [TASK-038](TASK-038.md) | Done | Final G4 evidence map, cold load, four sustained-playback samples, 20-switch warm-up/ten-minute lifecycle, reusable handoff and explicit device gaps |

### Next actions

1. Use the [showcase guide](../../../../../docs/web-showcase.md) to launch the completed local package or integrate its reusable player into the personal website.
2. TASK-P01/TASK-021 consume the [G4 acceptance report](../../reports/web-resource-acceptance.md) alongside the independent avatar, camera/OBS and voice evidence. No remaining G4 implementation child is active.
3. If physical Safari/iOS/Android access becomes available, run the same transparency/playback/layout cases on those devices and append actual results; do not reinterpret Windows WebKit or mobile viewport tests as device certification.

## Session and decision log

| Date | Event | Evidence / consequence | Next action |
| --- | --- | --- | --- |
| 2026-09-12 | User requested third workstream research, proposal and TASK-P03 | Inspected source assets, VMD structure, current Kizuna site and official format/tool sources; selected transparent rendered media; added G4 and ten children | Start TASK-029 when resource implementation is requested |
| 2026-09-12 | TASK-029 and TASK-030 accepted and archived | Isolated Cyber legs source reopens; pinned FFmpeg/libvpx/libwebp; 48-frame RGBA sample; final WebM/WebP alpha and fallback pass. Chrome 60-second small WebM had zero drops. Windows WebKit uses animated WebP; actual Safari/mobile remains untested. | Author TASK-031 greeting and TASK-032 normal desk using measured settings |

| 2026-09-12 | TASK-031 and TASK-032 accepted and archived; TASK-033/034/035 active | Five-second VMD-informed greeting and three-second normal desk loop; editable pre-secondary/baked scenes; exact endpoints, stable desk contact, actual decoded alpha and paused seek/pixel checks; originals unchanged. Screenshot attachment comparison remains unverified. | Author and visually compare the three expression variants, then final media production |

| 2026-09-12 | TASK-033/034/035 accepted and archived; TASK-036 active | Three genuine desk variants with exact endpoints, fixed contact/camera, 5% safe inset, 320 px comparison and decoded WebM/WebP alpha. Excited mouth/eye choices were refined from actual source renders; parent reviewed distinct expression reads. | Render 408 final master frames; encode and audit five large/small media families |

| 2026-09-12 | TASK-036 through TASK-038 accepted; all ten children complete | 408 full-size RGBA masters, five large/small families, exact 42-file public/45-file build audits, all-four-engine functional matrix, 1.53/1.92 s cold animation, four >61 s playback samples and 602.21 s lifecycle pass. Rebuild is hash-identical. Real Safari/mobile remains unverified. | G4 acceptance/report and integration kit handed to TASK-P01/TASK-021; controller closed without waiting on overall live acceptance |

Append any later evidence or reopened scope explicitly; the accepted local delivery above is the current checkpoint.

## Acceptance criteria

- [x] TASK-029 through TASK-038 statuses agree with this controller/index, and material G4 changes are reflected in TASK-P01.
- [x] All five requested resources are actual animations made from Ene; the greeting documents use of the supplied VMD reference and the four desk states have the required distinct expressions.
- [x] Measured transparent animation/poster renditions and manifest satisfy the recorded quality, performance and browser requirements; unperformed checks are explicit.
- [x] A simple local showcase presents completed media in homepage/stream layouts with responsive controls, fallback and reduced-motion behavior.
- [x] Editable source, reproducible no-paid-service render/encode recipe, credits, quickstart and integration example are delivered.
- [x] TASK-038 is Done, final artifacts/limitations are linked and G4 acceptance is handed to TASK-P01/TASK-021.

## Implementation notes

This is a progress/delivery controller, not a background process. It does not request sub-agent delegation or alter child dependencies. Proceed within the user's authorized session scope; controller creation alone does not start animation implementation or publish a website.
