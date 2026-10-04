export function allowedOrigins(port, publicOrigin) {
  const origins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
  if (publicOrigin) {
    const url = new URL(publicOrigin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) {
      throw new Error('VMODEL_ORIGIN must contain only an HTTP or HTTPS origin.');
    }
    origins.push(url.origin);
  }
  return origins;
}

export function acceptsOrigin(req, origins) {
  return origins.some(origin => new URL(origin).host === req.headers.host &&
    (!req.headers.origin || req.headers.origin === origin));
}
