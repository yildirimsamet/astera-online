# Engineering Standards

Project law, not preferences. CI enforces most of it; the rest is enforced by review.

> **CODE WITHOUT TESTS IS CODE THAT WAS NEVER WRITTEN. IT IS UNFINISHED WORK.**

## The gate

```bash
pnpm verify        # typecheck + lint + all tests → 0 errors, all green
```

**There is no acceptable error count.** A warning that is always present is a warning nobody
reads. If a rule is wrong, change the rule deliberately and say why — never learn to ignore
its output.

## Typing

**Everything is typed. `any` is banned.** `tsconfig.base.json` runs `strict` plus
`noUncheckedIndexedAccess` (the most valuable flag in a game full of sparse records like
`Fleet`), `noImplicitOverride`, `verbatimModuleSyntax` and `isolatedModules`.

- **No casts to silence the compiler.** A cast claims you know more than the type system; if
  that is not true it is a lie that surfaces as a runtime bug.
- **Parse, don't validate.** Untrusted input goes through Zod at the boundary and is typed
  from there on. Unparsed input must never reach a service.
- **Prefer making illegal states unrepresentable** over checking for them later.

**One lesson already paid for:** `Object.values()` / `Object.entries()` on a
`Partial<Record<K, V>>` is typed `V[]`, which **hides that a value can be undefined at
runtime**. Use the key-list helpers (`fleetEntries`, `satelliteEntries`). When a type looks
more certain than reality, fix the shape rather than papering over it with `?? 0`.

## Lint

ESLint 9 flat config, `typescript-eslint` **strictTypeChecked + stylisticTypeChecked**, fully
type-aware — which catches unsafe `any` flow, floating promises, misused promises and
unnecessary conditions that reveal a wrong mental model.

**The architectural boundary is a lint rule.** `packages/rules` may not import a Node builtin,
another workspace package, `Math.random`, `Date.now` or `new Date`. **If the rules ever acquire
a clock, CI fails.** This is the invariant the whole design rests on, enforced mechanically
rather than by anyone remembering it.

**When lint and reality disagree, type the variable rather than suppressing the rule.**
`no-unnecessary-type-assertion` once flagged a cast on the Fastify logger as unnecessary — it
was assignable, but removing it specialised Fastify's logger generic and broke every downstream
route signature. Suppression is the last option, and it carries a comment saying *why the rule
is wrong here*.

## Testing

**Risk coverage, not line coverage.** Concentrate on what is deterministic and
server-authoritative: combat resolution, loot, resource transactions, travel, timing, fleet
state, concurrency, idempotency, season transitions, intel visibility.

**Happy-path tests prove a feature can work; they do not prove it is correct.** Every feature
gets tested for:

- **Boundaries** — zero, one, maximum, exactly at the cap.
- **Malformed input** — negative counts, fractional counts, wrong types, missing fields.
- **Adversarial input** — a refresh token used as an access token, a forged signature, a
  planet id belonging to someone else.
- **Concurrency** — two of the same request at once. Exactly one must win, *for the right
  reason*.
- **Failure** — the transaction rolls back, the process dies, the event is delivered twice,
  the server was down for six hours.
- **Time** — the clock going backwards, absences longer than the storage cap, disruption
  overlapping a tick boundary.

| Layer | Tool | Needs |
|---|---|---|
| Rule units | Vitest, pure | Nothing |
| Properties | Vitest + fast-check | Nothing |
| Season regression | The simulator | Nothing |
| Persistence | Vitest + real Postgres | `docker compose up -d` |
| API | `fastify.inject()` | Real Postgres |

**Rules are testable with zero infrastructure.** That is the point of the architecture, and it
is what keeps the rest of the pyramid small.

**Some claims must hold for all inputs, not three examples:** Dominion sums to exactly zero
across any battle; loot never exceeds cargo or what is available; unit counts never go negative
and units are never created from nothing; combat is deterministic for a given seed; travel is
monotonic in distance and never instant.

