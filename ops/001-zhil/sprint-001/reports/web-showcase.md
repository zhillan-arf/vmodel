# Final-media website implementation

The complete Ene showcase is built and running locally at **http://127.0.0.1:4180/**. TASK-037's player/layout acceptance passes with all five final media families. Sustained performance, lifecycle measurements and the overall G4 handoff remain in TASK-038.

The welcome layout plays the full-body greeting; the desk layout presents normal, confused, surprised and excited performances alongside separate HTML/CSS content, desk and illustrative chat. One reusable [player](../../../../web-showcase/src/player.ts) reads the [final manifest](../../../../web-showcase/public/ene/manifest.json). [The beginner/integration guide](../../../../docs/web-showcase.md) records local commands, component usage and playback behavior; [the rebuild guide](web-resource-rebuild.md) covers authoring and media regeneration.

## Final production browser checks

All runs used the actual `web-showcase/dist` through Vite's HTTP preview on port 4180, after the complete final package was built. No draft routing or replacement media were used. Tests ran concurrently for functional coverage, so their elapsed times are not performance measurements. Every owned test browser closed afterward.

| Windows browser | Selected normal animation path | Passed cases | Evidence |
| --- | --- | --- | --- |
| Chrome 152.0.7977.83 | Transparent WebM | 11 | [Report](web-showcase-smoke.json) |
| Edge 152.0.4191.66 | Transparent WebM | 11 | [Report](web-showcase-edge-smoke.json) |
| Firefox 155.0 | Transparent WebM | 11 | [Report](web-showcase-firefox-smoke.json) |
| Playwright WebKit 26.6 on Windows | Animated WebP | 9 applicable cases | [Report](web-showcase-webkit-smoke.json) |

Coverage includes all five state controls and keyboard activation, one active animation, selected-family-only loading, pause/replay, retained pause intent across selection/visibility changes, actual offscreen scrolling, reduced-motion poster default with explicit Play, data-saving poster default, failed-alpha animated WebP fallback, PNG poster fallback, missing manifest, missing animations, and retaining a visible previous still while a replacement is delayed or completely missing. WebM-capable browsers additionally exercised rejected autoplay with explicit retry and an interrupted pending play that must resume when returned onscreen.

Failure responses, data-saving state and the hidden-tab signal were deliberately simulated; offscreen detection used real scrolling and IntersectionObserver. Autoplay/AbortError tests controlled promise timing around an actual video element. These cases test the application's response, not every operating-system/browser failure mode. The optional `finalFamilies` field in draft reports lists only draft overrides; non-draft reports instead use the complete final package directly.

No page errors or external page requests occurred. No camera or microphone is part of this website. Windows WebKit and 390×844 browser viewports are supplementary compatibility/layout checks; actual Safari, iPhone and Android hardware remain unverified.

Saved final screenshots: [welcome desktop](local/web-showcase/welcome-desktop.png), [desk desktop](local/web-showcase/desk-desktop.png), [welcome phone layout](local/web-showcase/welcome-mobile.png), [desk phone layout](local/web-showcase/desk-mobile.png). The raised palm stays inside the phone composition. [Final source/codec review](web-resource-production-review.md) supplies the separate white/black/checkerboard alpha and appearance evidence. The original reference screenshot is unavailable locally; the documented pose/composition brief guided the source work.

## Fixed issues and package boundary

Review caught three material defects before acceptance. Cancelled pending video playback now has a separate attempt generation, so pause/offscreen cancellation cannot latch an autoplay block. State changes keep a previous still until replacement content is usable, with a truthful unavailable state when all new files fail. Manifest asset paths reject encoded Windows separators before URL resolution, closing a demonstrated escape from `/ene/` to known showcase CSS. [The path regression](../../../../tests/web-manifest.test.ts) includes that exact vector.

The Vite development server also limits its filesystem allowlist to `web-showcase`. A read-only boundary check returned HTTP 403 for the known parent `package.json`, while the page and its own CSS returned 200. No private file was requested in that check.

The [production bundle audit](web-bundle-audit.json) passes **45 files**: index HTML, two code assets, 40 character-family files, the alpha probe and manifest. JS+CSS is **11,725 bytes gzip**, below the 150 KiB budget. Rendered files total **26,046,463 bytes** excluding the manifest; the browser loads only its selected rendition and poster. Exact media sizes and SHA-256 hashes match the manifest. No PMX, VMD, Blend, VRM, tracking runtime, voice files, recordings or private credentials are bundled. The manifest SHA-256 is `423a4ce2916bd4c9f3560fbf871c8c5ba156dbbd739efda29462008f012586a2`; the independently demonstrated cached media rebuild kept all staged hashes unchanged.

## Commands and remaining gates

```powershell
npm run web:build
node scripts/audit_web_bundle.mjs
npm run web:preview
$env:ENE_WEB_TEST_URL = 'http://127.0.0.1:4180'
node scripts/web_showcase_smoke.mjs --browser chrome
node scripts/web_showcase_smoke.mjs --browser edge
node scripts/web_showcase_smoke.mjs --browser firefox
node scripts/web_showcase_smoke.mjs --browser webkit
```

The production typecheck/build, bundle audit and matrix above pass. The existing 65-test project run includes the tracking timestamp/watchdog and media-path regressions. Later isolated soak-helper tests are separate evidence. TASK-038 owns throttled first-load timing, sustained codec playback, 20-switch/ten-minute lifecycle measurements, and the final G4 package/credit handoff; TASK-037 does not pre-accept those measurements.
