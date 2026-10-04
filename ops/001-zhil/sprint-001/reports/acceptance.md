# Ene Studio delivery evidence

Checkpoint: 2026-09-13. **Overall release remains in progress.** TASK-020 is now complete and archived; both soak presets pass the specification's frame-time gate. This report maps the agreed G1-G4 requirements to actual artifacts and measured evidence. It does not replace the outstanding operator checks. [TASK-P01](../tasks/active/TASK-P01.md) owns delivery; [TASK-021](../tasks/active/TASK-021.md) is the final acceptance gate.

## Available kit

| Deliverable | Local entry point |
| --- | --- |
| Reusable Ene Cyber legs avatar | [VRM](../../../../assets/avatars/ene.vrm), [editable export scene](../../../../assets/work/ene/vrm-work.blend), [mapping](../../../../config/avatars/ene.json), [conversion recipe](../../../../docs/avatar-conversion.md) |
| Webcam studio | [Start VModel.cmd](../../../../deploy/Start%20VModel.cmd), [quickstart](../../../../docs/quickstart.md), [operator check](../../../../docs/live-check.md) |
| OBS capture/recording | [OBS setup](../../../../docs/obs-setup.md), [recording guide](../../../../docs/recording.md); installed Landscape and Portrait scenes |
| Voice auditions and controls | [Start Voice Studio.cmd](../../../../deploy/Start%20Voice%20Studio.cmd), [voice guide](../../../../docs/voice-quickstart.md); Bright, Soft, Cool and explicit natural speech |
| Five website animations | [showcase guide](../../../../docs/web-showcase.md), [final media manifest](../../../../web-showcase/public/ene/manifest.json), [production/rebuild evidence](web-resource-production.md) |
| Installation and provenance | [Toolchain](toolchain.md), [software/model notices](../../../../docs/third-party-notices.md), [character attribution](model-notices.md) |

The final VRM SHA-256 is `3657b97928638e7ada5f6639141fb63f555912049a2c6ec217851001e322cbcb`. Original PMX/VMD, editable scenes, character media and recordings remain local/private and excluded from code distribution. No public stream or publication was performed.

## Avatar and live video

| Requirement | Current evidence | Acceptance state and remaining work |
| --- | --- | --- |
| G1-A identity | [Import](ene-import.md) and [final validation](ene-avatar-validation.md); actual Cyber legs views, textures, intentional cheek marks and fading legs retained | Avatar accepted. The supplied YouTube reference was not viewable, so exact video parity is not claimed. |
| G1-B rig | 53 humanoid mappings; independent reimport and 13 rig poses in [avatar validation](ene-avatar-validation.md) | Accepted for the reusable rig. Live tracking quality remains under G2. |
| G1-C expressions | Eleven exported expressions, independent blinks and vowels; [actual-Ene retarget fixtures](retarget-fixture-smoke.json) | Avatar expressions accepted. Operator blink/mouth response remains open in TASK-010. |
| G1-D portability | Editable sources, mapping/recipe, validated VRM, independent viewer/reimport; [reload/recovery](viewer-smoke.json) | Accepted in TASK-007/008. |
| G2-A face and torso | Real installed tracker executes positive photos; torso/head/blink/mouth fixtures and calibration controls exist | Physical head turn/nod, blink, speech and lean check pending. [Positive photos](tracking-positive-fixture.md) prove execution, not motion accuracy. |
| G2-B arms and hands | Actual-Ene arm/wrist/finger fixtures; real face/pose/hand detections after SDK timestamp repair | Operator arm raises, both-hand waves, finger movement and occlusion/reentry pending. |
| G2-C standing | Bounded root/knees, hidden-leg fallback and framing guidance implemented; deterministic fixtures pass | Head-to-feet camera framing, knee bends and small steps pending. A cropped still-photo workload cannot accept standing movement. |
| G2-D output | [Clean output](studio-output.md), [native OBS capture](obs-capture.md), two [10.566-second MP4 fixtures](obs-recording.md) with prerecorded audio | Required 60-second live landscape/portrait clips remain open. Virtual Camera registration was canceled at Windows confirmation; no consumer test. |
| G2-E usability | [Launcher ownership/restart](launcher-smoke.json), [bundle audit](bundle-audit.json), local quickstarts and installed OBS routes | Packaged launch accepted in TASK-019; a person following launch/calibrate/record/stop/restart remains pending. |
| G2-F robustness | [Camera/recovery/network](camera-reliability.md), [server-loss camera release](server-stop.md), [feasibility](feasibility.md), [heartbeat repair](output-layout-heartbeat.md), [combined performance](performance.md), [denied/missing/busy camera recovery](camera-denial-smoke.json), [minimize mechanism](capture-minimize-cause.md) | **Accepted in TASK-020.** A clean 30-minute two-phase soak completed with no errors: seated **58.14 fps / p95 44.4 ms** with **0 skipped OBS output frames of 27,069**, standing **58.48 fps / p95 39.8 ms** with **0 of 27,002**, zero blank captures in both, and both recordings verified at 720p h264. Memory growth is collectable garbage, not retention: one forced collection reclaimed 61.11 and 59.65 MiB against 50.70 and 60.37 MiB of growth. Offline operation recorded zero external requests under load. The earlier 1 Hz-and-white-stills failure now has a reproducing mechanism — **a minimized window delivers zero animation frames** (60.04 fps before, 0.00 minimized, 59.91 restored) — though it is not proven to be what happened originally. Denied, missing, busy and overconstrained camera states all report clearly and recover on retry. Physical device and reacquisition checks remain open. |

