# Capture intervention and power-state comparison

The failed full fixture and healthy short diagnostic used the **same hashed production index, worker, avatar and SDK version**. Their observation procedures and system power history differed. Those differences justify a short controlled reproduction; they do not establish why capture became white.

## Recorded power evidence

[The narrow read-only power result](power-state-comparison.json) records these Kernel-Power 105 events:

| UTC time on 2026-09-12 | Selected event data | Relationship to the tests |
| --- | --- | --- |
| 10:05:43.500 | `AcOnline=false` | Most recent power-source event before the 11:45 UTC comparison window; query restricted to one event in this workday |
| 12:03:00.971 | `AcOnline=true` | During the full seated phase, about six minutes after white capture/slow animation began |

At 12:56:59 UTC, the current system API reported AC online, battery 81% and charging, battery saver off, effective mode **Balanced**, and the Balanced base scheme. The documented [system power status fields](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-system_power_status) distinguish AC, battery charge and battery-saver status. The [effective-power notification API](https://learn.microsoft.com/en-us/windows/win32/api/powersetting/nf-powersetting-powerregisterforeffectivepowermodenotifications) supplies the current mode upon registration; this read registered briefly, received Balanced and unregistered successfully. It called no power-setting functions.

The event sequence records a real DC-to-AC change across the broader test period, consistent with different historical power conditions. It does not measure CPU/GPU frequency, thermal limits or scheduler decisions. The full-run white capture began around 11:57:13 UTC, **before** AC became online, and persisted after that event. Therefore AC connection cannot be described as either its demonstrated cause or its demonstrated recovery. The root's earlier/later LLVC timing difference also remains a correlation without clock/scheduling evidence.

Narrow queries for selected sleep, Display 4101 recovery, power-policy-change, session disconnect/reconnect and lock/unlock IDs found no matching events from 11:45 to 12:56 UTC. Only timestamps, IDs and whitelisted power/session fields were considered; no broad messages, identities or addresses were collected, and no escalation was used. Missing events do not prove that no transition occurred or that those events were enabled. The event filters use local time for Windows querying and validate returned timestamps against the intended UTC window. An initial DateTime-kind query returned an out-of-window event; that result is excluded from this analysis.

The [earlier post-run policy check](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/power-policy-after.txt) found display/sleep timeouts disabled on AC and DC. The [current-desktop observation](local/combined-soak/2026-09-12T11-55-00-927Z-0b91f283/input-desktop-after.json) found Default in the active console session after the failed run. Neither records continuous historical display/session state.

## Procedure differences

| Factor | Failed combined fixture | Healthy short diagnostic |
| --- | --- | --- |
| Duration | Two 60-second warm-ups plus two 900-second windows | Positive-result readiness, 180-second passive period, one activation and 30 seconds more |
| Extra animation callback | Existing viewer and camera scheduling only | Adds an independent continuously scheduled rAF observer |
| Canvas readback | None during observation | Immediately after a real draw at start, passive end and after activation |
| GL/browser GPU inspection | Selected worker delegate only | Viewer GL properties, context events and browser GPU information |
| Native-window queries | No periodic native window state; geometry API and process memory sampled | Native/window/input-desktop queries approximately every 15 seconds, but native title matching failed |
| Browser activation | None after setup | One logged owned-page bring-to-front after passive period |
| OBS screenshots | Phase start/end | Start/passive end/after activation, paired with canvas captures |
| Measured power at launch | Not recorded | Not recorded; later event history places this run after AC-online event |

Both retained the same privacy boundary, 640×480 permitted portrait fake camera for seated mode, positive installed tracking, Gentle springs, Balanced quality, one clean 720p30 capture and exact OBS restoration. Both used five-second trace collection and roughly 30-second process-memory queries. The diagnostic is not an unmodified original-style control: extra rAF scheduling, synchronous canvas readback and inspection activity could perturb behavior. Their causal effect is unmeasured. Its healthy state already existed before the activation, so bring-to-front cannot be credited with recovery.

The failed seated first 30 measured seconds delivered about 29.93 draws/s before collapsing near 32.6 seconds; the later diagnostic averaged 57.01. These values should not be collapsed into one laptop baseline. The recorded power transition and intervention differences are concrete confounds.

## Recommended next bounded reproduction

After the queued voice parity window, run **at most three minutes from OBS recording start** using the original seated fake-photo workload and original frame instrumentation. Include the original first 60 seconds as warm-up, leaving two minutes to observe the prior approximately 92-second recording failure point. This remains a diagnostic, not the required 30-minute acceptance.

Before recording, record current AC/battery/effective mode, verify exactly one native window under the owned Chrome PID and unique caption, then attach using the unchanged geometry rules. Retain the corrected exact-title-or-exact-Chrome-suffix guard. Use no extra rAF observer, periodic native/GL queries, initial canvas readback or planned activation. Keep original five-second telemetry and original process-memory sampling so the procedure resembles the failed fixture.

Save the original OBS-only start still. If sustained long draw gaps appear, record their onset first, then take one explicitly logged diagnostic snapshot of the actual canvas immediately after a draw, OBS source, GL/GPU context and native/input-desktop state. If no failure occurs, take those probes only after the three-minute passive observation. Capture power state at the end and restore OBS exactly. Do not alter power, display, driver or security settings or ask for physical media.

A clean result would reduce the case that the richer diagnostic's extra probes were necessary for normal behavior under current conditions; it would not prove a fix or reproduce earlier DC conditions. A failure with paired pixels could separate valid avatar rendering from native capture failure and guide a specific correction. No new long soak is justified solely by the previous healthy short run.

This recommendation was executed as [the original-style passive control](capture-passive-control.md):177.366 seconds including60 seconds warm-up, healthy cadence/content, exact native match and observed AC at both endpoints. Its report confirms the same single Clean-mode viewer in every test and distinguishes Chrome Energy Saver from Windows battery saver; historical Chrome saver state was not retained. A future full baseline on observed AC with strict native preflight and failure-triggered snapshots is a reasonable way to measure long-run stability under declared conditions after the voice-path decision. The original failure and its unknown cause remain recorded.
