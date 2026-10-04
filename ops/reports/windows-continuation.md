# Windows continuation

Date: 2026-10-04.

## Scope

This session checks the existing studio on the Windows laptop.
[TASK-061](../tasks/backlog/TASK-061.md) collects human review, physical motion, voice selection, and final recordings.
The original release requirements remain in force.

## Corrections

- The solver comparison now calls Vitest through Node and uses forward slashes in its file pattern.
- Vite excludes local tools, generated assets, reports, and source packages from its file watcher.
- Vite scans `index.html` for dependencies.
- Verification saves error logs under `ops/reports/local/verify/`.
- The Windows browser helper selects installed Chrome or Edge through `VMODEL_BROWSER`.
- Video tests wait for two encoded chunks before a stop condition.
- Recording-state tests wait for the display update instead of assuming an 80-millisecond delay.

The avatar replay check fell from 182.7 seconds to 7.9 seconds after the Vite correction.
The video test previously stopped before Windows supplied a usable video sequence.
The application retains its codec order, inference schedule, confidence thresholds, and smoothing.
The browser helper permits 120 seconds for navigation during cold test startup.
The application retains its 30-second model preparation deadline and all performance limits.

## Chrome software checks

Chrome version: `154.0.8037.97`.
All 310 unit tests passed.
The production build passed with the existing warning for the main JavaScript chunk above 500 kB.
The solver comparison passed 720 updates against commit `da48542e991aa202a1b9eaafc1a4f1cbb22ef7b9`.
Canonical, Ene, and Rei replay checks passed for 52 bones.

The complete verification run had two failed test fixtures.
Both fixtures passed after their timing corrections.
See [the Chrome record](windows-chrome-verification.json).
The original logs remain under `ops/reports/local/windows/chrome/verify/`.

## Edge software checks

All 37 checks in the complete Edge verification run passed.
See [the Edge verification record](verify-msedge.json).
The combined camera, import, replay, recovery, and storage-failure test also passed in both browsers.
See the [Chrome result](combined-studio-chrome.json) and [Edge result](combined-studio-msedge.json).
Each browser has evidence for the original 37 checks and this additional test.
The verification command now includes all 38 checks.
The new test produced no page errors or external requests.
The same test also passes in [bundled Chromium](combined-studio-chromium.json), which remains the default when no browser channel is selected.

## Measurement method

The laptop has an Intel Core i7-1255U, 16 GB RAM, and Intel Iris Xe graphics.
The Intel graphics driver is `31.0.101.4255`.
Chrome is `154.0.8037.97`; Edge is `154.0.4258.53`.
All browser automation runs without a visible browser window.

The local model hashes are:

| Model | SHA-256 |
| --- | --- |
| Ene | `3657b97928638e7ada5f6639141fb63f555912049a2c6ec217851001e322cbcb` |
| Rei | `07037243141d9c3f260c6ef09419f1225ca64ffb7791204b4aef0b817ebc1735` |

`scripts/windows_library_measure.mjs` measures the actual Ene and Rei files.
Each output condition has five warm-up selections and 20 alternating selections.
Windows process measurements include private bytes, working-set bytes, and peak working-set bytes.
Private bytes measure committed memory that a browser process cannot share with other processes.
Each process peak can occur at a different time.
The report sums these counters and separately records sampled private memory.
The cleanup test keeps browser pages open while it samples memory.
It requires zero remaining owned geometries and textures.
It applies the existing L13 limit of 15% or 100 MiB, whichever is larger.

Chrome passed both output conditions with stable graphics counts and zero owned resources after disposal.
The baseline medians were 3,800 MiB with output closed and 6,471 MiB with output open.
The final cleanup samples were at most 1,462 MiB and 1,797 MiB, respectively.
See [the Chrome measurements](windows-library-chrome.json).
Edge also passed both conditions with stable graphics counts and zero owned resources after disposal.
Its baseline medians were 3,881 MiB with output closed and 6,820 MiB with output open.
The final cleanup samples were at most 1,616 MiB and 2,043 MiB, respectively.
See [the Edge measurements](windows-library-msedge.json).

Import measurements use the production inspection worker and viewer with unchanged model bytes.
They measure inspection, preparation, and the first frame.
The storage and registration tests supply separate database evidence.

`scripts/windows_tracking_measure.mjs` uses one repeated public NASA photograph as a simulated camera stream.
It crops the face and raised arm, then places the crop in a 640 by 480 frame.
Each mode has 30 seconds of warm-up and three 60-second samples.
The script checks the power source before and after each sample.
All modes must use the same power source.
The [initial run](windows-tracking-power-transition.json) changed from battery power to AC power and cannot establish a performance comparison.
The [second run](windows-tracking-size-mismatch.json) used different avatar render dimensions and cannot establish a performance comparison.
The final protocol fixes the avatar renderer at 752 by 423 pixels in every mode.
The modes include the pinned baseline, inspector off, overlay, estimated 3D, trace recording, dense face points, and camera video.
The script records accepted pose samples, first-use age, render rate, process memory, delegate, and frame requests in flight.
Useful pose rate counts unique samples that update the spine or an arm.
Capture-to-use age uses the camera worker timestamp and the first solver update for that sample.
These results cannot establish physical gesture quality.

