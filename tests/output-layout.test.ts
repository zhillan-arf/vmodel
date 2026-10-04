import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { captureCrop, createOutputLayoutHandler, type OutputLayout } from '../scripts/output-layout.mjs';
const servers: http.Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });
async function fixture(origins?: string[]) {
  let time = 1000;
  const server = http.createServer(); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const handler = createOutputLayoutHandler(port, { now: () => time, origins });
  server.on('request', (req, res) => { void handler(req, res).then(handled => { if (!handled) { res.writeHead(404); res.end(); } }); });
  const origin = `http://127.0.0.1:${port}`;
  const post = (body: unknown, originHeader = origin) => fetch(origin + '/api/output-layout', { method: 'POST', headers: { Origin: originHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const get = () => fetch(origin + '/api/output-layout').then(response => response.json());
  return { post, get, origin, expire: () => { time += 6000; } };
}
const layout: OutputLayout = { id: 'abcde123-1234-4321-1234-123456789012', title: 'VModel Output · clean', kind: 'clean', orientation: 'portrait', viewport: { width: 600, height: 800 }, canvas: { left: 75, top: 0, width: 450, height: 800 }, observedAt: 0 };
describe('local output geometry', () => {
  it('accepts a configured HTTPS origin and rejects other hosts and origins', async () => {
    const f = await fixture(['https://studio.example']);
    const request = (host: string, origin?: string) => new Promise<number>(resolve => {
      const req = http.request(f.origin + '/api/output-layout', {
        method: 'POST', headers: { Host: host, ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' },
      }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
      req.end(JSON.stringify({ ...layout, active: true }));
    });
    expect(await request('studio.example', 'https://studio.example')).toBe(200);
    expect(await request('studio.example', 'http://studio.example')).toBe(403);
    expect(await request('studio.example', 'https://other.example')).toBe(403);
    expect(await request('other.example', 'https://studio.example')).toBe(403);
    expect(await request('studio.example')).toBe(403);
  });
  it('shares whitelisted geometry, expires closed outputs and deletes on exit', async () => {
    const f = await fixture();
    expect((await f.post({ ...layout, active: true, privateFrame: 'must not be stored' })).status).toBe(200);
    const stored = (await f.get()).layouts[0]; expect(stored.observedAt).toBe(1000); expect(stored.privateFrame).toBeUndefined();
    f.expire(); expect((await f.get()).layouts).toEqual([]);
    await f.post({ ...layout, active: true }); await f.post({ id: layout.id, active: false }); expect((await f.get()).layouts).toEqual([]);
  });
  it('rejects external origins, oversized bodies and invalid canvas bounds', async () => {
    const f = await fixture();
    expect((await f.post({ ...layout, active: true }, 'https://example.com')).status).toBe(403);
    expect((await f.post({ ...layout, active: true, padding: 'x'.repeat(5000) })).status).toBe(413);
    expect((await f.post({ ...layout, active: true, canvas: { ...layout.canvas, width: 5000 } })).status).toBe(400);
    expect((await f.get()).layouts).toEqual([]);
  });
  it('crops scaled browser chrome and aspect margins, rejecting stale/incompatible geometry', () => {
    expect(captureCrop(900, 1350, layout)).toEqual({ cropLeft: 113, cropRight: 113, cropTop: 150, cropBottom: 0 });
    expect(() => captureCrop(900, 500, layout)).toThrow('Unexpected capture geometry');
    expect(() => captureCrop(900, 1350, { ...layout, orientation: 'landscape' })).toThrow('composition changed');
  });
});
