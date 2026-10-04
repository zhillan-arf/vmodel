# TASK-044 implementation evidence

Date: 2026-10-04. Status: Done.

Selection preserves the active model until preparation completes.
Output control cancels an older pending load when a newer revision arrives, including before hash calculation finishes.
Heartbeat expiry now removes stale peer results from the studio interface.

Changed files: `src/main.ts`, `src/model-selection.ts`, and `src/output-link.ts`.
Tests: `tests/output-link.test.ts`, `tests/model-selection.test.ts`, and `scripts/output_failure_smoke.mjs`.

Commands:

```text
npm test -- --reporter=dot
npm run build
node scripts/output_failure_smoke.mjs
```

All 254 unit tests pass. Type checking and the production build pass.
The build retains its existing warning for a JavaScript chunk above 500 kB.
The [browser report](output-failure-smoke.json) records fixture hashes and results from Chromium 153.0.8010.12 on Linux.

| Acceptance check | Evidence |
| --- | --- |
| Studio preparation failure | Avatar hash, label, settings, calibration, expression, and bundle selection remain equal to their previous values. |
| Persistence failure | An injected preference write failure shows session-only selection. The studio and output retain the successful model. |
| Old messages and late loads | Unit tests reject old acknowledgments. A paused hash result cannot replace the newer revision. |
| Failed peer decode | The peer retains its old avatar. The studio displays the error. The output shows no error text. |
| Deadline | Expired preparation retains the old model. The late candidate is disposed. A later retry succeeds. |
| Late or reloaded peer | Both receive the latest committed model bytes. |
| Disconnection | Closed peers clear their status. A unit test also expires a peer whose heartbeat stops. |

The existing unit suite covers output layout, composition, and channel teardown.
The [combined browser test](studio-features-smoke.json) covers 20 alternating selections after five warm-up selections.

The deadline test triggers the 30-second timer callbacks after candidate preparation.
Separate fake-timer tests verify the duration and synchronous-work deadline checks.
The browser fixture uses synthetic models. It does not establish Ene/Rei appearance or Windows release-browser acceptance.
P04 retains those release checks.

## Actual-model reload correction

A Linux Ene/Rei check found a readiness race during reload.
The studio displayed Rei before its selected-entry transaction completed. Reload could restore the earlier Ene preference.
The studio now reports readiness after the selection write completes.
Storage failure retains the active model and reports session-only selection.
The regression script includes a delayed selection write and an immediate reload after readiness.

The native Ene/Rei sequence now passes all eight checks with no page errors.
The delayed-write regression also passes: readiness waits for persistence, and reload retains the selected model.
Storage failure still retains session-only selection.
Commands: `node scripts/model_selection_smoke.mjs --chromium` and `node scripts/output_failure_smoke.mjs`.
Evidence: [native models](local/model-selection-smoke.json) and [failure cases](output-failure-smoke.json).
The full unit suite passed 282 tests. Production typecheck, build, and task audit passed.

## Studio reload with an open output

A new browser check found that Studio reset its selection revision after reload.
The open output retained a larger revision and rejected the restored model.
Studio now stores the selection revision in sessionStorage with its output session identifier.
The next selection uses a larger revision after reload.
This counter contains no model bytes or terms.

The updated browser check passes after this correction.
It makes 25 saved model changes, selects a temporary model, and reloads Studio with the output still open.
Both windows return to the saved model. Database entries and saved selection remain unchanged.
Evidence: [Studio feature check](studio-features-smoke.json).

## Preparation timeout message

The load error formatter discarded the preparation timeout message because its filter did not include that exact message.
It showed an invalid VRM file message instead.
The formatter now preserves the known 30-second timeout and its retry instruction.
The six load-error tests pass, including the timeout regression test.
Other parser and platform errors retain their existing fallback messages.

## Built-bundle Chromium checks

`node scripts/model_selection_smoke.mjs --chromium` passes with actual Ene and Rei files.
The check verifies output synchronization, idle poses, Rei expressions, separate model settings, and reload persistence.
Missing files, delayed older fetches, and invalid manual imports preserve the current selection.
No page error occurs.
The [Chromium report](model-selection-chromium.json) records the checks and JavaScript build hashes.

`node scripts/avatar_load_failure_smoke.mjs --chromium` also passes.
Three malformed inputs preserve the active avatar and continued rendering.
A valid file recovers without reload. The [failure report](avatar-load-failure-chromium.json) records these results.
The default Chrome checks still require installed Chrome. These Chromium results do not close Windows browser acceptance.

## Output mismatch images

The existing output-failure check now captures Studio and clean output at all three required sizes.
The six images show a peer decode failure while Studio has selected a different model.
The test verifies that clean output retains the previous model and contains no error text.
It then removes the injected failure and verifies output recovery.
No horizontal page overflow or page error occurs.

The [output report](output-failure-smoke.json) records image paths, hashes, viewport sizes, and all recovery checks.
Images remain under `ops/reports/local/visual-states/output/`.
Assistant examination of the narrow pair confirms visible Studio error text and an unobstructed output image.
The models are synthetic fixtures. These images do not establish actual model appearance or human acceptance.
