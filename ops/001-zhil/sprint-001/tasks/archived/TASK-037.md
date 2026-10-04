# TASK-037: Build the local web showcase and reusable resource player

- Status: Done
- Priority: P0
- Goal: G4
- Controller: [TASK-P03](TASK-P03.md)
- Depends on: TASK-036
- Estimate: S-M (1-2 days)
- Specification: [Web character resources](../../specs/web-character-resources-plan.md)

## Outcome

Provide a runnable web server showing the completed assets in homepage and streaming-interface layouts.

## Work

- Add a separate web-showcase entry, Vite configuration, isolated public/output directories and web:dev/web:build/web:preview npm commands using the existing toolchain. Bind local serving to 127.0.0.1; avoid copying the root public avatars/runtime tree.
- Build a homepage greeting mode and stream-style mode with content/player area, character at a separately composited desk, title/status and illustrative chat/sidebar. Adapt to desktop/mobile and keep background/UI content in HTML/CSS.
- Create a reusable manifest-driven resource player with relative/base URLs, poster-first fixed geometry, chosen-size lazy loading, bounded alpha probe, WebM/WebP selection, error/autoplay handling and state-switch crossfades.
- Provide keyboard-accessible five-state selection and play/pause/replay. Respect reduced-motion/data-saving preferences, user pause intent, tab visibility and offscreen status; implement WebP poster-based pause/restart honestly.
- Use posters for unselected gallery entries, at most one normal active animation and a bounded two-source transition; release superseded media. Add optional inspection backgrounds/metrics apart from the normal flow.
- Document actual launch/build/preview commands, integration example and missing-resource behavior; add meaningful browser coverage for source selection, failed-alpha path, lifecycle and accessibility without relying solely on fixtures.

## Acceptance criteria

- [x] A single documented local command starts a usable showcase of all five completed Ene resources in both requested contexts.
- [x] Responsive layouts and keyboard controls work; media overlay alignment survives light/dark backgrounds and narrow screens.
- [x] Reduced-motion, user pause, hidden/offscreen stop, rejected autoplay, failed alpha and missing files behave as specified.
- [x] Network/build inspection shows no PMX/VRM, Three.js/MediaPipe/voice runtime or unselected animation downloads; the production build serves through an HTTP preview.

## Implementation notes

Final acceptance: [implementation and browser report](../../reports/web-showcase.md) records all-five final-file HTTP preview checks in Chrome/Edge/Firefox (11 cases each) and Windows WebKit (9 applicable animated-WebP cases), desktop/phone layout evidence, exact test limits and fixes. [Bundle audit](../../reports/web-bundle-audit.json) passes 45 files, all declared media hashes and 11,725 bytes gzip JS+CSS, with no source/runtime/private files. TASK-036 is archived; the final manifest hash matches its unchanged cached rebuild. [Local/integration guide](../../../../../docs/web-showcase.md) and [source rebuild guide](../../reports/web-resource-rebuild.md) are available. Sustained performance/lifecycle and actual-device gaps remain explicitly owned by TASK-038.

Player/layout code starts alongside TASK-036's long final render batch. TASK-036 remains the acceptance dependency: review media and code scaffolding cannot close this task. The isolated Vite entry uses `web-showcase/public` and `web-showcase/dist`; it does not copy the root avatar or tracking runtime.

Implementation checkpoint: [player and integration guide](../../../../../docs/web-showcase.md), [player code](../../../../../web-showcase/src/player.ts) and separate `web:dev`, `web:build`, `web:preview` commands exist. Review checks use the actual completed greeting/normal files where available and explicitly labelled 12 fps drafts for the remaining states. [Chrome](../../reports/web-showcase-draft-smoke.json), [Edge](../../reports/web-showcase-draft-edge-smoke.json) and [Firefox](../../reports/web-showcase-draft-firefox-smoke.json) pass 11 functional cases; [Windows WebKit](../../reports/web-showcase-draft-webkit-smoke.json) passes the nine applicable animated-WebP cases. Each report identifies the final families used. These are not final all-five-media acceptance or physical mobile-device tests.

Fixed review findings: a cancelled pending `play()` no longer latches an autoplay block; transitions retain the previous still until replacement media is ready and explain fully missing states; generated relative asset paths reject encoded Windows separators before URL construction. The regression includes a previously demonstrated encoded-backslash escape from `/ene/` to known showcase CSS. Vite's filesystem allowlist is now restricted to `web-showcase`; a read-only request for the known parent `package.json` returns 403 while the page/CSS remain available. No private file was requested in that check. Phone composition keeps the raised hand inside the frame. Sixty-five project unit tests pass after the tracking and manifest fixes. Final build/media boundary audit and browser acceptance remain pending TASK-036 completion.

Planned paths are not completed artifacts. Record exact output paths, commands/results and visual evidence before marking Done. Preserve original assets and existing work; keep source and generated character media separate from code distribution. Update TASK-P03 and the backlog after status changes, and summarize material shared dependencies in TASK-P01.

