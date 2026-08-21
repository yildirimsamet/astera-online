# Deploying a change

**This file is the CHECKLIST: what has to be true before a change ships, how it
ships, and every way shipping it can hurt somebody who is playing right now.**

`docs/deployment.md` is the other half and they do not overlap: that one is how
production is *shaped and operated* — nginx, ports, certificates, backups, rate
limits, granting a reward, reclaiming a seat. Read it when you need to know how
the box works. Read this one when you are about to change what is on it.

> There are real people in the galaxy. A season is fourteen days of decisions
> that exist nowhere else and are derivable from nothing. Nothing below is
> ceremony.

---

## The gates

Every one of these, in order, before anything is pushed. A gate that is skipped
is not a shortcut; it is a gate that will be paid for on the box instead.

### 1 · Review the change, including your own

Read the whole diff, hunk by hunk, as if somebody else wrote it. The last pass
through this file's own history found five real problems that way — a docblock
attached to the wrong function, a helper that silently diverged from the library
it claimed to mirror, a missing test, a test that passed by accident, and a live
check that reported PASS while comparing two empty sets.

Ask specifically:

- **Did a docblock I moved land on the right thing?** Two adjacent `/** */`
  blocks usually mean one function is now described by the other's comment.
- **Did my change make an existing comment false?** A present-tense claim about a
  poll interval, a window, or a payload shape is the one that rots. Grep for the
  numbers you changed.
- **Does every new test fail against the old code?** If it does not, it is
  decoration. Revert the fix, watch it go red, put the fix back. Every time.

### 2 · `pnpm verify`

```bash
pnpm verify        # 0 type errors · 0 lint errors · all suites
```

Green means: `rules`, `server` and `web` fully green, and `sim` green except the
**two documented reds** (`TI` band and the informed archetype on one seed —
`CLAUDE.md` names them). Any other red is a stop.

`any` is banned, lint errors are errors, and a `TODO` in core gameplay logic is a
bug that has not been filed yet.

### 3 · `pnpm build` — and this one is not optional

```bash
pnpm build
```

**Because `deploy.sh` builds the client AFTER it has already restarted the API.**
The order is: build the server image → migrate → restart the API → build the
client → publish it. So a client build that fails leaves the new server serving
the **old** client, with the deploy script stopped half-way and nothing on the
site saying so.

That state is survivable — see *Both directions have to work* below — but it is
survivable by accident, not by design, and you find out about it from a stack
trace in a terminal rather than from the game. Prove the build here, where it
costs six seconds and nobody is looking.

### 4 · Verify it running, not just passing

A green suite has shipped a frozen rock and a sideways ship out of this repo. For
anything that touches a screen or the live loop, drive the real thing:

```bash
# an isolated world — never point these at the dev database you are playing
docker exec astera-pg psql -U astera -d postgres -c "CREATE DATABASE astera_visual"
cd apps/server && DATABASE_URL='postgres://astera:astera@localhost:5433/astera_visual' \
  pnpm exec tsx src/cli/season.ts migrate
DATABASE_URL='postgres://astera:astera@localhost:5433/astera_visual' \
  pnpm exec tsx src/cli/season.ts bootstrap --count 1 --cap 50 --unattended 12

# then, with an API on 3199 and a Vite on 5299 pointed at it:
DATABASE_URL=... API=http://localhost:3199 node tools/loop-check.mjs
DATABASE_URL=... API=http://localhost:3199 WEB=http://localhost:5299 node tools/movement.mjs out/movement
WEB=http://localhost:5299 node tools/visual.mjs out/visual
```

| Harness | Answers |
|---|---|
| `tools/loop-check.mjs` | Does the loop work over real HTTP as two real commanders — can each see the other's craft, does a raid land, fight and come home, is anything drawn twice from either end |
| `tools/movement.mjs` | Do craft actually MOVE on two real screens, is any craft drawn twice, do two clients put the same ship in the same place, is anything drawn at the origin or inside a world |
| `tools/visual.mjs` | Does the disc come up, do the rocks turn, does focus open, do the panels say what they should |

**Raise the rate limits on your throwaway API** (`RATE_LIMIT_SIGNUP_MAX` and
friends) or the harnesses will exhaust the signup bucket and fail on a 429 that
has nothing to do with your change.

Drop the scratch database afterwards. It is tmpfs and dies with the container
anyway, but leaving it invites the next run to measure a world it did not make.

### 5 · Docs in the same pass

A locked behaviour changed → the invariants table in `CLAUDE.md` and a decision
in `docs/decisions.md`. A system retired → its rows and its prose deleted. The
test counts in `CLAUDE.md` updated. **A stale doc is worse than no doc, because
the next reader trusts it.**

