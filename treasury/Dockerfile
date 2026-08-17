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

# The client's own lockfile, installed in its own layer for the same reason.
COPY src/presentation/web/client/package.json src/presentation/web/client/package-lock.json ./src/presentation/web/client/
RUN npm --prefix src/presentation/web/client ci

COPY tsconfig.json ./
COPY src ./src

# Compiles the server AND bundles the React client into dist/presentation/web/client, which is what
# `express.static` serves. Without the client build the image would ship the dev index.html, whose
# only script tag points at /src/main.tsx — a page that loads and then renders nothing.
RUN npm run build

# Production dependencies only, resolved in the SAME image the runtime uses. The native binary in
# node_modules is platform-specific, so it is built here and copied rather than reinstalled in a
# stage that has no compiler.
RUN npm prune --omit=dev

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist

# The Party Directory's file lives here, on a mounted volume — an id issued to a Ledger event must
# outlive the container that issued it.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