**The season regression is the most important test.** A balance regression — someone nudges a
constant and the vault silently protects 200% of storage again — is invisible to unit tests and
catastrophic in production. A full simulated season on fixed seeds is the only thing that
catches it, and it costs a few seconds.

### When a test fails, find the root cause first

**Never bend a test to fit the code, or code to fit a wrong test.** Establish which is wrong
before changing either. Both shapes have happened here:

- *"Two concurrent upgrades: exactly one wins"* failed with **zero** winners. The lock was
  fine — the arrangement was wrong, because the Core ceiling rejected both before resources
  were checked. Fixed the arrangement **and added an assertion on the rejection reason**,
  because a gating bug reads exactly like working mutual exclusion.
- *"Fleet comes home"* failed, and that one was real: a return leg travels backwards and the
  handler read `originPlanetId` as home.

**When several tests fail identically, that is one bug.** Fifteen worker tests once failed with
the same message; the cause was a single `Date` binding.

### A flaky test is a defect, not noise

A test that passes 95% of the time fails randomly in CI and trains everyone to ignore red. Two
tests here bet on a detection roll that succeeds 95% of the time. The fixes were structural:
tests about a **read filter** now arrange their input directly instead of driving it through a
probabilistic path, and the one that genuinely is about the roll measures it over eight probes
with a ~1e-6 failure probability.

**Never re-run it, and never loosen an assertion until it stops failing.** Find what is
non-deterministic and either remove the dependence or measure it properly.

### A diagnostic that cannot fail is not a diagnostic

If a check has never been observed to fail, prove it *can*. Two balance invariants had to be
redefined after failing to catch the bug they existed for (`balance.md` § six health
invariants).

### The API boundary is tested from both sides

`apps/server/test/contract.test.ts` runs **the client's own Zod schemas** against a live app, a
real database and a planet with something in every column. **Adding a route the client parses
means adding it there.**

It closes a hole every other gate in this repo is structurally incapable of seeing:

- **Typecheck cannot see it.** A Zod schema is a runtime value; nothing in the client's types
  derives from a route handler, so a renamed field is invisible to the compiler on both sides.
- **The server suite cannot see it** — the endpoint is correct; the other end disagrees.
- **The client suite cannot see it** — client tests parse fixtures the client wrote, and a
  fixture is updated to match the schema, never the server.
- **The request still returns 200.** Zod rejects at the boundary, the query resolves to an
  error, `data` stays undefined, and the component renders empty. Nothing red anywhere.

The failure mode is a whole system going dark on a green build: when `/api/mining` gained
`derrick: boolean` in place of `drill: number`, every asteroid disappeared from the galaxy and
nothing said so.

**A new contract test is only finished when you have watched it fail.** Revert the fix, confirm
it goes red, put the fix back.

### Two languages are checked by machine, not by promise

`t()` is typed against the English resource tree, so a key that does not exist is a compile error
at the call site rather than a path printed on a phone. Every other language is typed as that tree
with its string literals widened, so a missing or extra key is a compile error too.

`apps/web/test/i18n.test.ts` covers what types cannot see, and each case is a real failure mode:
an empty string; a key copied across untranslated; a `{{placeholder}}` or `<0>` slot dropped or
renamed in one language; a plural missing its `_one` form. That last one bites specifically in
Turkish — no plural suffix follows a numeral, so writing only `_other` looks correct, and i18next
falls back to the **bare key** rather than to `_other`.

The untranslated check keeps an explicit exception list for leaves that genuinely read the same in
both languages (punctuation, bare placeholders, proper nouns). A second test fails on any entry in
that list that is no longer identical, so an allowance cannot quietly rot into permission.

### Verify frontend work by looking at it

