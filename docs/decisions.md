# Decision Log

Every decision that would be expensive to re-derive. **This file outranks the code.** If
the implementation disagrees with an entry here, find out why before assuming the code is
right.

Format: what was decided · what was rejected · why · what it binds · reversible?

---

## Design

### D1 · Core tension is the information game — **LOCKED, irreversible in practice**

Primary tension is **seeing and being seen**. Fleet allocation is the *resolution*
mechanic and the tutorial, not the core.

**Rejected:** *Commitment-primary* (the decision calcifies by day 3 — once you learn the
optimal split %, it is arithmetic); *Timing/windows* (rewards being present, which
punishes the async mobile player who is the target user); *Arms race* (a timer game whose
return hook is "a bar filled up").

**Why:** the only option whose return moment refreshes itself; 5 of the 7 target emotions
are information-shaped; cheapest differentiator per developer-hour; manufactures curiosity
and fear, which rising numbers cannot.

**Binds:** promotes Telescope/Radar/Explorer/Veil from features to core; *permits combat
to stay simple*; makes the 3D galaxy an interface rather than a target list.

---

### D2 · Score is Dominion, not net worth — **LOCKED**

```
Dominion = (looted + enemy value destroyed) − (lost + own value destroyed)
```

**Rejected:** Empire Value / net worth (was the working hypothesis for most of design);
Investment Points; Liquid Treasury; Plunder Score; Elo; Composite Prestige.

**Why:** the simulator killed net worth with data. Pure builders finished a season with
**2.1× the net worth of raiders**, and sweeping the loot dial from 0.4 → 0.9 left the raid
tax unchanged at 0.05 — the dial was provably inert. Wealth ladders reward accumulation;
accumulation is dominated by simply being present.

Dominion is zero-sum, only combat generates it, and it rewards winning *efficiently* —
which is what scouting buys. It also scores defence, so a fortress that holds climbs.

**Binds:** removes the need for anti-turtle machinery anywhere else; made durable defence
safe to add (D7); Wealth is now displayed but never ranked.

**Measured:** across 4 seeds at 140 players, the informed archetype tops the ladder every
time (median rank 12–15 of 140); blind aggression lands ~97th with negative Dominion.

---

### D3 · Disruption — **mechanic LOCKED, durations PROVISIONAL**

A successful raid knocks the target's surface works offline: 180 min DECISIVE / 60 PARTIAL.
Refreshes rather than stacks, capped at 240 min pending.

**Why:** an alloy invested compounds ~16× over a 336-hour season; an alloy stolen returns
1×. Raiding was **5% of the total economy** and no loot percentage could fix it. Disruption
is the only mechanism that makes a raid cost the victim *compounding* rather than stock.
Raid tax went 0.06 → 0.18, into band.

**Binds:** buildings still never take damage, so the ownership pillar survives intact.

**Reversible:** durations yes, existence no.

---

### D4 · Construction is instant — no build timers, no queues — **LOCKED**

**Why:** three reasons pointing the same way. A build timer's return hook is *"a bar filled
up"*, the weakest one available. It is a whole state machine plus a permanent temptation to
sell speed-ups, which would wreck the risk economy. And removing it makes the **panic
session better** — converting stock into Bastions in the nine minutes before a fleet lands
is a real emergency option.

**Binds:** Shipyard level now gates hull tiers and probe stealth, not build speed.

---

### D5 · Seasons are short and fixed-length; currently 14 days — **structure LOCKED, the number is PROVISIONAL**

**Rejected:** 7 days — the progression arc does not fit. A player reaches roughly Core L8
and the mid-game never arrives.

**Why:** *derived, not chosen.* With ~8–24h upgrade payback and the cost curve in
[balance.md](balance.md), a full arc to Core L12–14 needs 300–340 hours of exposure.
14 days also gives weekend-only players two shots.

**If the cost curve changes, this must be re-derived.**

---

### D6 · Clarity gradient, not a level comparison — **LOCKED**

Telescope vs Veil produces five states from `FULL` to `BLIND`.

**Rejected:** binary "level 2 beats level 1".

**Why:** a wall produces a yes/no; a fog produces judgement. The interesting state is
`Clarity = 0` — real information that may be stale. *"Fleet HOME — 18 min ago"* forces the
player to decide whether that is still true.

---

### D7 · Ground defence is durable — 60% salvage — **LOCKED**

**Why:** with consumable defence the simulator resolved **~95% of all attacks as
DECISIVE**. If blind raiding almost never fails, there is nothing for information to reduce
and the entire fog layer becomes decoration.

