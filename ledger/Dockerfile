# ─── Build stage ─────────────────────────────────────────────────────────────
# Debian rather than Alpine: better-sqlite3 is a native module and publishes prebuilt binaries for
# glibc, not musl. On Alpine every build would compile it from source; here it is downloaded, and
# the toolchain below is only the fallback for when a prebuild is unavailable for the platform.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# The lockfiles in this repo are written by npm 11; the npm bundled with the Node 22 image is 10,
# and it reads the same file as out of sync (it resolves optional peer dependencies differently).
# Pinning the major here keeps `npm ci` meaning "install exactly the lockfile" instead of failing.
RUN npm install -g npm@11

# Install against the lockfile first so this layer caches across source changes.
COPY package.json package-lock.json ./
RUN npm ci

# Compile TS and copy the static client into dist (see the "build" npm script).
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production dependencies only, resolved in the SAME image the runtime uses. The native binary in
# node_modules is platform-specific, so it is built here and copied rather than reinstalled in a
# stage that has no compiler.
RUN npm prune --omit=dev

# ─── Runtime stage ───────────────────────────────────────────────────────────
# Lean image: production dependencies + compiled output only. No source, no tsc.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Self-contained build output: JS entrypoint + client HTML + compiled migrations.
COPY --from=builder /app/dist ./dist

# The book's file and the audit log, both on mounted volumes and both owned by the unprivileged
# runtime user. `data` is the system of record — losing it is losing the ledger.
RUN mkdir -p /app/logs /app/data && chown -R node:node /app/logs /app/data
USER node

EXPOSE 3000

# Container-level liveness for runtimes that honor Docker HEALTHCHECK.
# PaaS platforms typically ignore this and probe /health or /ready themselves.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.SERVER_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
