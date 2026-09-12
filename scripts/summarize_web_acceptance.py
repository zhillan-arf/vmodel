"""Create the G4 acceptance report only from completed final measurements."""
from web_production import ROOT, read_json

cold = read_json(ROOT / 'ops/reports/web-showcase-measurement-cold.json')
playback = read_json(ROOT / 'ops/reports/web-showcase-measurement-playback.json')
session = read_json(ROOT / 'ops/reports/web-showcase-measurement-lifecycle.json')
production = read_json(ROOT / 'ops/reports/web-production-audit.json')
rebuild = read_json(ROOT / 'ops/reports/web-production-rebuild.json')
bundle = read_json(ROOT / 'ops/reports/web-bundle-audit.json')
assert all(item['state'] == 'passed' for item in (cold, playback, session))
assert production['passed'] and rebuild['passed'] and bundle['pass']
browser_rows = []
for label, name in [('Windows Chrome', 'smoke'), ('Windows Edge', 'edge-smoke'), ('Playwright Firefox on Windows', 'firefox-smoke'), ('Playwright WebKit on Windows — supplementary engine', 'webkit-smoke')]:
    report = read_json(ROOT / f'ops/reports/web-showcase-{name}.json')
    assert report['pass'] and all(case['pass'] for case in report['cases'])
    browser_rows.append(f'| {label} | {report["browser"]} | {report["cases"][0]["format"].upper()} | {len(report["cases"])} applicable functional cases pass | [Report](web-showcase-{name}.json) |')
load_rows = []
for item in cold['cold']:
    load_rows.append(f'| {item["codec"].upper()} | {item["domReadyMs"]:.0f} ms | {item["posterReadyMs"]:.0f} ms | **{item["animationVisibleMs"]:.0f} ms** | Selected greeting only |')
play_rows = []
for item in playback['playback']:
    frames = item['videoFrames']
    frame_text = f'{frames["total"]:,} / {frames["dropped"]} dropped' if frames else 'Visible motion; no video-frame counter'
    play_rows.append(f'| {item["size"]} {item["codec"].upper()} | {item["seconds"]:.2f} s | {frame_text} | {item["cpuCorePercent"]:.2f}% / {item["cpuAllCoresPercent"]:.2f}% | {item["before"]["workingSetBytes"] / 1048576:.1f} → {item["after"]["workingSetBytes"] / 1048576:.1f} MiB |')
