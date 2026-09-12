// A loaded browser can keep a webcam alive after its local server exits.
// Stop capture if the production server is lost, including the Stop launcher.
export function watchLocalServer(active: () => boolean, stop: () => void, check = async () => {
  const response = await fetch('/health', { cache: 'no-store', signal: AbortSignal.timeout(1000) });
  return response.ok && (await response.json()).application === 'vmodel';
}) {
  let failures = 0, pending = false, closed = false;
  const timer = setInterval(async () => {
    if (closed || pending) return;
    if (!active()) { failures = 0; return; }
    pending = true;
    let healthy = false;
    try { healthy = await check(); } catch { /* Stop below after a second failed check. */ }
    pending = false;
    if (closed || !active()) { failures = 0; return; }
    failures = healthy ? 0 : failures + 1;
    if (failures >= 2) { failures = 0; stop(); }
  }, 1500);
  return () => { closed = true; clearInterval(timer); };
}
