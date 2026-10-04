# Evaluation of the model library and tracking research

Date: 2026-10-04. Source revision: `9426e17`. Author: Codex. Audience: VModel implementers and the product owner.

Both research documents provide a useful basis for implementation. Neither document is a complete product specification. Proceed with a local model library and a Tracking Inspector. Keep tracker corrections behind measured diagnosis.

The Tracking Inspector is a studio view that shows observations, solver decisions, and avatar motion. A solver converts landmark positions into bone motion.

## Documents and evidence

| Document | Assessment | Necessary addition |
| --- | --- | --- |
| [Model library research](../research/vrm-library-and-registration.md) | The storage recommendation fits the current local browser application. The identity and cancellation rules address actual model differences. | Define transaction limits, backup format, selection failures, resource limits, and visible states. |
| [Tracking research](../research/tracking-diagnostics-and-improvement.md) | The document correctly separates observations, solver behavior, and avatar appearance. It does not claim a proven camera fault. | Define clocks, replay events, buffer limits, diagnostic ownership, test targets, and conditional correction tasks. |

I checked the source files below. The observations concern the inspected revision, not later changes.

| Finding | Evidence | Design consequence |
| --- | --- | --- |
| The catalog contains Ene and Rei. Selection persistence supports only these entries. | [avatars.ts](../../../../src/avatars.ts) | Add imported entries behind a common repository interface. |
| The viewer disposes the old VRM before `main.ts` completes retargeter setup. | [viewer.ts](../../../../src/viewer.ts), [main.ts](../../../../src/main.ts) | Prepare the viewer and retargeter before the selection commit. |
| The loader checks the magic bytes and required bones. It blocks external URLs during decode. | [viewer.ts](../../../../src/viewer.ts) | Add structural inspection and allocation limits before decode. |
| Settings use asset hashes. Calibration also uses camera, mode, and format. | [profiles.ts](../../../../src/profiles.ts) | Preserve these keys. Do not copy calibration to changed bytes. |
| Output peers request missing model bytes through periodic messages. | [output-link.ts](../../../../src/output-link.ts) | Add selection revisions and explicit output load results. |
| Face runs on each admitted frame. Pose and hands run every second or third frame. | [tracking.worker.ts](../../../../src/tracking.worker.ts), [camera.ts](../../../../src/camera.ts) | Count distinct task samples. Renderer FPS cannot establish useful motion rate. |
| Freshness allows ages from -50 ms to less than 500 ms. Confidence requires values above 0.55. | [retarget.ts](../../../../src/retarget.ts) | Preserve exact boundary behavior during instrumentation. |
| Several solver paths return no result without a reason. | [limb-solver.ts](../../../../src/limb-solver.ts), [retarget-math.ts](../../../../src/retarget-math.ts) | Add reasons at the rejecting branch. Do not infer reasons from motion. |
| The studio already uses dark blue surfaces and cyan controls. | [style.css](../../../../src/style.css) | Extend this visual design with readable labels and consistent spacing. |
| The task audit assumes 38 tasks and three controllers. | [task_audit.py](../../../../scripts/task_audit.py), [task_state.py](../../../../scripts/task_state.py) | Extend task accounting for the new implementation scope. |

## Assessment of the recommendations

Accept the browser storage recommendation. IndexedDB transactions can store records and Blobs together. Storage remains specific to an origin and browser profile. [IndexedDB guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)

Require disk backups for recovery. Persistent storage requests do not remove quota limits or user deletion. Do not recommend browser storage as the only copy. This corrects the library research's final implementation step. [Storage limits](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

Preserve VRM metadata fields and original terms. A save acknowledgment records a user action. It does not settle conflicting terms. [VRM metadata specification](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/meta.md)

Accept the four tracking layers. Pose world points and hand world points use different origins. Keep separate views before any calculated alignment. [Pose results](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [hand results](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)

Retain MediaPipe and the current solver for the first release. A replacement solver cannot prove better camera observations. A larger model can increase inference time. These are design conclusions, not new benchmark results.

Treat 15 Hz and 150 ms as experiment targets. The supplied photo tests do not establish sustained live performance. Physical camera tests remain necessary.

## Risks and treatment

| Risk | Importance | Required treatment | Owner |
| --- | --- | --- | --- |
| Large VRMs exhaust graphics memory during preview. | High | Permit one candidate. Bound decoded resources. Measure Ene and Rei with output open. | TASK-P04 |
| A failed selection replaces a usable model. | High | Prepare first. Commit synchronously. Keep the old selection on preparation failure. | TASK-P04 |
| Browser data disappears. | High | Show storage state. Supply verified backup and restore. Keep bundled models available. | TASK-P04 |
| A delayed result draws on the wrong camera image. | High | Retain matched task images. Label cached sample ages. | TASK-P05 |
| Replay uses the current clock or loses solver history. | High | Record application events. Reset history and replay from the start on seek. | TASK-P05 |
| Diagnostics change tracker behavior. | High | Test inspector-off parity and enforce separate diagnostic messages. | TASK-P05 |
| A neat skeleton hides observation errors. | Medium | Keep raw points and estimated depth distinct from constrained motion. | TASK-P05 |
| Dense controls reduce stage space. | Medium | Use separate views and an optional detail panel. Test narrow layouts. | TASK-P04 and TASK-P05 |
| Live movement evidence is unavailable. | High | Keep diagnosis and physical acceptance open. Continue independent implementation. | TASK-P05 |

## Evidence limits

This evaluation includes source inspection and checks of primary online documents. It includes no new camera session, import measurement, visual runtime acceptance, or legal interpretation.

The research's Rei size, hash, and terms remain supplied evidence. Implementation must verify the actual local bytes and notices before fixture acceptance.

The official STE PDF and FAQ returned HTTP 403 during this review. The text follows the repository language rules. Full STE compliance needs a person to check both parts of the standard.

## Result

Proceed through the [action plan](../specs/studio-evolution-plan.md), [decision record](../specs/studio-design-decisions.md), and [product specification](../specs/studio-product-spec.md). The specification controls new implementation requirements. The research remains unchanged as source evidence.