life = session['lifecycle']
assert life['state'] == 'passed' and len(life['warmupSwitches']) == 20 and life['samples'][-1]['seconds'] >= 600
assert not life['privateMemoryMonotonicallyIncreasing'] and not life['materialGrowthNeedsReview']
assert all(sample['actual']['activeAnimationElements'] == 1 for sample in life['samples'])
working = [sample['process']['workingSetBytes'] for sample in life['samples']]
text = f'''# Ene website resources: G4 acceptance

Date: 2026-09-12. **The local Windows delivery is accepted for the tested scope.** All five final Ene Cyber legs animations, their editable sources and the separate website showcase are delivered. Final codec/quality/size, local build/HTTP, cold-load, sustained playback and ten-minute lifecycle gates pass. Real macOS Safari, iOS Safari and Android Chrome remain **unverified**, with no physical-device result inferred from a desktop engine or narrow viewport. This report hands G4 to TASK-P01/TASK-021; it does not close the separate live camera/OBS/voice goals.

## Goal evidence

| Criterion | Delivered evidence |
| --- | --- |
| G4-A greeting | Five-second full-body nod/wave, documented inspection and adaptation of the supplied VMD, settled loop boundaries and complete cyber-leg silhouette. [Source/adaptation](web-resource-greeting.md), [final visual review](web-resource-production-review.md). |
| G4-B four desk states | Actual normal/confused/surprised/excited keyed performances with fixed camera/contact/anchor, blink/breath and baked secondary motion. All final expressions remain readable at 320 CSS px. [Normal baseline](web-resource-desk-normal.md), [confused](web-resource-desk-confused.md), [surprised](web-resource-desk-surprised.md), [excited](web-resource-desk-excited.md), [final source/codec comparisons](web-resource-production-review.md). |
| G4-C lightweight media | 408 RGBA masters; 20 animated renditions and 20 posters; every frame actually decoded with alpha; exact timing, bytes and hashes; all byte ceilings pass without revision. [Production report](web-resource-production.md), [42-file audit](web-production-audit.json), [manifest](../../web-showcase/public/ene/manifest.json). |
| G4-D web setting | Separate welcome/desk layouts, responsive accessible controls, selected-only loading, decoded-alpha probe, animated fallback, pause/replay and lifecycle/error behavior. [Showcase acceptance](web-showcase.md), [bundle audit](web-bundle-audit.json), browser matrix below. |
| G4-E reusable handoff | Editable pre-secondary/baked scenes, fixed source/encoder recipes, preserved creator/contributor terms, integration API and local launch/rebuild instructions. [Integration guide](../../docs/web-showcase.md), [rebuild guide](web-resource-rebuild.md), [single-resource rebuild proof](web-production-rebuild.json). |

The original screenshot attachment was unavailable. Desk composition follows the supplied written brief; no pixel-for-pixel comparison to that attachment is claimed. The greeting is an Ene-specific new action informed by inspected VMD gestures, not an unverified direct import of all foreign-model channels.

## Build and functional browser coverage

The final isolated production build contains {len(bundle['files'])} files. Initial JS/CSS is **{bundle['codeGzipBytes']:,} gzip bytes**, below 150 KiB. Declared media total {bundle['mediaBytes']:,} bytes; they are selected on demand. The entire staged `ene/` folder including its manifest is {production['stagedBytesIncludingManifest']:,} bytes. No PMX, VMD, Blend, VRM, master sequence, Three.js/MediaPipe tracking or voice runtime enters this build. Its 40 family files, known-alpha probe and manifest have matching hashes in the public and built package. [Exact build whitelist/hash audit](web-bundle-audit.json).

| Tested browser/engine | Version | Chosen animated path | Result | Evidence |
| --- | --- | --- | --- | --- |
''' + '\n'.join(browser_rows) + f'''
| Actual macOS Safari | Unavailable | Unverified | **Not tested; not passed** | Physical device/session required |
| Actual iPhone/iPad Safari | Unavailable | Unverified | **Not tested; not passed** | Physical device/session required |
| Actual Android Chrome | Unavailable | Unverified | **Not tested; not passed** | Physical device/session required |

Functional checks cover selected-only initial media, controls and switching, real scroll/IntersectionObserver stop/resume, reduced motion, animated WebP fallback/poster pause, missing animation/manifest, PNG poster fallback and retaining a visible still during delayed/failed loads. Chrome/Edge/Firefox also exercise explicit retry after rejected autoplay and cancelled pending playback. Visibility events, `saveData`, `NotAllowedError` and `AbortError` conditions are controlled injections where identified in those reports; narrow 390×844 layout testing is desktop browser emulation. They are useful branch/layout evidence, not claims of natural policy rejection or real mobile hardware behavior.

## Cold first visit

Measured in installed Windows Chrome {cold['browser']} on Windows {cold['release']}, Intel Core i7-1255U, {cold['logicalCores']} logical processors and {cold['ramBytes'] / 1073741824:.2f} GiB RAM. The headless browser loads the final built showcase from an owned loopback HTTP server. CDP applies **10 Mbit/s download, 100 ms latency and disabled cache**. A 390×1300 viewport chooses the 360×480 greeting, displayed at 315×420 CSS px. UI/poster arrive before animation; both animated paths pass the four-second small-rendition target. [Cold-load report](web-showcase-measurement-cold.json).

| Path | DOM ready | Poster ready | Animation visible | Animation-family requests |
| --- | ---: | ---: | ---: | --- |
''' + '\n'.join(load_rows) + f'''

The WebP row intentionally rejects the known-alpha probe to exercise the actual animated fallback on Chrome. This is a measured fallback load, not a claim that Chrome lacks WebM alpha. Normal requests consist of UI code, manifest, selected poster, tiny probe and selected animation; no unselected animation family is downloaded. Network emulation on this laptop is not a real cellular-network measurement.

## Sustained playback

One final normal desk animation is active at a time. The 480 px rendition is displayed at 454 CSS px in a 1050 px viewport; the 960 px rendition at 569 CSS px in a 1440 px viewport. Each sample runs for at least 60 seconds after settling; process-stat snapshots extend the recorded wall interval slightly. No concurrent Blender, OBS/voice benchmark or other owned test browser ran during these measurements. [Playback report](web-showcase-measurement-playback.json).

| Rendition/path | Recorded interval | Video frames / visible motion | CPU, one logical core / all 12 | Browser working set, start → end |
| --- | ---: | --- | ---: | ---: |
''' + '\n'.join(play_rows) + f'''

Both WebM samples report zero **measured-interval** dropped frames, comfortably below 5%; startup frames before the settled interval are retained separately in the raw report. WebP has no HTML video-frame counter, so its continuity is supported by visibly changing screenshots and the independent full decoder/frame audit, without inventing a WebP dropped-frame number. CPU time sums this owned browser's processes. Memory includes browser/GPU/utility overhead and caches; it is not a per-character allocation. Large WebP consumes substantially more browser memory than the ordinary small path, supporting the existing size-selection behavior.

## Twenty-switch warm-up and ten-minute lifecycle

The actual final showcase cycles through all five states with both codecs. **20 warm-up switches** each play a complete loop, taking {life['warmupSeconds']:.2f} seconds, so later-frame WebP decoding is included in warm-up. The following measurement spans **{life['samples'][-1]['seconds']:.2f} seconds**, with 21 process/DOM samples and another 20 state/codec changes. [Lifecycle report](web-showcase-measurement-lifecycle.json).

- One animation element remains active in every settled sample; DOM element counts stay within {life['domElementsRange'][0]}–{life['domElementsRange'][1]}. Superseded video/image elements do not accumulate.
- Browser private memory starts at {life['privateBytesStart'] / 1048576:.2f} MiB, ends at {life['privateBytesEnd'] / 1048576:.2f} MiB and peaks at {life['privateBytesPeak'] / 1048576:.2f} MiB in the sampled interval.
- Early/late five-sample private-memory medians are {life['earlyPrivateBytesMedian'] / 1048576:.2f} / {life['latePrivateBytesMedian'] / 1048576:.2f} MiB, a change of {life['privateGrowthBytes'] / 1048576:+.2f} MiB. Samples are not monotonically increasing, and the additional material-growth investigation threshold is not exceeded.
- Working-set samples range from {min(working) / 1048576:.2f} to {max(working) / 1048576:.2f} MiB. No forced garbage collection or cache clearing is used after warm-up.

This demonstrates bounded behavior over the measured session, not proof against every possible leak or every device's memory limit. Memory varies while resources/codecs change; this process-level measurement does not isolate its cause. Hidden/offscreen and explicit user-pause behavior are separately covered by the functional matrix, with synthetic-event limits identified above. The measurement browser and loopback server close before the next camera/OBS fixture soak.

The endpoint samples select different resources (`{life['samples'][0]['actual']['resource']}` then `{life['samples'][-1]['actual']['resource']}`), so the early/late medians and intervening samples are more informative than treating the endpoint difference alone as a leak. Process totals do not isolate individual decoder/cache allocations.

## Reproduce and use

Run `npm run web:dev` and open `http://127.0.0.1:5180/`. The installed dependencies require no additional manual setup for this local showcase. Production build/preview uses `npm run web:build`, `node scripts/audit_web_bundle.mjs`, and `npm run web:preview` at `http://127.0.0.1:4180/`. [Controls and reusable component example](../../docs/web-showcase.md).

The single-resource command `python scripts/produce_web_resources.py desk-confused` reopened the accepted scene, verified all 72 cached masters, rendered zero new frames and kept all 42 public file hashes identical. [Rebuild proof](web-production-rebuild.json), [full batch record](web-production-batch-full.json). The [source/rebuild guide](web-resource-rebuild.md) also documents changing the configuration, re-authoring, re-auditing, and the render pause flag. Regeneration follows the configuration; preserve manual edits in a separate scene before regenerating.

For the same measurements after a final build, set `WEB_SHOWCASE_PHASE` to `cold`, `playback`, or `lifecycle` in PowerShell and run `node scripts/measure_web_showcase.mjs`; omit it or use `all` for the full sequence. Run performance phases with other heavy local jobs stopped. The lifecycle phase intentionally takes more than eleven minutes including warm-up.

No paid tool, character regeneration, source upload or public deployment was required. Original PMX/VMD and accepted G1 Blend/VRM hashes remain unchanged. Keep the AuroraYok / yokkaulove attribution and supplied contributor readmes; character media and private sources stay separate from software distribution. Actual Safari/mobile confirmation, the unavailable screenshot comparison, and any future user art-direction refinements remain explicitly outside the evidence passed here. TASK-021 consumes this G4 handoff while retaining overall project acceptance.
'''
(ROOT / 'ops/reports/web-resource-acceptance.md').write_text(text, encoding='utf-8')
print('WEB_RESOURCE_ACCEPTANCE_WRITTEN')
