# Transparent Ene animation feasibility

Date: 2026-09-12. TASK-030 delivery experiment, using the actual Cyber legs rig.

The selected path is viable on the tested laptop: **24 fps VP9 alpha WebM, with animated WebP fallback**, using 480/960 px renditions and transparent posters. The two-second diagnostic includes a keyed arm/hand gesture, head/chest movement, a full blink, and fine hair edges. It is an editable codec sample, not one of the five final creative resources. [Source/control audit](web-source-audit.json), [render record](web-spike-render.json), [full encoding sweep](web-spike-encoding.json), [browser measurements](web-spike-browsers.json), and [production settings](../../config/web-resources/encoding.json) are reproducible evidence.

The private scene is `assets/work/ene-web/alpha-spike.blend`; 48 PNG RGBA masters remain under `assets/work/ene-web/spike/frames/`. The isolated source retains 63,278 vertices and the existing image repairs. A known degenerate triangle/edge was removed locally without changing shape-key indexing. All source PMX/VMD hashes and the accepted VRM hash remain unchanged. No webcam, voice model or remote rendering service participates.

## Measured encoding choices

All rows use the same 48 rendered frames. WebM duration is 2.000 seconds, with no audio. Each animated WebP contains 48 ANMF frames, looping indefinitely, with a measured 1,999 ms total duration due to integer millisecond frame timing. `scripts/web_media.py` reads this container timing directly because ffprobe does not report its duration reliably.

| Rendition | WebM CRF 28 | WebM CRF 34, selected | WebM CRF 40 | WebP Q65, selected | WebP Q80 | Poster Q85 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 480x480 | 103,221 B | **70,663 B** | 47,724 B | **909,996 B** | 1,027,824 B | 24,850 B |
| 960x960 | 309,361 B | **208,664 B** | 133,393 B | **1,731,932 B** | 1,962,818 B | 47,906 B |

CRF 34 provides a small WebM with readable eyes, cheek markings, trim and hair at 320 CSS px. Q65 WebP also remains readable at that display size and leaves more fallback budget than Q80. The decoded character was inspected over black, white and checkerboard in the browser: [WebM comparison](local/web-resource-spike/chrome-webm-composite.png), [WebP comparison](local/web-resource-spike/chrome-webp-composite.png). There is no opaque rectangle. Fine hair tips retain partial alpha; some softened raster edges are expected at the small size. The sample's raised hand is diagnostic; it does not approve the final desk pose/open-palm composition.

Keep the proposal's existing size ceilings and use **three-second desk loops**, within the original 3–4 second brief. Linear estimates from this sample are about 1.30 MiB small / 2.48 MiB large for Q65 WebP, below 1.5 / 3 MiB. These are estimates, not accepted final sizes: expression changes and secondary motion alter compression. TASK-036 must encode and measure every finished resource. Target a four-second greeting initially, retaining the permitted 4–6 second creative range and its existing 2.5 / 5 MiB WebP limits. No budget increase is justified by this spike.

Use the explicit resize filter `scale=WIDTH:HEIGHT:flags=lanczos,format=rgba` before the encoder's `yuva420p` conversion. The initial direct Lanczos-to-YUVA negotiation turned a zero-alpha background into alpha 1/255 across much of the small rendition. The explicit RGBA intermediate fixes this; the final files and all recorded browser measurements use it. Do not remove that intermediate based only on an apparently transparent preview.

The chosen WebM options are libvpx-vp9, CRF 34, zero target bitrate, `deadline=good`, `cpu-used=2`, row multithreading, four threads and `auto-alt-ref=0`. WebP uses libwebp_anim, Q65, compression level 4 and loop 0. Level 6 was abandoned after a much slower trial; no quality or size result is claimed for that unfinished candidate. The successful final level-4 encodes took roughly 1–3 seconds each on this laptop. Exact commands, durations, byte counts, hashes and decoder results are in the encoding JSON. The [toolchain report](web-resource-toolchain.md) records the verified executable and notices.

## Alpha and browser evidence

The local harness serves only its HTML and allowlisted diagnostic media names on a temporary loopback port. It never serves Blend, PMX, textures, VRM or master frames. This is a measurement page, separate from TASK-037's final showcase.

| Browser path on Windows | Actual animation and alpha | Fallback / lifecycle evidence |
| --- | --- | --- |
| Chrome 152.0.7977.83, headless | WebM and WebP pass; real character canvas corner alpha is 0 with thousands of partial-alpha edge pixels | Known-alpha probe succeeds; opaque-probe rejection and missing-codec rejection select animated WebP; injected autoplay rejection shows poster; pause/poster and resume work |
| Playwright Firefox 155.0 | WebM and WebP pass; decoded Ene alpha matches the encoder counts | Same probe, fallback, poster and pause/resume checks pass |
| Playwright WebKit 26.6 for Windows | Animated WebP passes, including actual character alpha and visibly changing frames; WebM never reaches loaded data in this build | Timed-out probe selects animated WebP; forced WebM load displays poster on failure; WebP pause/resume works |

