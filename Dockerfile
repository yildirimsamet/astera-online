# syntax=docker/dockerfile:1

# Astera Online — one image, two artefacts.
#
#   target `server`   the API and the event worker (ROLE decides which)
#   target `web-dist` the built client, as a bare filesystem to copy out
#
# WHY THE SERVER RUNS TYPESCRIPT IN PRODUCTION. `@astera/rules` is consumed as
# SOURCE — its package `main` is `./src/index.ts` — because it is the single
# source of truth shared by the server, the simulator and the browser, and
# publishing a build step for it would put a stale copy between them. So the
# server needs a TypeScript runtime, which is why `tsx` is a dependency of
# `apps/server` rather than a dev tool. tsx transpiles per file on load; the boot
# cost is on the order of a second, once, at container start.
#
# It works because pnpm links `@astera/rules` as a SYMLINK and Node resolves the
# real path — `/app/packages/rules/src/index.ts`, which is outside node_modules
# and therefore something tsx will transpile. A bundled or copied dependency
# would land inside node_modules, where tsx does not look, and the container
# would die on its first import.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app


# ── manifests only ───────────────────────────────────────────────────────────
# Split from the source so that editing a route does not re-run the install. All
# five manifests are copied even where only two are needed: a filtered install
# still validates the whole lockfile, and a missing workspace manifest fails it.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/rules/package.json  packages/rules/
COPY packages/sim/package.json    packages/sim/
COPY apps/server/package.json     apps/server/
COPY apps/web/package.json        apps/web/


# ── the client ───────────────────────────────────────────────────────────────
FROM manifests AS web-deps
RUN pnpm install --frozen-lockfile

FROM web-deps AS web-build
COPY packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.base.json ./
# THE MEASUREMENT ID IS BAKED IN HERE OR NOT AT ALL. Vite inlines `import.meta.env`
# at build time, so this cannot be supplied to the running container — the client
# is a directory of static files with no environment to read. Absent (the default,
# and every local build) the client installs no tag and fetches nothing from
# Google; see `apps/web/src/lib/analytics.ts`.
ARG VITE_GA_ID=""
ENV VITE_GA_ID=$VITE_GA_ID
RUN pnpm --filter @astera/web build

# A filesystem, not an image. `docker build --target web-dist --output` writes it
# straight to a directory on the host, which is where nginx serves it from — no
# container, no volume, no runtime for static files.
FROM scratch AS web-dist
COPY --from=web-build /app/apps/web/dist /


# ── the server ───────────────────────────────────────────────────────────────
# `--prod` drops the dev tree; `--filter @astera/server...` takes the server and
# the workspace packages it depends on, and nothing else. The web client's
# three.js tree is roughly 200 MB installed and has no business in this image.
FROM manifests AS server-deps
RUN pnpm install --frozen-lockfile --prod --filter @astera/server...

FROM base AS server
ENV NODE_ENV=production

# The whole tree rather than selected folders: pnpm's node_modules is a forest of
# symlinks into `.pnpm`, and copying parts of it produces links that resolve to
# nothing at runtime.
COPY --from=server-deps /app ./

COPY packages/rules/src   ./packages/rules/src
COPY apps/server/src      ./apps/server/src
# MIGRATIONS ARE PART OF THE IMAGE. `assertSchemaCurrent` counts the entries in
# `meta/_journal.json` against what the database has run and refuses to start if
# the image is ahead. Without this folder there is nothing to count.
COPY apps/server/drizzle  ./apps/server/drizzle

# Node's own signal handling, and a real PID 1. Without an init, SIGTERM from
# `docker stop` never reaches the process and every deploy is a hard kill in the
# middle of whatever transaction the worker was running.
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

USER node
# The binary is under the PACKAGE, not the root. A filtered pnpm install links a
# dependency's executable into the node_modules/.bin of the package that asked for
# it, and `tsx` was asked for by `apps/server`.
CMD ["apps/server/node_modules/.bin/tsx", "apps/server/src/index.ts"]
