// Launch/stop only a child server created by this diagnostic. No shared ports/PIDs.
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import assert from 'node:assert/strict';

export async function startIsolatedStudioServer({ workspaceRoot = fileURLToPath(new URL('..', import.meta.url)) } = {}) {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  assert(![4173, 5173, 5081].includes(port));
  const child = spawn(process.execPath, ['scripts/server.mjs'], {
    cwd: workspaceRoot, env: { ...process.env, VMODEL_PORT: String(port) },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${port}`;
  let output = '', exited = false;
  const exit = new Promise(resolve => child.once('exit', (code, signal) => { exited = true; resolve({ code, signal }); }));
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Owned studio server startup timed out: ${output}`)), 10000);
    child.stdout.on('data', chunk => {
      output = (output + chunk).slice(-10000);
      if (output.includes(`VModel is ready at ${base}`)) { clearTimeout(timer); resolve(); }
    });
    child.stderr.on('data', chunk => { output = (output + chunk).slice(-10000); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Owned studio server exited (${code}): ${output}`)); });
  });
  async function stop() {
    if (!exited) child.kill();
    let timer;
    try { return await Promise.race([exit, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owned child server did not exit.')), 10000); })]); }
    finally { clearTimeout(timer); }
  }
  try {
    await ready;
    const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    assert.equal((await response.json()).application, 'vmodel');
    return { base, port, pid: child.pid, stop };
  } catch (error) { await stop(); throw error; }
}
