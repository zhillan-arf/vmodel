# MediaPipe model notices

Audit date: 2026-09-12. **The three pinned tracking bundles have sufficient primary publisher evidence to identify their model license as Apache-2.0.** The remaining model-license inventory for TASK-002 is resolved. This finding is separate from functional/live acceptance and from the rights to Ene or future voice models.

The evidence is the explicit license statement inside each model card, linked by Google's official model-download table. The documentation footer's license was not used as a model-weight license. [Machine-readable notice inventory](../../../../config/model-notices.json) and [retained Apache-2.0 text](../../../../config/notices/Apache-2.0.txt) accompany this report.

## Primary license evidence

| Pinned bundle | Publisher's model-download row | Direct model license evidence |
| --- | --- | --- |
| `face_landmarker.task`, float16/1 | [Face Landmarker models](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker#models) links the detector, mesh and blendshape cards alongside the bundle. | [BlazeFace Short Range, page 1](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20%28Short%20Range%29.pdf), [Face Mesh V2, page 1](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf), and [Blendshape V2, page 1](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf) each explicitly identify Apache License, Version 2.0. |
| `pose_landmarker_lite.task`, float16/1 | [Pose Landmarker models](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker#models), specifically the **Lite** row, links this card. | [BlazePose GHUM 3D, page 2](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf) explicitly identifies Apache License, Version 2.0. This conclusion does not depend on assuming a statement about the Full bundle covers Lite. |
| `hand_landmarker.task`, float16/1 | [Hand Landmarker models](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker#models) links the card for the full hand pipeline. | [Hand Tracking Lite/Full, page 2](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf) explicitly identifies Apache License, Version 2.0 for the detector/tracker model description. |

The Face Landmarker bundle also contains geometry-pipeline metadata. Its corresponding [MediaPipe source metadata](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/face_geometry/data/geometry_pipeline_metadata_landmarks.pbtxt) carries an explicit Apache-2.0 header attributed to The MediaPipe Authors, 2023. The task bundle remains unmodified.

## Exact file identity

The official tables currently link `/float16/latest/`, while this project deliberately downloads `/float16/1/`. HEAD requests to both URLs for each model reported equal MD5, ETag and byte length. Those values matched the already-downloaded local files. Local SHA-256 values were recomputed and matched [runtime-assets.json](../../../../config/runtime-assets.json). No large model was downloaded again.

| Local bundle | Bytes | Local SHA-256 | Publisher MD5, same for `/1/` and `/latest/` |
| --- | ---: | --- | --- |
| `face_landmarker.task` | 3,758,596 | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` | `b0e7274907a1644404fef66b28dd6d85` |
| `pose_landmarker_lite.task` | 5,777,746 | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` | `04a75ddf7c811ac7a1a4523266dd7d88` |
| `hand_landmarker.task` | 7,819,105 | `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1` | `15318430ea3851670fe9914116a9cfad` |

The exact versioned download URLs are retained in both manifests. SHA-256 is a local integrity pin, not an independently published publisher checksum. The publisher MD5/length comparison establishes the documented alias correspondence observed on this audit date; future `/latest/` updates do not change our pinned `/1/` selection.

The local ZIP contents were inspected without extraction or modification:

| Bundle | Members |
| --- | --- |
| Face | `face_detector.tflite`, `face_landmarks_detector.tflite`, `face_blendshapes.tflite`, `geometry_pipeline_metadata_landmarks.binarypb` |
| Pose Lite | `pose_detector.tflite`, `pose_landmarks_detector.tflite` |
| Hand | `hand_detector.tflite`, `hand_landmarks_detector.tflite` |

The TFLite `Model.metadata` entries were read through their buffer references using the [official metadata schema](https://github.com/tensorflow/tflite-support/blob/master/tensorflow_lite_support/metadata/metadata_schema.fbs). Available model metadata identifies MediaPipe as author but has empty license fields; the blendshape file has no `TFLITE_METADATA` entry. The pose detector even contains a generic face-detector name/description. Those labels were not treated as stronger evidence than the official bundle row and linked model card. No separate LICENSE or NOTICE member was present in the task ZIPs.

## Use and packaging boundary

Apache-2.0 provides the project basis for local use and redistribution of these unmodified model bundles, subject to its conditions. A redistributed kit must carry the license text and applicable attribution/notices, identify modifications if any, and preserve any upstream NOTICE material supplied with future revisions. The exact conditions are in the [Apache license, especially section 4](https://www.apache.org/licenses/LICENSE-2.0). This audit retains the text and a model attribution/provenance inventory; the final packaging task should include both with the distributed files.

This model inventory does not apply the software license to Ene, other character assets, training datasets or voice weights. Ene continues to use the supplied permission and asset terms. No character model or camera data was uploaded or published during this audit.

The source cards also describe intended use and accuracy limitations. They are relevant to gesture acceptance and occlusion fallback; they do not make a successful license audit a physical camera test. No unresolved model-license term was found that requires stopping the existing local implementation.

## Telemetry is a separate SDK boundary

The [June 10 maintainer clarification](https://github.com/google-ai-edge/mediapipe/issues/6306#issuecomment-4673728357), read through the GitHub API, was authored by `schmidt-sebastian` with collaborator association. It explicitly permits blocking outgoing telemetry requests while continuing normal SDK use, and separately identifies the exact Pose **Full** float16/1 bundle as Apache-2.0. That Full-specific statement is corroborating context; the Lite conclusion above uses Lite's own official download-row/card association.

The comment's statement about the Web SDK having no telemetry describes its June 10 version. It does not supersede the installed 1.0.1 bundle inspection or our external-request policy. The tested local CSP and 70-second request monitoring remain documented in [camera-reliability.md](camera-reliability.md).

## Verification scope

Completed: three official model tables, all five linked model cards, exact/published-alias HEAD metadata, local SHA-256 and MD5 checks, ZIP-member inventory, embedded model metadata, geometry metadata source license, and the existing maintainer clarification. The separate notice JSON was parsed and checked against every pinned task URL/hash/size. A separate file is used because `scripts/provision_runtime.mjs` regenerates `runtime-assets.json` and would discard extra notice fields.

TASK-002 may use this report to close its remaining model-provenance item after its existing installation/initialization evidence is reconciled. This audit did not change TASK-002's status or any controller counts.
