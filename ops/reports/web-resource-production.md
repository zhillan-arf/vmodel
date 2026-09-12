# Ene website media production

All five accepted Ene Cyber legs actions now have final 24 fps master sequences, two transparent animation formats at two sizes, and transparent static WebP/PNG posters. The staged package contains **40 family files, one known-alpha probe and one manifest**, with no source model or master sequence. Every animated file was fully decoded, frame by frame, with actual RGBA checks. [Final staging/decode/hash audit](web-production-audit.json).

The final local package is [web-showcase/public/ene/manifest.json](../../web-showcase/public/ene/manifest.json). [Its schema](../../config/web-resources/manifest.schema.json) records relative URLs, measured dimensions, duration, nominal source FPS, per-file bytes/SHA-256, normalized visible bounds and fixed desk/foot anchors. WebM stream FPS is 24; WebP's asset FPS records frame count divided by its measured integer-millisecond duration. Resource FPS remains the 24 fps source timeline. The private [build manifest](../../assets/work/ene-web/production-build.json) records source/master/tool recipes without placing private paths in the public manifest.

## Actual files and timing

All values below are measured bytes. Poster cells show static WebP / PNG. Duration cells show WebM / animated WebP. All approved per-file byte ceilings pass without a budget revision. Every file is silent; the encoders and probes report one video/image stream and no audio track.

| Resource | Rendition | WebM bytes | Animated WebP bytes | Poster bytes, WebP / PNG | Duration seconds, WebM / WebP |
| --- | --- | ---: | ---: | ---: | ---: |
| `home-greeting` | small, 360×480 | 111,601 | 1,154,402 | 17,962 / 67,900 | 5.000 / 4.999 |
| `home-greeting` | large, 720×960 | 318,841 | 2,265,586 | 36,530 / 299,762 | 5.000 / 4.999 |
| `desk-normal` | small, 480×480 | 88,008 | 1,437,172 | 26,104 / 134,241 | 3.000 / 2.999 |
| `desk-normal` | large, 960×960 | 271,697 | 2,781,262 | 51,398 / 541,677 | 3.000 / 2.999 |
| `desk-confused` | small, 480×480 | 110,825 | 1,479,764 | 27,038 / 136,420 | 3.000 / 2.999 |
| `desk-confused` | large, 960×960 | 338,036 | 2,897,938 | 54,172 / 548,239 | 3.000 / 2.999 |
| `desk-surprised` | small, 480×480 | 94,862 | 1,436,084 | 26,174 / 134,341 | 3.000 / 2.999 |
| `desk-surprised` | large, 960×960 | 293,184 | 2,783,494 | 51,416 / 541,921 | 3.000 / 2.999 |
| `desk-excited` | small, 480×480 | 131,856 | 1,442,498 | 26,120 / 134,341 | 3.000 / 2.999 |
| `desk-excited` | large, 960×960 | 373,723 | 2,785,680 | 51,450 / 542,054 | 3.000 / 2.999 |

The complete staged folder, including its manifest and probe, is 26,066,834 bytes. Files are selectively loaded by the showcase; this total is not its first-visit transfer. Animated WebP's 4,999 ms greeting and 2,999 ms desk loops follow the encoder's integer-millisecond frame-delay rounding, within the documented 2 ms tolerance. The files still contain exactly 120 / 72 decoded frames and loop indefinitely. No duplicate endpoint frame is exported.

## Master provenance and rendering

There are **408 full-size RGBA masters**. Small media derives from the same masters using `scale=WIDTH:HEIGHT:flags=lanczos,format=rgba`, preserving alpha before the encoder's YUVA conversion. Each content-addressed master index preserves the accepted scene SHA, frame hashes, camera, render recipe and individual render times. Accepted pre-secondary scenes and body/face actions remain editable; bounded secondary animation was warmed up and keyed before production. [Greeting adaptation](web-resource-greeting.md), [desk baseline](web-resource-desk-normal.md), [confused](web-resource-desk-confused.md), [surprised](web-resource-desk-surprised.md), [excited](web-resource-desk-excited.md).

| Resource | Master frames | Dimensions | Sum of frame-render seconds | Median frame seconds | Master build key |
| --- | ---: | --- | ---: | ---: | --- |
| `home-greeting` | 120 | 720×960 | 339.29 | 2.52 | `6b08cda64e40155eb074` |
| `desk-normal` | 72 | 960×960 | 249.98 | 3.35 | `a021ba16d9c562bb3f68` |
| `desk-confused` | 72 | 960×960 | 258.34 | 3.47 | `2b9b660d643103c179d5` |
| `desk-surprised` | 72 | 960×960 | 259.25 | 3.31 | `59320f820713106cf9d9` |
| `desk-excited` | 72 | 960×960 | 218.53 | 2.97 | `5838019d4c1b786ab379` |

Frame render calls total 1325.40 seconds (22.09 minutes), including the four cached calibration frames. This excludes scene loading, filesystem/hash checks and encoding. The measured calibration was 24.67 seconds for four full-size frames; the full batch ran one Blender or encoder process at a time, with Blender CPU threads fixed at four. Routine code/browser functional work could coexist during production, so full-batch frame timings are observations under that shared workload. Read-only OS snapshots observed a Blender peak working set of 2,373,337,088 bytes (2.21 GiB); this is an observed peak at sample times, not a continuous whole-batch memory trace. [Process snapshots](web-production-process-snapshots.json).