**Only safe because of D2.** Under a wealth ladder, durable defence recreates the turtle
exploit; under Dominion an unattacked turtle scores exactly zero anyway.

**Measured:** moved the value of scouting from break-even to **6–19× per raid**.

---

### D8 · Support hulls are shielded while combat hulls live — **LOCKED**

**Why:** Haulers (80 HP, taking 1.6× from everything) died in round one, so attackers
arrived with no cargo and raiding could not pay for itself.

**Bonus:** creates the escort decision — bring enough combat hulls to cover the cargo you
brought.

---

### D9 · Radar warns at `arriveAt − lead`, not at launch — **LOCKED**

L3 → 5 min, L4 → 8, L5 → 12.

**Why:** a 40-minute flight must not give 40 minutes of notice. Higher radar buys a longer
fuse; the panic window stays tight.

---

**Enforced in three places, not one.** The warning event fires at `arriveAt − lead`, the
notification carries only what the radar level bought — and `pending[]` on the session
payload applies the same gate. It did not, for one phase: it listed every inbound attack
with its exact ETA regardless of radar, which handed away the whole ladder for free. The
test covering it asserted the leak. Fixed in Phase 4, found by building the UI for it.

### D10 · Veil hides, it never lies — **LOCKED for MVP**

Status becomes `UNKNOWN`, never a false `HOME`.

**Why:** active deception is a genuinely great mechanic and a real rabbit hole. `UNKNOWN`
already lets players invent bluffs at zero implementation cost — observed on day 3 of the
text prototype, unprompted.

**Reversible:** yes. Strong post-MVP candidate.

---

### D11 · Combat stays deliberately simple — **LOCKED**

Three rounds, simultaneous fire, counter cycle, ±8% variance, no player input.

**Why:** this is the scope trade that pays for the information layer. Since skill
expression lives in intel, combat does not need to carry depth. The ±8% is a hard
constraint, not taste — if randomness dominated outcomes, intel would be worthless.

---

### D12 · Grade on value destroyed, not `ATK × HP` — **LOCKED**

**Why:** `fleetPower` ignores the counter matrix. 26 Wasps (power 8.7) and 1 Bastion
(power 8.8) read as equal while the Wasps annihilate it without a casualty. Every fight
involving a counter was mis-scored. Value is also legible to the player: *"you wrecked 64%
of what he'd spent on defence."*

`fleetPower` still exists as an advisory heuristic. **Never grade with it.**

---

### D13 · Vault floor is flat, and `vaultMult < alloyMult` — **LOCKED (invariant)**

**Why:** a flat floor means small players are almost entirely protected and large players
almost entirely exposed — self-balancing anti-griefing in one line, no rank brackets
needed.

**The invariant nearly killed the game.** The first draft shipped `900 × 1.5^L` against an
`alloyMult` of 1.45. Protection compounded faster than the stock it protected, so from
level 3 the vault covered **208–301% of everything a player could hold**. Nothing was
raidable, all season, silently. Now `300 × 1.30^L`, with a test that fails if the
relationship ever inverts.

---

## Architecture

### A1 · One source of truth for game rules — **LOCKED, foundational**

`@blindspace/rules`: pure functions, zero runtime dependencies, no clock, no I/O, no
ambient randomness. Server imports it to decide outcomes; simulator to validate balance;
client only to predict and render.

**This single constraint decided the entire stack** — it requires one language across
client, server and simulator, which is why Unity and Godot were rejected regardless of
their other merits.

**Enforced mechanically** by ESLint. CI fails if the rules acquire a clock.

---

### A2 · React Three Fiber for the galaxy — **LOCKED**

