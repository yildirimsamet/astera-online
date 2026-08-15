# Engineering Standards

These are **project law**, not preferences. CI enforces most of them; the rest are enforced
by review.

> ## CODE WITHOUT TESTS IS CODE THAT WAS NEVER WRITTEN.
> ## IT IS UNFINISHED WORK.

---

## The gate

Nothing is finished until this passes. Run it before every commit.

```bash
pnpm verify        # typecheck + lint + all tests
```

```
0 type errors  ·  0 lint errors  ·  all tests green
```

**There is no "acceptable" error count.** A warning that is always present is a warning
nobody reads. If a rule is wrong, change the rule deliberately and say why — do not learn
to ignore its output.

---

## Typing

**Everything is typed. `any` is banned.**

`tsconfig.base.json` runs `strict`, plus:

| Flag | Why |
|---|---|
| `noUncheckedIndexedAccess` | Indexing returns `T \| undefined`. It is the single most valuable strictness flag in a game full of sparse records like `Fleet`. |
| `noImplicitOverride` | Prevents accidental method shadowing. |
| `verbatimModuleSyntax` | Type imports stay erasable; no accidental runtime imports. |
| `isolatedModules` | Keeps every file independently transpilable. |

### Rules

- **No `any`.** `@typescript-eslint/no-explicit-any` is an error. If you truly do not know
  a shape, use `unknown` and narrow it.
- **No casts to silence the compiler.** A cast is a claim that you know more than the type
  system. If that is not true, it is a lie that will surface as a runtime bug.
- **Parse, don't validate.** Untrusted input goes through Zod at the boundary and is typed
  from there on. Unparsed input must never reach a service.
- **Prefer making illegal states unrepresentable** over checking for them later.

### The one lesson already paid for

`Object.values()` / `Object.entries()` on a `Partial<Record<K, V>>` is typed `V[]`, which
**hides that a value can be undefined at runtime**. Use the key-list helpers
(`fleetEntries`, `satelliteEntries`). When a type looks more certain than reality, do not
paper over it with `?? 0` — fix the shape.

---

## Lint

```bash
pnpm lint        # zero errors, always
pnpm lint:fix
```

ESLint 9 flat config, `typescript-eslint` **strictTypeChecked + stylisticTypeChecked** —
fully type-aware. This catches a class of bug plain linting cannot: unsafe `any` flow,
floating promises, misused promises, unnecessary conditions that reveal a wrong mental
model.

### The architectural boundary is a lint rule

`packages/rules` may not import a Node builtin, another workspace package, `Math.random`,
`Date.now`, or `new Date`.

```js
files: ['packages/rules/src/**/*.ts']
  no-restricted-imports: node builtins, @blindspace/*, drizzle, fastify, zod
  no-restricted-syntax:  Math.random(), Date.now(), new Date()
```

**If the rules ever acquire a clock, CI fails.** This is the invariant the whole design
rests on, and it is enforced mechanically rather than by anyone remembering it.

### When lint and reality disagree

A rule can be wrong about consequences. Real example: `no-unnecessary-type-assertion` said a
cast on the Fastify logger was unnecessary — it was assignable, but removing it specialised
Fastify's logger generic and broke every downstream route signature.

**The fix was to type the variable, not to suppress the rule.** Suppression is the last
option, and when used it carries a comment explaining *why the rule is wrong here*.

---

## Testing

### What to test

**Risk coverage, not line coverage.** Concentrate on what is deterministic and
server-authoritative:

combat resolution · loot · resource transactions · travel · timing · upgrade completion ·
fleet state · concurrency · idempotency · season transitions · intel visibility

### Edge cases are the point

Happy-path tests prove a feature can work. They do not prove it is correct. Every feature
gets tested for:

- **Boundaries** — zero, one, maximum, exactly-at-the-cap.
- **Malformed input** — negative counts, fractional counts, wrong types, missing fields.
- **Adversarial input** — a refresh token used as an access token, a forged signature, a
  planet id belonging to someone else.
- **Concurrency** — two of the same request at once. Exactly one must win, *for the right
  reason*.
- **Failure** — what happens when the transaction rolls back, the process dies, the event
  is delivered twice, the server was down for six hours.
- **Time** — clock going backwards, absences longer than the storage cap, disruption
  overlapping a tick boundary.

### The layers

| Layer | Tool | Needs |
|---|---|---|
| Rule units | Vitest, pure | Nothing |
| Properties | Vitest + fast-check | Nothing |
| Season regression | The simulator | Nothing |
| Persistence | Vitest + real Postgres | `docker compose up -d` |
| API | `fastify.inject()` | Real Postgres |

**Rules are testable with zero infrastructure.** That is the point of the architecture, and
it is what keeps the rest of the pyramid small.

### Property tests earn their place

Some claims must hold for *all* inputs, not three examples:

```
dominion sums to exactly zero across any battle
loot never exceeds cargo, and never exceeds what is available
unit counts never go negative, and units are never created from nothing
combat is deterministic for a given seed
travel is monotonic in distance and never instant
```