The recipe uses Blender 5.1.1 build `b70da489d7f4`, MMD Tools 4.5.14, EEVEE 32 render samples, transparent PNG RGBA8, Standard/None color management, exposure −0.2 and gamma 1. The source scene fixes the camera, lights and baked action keys. Cross-driver pixel-identical rendering is not claimed; exact source hashes, settings and generated frame hashes make this build reviewable and resumable. The original PMX/VMD, original G1 Blend and VRM remain separate and unchanged under their existing audits.

FFmpeg 9.0.1 uses libvpx VP9 CRF34, zero target bitrate, good deadline, cpu-used 2, row-mt 1, four threads, auto-alt-ref 0 and yuva420p. Animated WebP uses libwebp_anim Q65/compression4/loop0. Posters use libwebp Q85 and a lossless PNG fallback. [Pinned toolchain](../../config/web-resources/toolchain.json), [encoding recipe](../../config/web-resources/encoding.json), [encoder implementation](../../scripts/encode_web_production.py). Every per-resource production JSON retains the exact commands, measured encode time, ffprobe output, WebP container timing and every decoded frame's hash/alpha/bounds.

## Decode, alpha and loop evidence

VP9 alpha is decoded with libvpx explicitly, since a decoder that discards the alpha plane is not an acceptable verification path. FFmpeg 9's actual `webp_anim` decoder reads all WebP frames, independently of the bounded RIFF timing reader. All animation and poster frames have a zero-alpha corner, transparent background, opaque character pixels and retained partial-alpha edges. The public known-alpha probe is also decoded and checks alpha 0 at (0,0) and 255 at (24,24).

The following sparse premultiplied-RGBA mean absolute differences use the 0–255 scale. They compare the last delivered frame with the first, and the largest adjacent decoded-frame change. They support seam inspection; they are not a perceptual-quality score. The independently evaluated source endpoint is exactly equal to frame 1 for all five actions, including keyed secondary motion.

| Resource | Rendition | Actually decoded frames | Loop seam sample MAE | Maximum adjacent sample MAE | Approved byte ceiling |
| --- | --- | ---: | ---: | ---: | ---: |
| `home-greeting` | small webm | 120 | 0.073 | 1.490 | 1,572,864 |
| `home-greeting` | small webp | 120 | 0.538 | 1.910 | 2,621,440 |
| `home-greeting` | large webm | 120 | 0.076 | 1.465 | 3,145,728 |
| `home-greeting` | large webp | 120 | 0.344 | 1.666 | 5,242,880 |
| `desk-normal` | small webm | 72 | 0.221 | 0.381 | 786,432 |
| `desk-normal` | small webp | 72 | 0.823 | 0.970 | 1,572,864 |
| `desk-normal` | large webm | 72 | 0.283 | 0.431 | 1,572,864 |
| `desk-normal` | large webp | 72 | 0.532 | 0.789 | 3,145,728 |
| `desk-confused` | small webm | 72 | 0.352 | 0.467 | 786,432 |
| `desk-confused` | small webp | 72 | 0.744 | 1.056 | 1,572,864 |
| `desk-confused` | large webm | 72 | 0.343 | 0.482 | 1,572,864 |
| `desk-confused` | large webp | 72 | 0.592 | 0.795 | 3,145,728 |
| `desk-surprised` | small webm | 72 | 0.255 | 0.372 | 786,432 |
| `desk-surprised` | small webp | 72 | 0.831 | 1.047 | 1,572,864 |
| `desk-surprised` | large webm | 72 | 0.298 | 0.446 | 1,572,864 |
| `desk-surprised` | large webp | 72 | 0.547 | 0.796 | 3,145,728 |
| `desk-excited` | small webm | 72 | 0.545 | 0.725 | 786,432 |
| `desk-excited` | small webp | 72 | 0.930 | 1.182 | 1,572,864 |
| `desk-excited` | large webm | 72 | 0.577 | 0.732 | 1,572,864 |
| `desk-excited` | large webp | 72 | 0.774 | 1.021 | 3,145,728 |

Visible bounds are the union of actual nonzero-alpha decoded pixels, using top-left image coordinates. The desk camera, forearm contact and anchor stay identical across states and sizes. The lower seated body extends below the desk crop by design; the website supplies its separate visible desk/occlusion layer. No room, desk, text or player UI is burned into the character.

## Visual review and handoff

The [completed final visual review](web-resource-production-review.md) accepts the five small and large encodes against their matching source frames, with retained white/black/checkerboard evidence. The [single-resource cache rebuild](web-production-rebuild.json) verified 72 master frames and left all 42 staged hashes identical.

Final source/WebM/WebP comparisons and black/white/checkerboard screenshots are produced by [the matched-frame extraction](../../scripts/prepare_web_production_review.py) and [browser compositor](../../scripts/review_web_production.mjs). The accompanying visual review record must be read together with these automated tables; source acceptance alone does not approve a new lossy encode. Final showcase playback/lifecycle and real-device coverage belong to TASK-037/038. Actual Safari, iOS and Android remain unverified unless their own device evidence is recorded; Windows Playwright WebKit is supplementary only.

The [rebuild and local launch guide](web-resource-rebuild.md) provides full-batch, single-resource and pause/resume commands. [Final staging audit](web-production-audit.json) verifies the exact allowlist and SHA/byte parity. Private sources/master frames stay outside `web-showcase/public/` and `web-showcase/dist/`; the staged character media folder is ignored by Git. Original creator/contributor terms and AuroraYok / yokkaulove attribution remain with the project. This is local integration, without paid tooling, model upload or public deployment.
