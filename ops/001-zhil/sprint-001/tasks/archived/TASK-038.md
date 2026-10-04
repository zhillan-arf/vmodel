# TASK-038: Validate web resources and deliver the G4 integration kit

- Status: Done
- Priority: P0
- Goal: G4
- Controller: [TASK-P03](TASK-P03.md)
- Depends on: TASK-037
- Estimate: M (1-3 days)
- Specification: [Web character resources](../../specs/web-character-resources-plan.md)

## Outcome

Complete evidence-backed delivery of all five animated web resources and their simple local showcase.

## Work

- Review actual Ene greeting and all four desk expressions against G4-A through G4-E; verify supplied VMD reference treatment and screenshot-inspired composition.
- Run build/HTTP browser checks and measure per-rendition bytes, first-visit startup at the stated network profile, 60-second playback, 20 switches and a 10-minute lifecycle session. Record hardware, browser versions, path and settings.
- Verify WebM alpha or animated WebP in Windows Chromium/Firefox and available Android Chrome/Safari macOS/iOS targets. Playwright WebKit is supplementary; unavailable actual device checks stay explicit and unpassed.
- Exercise reduced motion, data-saving behavior where supported, rejected autoplay, asset/alpha failures, pause/replay, offscreen/hidden lifecycle and transparent edges. Fix release-blocking defects; do not substitute posters for required normal animation.
- Package local media/manifest, editable sources/actions, source/motion mapping, recipe, attribution, quickstart and a reusable integration example. Demonstrate a clean startup and a single-resource rebuild without modifying G1/G2/G3 tools.
- Write ops/001-zhil/sprint-001/reports/web-resource-acceptance.md with G4 criteria mapped to evidence, limitations and unresolved checks. Hand G4 to TASK-P01/TASK-021; update TASK-P03 and backlog counts. No public deployment is part of this task.

## Acceptance criteria

- [x] G4-A through G4-E map to actual final media, source and runnable showcase evidence; all five animations are reviewed.
- [x] Measured quality, byte, loading and lifecycle gates pass or explicitly agreed revisions are recorded; required target-device gaps are not marked passed.
- [x] The handoff includes reproducible launch/integration/rebuild instructions, credits and precise codec/playback limitations.
- [x] No release-blocking defect remains; TASK-P03 and TASK-P01 receive the acceptance report while TASK-021 retains overall final acceptance.

## Implementation notes

Accepted 2026-09-12 for the measured local Windows scope. The [G4 acceptance report](../../reports/web-resource-acceptance.md) maps every goal to actual final media/source evidence, the four-engine functional matrix and measured gates. All five final source/codec comparisons pass at 320/640 CSS px. The [isolated bundle/hash audit](../../reports/web-bundle-audit.json) verifies 45 files and 11,725 gzip bytes of JS/CSS, with no source model, tracking or voice payload. All rendition byte ceilings pass unchanged.

`node scripts/measure_web_showcase.mjs` was run as separate phases against the actual final build over an owned loopback HTTP server, setting PowerShell's `$env:WEB_SHOWCASE_PHASE` to `cold`, `playback` and `lifecycle`, with no concurrent owned heavy job. In installed Chrome 152 on the i7-1255U laptop, [cold loading](../../reports/web-showcase-measurement-cold.json) at 10 Mbit/s, 100 ms latency and disabled cache showed small WebM animation in 1,531 ms and the actual WebP fallback in 1,920 ms. [Four playback samples](../../reports/web-showcase-measurement-playback.json) each exceed 61 seconds: both WebM sizes have zero measured-interval dropped frames; both WebP sizes visibly animate, with CPU/memory retained and no invented video-frame counter. [Lifecycle](../../reports/web-showcase-measurement-lifecycle.json) passed 20 full-loop warm-up switches plus 602.21 seconds/20 further switches: exactly one active animation and 160 DOM elements at every sample; private-memory medians changed by 87.07 MiB (7.7%) with non-monotonic samples. Browser/server closed after the run.

The [launch/integration guide](../../../../../docs/web-showcase.md), [rebuild guide](../../reports/web-resource-rebuild.md) and [unchanged single-resource rebuild](../../reports/web-production-rebuild.json) supply the usable handoff. Original PMX/VMD and G1 Blend/VRM hashes remain unchanged. The acceptance report was delivered to TASK-P01/TASK-021 coordination before controller closure; overall camera/OBS/voice acceptance stays with TASK-021.

Limits: actual macOS Safari, iOS Safari and Android Chrome were unavailable and remain explicitly untested/unpassed. Windows Playwright WebKit is supplementary engine coverage. Narrow viewports, network throttling, visibility/data-saving/autoplay failure injections retain their simulation labels. The original screenshot attachment was unavailable, so written-brief composition is delivered without a direct attachment comparison. No public deployment is included.

## Launcher consistency — 2026-09-13

The showcase guide told the user to open a terminal and run `npm run web:dev`, the only place in an otherwise `.cmd`-driven kit that required a developer command. **Start Web Showcase.cmd** now wraps it, guarding on both the installed dependencies and the media package with messages naming the setup step, and opening the page. The npm command is still documented for anyone who prefers it.

Verified: both guard paths resolve, and `web:dev` serves `http://127.0.0.1:5180/` with HTTP 200.

This changes no media, manifest or acceptance evidence; G4 remains accepted as recorded. It removes a friction point found by asking how a beginner would open the showcase after a reboot, the same question that found the missing listening-room launcher.
