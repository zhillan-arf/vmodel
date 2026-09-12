// Installed only into the owned diagnostic page. Snapshots are explicit interventions.
export function installCaptureAnimationProbe({ observeRaf: observeAnimationFrames = true } = {}) {
  const viewer = window.__vmodel.viewer, canvas = viewer.renderer.domElement;
  const started = performance.now(), events = [], raf = []; let last, pending;
  const note = (kind, extra = {}) => { events.push({ kind, atMs: performance.now() - started, ...extra }); if (events.length > 100) events.shift(); };
  for (const kind of ['webglcontextlost', 'webglcontextrestored']) canvas.addEventListener(kind, event => note(kind, { statusMessage: event.statusMessage ?? null }));
  for (const kind of ['freeze', 'resume', 'visibilitychange']) document.addEventListener(kind, () => note(kind, { visibility: document.visibilityState }));
  const glStatus = () => {
    const gl = viewer.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { contextLost: gl.isContextLost(), vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
      unmaskedVendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null, unmaskedRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      version: gl.getParameter(gl.VERSION), rendererFrame: viewer.renderer.info.render.frame };
  };
  const draw = viewer.draw.bind(viewer);
  viewer.draw = (...args) => {
    const result = draw(...args);
    if (pending) {
      const { resolve, timer } = pending; pending = null; clearTimeout(timer);
      try { resolve({ atMs: performance.now() - started, png: canvas.toDataURL('image/png'), gl: glStatus() }); }
      catch (error) { resolve({ atMs: performance.now() - started, error: String(error), gl: glStatus() }); }
    }
    return result;
  };
  function observeRaf(now) { if (last !== undefined) { raf.push({ atMs: performance.now() - started, intervalMs: now - last }); if (raf.length > 12000) raf.shift(); } last = now; requestAnimationFrame(observeRaf); }
  if (observeAnimationFrames) requestAnimationFrame(observeRaf);
  window.__captureDiag = {
    status: () => ({ events: [...events], gl: glStatus(), raf: [...raf], view: window.__soak.status().view }),
    takeCanvas: () => new Promise(resolve => {
      if (pending) throw new Error('Only one diagnostic canvas snapshot may be pending.');
      const timer = setTimeout(() => { pending = null; resolve({ error: 'No viewer draw within four seconds', gl: glStatus() }); }, 4000);
      pending = { resolve, timer }; note('canvas-snapshot-requested');
    }),
    note,
  };
}