OBS captures the content of its selected window. Exact-title matching does not prevent a later tab change in that window; [measured lifecycle behavior](obs-window-lifecycle.md) informs the dedicated-window instructions. Camera frames stay within the local tracking app. Component recordings contain actual Ene and prerecorded test audio, without physical camera or microphone input.

## Character voice

| Requirement | Current evidence | Acceptance state and remaining work |
| --- | --- | --- |
| G3-A open source | Pinned RVC code, dependencies and separately tracked weights in [toolchain](voice-toolchain.md), [models](voice-models.md) and [license inventory](voice-license-inventory.json); local PCM bridge implemented | Provisioning accepted in TASK-022. Final selected live stack remains to be established; proprietary DirectML was only an unaccepted experiment. |
| G3-B cheerful English | Three licensed distinct character checkpoints converted the same public-domain English reference; [auditions](voice-auditions.md) | User preference, own-microphone English intelligibility and expressive speech unaccepted. TASK-027 training/no-training disposition awaits that decision. |
| G3-C experimentation | Bright/Soft/Cool selection, comparison, save/reset, mute and explicit natural speech; [UI evidence](voice-studio-ui-smoke.json), [natural mode](voice-natural-mode.md) | Controls implemented. Profiles remain provisional; no voice is labeled the accepted default. |
| G3-D feasible hardware | [RVC measurements](voice-performance.md), [LLVC fallback measurements](voice-llvc-plan.md) | RVC presets miss throughput; RVC GPU and LLVC ONNX state parity failed. Initial eager LLVC runs were slow, but an exact repeat passed all 577 compute deadlines with identical audio. The timing difference remains unexplained; paced/combined reproducibility and physical latency are open. The tentative A100/vLLM API still has no provided address/model or established conversion capability. |
| G3-E production audio | [Converted reference transport](voice-routing.md), installed [converted](voice-obs-setup.json) and [natural](voice-obs-natural-setup.json) sources | Physical input-to-output latency, headphones, continuous speech quality, lip sync and final converted-speech clips remain open. |
| G3-F everyday operation | Independent avatar/voice launchers, explicit mute/recovery, separate routes and [beginner guide](../../../../docs/voice-quickstart.md); [receiver restart](voice-reconnect-browser.json) and [installed launcher refresh](voice-launcher-receiver-refresh.json) | Both receivers recover across an isolated service restart with mocked Web Audio; changed route identities stop retry. The real launcher silently refreshed both installed OBS sources while preserving settings/sync/scenes and the existing service. Physical device recovery and thirty-minute combined live voice session remain open. |

Natural speech requires an explicit action and uses its own receiver; it is never a fallback after conversion failure and does not fulfill character-voice acceptance. Both installed voice sources are idle/silent until deliberate use. Natural UI and receiver restart tests mocked audio classes. OBS pages now have bounded output-only reconnect; the launcher can refresh verified idle sources. The browser restart check is not a native OBS CEF or physical audio test. OBS Virtual Camera carries video only; no external-call virtual microphone is installed.

## Website resources

