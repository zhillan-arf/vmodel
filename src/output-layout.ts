export function publishOutputLayout(canvas: HTMLCanvasElement, read: () => { active: boolean; kind: 'output' | 'clean'; orientation: 'landscape' | 'portrait' }) {
  const id = crypto.randomUUID();
  let lastActive = false, stopped = false;
  let inFlight: AbortController | undefined;
  async function publish() {
    if (stopped || inFlight) return;
    const state = read();
    if (!state.active && !lastActive) return;
    lastActive = state.active;
    const rect = canvas.getBoundingClientRect();
    const payload = { id, ...state, title: document.title, viewport: { width: innerWidth, height: innerHeight }, canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
    const controller = new AbortController(); inFlight = controller;
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      // Periodic requests must finish their bodies rather than exhaust keepalive's 64 KiB quota.
      const response = await fetch('/api/output-layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      await response.text();
    } catch { /* Rendering remains usable without the optional OBS helper. */ }
    finally { clearTimeout(timeout); if (inFlight === controller) inFlight = undefined; }
  }
  const observer = new ResizeObserver(() => { void publish(); }); observer.observe(canvas);
  const timer = setInterval(() => { void publish(); }, 1500);
  return () => {
    if (stopped) return;
    stopped = true; observer.disconnect(); clearInterval(timer);
    inFlight?.abort();
    if (lastActive) void fetch('/api/output-layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active: false }), keepalive: true }).then(response => response.text()).catch(() => {});
  };
}