The first fixed-size run completed the reference, off, overlay, estimated-3D, and trace-recording samples.
Its dense-face assertion used a report-only field instead of the worker's landmark array.
The worker reported positive face samples, but the incorrect counter stayed at zero.
The script now counts the actual face landmarks.
The failed run remains in [the original record](windows-tracking-chrome.json).
Its completed modes retain their measured values; its dense-face result does not establish that mode's acceptance.

The completed samples had these medians:
FPS means frames per second.
The p95 value is the value below which 95% of measured sample ages fall.

| Mode | Renderer FPS | Useful pose Hz | p95 capture-to-use age, ms |
| --- | ---: | ---: | ---: |
| Reference | 59.98 | 5.58 | 196.20 |
| Inspector off | 59.97 | 4.82 | 214.10 |
| Default overlay | 59.99 | 5.03 | 197.00 |
| Estimated 3D | 59.98 | 5.02 | 197.40 |
| Bounded trace recording | 60.00 | 4.92 | 196.90 |

The overlay satisfies the measured default-mode speed and age limits.
The sequential reference comparison loses 13.7% of task rate and fails the 5% limit.
The [follow-up test](windows-tracking-chrome-alternating.json) changes the mode order to check variation over time.
It uses three pairs: reference/off, off/reference, and reference/off.
Each visit has 30 seconds of warm-up and one 60-second sample.
Each mode therefore has three measured samples.
All samples use AC power and the same render dimensions.
This comparison passes: face rate retains 97.0%, pose and hand rates retain 96.8%, and renderer FPS retains 99.97%.
The unchanged reference varied from 4.28 to 4.85 useful pose Hz during this repeat.
The initial reference median was 5.58 Hz.
The first sequential failure remains recorded; the repeat reduces the effect of mode order.
Recording measurements retain the 60-second and 32 MiB limits.
The initial recording run did not record the exact stop time within each sample.
The [optional-mode repeat](windows-tracking-chrome-optional.json) completes recording and dense-face measurements.
Its video start check incorrectly expected the trace-only status text.
The script now requires the separate trace-and-video status and verifies exported video bytes.
The completed recording samples show active durations from 49.95 to 51.69 seconds within each 60-second measurement.
These values describe the bounded recording workflow, including its automatic stop.
The dense-face samples each contain 478 face points.
The [video repeat](windows-tracking-chrome-video.json) completes all three samples and exports three WebM files.
Video recording stays active for 48.61 to 48.64 seconds within each 60-second sample.
The exports contain 3.60 to 4.19 million bytes.

The final optional-mode medians are:

| Mode | Renderer FPS | Useful pose Hz | p95 capture-to-use age, ms |
| --- | ---: | ---: | ---: |
| Bounded trace recording | 59.98 | 4.95 | 197.30 |
| Dense face points | 60.00 | 4.33 | 243.40 |
| Bounded camera video | 60.00 | 5.25 | 180.40 |

These optional-mode results do not replace the default-mode limits.
Sampled private memory stays between 1,933 and 2,097 MiB in these optional modes.
After each optional-mode context closes, sampled browser private memory is between 1,040 and 1,072 MiB.
Every accepted sample has one camera request and at most one frame in flight.
Resource tests and these samples show no unbounded growth during the measured intervals.

The [measurement summary](windows-tracking-summary.json) validates three samples for every mode and records both required limit results as passed.
It preserves the source errors and uses only completed modes from interrupted runs.
Run `node scripts/summarize_windows_tracking.mjs` to repeat that evidence check.

## Repeat the software tests

Use PowerShell from the repository directory.
Select `chrome` or `msedge` in `VMODEL_BROWSER`.

```powershell
$env:VMODEL_BROWSER = 'chrome'
$env:NODE_OPTIONS = '--import=./scripts/windows-browser.mjs'
npm run verify
```

Run each measurement separately after software verification.
Keep the same power source throughout the tracking test.
Do not run other browser tests during a measurement.

```powershell
node scripts/windows_library_measure.mjs
node scripts/windows_tracking_measure.mjs
```

Each measurement writes a browser-specific JSON report under `ops/reports/`.

## Final verification

Task records, acceptance claims, document links, and report parsing pass their audits.
The whitespace check and syntax checks pass.
All test servers and browser processes have stopped.
The existing Studio server remains active.

## Remaining acceptance

TASK-039, TASK-043, TASK-045, and TASK-051 are complete for their automated implementation checks.
The task files identify each transferred human check and its release owner.
TASK-061 owns human appearance review, native browser zoom, screen-reader checks, and guide review.
Physical diagnosis must precede any tracking correction experiment.
TASK-057 through TASK-059 still need that diagnosis and the required physical repetitions.
P04, P05, and final studio acceptance remain open.
