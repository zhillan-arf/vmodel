// Only geometry is shared with the local OBS helper; no media or avatar data.
import { allowedOrigins, acceptsOrigin } from './request-origin.mjs';
export function createOutputLayoutHandler(port, { now = Date.now, ttl = 5500, origins = allowedOrigins(port) } = {}) {
  const layouts = new Map();
  return async function handle(req, res) {
    if (req.url?.split('?')[0] !== '/api/output-layout') return false;
    const reply = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    if (!acceptsOrigin(req, origins)) { reply(403, { error: 'Configured origin required.' }); return true; }
    for (const [id, value] of layouts) if (now() - value.observedAt > ttl) layouts.delete(id);
    if (req.method === 'GET') { reply(200, { layouts: [...layouts.values()] }); return true; }
    if (req.method !== 'POST') { reply(405, { error: 'Use GET or POST.' }); return true; }
    if (!req.headers.origin || req.headers['content-type']?.split(';')[0] !== 'application/json') { reply(403, { error: 'Same-origin JSON required.' }); return true; }
    try {
      let length = 0; const chunks = [];
      for await (const chunk of req) { length += chunk.length; if (length > 4096) { reply(413, { error: 'Layout too large.' }); return true; } chunks.push(chunk); }
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!input || !/^[a-f0-9-]{36}$/.test(input.id)) throw new Error('Invalid layout identifier.');
      if (input.active === false) { layouts.delete(input.id); reply(200, { ok: true }); return true; }
      const { title, kind, orientation, viewport, canvas } = input;
      if (input.active !== true || typeof title !== 'string' || !title.startsWith('VModel Output') || title.length > 160 || /[\r\n]/.test(title)) throw new Error('Invalid output title.');
      if (!['output', 'clean'].includes(kind) || !['landscape', 'portrait'].includes(orientation)) throw new Error('Invalid composition.');
      if (!viewport || !canvas || ![viewport.width, viewport.height, canvas.left, canvas.top, canvas.width, canvas.height].every(Number.isFinite)) throw new Error('Invalid geometry.');
      if (viewport.width < 1 || viewport.height < 1 || viewport.width > 16384 || viewport.height > 16384 || canvas.width < 1 || canvas.height < 1 || canvas.left < -1 || canvas.top < -1 || canvas.left + canvas.width > viewport.width + 1 || canvas.top + canvas.height > viewport.height + 1) throw new Error('Canvas must fit the viewport.');
      if (!layouts.has(input.id) && layouts.size >= 32) { reply(429, { error: 'Too many outputs.' }); return true; }
      layouts.set(input.id, { id: input.id, title, kind, orientation, viewport: { width: viewport.width, height: viewport.height }, canvas: { left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height }, observedAt: now() });
      reply(200, { ok: true });
    } catch { if (!res.headersSent) reply(400, { error: 'Invalid output layout.' }); }
    return true;
  };
}

export function captureCrop(sourceWidth, sourceHeight, layout) {
  const { viewport, canvas } = layout;
  const scale = sourceWidth / viewport.width;
  const chromeTop = sourceHeight - viewport.height * scale;
  if (![scale, chromeTop].every(Number.isFinite) || scale < 0.5 || scale > 4 || chromeTop < -1 || chromeTop > 400) throw new Error('Unexpected capture geometry. Keep the output visible, then attach again.');
  const crop = {
    cropLeft: Math.max(0, Math.round(canvas.left * scale)),
    cropRight: Math.max(0, Math.round(sourceWidth - (canvas.left + canvas.width) * scale)),
    cropTop: Math.max(0, Math.round(chromeTop + canvas.top * scale)),
    cropBottom: Math.max(0, Math.round(sourceHeight - (chromeTop + (canvas.top + canvas.height) * scale))),
  };
  const width = sourceWidth - crop.cropLeft - crop.cropRight, height = sourceHeight - crop.cropTop - crop.cropBottom;
  const aspect = layout.orientation === 'landscape' ? 16 / 9 : 9 / 16;
  if (width < 1 || height < 1 || Math.abs(width / height - aspect) > 0.015) throw new Error('Output composition changed. Attach again after resizing.');
  return crop;
}