`node tools/visual.mjs out/visual` drives the real client against the real API, photographs it
and **measures the scene through the dev bridge** rather than guessing from the picture. A green
typecheck has shipped a frozen rock, a sideways ship and an empty asteroid field.

## No silent placeholders

Placeholders are fine while building; letting them become permanent is not. Gone before MVP or
explicitly documented as a known limitation: fake server logic, client-side authority,
hardcoded gameplay values, fake combat results, fake persistence, temporary UI, TODO'd core
logic.

**A `TODO` in core gameplay logic is a bug that has not been filed yet.**

## Comments

Comment **why**, never **what**. The comments that earn their place explain a decision, a trap
or a non-obvious constraint — the ones that stop the next reader, including a future you, from
re-breaking something:

```ts
// INVARIANT: vaultMult MUST stay below alloyMult, or the vault outgrows the stock
// it protects and nothing in the galaxy is ever raidable again. The first draft
// shipped 1.50 against 1.45 and killed the PvP economy for a whole season.
```

**Delete commented-out code.** Git remembers it.

## Errors

- One shape for the whole API:
  `{ error: MACHINE_CODE, message: "human sentence", params?: { … } }`.
- `GameError` carries a stable code, a sentence a player can act on, an HTTP status, and — where
  the sentence has figures in it — the figures themselves. Anything else is a bug and is **not**
  described to the client.
- Messages say what went wrong *and what to do*: `"Command Core must be raised first"`, never
  `"validation failed"`.
- **The code is what the client localises off; the sentence is the fallback.** A finished sentence
  cannot be translated after the fact — "All 4 flight bays are in use" has the 4 baked in — so a
  refusal that interpolates anything sends its parts as `params` too. The English sentence still
  ships, because a phone one deploy behind the server has never heard of the new code and the
  server's own words beat a key path on screen.
- **Named things travel as IDs.** `{ hull: 'WASP' }`, never `{ hull: 'Wasp' }`. The server has no
  business holding a Turkish name for a hull — `packages/rules` is shared with the simulator and is
  deliberately language-free — so the client resolves the ID at the last moment.
- Never swallow an error to make a test pass.

## Server authority

The client sends **intent** and receives **outcomes**. It never computes one. Resources, fleet
state, combat, travel, cooldowns, loot and progression are decided server-side, in a
transaction, using `@astera/rules`.

**The fog is enforced in the query, not the UI.** A modified client must not be able to read a
field it was not entitled to — asserted against the API response shape, never the rendering.

## Database work

- Every mutating action: lock the row → advance the lazy economy **inside** the lock → validate
  against the rules → mutate → commit → emit.
- **Two-planet operations lock in ascending id order.** Otherwise mutual raids deadlock.
- Never emit an SSE event inside a transaction. Commit first.
- Every list endpoint needs a bound. Watch for N+1 and unbounded queries.
- A schema change means `pnpm --filter @astera/server db:generate` and a committed
  migration. **Never edit a generated migration that has already been applied anywhere**, and
  the server refuses to boot against a database it is ahead of (D47).

## Commits

One logical change per commit. The subject says what changed; the body says **why**, and names
any bug the change fixes and how it was found. Never commit with `pnpm verify` failing. Never
commit secrets — `.env` is ignored, `.env.example` is committed.

## Performance and dependencies

Performance is designed in, never added later, and **never at the cost of core gameplay**. The
architecture removes most of it by construction: nothing is stored that a formula and a clock
can derive, there is no global tick, and the living galaxy is computed client-side from
timestamps rather than streamed. Watch for unnecessary requests, N+1 queries, unnecessary client
state and re-renders, heavy 3D scenes, oversized payloads, memory leaks, duplicated jobs and
race conditions.

`packages/rules` has **zero** runtime dependencies and that is not negotiable. Everywhere else,
add one only when writing it yourself is clearly worse, and prefer boring, well-maintained
libraries — every dependency is a thing that can break at 3am and a thing a future maintainer
must learn.
