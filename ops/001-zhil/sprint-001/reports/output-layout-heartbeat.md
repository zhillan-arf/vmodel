# Output-layout heartbeat failure and reproduction

The first two combined avatar/tracker/OBS soaks were interrupted after approximately five measured minutes of their seated phase. Both attempts stopped their owned recording and fake camera and restored OBS successfully. These are partial workload measurements, not completed 30-minute soaks.

The enhanced second attempt established that the output-layout API entry expired while the actual capture geometry stayed unchanged. The last heartbeat received HTTP 200 at `2026-09-12T11:40:22.443Z`; the next geometry guard failed at `11:40:51.846Z`, with an empty API layout list. At failure, live DOM viewport/canvas coordinates, backing-buffer dimensions and native OBS source/crop exactly equalled the initial attachment. The browser remained visible and focused, and its resize/focus/visibility event ring was empty. The camera worker continued producing results. This evidence does not support attributing the interruption to a resize, display idle or temperature.

The preserved diagnostic is [the second run report](local/combined-soak/2026-09-12T11-34-10-731Z-a910b510/report.json). The original attempt remains in [its separate report](local/combined-soak/2026-09-12T11-20-21-602Z-dc841f17/report.json). Each includes partial performance summaries; neither replaces an uninterrupted soak.

## Bounded browser reproduction

[The probe](../../../../scripts/output_layout_heartbeat_probe.mjs) uses an owned loopback server, the production layout API handler and a blank Chrome page. It performs 500 sequential layout POSTs per case with a 10 ms pause, using the same 272-byte JSON geometry payload. It opens no camera, microphone, avatar or OBS output. Each case has its own browser context. The complete counters, exact exceptions and browser version are in [the machine-readable result](output-layout-heartbeat-probe.json).

| Periodic fetch configuration | Successful / attempted | Server POSTs | Browser finished responses |
| --- | ---: | ---: | ---: |
| Playwright route interception; keepalive; response unread | 240 / 500 | 240 | 0 |
| No route interception; keepalive; response unread | 240 / 500 | 240 | 0 |
| Route interception; keepalive; response consumed | 500 / 500 | 500 | 500 |
| Route interception; ordinary fetch; response consumed | 500 / 500 | 500 | 500 |

Both unread keepalive cases fail from zero-based request index 240 onward with `TypeError: Failed to fetch`. The first 240 payloads total 65,280 bytes; the next would exceed 65,536 bytes. The [Fetch Standard's HTTP network-or-cache algorithm](https://fetch.spec.whatwg.org/#http-network-or-cache-fetch) rejects a keepalive request when its body plus unfinished keepalive bodies exceeds 64 KiB. This threshold, the absent completed responses and the successful consumed-body controls identify exhausted keepalive accounting as the reproduced failure mechanism. It also explains why the publisher's silent catch allowed the server's 5.5-second geometry TTL to expire.

The failure reproduced with and without request interception. Both cases still use a Playwright-launched installed Chrome; this is not a separate manually launched browser test. The accelerated diagnostic establishes request-count behavior, not elapsed-time performance. An initial exploratory variant added a two-second AbortSignal to unread requests; it completed 500 because later aborts released their bodies, and therefore did not reproduce the original publisher's no-timeout contract. Its separate [exploratory output](local/output-layout-heartbeat-probe-aborted-bodies.json) is retained rather than mixed into the four-case result.

The production correction in [output-layout.ts](../../../../src/output-layout.ts) uses ordinary periodic requests, consumes responses and permits one pending request with a 2.5-second abort. Stop disconnects the observer and timer and aborts pending work. Only the final inactive teardown uses keepalive; its response is also consumed when the document remains available. The capture geometry guard and TTL remain strict.

Validation: the three new publisher lifecycle regressions plus existing layout and soak-summary tests pass (12 tests). The [actual-source browser smoke](output-layout-publisher-smoke.json) passed 500 accelerated publisher requests (117,000 body bytes) without failure, with the API layout still current. Stop removed the API entry; its single pending ordinary request was intentionally aborted, and every other request finished. The script changes only the publisher interval from 1,500 to 10 ms for this bounded regression, and imports the actual TypeScript source with types stripped. It does not alter its request/response logic. An initial smoke incorrectly rejected the expected Stop abort; [that guard result](local/output-layout-publisher-smoke-stop-guard.json) is retained, and the corrected guard permits only one `net::ERR_ABORTED` after Stop. The production build/typecheck and 33-file bundle/notice audit passed after the source correction. These checks permit the strict full-soak retry; they alone do not establish that the longer workload passes.
