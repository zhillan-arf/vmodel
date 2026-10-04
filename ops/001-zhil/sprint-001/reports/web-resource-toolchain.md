# Web resource toolchain and source reuse

Date: 2026-09-12. TASK-029 evidence; Cyber legs remains the selected variant.

The web authoring workspace is isolated at `assets/work/ene-web/`. It derives from `assets/work/ene/source.blend`; it does not overwrite the shared MMD scene, VRM authoring scene or accepted avatar. [Source configuration](../../../../config/web-resources/source.json) pins the original PMX/VMD hashes and private output paths. [Source audit](web-source-audit.json) records reopened editable scenes, keyed blink/hand controls and finite evaluated geometry. [Render measurements](web-spike-render.json) record the shared source hash, unchanged original hashes, image references and RGBA pixel counts.

The source retains all 193 MMD bones and 63,278 vertices. The web copy reuses the G1 missing-sphere-map repair already present in the imported scene: absent additive `s.bmp` and `spa-pi.bmp` layers remain disabled, with diffuse maps and packed textures intact. It separately applies Blender mesh validation to the known degenerate triangle/edge while preserving vertex indices and all shape keys. Cyber leg fading and blue cheek markings remain intentional. The disposable codec spike keys the left arm/hand, head/chest and blink. Its pose and lighting are diagnostic; the four final desk expressions, open palm, contact anchor and secondary-motion baking still belong to TASK-032 through TASK-036.

| Component | Pinned local version / location | Verification |
| --- | --- | --- |
| Blender | 5.1.1, build `b70da489d7f4`, existing system installation | Background EEVEE RGBA render; isolated scenes saved and reopened |
| MMD Tools | 4.5.14, `.tools/blender/addons/mmd_tools` | Existing publisher-verified installation loads; imported MMD constraints, arm and shape-key controls retained |
| FFmpeg / ffprobe | 9.0.1-essentials_build-www.gyan.dev, `.tools/web/ffmpeg-9.0.1-essentials_build/bin` | Both programs run; `libvpx-vp9`, `libwebp_anim` and static `libwebp` encoders present |
| libvpx | `v1.16.0-184-g0cfc6da39` | Version from distribution README; real RGBA WebM encode and alpha decode succeed |
| libwebp | `v1.6.0-199-g94d3c4a` | Version from distribution README; real animated WebP encode and alpha decode succeed |

The [FFmpeg project download page](https://ffmpeg.org/download.html) links the Windows build publisher used here. The [Gyan release](https://github.com/GyanD/codexffmpeg/releases/tag/9.0.1) is pinned in [toolchain.json](../../../../config/web-resources/toolchain.json). Its 111,253,802-byte archive matches the publisher checksum `fec81ae03971d9dd4be3ebe02e263bd2ec1d789483f931bdba5f5715e65da2e9`. No global PATH modification or paid tool/service is required. The exact build flags and exposed encoders are in [web-encoder-build.txt](web-encoder-build.txt).

The 12-frame, 480x480, 24 fps smoke encoded actual Ene frames into a 32,861-byte VP9 alpha WebM and 205,710-byte animated WebP. Decoding the first WebM frame yielded 172,844 transparent, 48,637 opaque and 8,919 partial-alpha pixels; WebP yielded 174,998 transparent, 50,471 opaque and 4,931 partial-alpha pixels. [Executed commands, times, hashes and alpha counts](web-encoder-smoke.json) are separate from the full TASK-030 sweep. Force `-c:v libvpx-vp9` **before** `-i` when decoding WebM alpha with FFmpeg; the native VP9 decoder can otherwise lose alpha even when WebM metadata says it exists. Browser compositing is tested separately in TASK-030.

Reproduce the tool installation and isolated diagnostic:

```powershell
python scripts/provision_web_tools.py
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/render_web_spike.py
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/audit_web_source.py
python scripts/encode_web_spike.py
node scripts/measure_web_spike.mjs
```

`render_web_spike.py -- 1 23 36` after Blender's `--python ... --` option renders only those diagnostic frames; a complete encoder sweep requires all 48 frames. Partial render commands overwrite the render report with their actual subset, so retain the complete report for acceptance. The full private sequence is `assets/work/ene-web/spike/frames/frame-0001.png` through `frame-0048.png`. Encoded diagnostics are under `ops/001-zhil/sprint-001/reports/local/web-resource-spike/`. Nothing in these paths is served by the VTuber app or copied to its build. The future showcase public directory is separately reserved as `web-showcase/public/ene/`; it must contain selected rendered outputs only.

Blender is GPL-3.0-or-later; MMD Tools GPL-3.0-or-later and its isolated OpenCC dependency Apache-2.0. This FFmpeg build is GPL v3, with its LICENSE, README, documentation and source revision retained in the installed directory. The used libvpx/libwebp BSD notices and patent grants are saved under `.tools/web/notices/`, fetched from their exact recorded source revisions and hash-pinned in the toolchain configuration. These are local executable tools; they are not browser dependencies or bundled in the future site. Other optional FFmpeg components and their versions remain listed in the complete distribution README.

Character attribution remains **AuroraYok / yokkaulove (DA)** and all supplied contributor readmes. The user's existing permission authorizes this local project; no repeated permission is requested. The supplied model readme prohibits model redistribution. Keep PMX, VMD, Blend, VRM, textures, master frames and generated character media private and separate from software source distribution. The VMD is not used in the codec spike; TASK-031 must retain its provenance and documented adaptation for the greeting. Tripo, regeneration, paid encoders and remote uploads are absent.

The next decision is TASK-030's measured 480/960 px WebM/WebP sweep and actual browser alpha/fallback behavior. This toolchain evidence does not approve a final greeting/desk performance or certify Safari/mobile hardware.