| Requirement | Current evidence | Acceptance state and remaining work |
| --- | --- | --- |
| G4-A greeting | Accepted full-body greeting source, adapted after [VMD compatibility investigation](ene-vmd-compatibility.md); final five-second animation | TASK-031/036 accepted. It is an authored Ene-specific adaptation, not a claim of complete motion retargeting. |
| G4-B four desk states | Accepted normal/confused/surprised/excited three-second loops with shared desk composition; [production review](web-resource-production-review.md) | TASK-032 through TASK-036 accepted. The original reference screenshot was unavailable for exact image comparison. |
| G4-C lightweight resources | 408 master frames; five small/large WebM, animated WebP and poster families; [production audit](web-production-audit.json), [measured performance](web-resource-acceptance.md) | Accepted. Size/alpha/timing/bounds, cold loading, four sustained playback samples and a 602-second lifecycle check pass. |
| G4-D web setting | Final responsive welcome/desk website, reusable player, one active animation, fallback/recovery/accessibility controls; [showcase evidence](web-showcase.md) | TASK-037 accepted. Final Chrome/Edge/Firefox and Windows Playwright WebKit functional checks pass; physical mobile/Safari remain unverified. |
| G4-E reusable handoff | Editable scenes, deterministic cached rebuild, notices, integration guide; [rebuild evidence](web-resource-rebuild.md), [isolated bundle](web-bundle-audit.json), [final G4 report](web-resource-acceptance.md) | Accepted. TASK-029 through TASK-038 and TASK-P03 are archived Done; G4 is handed to overall acceptance. |

The isolated final website build has 45 files and 11,725 bytes of gzipped JS/CSS. It contains the website and rendered media, without the live avatar/ML/voice runtime. Windows Playwright WebKit is regression coverage, not Safari or iPhone hardware-codec certification. No physical Safari/iOS/Android device has been made available.

## Conditions still needed for release

- Operator camera/gesture and beginner workflow results, including standing and visible hands.
- A selected voice and a backend that passes live speed, continuity and English-quality gates. For the proposed internal service, its actual base URL and served model are still needed; no VPN scanning or capability assumption is used.
- Successful interactive Virtual Camera registration followed by a moving-Ene consumer check. The canceled prompt will not be retried automatically.
- Final one-minute portrait/landscape converted-speech clips, measured residual lip/audio mismatch and complete live soak evidence.
- Complete combined avatar/OBS measurements and address any unmet gates. Website performance/handoff is complete for the documented local Windows scope, with real Safari/mobile gaps retained.

These are explicit open acceptance rows, not waived requirements. The task register remains authoritative for lifecycle state; this matrix will be updated as new evidence arrives.


## 2026-09-13 addendum: resolved mechanisms and their limits

Three long-open questions were closed, and each is recorded with what it does **not** establish.

**The draw-cadence collapse and white captures have a reproducing mechanism.** A minimized Chrome window delivers zero animation frames, measured at 60.04 fps before, **0.00 fps minimized with `visibilityState` reporting `hidden`**, and 59.91 fps after restoring. Both original symptoms follow from that one cause. It is **not** established that the original failure was a minimize event, because no visibility state was recorded at the time; the harness now captures it. [Report](capture-minimize-cause.md).

Two hypotheses were eliminated along the way: [hybrid-core placement is rejected](capture-core-placement.md) for the render path (efficiency cores cost 13% of cadence, not 98%), and the [occlusion probes](capture-occlusion-investigation.md) never established their own condition — a null result that, inverted, usefully shows **covering the output window is harmless at a full 60 fps**.

**The LLVC voice timing discrepancy is explained.** This host is a hybrid i7-1255U; efficiency cores cost **2.32x** per neural call and miss 200/200 deadlines where performance cores miss 0/200, all measured on battery. Power state was a red herring. [Report](voice-llvc-hybrid-cores.md).

**Local LLVC does not meet the voice gates under ordinary load.** The paced proof passed once on a quiet machine and failed reproducibly four times under an open editor and browser, at roughly 65 ms per 52 ms chunk. Combined with the avatar, the **avatar is unaffected** (0.965 and 1.006 draw retention) while the voice fails on its first call. Pinning selects the performance cores but cannot reserve them. Recorded as a measured defect, not a pass. [Report](voice-combined-workload.md).

### Defects found and fixed

- The production typecheck was broken: `scripts/soak-health.mjs` shipped without the `.d.mts` declaration its sibling modules carry.
- A missing camera fell through to raw exception text. `NotFoundError` and `OverconstrainedError` now give beginner-usable messages.
- The fail-fast draw guard required three consecutive slow draws, so a lone 1,227 ms stall that wedged a recording passed unnoticed. It now also fails on a single gap over a second.

### Still gated on the operator

Nothing above touches live camera quality, voice preference, OBS Virtual Camera registration or the final recordings. Those remain the gate on the sixteen open tasks, listed for the user in [remaining checks](../../../../docs/remaining-checks.md).