**Rejected:** *Unity WebGL* (15–25 MB payload and slow cold start, fatal for a 60-second
comprehension target; C# breaks A1); *Godot 4 web* (web is its least mature target;
GDScript/C# breaks A1); *Phaser* (2D only, and the galaxy needs real 3D coordinates);
*Babylon.js* (close second — heavier, thinner React story).

**Why:** shares TypeScript with the server so the rules package is literally the same file;
3D and DOM UI compose in one tree, which matters when the game is 90% interface.

**Mobile/PC path:** Capacitor and Tauri wrap the identical web build. Packaging step, not
a project.

---

### A3 · Hybrid persistence model — **LOCKED**

Lazy evaluation for anything continuous; scheduled events for anything that must happen at
a moment. **No global tick, no per-planet loop.**

Resource production for 300 players costs exactly zero background compute — state advances
only when someone looks at it or an event touches it.

---

### A4 · SSE only, no WebSocket — **LOCKED for MVP**

**Why:** client→server is entirely REST actions; server→client is a handful of rare events.
**Fleet motion and asteroid orbits are computed client-side from timestamps**, so the
living galaxy needs no streaming whatsoever.

---

### A5 · Nothing is stored that a formula and a clock can derive — **LOCKED**

No fleet positions, no asteroid coordinates, no resource tick rows. A mission holds
`departAt`/`arriveAt`; the client interpolates. An asteroid holds `radius`/`period`/`phase`;
position is a pure function of the clock.

---

### A6 · Guest-first auth — **LOCKED**

`POST /api/auth/guest` creates an account with no form. **Why:** the acceptance test
requires a player looking at their own planet inside 60 seconds; a login wall makes that
impossible.

Short access token + httpOnly refresh cookie, both stateless. The `typ` claim check is
load-bearing: without it a 30-day cookie doubles as an API credential.

---

### A7 · One shard for MVP, schema shard-aware from day one — **LOCKED**

Every table carries `season_id`. Running EU2 later is inserting a row and starting a
worker.

**Do not open a second shard until the first fills.** An async PvP game with 12 players is
nothing, and splitting a small population is the most common way this genre dies.

---

### A8 · REST + Zod, not GraphQL or tRPC — **LOCKED, low stakes**

~14 endpoints. REST is trivially debuggable, consumable from any future native shell, easy
to rate-limit. Shared Zod schemas give inferred end-to-end types anyway. tRPC was tempting
in a TS monorepo; 80% of its win is captured by sharing schemas.

**Reversible:** yes, cheaply.

---

### A9 · Drizzle over Prisma — **LOCKED, low stakes**

SQL-first, so `FOR UPDATE` and `SKIP LOCKED` are first-class rather than raw-query escapes.
Prisma's client is heavier and fights explicit locking.

---

### A10 · SSE over Postgres LISTEN/NOTIFY, not an in-memory emitter — **LOCKED**

**Rejected:** a process-local `EventEmitter`.

**Why:** the API and the worker are separate process groups. The worker writes the
notification; the API holds the player's open connection. An emitter would work perfectly in
local dev — where both happen to be one process — and fail silently in production. That is
the worst possible failure mode.

`publish()` is called **inside** the transaction that produced the event. NOTIFY is
transactional: delivered on `COMMIT`, discarded on rollback, so a client can never be told
about a battle that was subsequently undone.

**Reversible:** yes, but only toward something stronger (Redis pub/sub), never toward
in-process.

---

### A11 · The unlock cascade is DERIVED, not stored — **LOCKED**

What a player has unlocked is computed from history: a battle resolving unlocks the
telescope, being attacked or scanned unlocks radar, watching someone unlocks the explorer,
being scanned unlocks the veil.

**Why:** stored flags drift from the events that justify them, and a player who somehow
skips a step ends up stuck. Only *what has already been announced* is persisted
(`players.unlocksSeen`), so the return overlay can say "new" exactly once.

**Note:** the telescope unlocks whether the first fleet won or was annihilated. Losing it and
only then being handed a telescope is the better lesson, and it means a wiped player is never
left in a dead end.

---

### A12 · `probe_reports` is a separate table from `scan_events` — **LOCKED**

**Why:** the two rows describe the same event from opposite sides. One names the target and
its contents (the observer's intel); the other names the origin (the defender's radar log).
Merging them would put fog enforcement one mistaken `select *` away from telling a defender
exactly who scanned them.

Probe values are stored already fuzzed, so even a leak of that table reveals only what the
observer was entitled to see.

---

### A13 · Exactly one clock — **LOCKED (invariant)**

Every timestamp written to the database comes from the injected clock. **Never
`defaultNow()`.**

**This shipped broken once.** `battle_reports.createdAt` used the database clock while
everything else used the injected one. In production they agree closely enough to hide it;
under a fixed clock the "while you were gone" window never closed and every read replayed the
same news forever. If you add a table with a timestamp, pass the time in.

---

## Reversed decisions — kept so nobody re-derives them

### ✗ Empire Value as the ladder
Working hypothesis through the whole design phase. Killed by simulation → **D2**.

### ✗ `w_def = 0.5` anti-turtle score discount
Proposed to tax turtling under a wealth ladder. Became wrong once ground defence was made
destructible — it would have taxed the same behaviour twice, and nobody would have built
defence at all. Then became irrelevant entirely under D2.

### ✗ Separate repeat-raid decay system
Unnecessary. The 50% loot rule already produces 50% → 25% → 12.5% on successive raids.
Diminishing returns arrive free, with no cooldown table and no extra state.

### ✗ 7-day seasons
Did not fit the progression arc → **D5**.
