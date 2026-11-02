# syntax=docker/dockerfile:1

# Astera Online — one image, two artefacts.
#
#   target `server`   the API and the event worker (ROLE decides which)
#   target `web-dist` the built client, as a bare filesystem to copy out
#
# THE SERVER RUNS A BUNDLE; THE OPERATOR COMMANDS RUN TYPESCRIPT. `@astera/rules` is
# consumed as SOURCE — its package `main` is `./src/index.ts` — because it is the
# single source of truth shared by the server, the simulator and the browser. The
# long-lived processes run `dist/server/index.mjs`, which has the rules and the server
# inside it: 157 MiB of container memory under tsx, 73 MiB bundled, and a third of the
# CPU per start (capacity plan, item 8). `node_modules` stays external.
#
# `tsx` is still a dependency of `apps/server` for the one-off commands
# (`src/cli/*.ts`: season, bots, maintenance), so the sources stay in the image too.
# A stack trace names the bundle's lines; `dist/server/index.mjs.map` beside it
# translates them, and `NODE_OPTIONS=--enable-source-maps` does so in a live process.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app


# ── manifests only ───────────────────────────────────────────────────────────
# Split from the source so that editing a route does not re-run the install. All
# five manifests are copied even where only two are needed: a filtered install
# still validates the whole lockfile, and a missing workspace manifest fails it.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# The lockfile names these patches; a frozen install refuses to run without them.
COPY patches ./patches
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
# The engine flames' recipes, compiled into the client (`src/vfx/engineFlames.ts`).
COPY assets/source/engine-flames/recipes.json ./assets/source/engine-flames/recipes.json
# THE MEASUREMENT ID IS BAKED IN HERE OR NOT AT ALL. Vite inlines `import.meta.env`
# at build time, so this cannot be supplied to the running container — the client
# is a directory of static files with no environment to read. Absent (the default,
# and every local build) the client installs no tag and fetches nothing from
# Google; see `apps/web/src/lib/analytics.ts`.
ARG VITE_GA_ID=""
ENV VITE_GA_ID=$VITE_GA_ID
# Komutan Gemisi playtest door; the arena process still decides who may enter.
ARG VITE_ARENA=""
ENV VITE_ARENA=$VITE_ARENA
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

# The build needs the dev tree for esbuild, and the image does not.
FROM manifests AS server-build
RUN pnpm install --frozen-lockfile --filter @astera/server...
COPY packages/rules/src   ./packages/rules/src
COPY apps/server/src      ./apps/server/src
RUN pnpm --filter @astera/server build

FROM base AS server
ARG ASTERA_GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$ASTERA_GIT_COMMIT
ENV NODE_ENV=production
ENV ASTERA_GIT_COMMIT=$ASTERA_GIT_COMMIT

# The whole tree rather than selected folders: pnpm's node_modules is a forest of
# symlinks into `.pnpm`, and copying parts of it produces links that resolve to
# nothing at runtime.
COPY --from=server-deps /app ./

COPY packages/rules/src   ./packages/rules/src
COPY apps/server/src      ./apps/server/src
COPY --from=server-build /app/apps/server/dist ./apps/server/dist
# MIGRATIONS ARE PART OF THE IMAGE. `assertSchemaCurrent` counts the entries in
# `meta/_journal.json` against what the database has run and refuses to start if
# the image is ahead. Without this folder there is nothing to count.
COPY apps/server/drizzle  ./apps/server/drizzle

# Node's own signal handling, and a real PID 1. Without an init, SIGTERM from
# `docker stop` never reaches the process and every deploy is a hard kill in the
# middle of whatever transaction the worker was running.
# Operator checkouts can have umask 077. COPY preserves those root-owned modes;
# the unprivileged runtime must be able to read manifests, dependencies and source.
RUN apk add --no-cache tini && chmod -R a+rX /app
ENTRYPOINT ["/sbin/tini", "--"]

RUN mkdir -p /data/chat-media && chown node:node /data/chat-media

USER node
CMD ["node", "apps/server/dist/server/index.mjs"]
