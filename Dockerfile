FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium
COPY . .
RUN node scripts/provision_runtime.mjs && npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production VMODEL_HOST=0.0.0.0 VMODEL_PORT=4173
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node scripts/server.mjs scripts/output-layout.mjs scripts/request-origin.mjs ./scripts/
COPY --chown=node:node config/http-policy.json ./config/
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "scripts/server.mjs"]