---

## Where it goes, and how

Production is one box, shared with two other projects, and **the deploy runs on
the box** — not from a laptop. It fetches `origin/master`, so a change that is
not pushed does not exist.

```bash
git push origin master                       # from your machine
ssh <the box> 'cd ~/astera && ./deploy/deploy.sh'
```

`./deploy/deploy.sh --local` deploys the working tree without fetching. It is for
debugging on the box and nothing else — what it ships is not in git, so nobody
can tell later what was running.

What the script does, in the order it matters:

1. **Fetch and hard-reset to `origin/master`**, then re-exec itself. The re-exec
   is not a flourish: `git reset --hard` rewrites the script while bash is
   part-way through reading it, and bash re-reads from a byte offset — so without
   it, a deploy that adds a step runs a spliced mixture of two versions.
2. **Build the server image.**
3. **Start the database and wait for its healthcheck**, because `up -d` returns
   before the socket accepts.
4. **Migrate.** In a one-off container, before the new image serves.
5. **Restart the API.**
6. **Build the client and publish it** to `/var/www/astera`, pre-compressed.
7. **Print `/health`.**

The migration ordering is the whole point and `docs/deployment.md` records what
the reverse order cost: an old image against a new schema answers every request
and fails every worker tick, so the API looks healthy while no fleet in the
galaxy ever lands again.

---

## Not losing the world

### The database is only ever at risk from a migration

A deploy with **no migration cannot alter a row**. The server image is replaced,
the client directory is replaced, and Postgres is not touched at all — it is a
separate container on a named volume (`astera_pgdata`) that the deploy only ever
starts and waits for.

So the first question of any deploy is: **does this change touch
`apps/server/src/db/schema.ts` or add a file under `apps/server/drizzle/`?**

```bash
git diff --stat origin/master -- apps/server/src/db/schema.ts apps/server/drizzle/
```

Empty means the season is not in play, whatever else goes wrong.

### Back up anyway, every time

```bash
ssh <the box> 'cd ~/astera && ./deploy/backup.sh'
```

Seconds, a few hundred kilobytes, keeps the last fourteen. There is a nightly
cron, and a nightly dump is up to twenty-four hours old — which is up to
twenty-four hours of real people's decisions. Take one before you deploy, not
because the deploy is dangerous but because it is the moment you are most likely
to need it and the least likely to have thought about it. The restore command is
in `docs/deployment.md`.

### `git reset --hard` destroys uncommitted work ON THE BOX

Step 1 of the deploy resets the checkout. Anything a previous session edited in
place — a hotfix typed straight into `~/astera`, a config tweak — is gone with no
prompt. **Check before you deploy:**

```bash
ssh <the box> 'cd ~/astera && git status --short'
```

Untracked files survive (`reset --hard` is not `clean`), which is why a stray
`.env.bak.*` is harmless. Tracked modifications do not survive. If you see any,
find out what they are before you run anything.

`.env` is untracked and holds `POSTGRES_PASSWORD`, `JWT_SECRET` and
`VITE_GA_ID`. It is never touched by a deploy. It is also never in git, so it
exists in exactly one place — treat it accordingly.

---

## Not hurting the people who are playing

### Know who is in there before you start

```bash
ssh <the box> 'cd ~/astera && \
  curl -sS http://127.0.0.1:3200/health; \
  docker exec astera-postgres-prod psql -U astera -d astera -tAc \
   "select (select count(*) from missions where status = '\''in_flight'\'') as missions,
           (select count(*) from mining_runs where status in ('\''outbound'\'','\''returning'\'')) as runs,
           (select count(*) from players where last_active_at > now() - interval '\''15 minutes'\'') as active;"'
```

`streamTopics` in `/health` is how many live connections there are — that is how
many people are looking at the disc this second. `missions` and `runs` are how
many committed decisions are mid-air.

**None of it is a reason not to deploy.** It is what you check the same numbers
against afterwards.

### What a restart actually costs them

| What happens | Why it is safe |
|---|---|
| The API is unreachable for a few seconds | The client reports `UNREACHABLE` — "lost contact, try again" — rather than treating it as a refusal. It is not a crash and it is not a rejected action |
| Every SSE connection drops | Clients reconnect on a jittered backoff, and since D72 a reconnection **re-reads the whole live set** — so a client comes back in step rather than up to a minute stale |
| The worker stops mid-tick | `SIGTERM` is wired to a graceful close that waits for the in-flight tick to finish. Nothing is left half-resolved |
| A flight was due during the restart | Every event carries the instant it was meant to fire at, so the worker drains everything overdue in `resolve_at` order on startup. A late landing, never a lost one |
| Players are running the OLD client | They keep it until they reload, so the new server must answer the old client correctly — see below |

