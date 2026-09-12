# Voice-model inventory: TASK-022

Updated 2026-09-12. Three character candidates are provisioned locally. Names below are audition labels, not user-accepted voices or English-quality ratings. No real user's speech was recorded or uploaded.

## CHIHAYA original-character pack

Creator 鶴乃 / distributor ちはや神社 explicitly licenses the model weights, index, illustrations and samples under MIT and describes the voice as a blend of consenting speakers. The publisher documents RVC v2, no F0, 40 kHz and index ratio zero. The retained description recommends an input **CHUNK near two seconds** for clean speech; past context with a much smaller chunk is not proven equivalent. This supports acquisition and testing; it does not establish low-latency English speech. [Creator's documentation](https://note.com/aisoiikei_turuno/n/n262c358700a5), [distribution page](https://chihaya369.booth.pm/items/4701666).

We used w-okada's public distribution at revision `c46962577db8cf3fba2b3fc3526af98eb6611840`, whose bundled `description.txt` preserves those terms and the creator links. Its exact SHA-256 is `7d84b5e3c30a47589c57d68c49ed79e86c6ca2469dd119887ddfc3f851f06b1c`. [Pinned description](https://huggingface.co/wok000/vcclient_model/blob/c46962577db8cf3fba2b3fc3526af98eb6611840/rvc_v2_chihaya_jinja/description.txt).

| Candidate | Downloaded target | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Bright / crisp | `V2-AISO-SYAKITTO.pth` | 55,074,757 | `569257d45848dada4ba604dfb9a60496d3043eb112e82c81d71eb37be942be50` |
| Soft / gentle | `V2-AISO-HOWATTO.pth` | 55,074,309 | `8fc32652b8ec472615af3f6661a50a195dd54990e0f517bd0dbd66db59813146` |
| Cool / lower | `V2-AISO-KAKKOII.pth` | 55,074,309 | `ae33b60655a59ecb37135892ed4a95ba326b412d6589dea251fced95e18aef31` |

All three are under `assets/voice/chihaya/`. The [manifest](../../config/voice/assets.json) contains immutable revision URLs. SARASARA and SITTORI are documented alternatives, not downloaded targets. No index or character artwork is required by the current adapter. All voice assets remain in ignored local storage even where redistribution is permitted; preserve the MIT attribution/terms when preparing any distributable voice pack.

The adapter verifies catalog hashes, reads the checkpoints with PyTorch's restricted weights-only loader, checks expected v2/no-F0/40 kHz metadata and finite tensors, then produces `.safetensors` derivatives with equality checks for every tensor. A loaded derivative is verified against the original target each time. Derivative and output hashes are recorded in conversion JSON reports. The first tested target contained 446 tensors.

## Shared inference asset

`assets/voice/pretrained/contentvec-f.onnx` is 378,550,151 bytes, SHA-256 `4b31ed3d95a568fab7952de923ff7f7d3d17128ea6fce69f665509d24c3156db`. The exact exporter distribution declares **GPL-3.0**. The original ContentVec research repository publishes MIT source, which does not replace the explicit terms of these exported bytes. Keep both provenance records; do not label this whole model catalog MIT. [Exported-weight notice](https://huggingface.co/wok000/weights_gpl/blob/c2f3e4a8884dba0995347dfe24dc0ad40acb9eb7/README.md), [ContentVec source](https://github.com/auspicious3000/contentvec).

No separate pitch estimator or pretrained training generator is loaded by the chosen no-F0 path. Inactive estimator weights bundled by installed torchcrepe/torchfcpe packages are separately hashed in the manifest and listed in the toolchain report.

## Licensed English input and control route

The smoke input is the dataset publisher's `LJ025-0076.wav`, 370,336 bytes, SHA-256 `b31133c05e9667a27db5be539ca089aa99e95ca7bef52040c902ff781680873a`. It is Linda Johnson's English narration at 22,050 Hz, acquired directly from the LJ Speech site. The publisher identifies the audio/text/annotations as public domain. It is a conversion test input, **not an already trained natural-voice target**. [Dataset and terms](https://keithito.com/LJ-Speech-Dataset/).

LUNAR was inspected at `c9591761fe5e87a7f40ca5d57f10efc7ea22dcf4`. Its model metadata advertises English/MIT and automatic gated access. A unauthenticated HEAD for `Mid_Range/G40k.pth` returned **HTTP 401**; no weights were acquired, no contact information was submitted, and no license-gate acceptance was automated. Its file tree contains training-style G/D checkpoints, so runtime compatibility would still require inspection after access. [Model card](https://huggingface.co/IssacMosesD/Lunar-RVC-Model), [local access evidence](local/voice/lunar-access.json).

The usable independent fallback is to acquire the public LJ Speech 1.1 archive, create an exact 20-minute training / two-minute holdout split, and train a natural English control in a separate pinned RVC environment. [Executable setup commands and concrete training disposition](../../docs/voice-setup.md#english-control-fallback) identify paths, source revision, parameters, checkpoints, required asset audit and evaluation. The archive/training run are not claimed as performed. That control may establish English intelligibility; cheerful expression still requires suitable material and user auditions.

## Validation boundary

The [bright WAV](local/voice/converted-bright.wav) and [conversion metadata](local/voice/converted-bright.json) prove local file conversion with these assets. Numerical checks reject silence, nonfinite tensors/audio, truncated results and unexpected model metadata. They do not score intelligibility or whether these targets are sufficiently distinct and comfortable on the user's voice. TASK-023 owns those listening and real-speech decisions, and TASK-024 owns live performance.

The [soft WAV](local/voice/converted-soft.wav) and [cool WAV](local/voice/converted-cool.wav) also converted successfully, with expected duration, finite non-silent samples and zero clipping. Their per-file JSON results and the [retained combined evidence](voice-conversion-smoke.json) contain all target, safe-derivative and output hashes. All three have 446 finite tensors; these are prepared functional samples for later listening, not a completed audition session.
