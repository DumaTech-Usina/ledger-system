# ─── Build stage ─────────────────────────────────────────────────────────────
# Full toolchain (incl. dev deps) to compile TypeScript and assemble dist/.
FROM node:22-alpine AS builder
WORKDIR /app

# Install against the lockfile first so this layer caches across source changes.
COPY package.json package-lock.json ./
RUN npm ci

# Compile TS and copy the static client into dist (see the "build" npm script).
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
# Lean image: production dependencies + compiled output only. No source, no tsc.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Self-contained build output: JS entrypoint + client HTML + compiled migrations.
COPY --from=builder /app/dist ./dist

# Writable audit-log dir owned by the unprivileged runtime user.
RUN mkdir -p /app/logs && chown -R node:node /app/logs
USER node

EXPOSE 3000

# Container-level liveness for runtimes that honor Docker HEALTHCHECK (busybox wget).
# PaaS platforms typically ignore this and probe /health or /ready themselves.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${SERVER_PORT:-3000}/health" || exit 1

CMD ["node", "dist/index.js"]
