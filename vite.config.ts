import { defineConfig } from 'vite';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createOutputLayoutHandler } from './scripts/output-layout.mjs';
import policy from './config/http-policy.json' with { type: 'json' };
const devPolicy = { ...policy, 'Content-Security-Policy': policy['Content-Security-Policy'].replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:5173 ws://localhost:5173") };
export default defineConfig({
  plugins: [{
    name: 'local-mediapipe-wasm-loader',
    configureServer(server) {
      const outputLayout = createOutputLayoutHandler(server.config.server.port ?? 5173);
      server.middlewares.use((_req, res, next) => {
        for (const [name, value] of Object.entries(devPolicy)) res.setHeader(name, value);
        next();
      });
      server.middlewares.use((req, res, next) => { void outputLayout(req, res).then(handled => { if (!handled) next(); }).catch(next); });
      // MediaPipe dynamically imports the runtime. Vite's ?import transform rejects
      // public JS files, so serve these fixed, locally provisioned modules unchanged.
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? '';
        if (!/^\/runtime\/wasm\/vision_wasm_(module_|nosimd_)?internal\.js$/.test(pathname)) return next();
        res.setHeader('Content-Type', 'application/javascript');
        createReadStream(path.join(process.cwd(), 'public', pathname)).on('error', next).pipe(res);
      });
    },
  }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