### The season regression is the most important test

A balance regression — someone nudges a constant and the vault silently starts protecting
200% of storage again — is **invisible to unit tests and catastrophic in production**. A
full simulated season on fixed seeds is the only thing that catches it, and it costs a few
seconds.

### When a test fails: root cause first

**Never bend a test to fit the code.** Never bend code to fit a wrong test. Establish which
one is wrong before changing either.

Real examples from this project, both discovered the same way:

- *"Two concurrent upgrades: exactly one wins"* failed with **zero** winners. The lock was
  fine — the test's arrangement was wrong, because the Core ceiling rejected both before
  resources were ever checked. Fixed the arrangement, **and added an assertion on the
  rejection reason**, because a gating bug reads exactly like working mutual exclusion.
- *"Fleet comes home"* failed. That one was a real bug: a return leg travels backwards, and
  the handler read `originPlanetId` as home.

When several tests fail identically, **that is one bug, not many.** Find the shared cause.
Fifteen worker tests once failed with the same message; the cause was a single `Date`
binding.

### A diagnostic that cannot fail is not a diagnostic

Two balance invariants were redefined after they failed to catch the bug they existed for.
`VFR` measured raw fill and read a healthy 0.50 while the vault protected 100% of it.
`TAX` used a median and always read 0.00 because most players are not raided on any given
day.

If a check has never been observed to fail, prove it *can*.

---

## No silent placeholders

Placeholders are fine while building. **Letting them become permanent is not.**

Gone before MVP, or explicitly documented as a known limitation:

fake server logic · client-side authority · hardcoded gameplay values · fake combat
results · fake rewards · fake persistence · temporary UI · `TODO`'d core logic

A `TODO` in core gameplay logic is a bug that has not been filed yet.

---

## Comments

Comment **why**, never **what**. The code already says what it does.

The comments that earn their place explain a decision, a trap, or a non-obvious constraint:

```ts
// INVARIANT: vaultMult MUST stay below alloyMult, or the vault outgrows the stock
// it protects and nothing in the galaxy is ever raidable again. The first draft
// shipped 1.50 against 1.45 and killed the PvP economy for a whole season before
// the simulator caught it.
```

```ts
// Seeding from (watchId, timeWindow) rather than fresh randomness means the answer
// is stable all window long. Without it, a player defeats the entire fog layer by
// pulling to refresh.
```

Both encode something that would otherwise be re-broken by the next person — including a
future you.

**Delete commented-out code.** Git remembers it.

---

## Errors

- One error shape for the whole API: `{ error: MACHINE_CODE, message: "human sentence" }`.
- `GameError` carries a stable code, a sentence a player can act on, and an HTTP status.
  Anything else is a bug and is **not** described to the client.
- Error messages tell the player what went wrong *and what to do*: `"Command Core must be
  raised first"`, not `"validation failed"`.
- Never swallow an error to make a test pass.

---

## Server authority

The client sends **intent** and receives **outcomes**. It never computes one.

Resources, fleet state, combat results, travel, upgrade completion, cooldowns, loot and
progression are all decided server-side, inside a transaction, using `@blindspace/rules`.

**The fog is enforced in the query, not the UI.** An intel response is filtered server-side
against the observer's clarity. A modified client must not be able to read a field it was
not entitled to — and that is asserted against the API response shape, never the rendering.

---

## Database work

- Every mutating action: lock the row → advance the lazy economy **inside** the lock →
  validate against the rules → mutate → commit → emit.
- **Two-planet operations lock in ascending id order.** Otherwise mutual raids deadlock.
- Never emit an SSE event inside a transaction. Commit first.
- Watch for N+1 queries and unbounded queries. Every list endpoint needs a bound.
- A schema change means `pnpm --filter @blindspace/server db:generate` and a committed
  migration. Never edit a generated migration that has already been applied anywhere.

---

## Commits

- One logical change per commit.
- Subject line says what changed. The body says **why**, and names any bug the change fixes
  and how it was found.
- Never commit with `pnpm verify` failing.
- Never commit secrets. `.env` is ignored; `.env.example` is committed.

---

## Performance

Designed in, not added later — but **never at the cost of core gameplay**.

Watch for: unnecessary network requests · N+1 queries · unnecessary reads and writes ·
unnecessary client state · unnecessary re-renders · heavy 3D scenes · unnecessary asset
loading · oversized payloads · unbounded queries · memory leaks · duplicated jobs · race
conditions.

The architecture already removes most of these by construction: nothing is stored that a
formula and a clock can derive, there is no global tick, and the living galaxy is computed
client-side from timestamps rather than streamed.

---

## Dependencies

- `packages/rules` has **zero** runtime dependencies. This is not negotiable.
- Everywhere else: add a dependency only when writing it yourself is clearly worse.
- Prefer boring, well-maintained libraries over clever ones.
- Every dependency is a thing that can break at 3am and a thing a future maintainer must
  learn.