The one genuinely bad outcome is a claim that was taken but never completed,
which sits in `scheduled_events` as `processing` until the reaper returns it five
minutes later. Graceful shutdown prevents it. **The check after the deploy is
what proves it.**

### Both directions have to work

At any moment during a deploy there are old clients against a new server, and
after it there are new clients against the same server. Both must work.

- **Adding an optional field to a payload is safe.** Zod's `z.object` strips keys
  it does not know, so an old client ignores a new field rather than failing to
  parse. `landing` on a contact went out exactly this way.
- **Removing a field, renaming one, or changing its type is NOT safe in one
  deploy.** An old client parsing a payload that lost a required key throws, and
  what the player sees is a blank surface. Ship the addition first, let the
  clients turn over, remove the old field in a later deploy.
- **A route that changes shape must be in `apps/server/test/contract.test.ts`.**
  That suite is the only thing standing between a moved payload and a route that
  answers 200, typechecks, passes both suites and goes dark.

### Never create a test account in a live galaxy

`docs/deployment.md` carries the full account of what this cost once — nothing in
the schema cascades, and a mission aimed at the test planet belongs to somebody
else, so deleting it stranded a real commander's ships where no safety net could
reach them.

Verify against `/api/preview` and the rehearsal instead. They write nothing, take
no seat, and are reachable without an account:

```bash
curl -s https://asteraonline.space/api/preview | head -c 200
```

A seat spent on a throwaway commander is spent for the season. Fifty per galaxy,
filled strictly in order, and that ordering is the only mitigation the
empty-shard risk has.

---

## After it lands

The deploy prints `/health` and that is necessary, not sufficient. It says the
API is serving; it does not say the restart cost nobody anything.

```bash
ssh <the box> 'cd ~/astera && git log --oneline -1 && \
  docker exec astera-postgres-prod psql -U astera -d astera -tAc \
   "select status, count(*) from scheduled_events group by status order by status;" && \
  docker exec astera-postgres-prod psql -U astera -d astera -tAc \
   "select count(*) filter (where arrive_at < now() - interval '\''2 minutes'\'') as overdue,
           count(*) as in_flight from missions where status = '\''in_flight'\'';"'
```

| Read | Wanted | If not |
|---|---|---|
| The commit | The one you pushed | The fetch did not take. Do not deploy again until you know why |
| `scheduled_events` by status | Only `pending` and `done` | A `processing` row is a claim the restart interrupted — wait five minutes for the reaper. A `failed` row is a flight that gave up and is stranded; `/health` reports it too |
| Overdue missions | `0` | A landing instant has passed and the mission is still in the air. The worker is not draining. This is the failure that leaves no other signal |
| `/health` `stream` | `ok` | Degraded, not down — the galaxy runs on its sixty-second polls. Worth fixing, not worth rolling back |

And from outside the box, because everything above is loopback:

```bash
curl -s https://asteraonline.space/ | grep -o 'index-[A-Za-z0-9_-]*\.js'   # the new bundle
curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' https://asteraonline.space/ | grep -i content-encoding
curl -s -o /dev/null -D - https://asteraonline.space/api/preview | grep -i x-server-time
```

`x-server-time` is not cosmetic. Every craft, countdown and bombardment on the
disc is drawn by comparing server timestamps against it; without the header the
client falls back to the **device** clock and draws the galaxy at the wrong
instant, differently on every phone (D52).

> **`/health` reports; it never restarts anything.** Nothing may be wired to
> restart on a 503. Every 503 it produces describes state a restart would clear
> without fixing — and clearing it destroys the only evidence.

---

## Going back

**Revert forward. Never rewrite history on the box.**

```bash
git revert <bad-commit> && git push origin master
ssh <the box> 'cd ~/astera && ./deploy/deploy.sh'
```

`git reset` on the box makes the checkout disagree with `origin/master`, and the
next deploy hard-resets it back to the thing you were escaping.

**A revert does not undo a migration.** Drizzle migrations are forward-only here,
and the server refuses to start against a database it is ahead of — so reverting
past a migration takes the API down rather than rolling it back. If a change with
a migration has to come out, the way back is the dump you took before you
deployed, and that is the whole reason to take one.

Reverting a client-only change is free: the next deploy republishes
`/var/www/astera` and a reload picks it up.