The small WebM's browser-decoded first frame has 171,584 zero-alpha, 48,718 fully opaque and 10,098 partial-alpha pixels. WebP has 173,030 zero-alpha, 50,029 opaque and 7,341 partial-alpha pixels. A separate tiny probe has known transparent and opaque sample points; an intentionally opaque encoded version demonstrates lost-alpha rejection. Three timed screenshots per animated path have different hashes, showing visible motion. Source blink controls and evaluated geometry are independently checked in Blender.

`canPlayType()` is not used as proof of alpha. The probe and real character both undergo actual decoded-pixel checks. Autoplay policy rejection in Chrome/Firefox is an injected `NotAllowedError` to test the error path; successful muted playback itself is real. WebKit's codec timeout occurs before that injection, so its result certifies the media-error poster path, not an injected autoplay-policy result.

An animated WebP `<img>` has no native playback timeline. Pause removes its animation source and substitutes the poster; resume recreates the animated image and may restart the loop. This is intentional and tested. It is not frame-accurate pause/resume. The final showcase must preserve user pause intent and implement visibility/reduced-motion behavior in TASK-037.

## Laptop measurements and limits

Machine: Windows, Intel Core i7-1255U, 12 logical processors, approximately 16 GiB RAM. The 960x960 EEVEE RGBA render took **399.58 seconds for 48 frames**, with a **7.65-second median frame** and **2,347,421,696-byte peak Blender working set**. Lighting uses Standard color management, exposure -0.2 and three soft area lights. The source sample has no secondary simulation; final physics must be baked and visually inspected before estimating production cost from these numbers. Full production is several minutes per clip at these settings, not instant generation.

At 480 source pixels displayed at 320 CSS px, one active Chrome animation was measured for 60 seconds per codec. WebM reported **1,429 video frames and zero dropped frames**. CPU time summed across this test browser's processes averaged **25.84% of one logical core** for WebM and **17.56%** for WebP (about 2.15% / 1.46% of all 12 logical processors). Browser process working-set snapshots are retained in the JSON; these include browser/GPU/utility overhead and are not a per-clip decoded-memory figure. WebP has no equivalent dropped-video-frame counter; visible motion, CPU/memory snapshots and compositing were checked without inventing a video FPS metric.

Cold media loads under CDP's **10 Mbit/s, 100 ms latency, cache-disabled** condition became ready in **154 ms for small WebM** and **859 ms for small WebP**, below the proposal's four-second target for this sample. These are local-server network-emulation results, not real mobile-network claims. They measure the sample media load, not a completed showcase's full first visit.

Firefox's short 10-second WebM run reported 245 frames with 5 dropped (2.04%); its WebP and WebKit's WebP visibly animated over 10-second checks. Those runs are useful compatibility evidence, not the final 60-second target-device matrix. The large 960 px / 640 CSS px Chrome measurements are recorded separately in [web-spike-browsers-large.json](web-spike-browsers-large.json).

The large Chrome run passed for 30 seconds per codec: WebM had 715 frames with zero dropped, averaging 40.86% of one logical core; WebP averaged 18.99%. Throttled readiness was 197 ms / 1,534 ms respectively. Total browser working set went from 676.6 to 624.4 MiB for small WebM and 745.4 to 720.2 MiB for small WebP; the large paths measured 775.5 to 745.4 MiB and 1,251.7 to 1,248.0 MiB. These snapshots include the diagnostic browser, earlier probe/comparison activity and its caches. They are not clean per-asset allocation measurements or proof of long-session stability. Prefer the small rendition at ordinary display sizes and load the large one only when needed; TASK-038 must examine switching/cache behavior in the actual one-active-resource component.

Real macOS Safari, iPhone/iPad Safari, Android Chrome, installed Edge, low-power/mobile conditions and a ten-minute memory/switching session remain TASK-038 work. Playwright WebKit on Windows is not Safari or iPhone hardware certification. The probe has an animated fallback on the tested WebKit engine; the untested devices remain explicit gaps. No finished site, final greeting/desk animation, polished loop seam or long-session memory claim is made here.

## Reproduce and continue

Run the installation/render/audit/encode/browser commands in [web-resource-toolchain.md](web-resource-toolchain.md). For the separate large-rendition measurement:

```powershell
$env:WEB_SPIKE_SIZE='960'
$env:WEB_SPIKE_DURATION_MS='30000'
$env:WEB_SPIKE_ENGINE='chrome'
node scripts/measure_web_spike.mjs
```

The default run tests 480 px in Chrome, Firefox and WebKit and writes `web-spike-browsers.json`; the large run writes a separate report and screenshots. Each owned test browser and temporary server closes when the measurement finishes. Use `npx.cmd playwright install firefox webkit` if those pinned Playwright engines are absent.

TASK-031 can now author the full-body greeting using the [VMD compatibility inspection](ene-vmd-compatibility.md), while TASK-032 authors the shared desk composition. Reuse the private source scene and verified encoder configuration, then measure the final media in TASK-036 and the finished site/device behavior in TASK-038.
