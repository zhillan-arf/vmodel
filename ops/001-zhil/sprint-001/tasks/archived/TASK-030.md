# TASK-030: Prove transparent animation delivery and lightweight budgets

- Status: Done
- Priority: P0
- Goal: G4
- Controller: [TASK-P03](TASK-P03.md)
- Depends on: TASK-029
- Estimate: S-M (1-2 days)
- Specification: [Web character resources](../../specs/web-character-resources-plan.md)

## Outcome

Measure the chosen WebM/WebP approach on an actual short Ene animation before committing to five final renders.

## Work

- Create a 1-2 second disposable Ene motion sample with a blink, hand movement and fine hair edges. Establish character-only RGBA rendering, lighting/color configuration and two candidate display scales.
- Measure render time and memory; encode quality/resolution sweeps for VP9 alpha WebM and animated WebP. Preserve masters and exact encoder commands; compare decoded alpha over black, white and checkerboard.
- Use a minimal local HTML measurement harness to exercise actual compositing, known-alpha detection, video autoplay, WebP fallback and poster replacement. This harness is not TASK-037's final showcase.
- Measure bytes, startup, CPU, memory and playback on the laptop. Exercise available Chromium/Firefox/WebKit engines; distinguish emulation/Playwright WebKit from actual Safari/iOS devices.
- Write ops/001-zhil/sprint-001/reports/web-resource-feasibility.md with the selected settings against the proposal's budgets and known target-browser gaps. If alpha detection is unreliable, prefer animated WebP for affected clients and measure it; do not silently fall back to stills as final animated delivery.
- Adjust dimensions, duration or encoding within the creative brief when evidence warrants it. Record any budget revision with reason and quality comparison in the proposal/controller; establish viable output before full production.

## Acceptance criteria

- [x] An animated Ene sample retains real transparency and readable face/hair in WebM and animated WebP.
- [x] Recorded measurements justify an explicit resolution/FPS/quality configuration and size targets; no performance claim is based only on source metadata.
- [x] Codec rejection, lost-alpha detection and poster behavior are demonstrated; WebP pause/restart limits are documented.
- [x] Feasibility report distinguishes verified browser paths from unavailable real devices and provides actionable production settings.

## Implementation notes

Planned paths are not completed artifacts. Record exact output paths, commands/results and visual evidence before marking Done. Preserve original assets and existing work; keep source and generated character media separate from code distribution. Update TASK-P03 and the backlog after status changes, and summarize material shared dependencies in TASK-P01.


## Delivered evidence - 2026-09-12

- [Feasibility report](../../reports/web-resource-feasibility.md) records the actual two-second Ene blink/hand/hair-edge sample, two source scales, rendering cost, alpha correction, encoder sweep and production settings. The editable sample and all 48 RGBA masters remain private.
- [Encoding record](../../reports/web-spike-encoding.json): 480/960 px VP9 CRF34 at 70,663/208,664 bytes; Q65 animated WebP at 909,996/1,731,932 bytes; 48 animated WebP frames / 1,999 ms verified from RIFF structure. Real transparent/opaque/partial-alpha pixels survive decoding.
- [Small browser measurements](../../reports/web-spike-browsers.json): Chrome and Firefox WebM/WebP pass; Windows Playwright WebKit uses animated WebP after the actual WebM timeout. Known-alpha, lost-alpha, codec rejection, poster, pause/resume and visibly changing frames are checked. Chrome 60-second WebM: 1,429 frames, zero dropped.
- [Large measurements](../../reports/web-spike-browsers-large.json): Chrome 960 px/640 CSS px, 30 seconds per codec, 715 WebM frames/zero dropped; alpha and fallback checks pass. CPU/browser-process memory and 10 Mbit/s + 100 ms cache-disabled startup are recorded. Large WebP memory cost supports using small rendition by default.
- [Selected configuration](../../../../../config/web-resources/encoding.json): 24 fps, explicit RGBA resize intermediate, WebM CRF34, WebP Q65/compression4, three-second desk loops. Existing budgets retained; final media must independently pass. Actual Safari/iOS/Android/Edge, long-session lifecycle and final creative resource acceptance remain explicit TASK-038 work.
