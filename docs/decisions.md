# Decision Log

Every decision that would be expensive to re-derive, at the length it is worth. **This file
outranks the code:** if the implementation disagrees, find out why before assuming the code
is right.

Keep entries short. A decision is *the rule*, *the evidence*, and *what it binds*. Narrative
belongs in git; superseded entries are deleted, not archived.

## Design

### D1 · The core tension is the information game — LOCKED
Primary tension is **seeing and being seen**. Fleet allocation is the resolution mechanic and
the tutorial, not the core.
Rejected: commitment-primary (calcifies by day 3 into arithmetic), timing windows (punishes
the async player who is the target user), arms race (return hook is "a bar filled up").
**Binds:** Telescope, Radar, Explorer and Veil are core, not features; combat is permitted to
stay simple; the 3D galaxy is an interface, not a target list.

### D2 · Score is Dominion, not net worth — LOCKED
`Dominion = (looted + enemy value destroyed) − (lost + own value destroyed)`.
Net worth was the working hypothesis for the whole design phase and the simulator killed it:
pure builders finished at **2.1× raiders' net worth**, and sweeping the loot dial 0.4 → 0.9
left the raid tax flat at 0.05. Wealth ladders reward being present.
Dominion is zero-sum, only combat generates it, and it rewards winning *efficiently* — which
is what scouting buys. It scores defence too, so a fortress that holds climbs.
**Binds:** no anti-turtle machinery is needed anywhere else; durable defence became safe to
add (D7); Wealth is displayed but never ranked.

### D3 · Disruption — mechanic LOCKED, durations PROVISIONAL
A successful raid knocks the target's works offline: 180 min DECISIVE, 60 PARTIAL. Refreshes
rather than stacks, capped at 240 min pending.
An alloy invested compounds ~16× over a season; an alloy stolen returns 1×. Raiding was 5% of
the economy and no loot percentage fixed it. Disruption costs the victim *compounding*: raid
tax went 0.06 → 0.18. Buildings still never take damage.

### D4 · Construction is instant — no build timers or queues — LOCKED
A build timer's return hook is "a bar filled up", the weakest available; it is a state machine
plus a permanent temptation to sell speed-ups; and removing it makes the panic session real —
converting stock into Bastions in the nine minutes before a fleet lands.
**Binds:** Shipyard level gates hull tiers and probe stealth, not build speed.

### D5 · Seasons are short and fixed; 14 days — structure LOCKED, number PROVISIONAL
Derived, not chosen: with 8–24h upgrade payback and the current cost curve, a full arc to Core
L12–14 needs 300–340 hours of exposure. 14 days also gives weekend players two shots. 7 days
was tried and the mid-game never arrives. **Re-derive this if the cost curve changes.**

### D6 · Clarity gradient, not a level comparison — LOCKED
Telescope vs Veil produces five states, `FULL` to `BLIND`. A wall produces a yes/no; a fog
produces judgement. The interesting state is `clarity = 0` — real information that may be
stale. *"Fleet HOME — 18 min ago"* forces the player to decide whether that is still true.

### D7 · Ground defence is durable — 60% salvage — LOCKED
With consumable defence the simulator resolved **~95% of attacks as DECISIVE**. If blind
raiding almost never fails there is nothing for information to reduce, and the fog layer is
decoration. Moved the value of scouting from break-even to **6–19× per raid**.
Only safe because of D2: under a wealth ladder this recreates the turtle exploit.

### D8 · Support hulls are shielded while combat hulls live — LOCKED
Haulers (80 HP, taking 1.6× from everything) died in round one, so attackers arrived with no
cargo and raiding could not pay for itself. Creates the escort decision as a bonus.

### D9 · A radar warns before impact, never at launch — LOCKED
A 40-minute flight must not give 40 minutes of notice. Higher radar buys a longer fuse; the
panic window stays tight. **Enforced in three places**: the warning event, the notification
payload, and the `pending[]` gate — that third one shipped missing for a phase and handed the
whole ladder away for free. Superseded in *mechanism* by D49 (a radius, not a countdown); the
principle above is unchanged and D49 preserves it arithmetically.

### D10 · The Veil hides, it never lies — LOCKED for MVP
Status becomes `UNKNOWN`, never a false `HOME`. Active deception is a great mechanic and a
real rabbit hole; `UNKNOWN` already lets players invent bluffs at zero cost — observed on day 3
of the text prototype, unprompted. Strong post-MVP candidate.

### D11 · Combat stays deliberately simple — LOCKED
Three rounds, simultaneous fire, counter cycle, ±8% variance, no player input. This is the
scope trade that pays for the information layer. The ±8% is a hard constraint: if randomness
dominated outcomes, intel would be worthless.

### D12 · Grade on value destroyed, not `ATK × HP` — LOCKED
`fleetPower` ignores the counter matrix: 26 Wasps and 1 Bastion read as equal while the Wasps
annihilate it without a casualty. Value is also legible — *"you wrecked 64% of what he'd spent
on defence"*. `fleetPower` survives as an advisory heuristic; **never grade with it**.

### D13 · The vault floor is flat, and `vaultMult < alloyMult` — LOCKED (invariant)
A flat floor protects small players almost entirely and large players almost not at all —
self-balancing anti-griefing in one line, no rank brackets.
**The invariant nearly killed the game.** The first draft shipped `900 × 1.5^L` against an
`alloyMult` of 1.45, so from level 3 the vault covered 208–301% of everything a player could
hold. Nothing was raidable, all season, silently. A test fails if the relationship inverts.

### D14 · No newcomer grace — owner decision
Four hours of immunity for a fresh account is gone. A world where a new arrival is untouchable
is a world where the first hours are safe, and this game's first hours are the ones that teach
that they are not.
What remains: the tier band (D49) and the bash limit — both scale with the SITUATION rather
than being granted for being new. **Reconsider only with data from a real shard**, never from
the simulator, whose bots have no skill variance and never quit.

### D15 · Hardware is visible; readings are not — LOCKED
Satellites in orbit are drawn for everyone; planet size is a three-step silhouette from the
public core tier. The fog is over *state* — where a fleet is, what a store holds, what a probe
measured — not over *construction*. Levels are never published: an Aegis is visible, its shield
strength is not, and shield strength is what decides a raid.
**Binds:** `/api/galaxy` publishes satellite TYPES only. Adding a level, a count or a target
re-opens the question.

### D16 · Production is collected by hand — owner decision
Each works fills a buffer worth `COLLECTOR.hours`, then **stops**. One tap moves it to storage
and production resumes. The Clash of Clans collector, deliberately.
D4 removed build timers, correctly, and left no reason to open the game except to spend. A
buffer that stops puts the waste on screen and makes the fix one tap.
**More generous, not less:** total accumulation is now 22 hours (10 in the works + 12 in
storage) against the old 12.
**Uncollected ore is raidable at half rate** (`LOOT.bufferShare`) — full immunity would make
the Vault pointless and teach players to hoard outside PvP's reach.

### D17 · Income is doubled, and three numbers had to move with it — owner decision
`alloyBase` 40 → 80, `crystalBase` 14 → 28.
**Doubling income is not balance-neutral.** With only the two bases doubled, 18 of 30 season
tests failed: raid return 0.05 against a band of 1.3–3.5, 83–91% of attacks REPELLED, turtles
topping the ladder at +475k. Storage is 12 hours of production, so doubling income doubles the
wall a defender builds — and 60% of destroyed ground defence rebuilds free. Defence scales with
the economy; offence does not.
Three measured changes make it safe: **all hull costs and Hauler cargo ×2, `vaultBase` 300 →
600** (a change of units, not balance — raid return recovered 0.03 → 0.42 on its own);
**`costMult` 1.55 → 1.70**, which puts the arc back at Core 10 on day 14; and
**`partialThreshold` 0.60 → 0.45**, which carried raid return over its floor on every seed.
Still open: at Core 12 an upgrade needs ~38 hours to repay, so the sunset is longer than
designed. A playtest question.

### D18 · The telescope has range and a per-slot cooldown — owner decision
Three gates instead of one: slots by level, **range** (`INTEL.telescopeRange`), and a
**cooldown on re-pointing** scaled by level (24h at L1 → 6h at L5). Filling an empty slot is
free; only switching costs.
The shipped version let a Telescope L1 read every planet in the galaxy in thirty seconds by
re-pointing its one slot. That is not a fog, it is a button, and it silently made the whole
clarity gradient optional. Range makes distance a real constraint on knowledge; the cooldown
makes *who you watch* a commitment.
**Binds:** the refusal is server-side. Watching stays silent — a cooldown is the observer's
cost, never a signal to the target.

### D19 · Asteroids are a mining economy — owner decision
Rocks carry a level 1–5 setting their ore. Orbital speed is random in a band and **independent
of level**, so a rich rock is not automatically a slow one. A rock disappears when mined out or
when its orbit leaves the disc.
**Interception is exact**, solved in continuous time from the orbit and the craft's speed.
Nothing about the meeting is stored that the seed and the clock cannot re-derive.
**First to arrive takes what it can carry.** Ore is claimed in the transaction that resolves
the arrival; a later craft takes what is left. The race is the decision.
**A Prospector is not a fleet.** Mining never makes a planet read `AWAY` — the telescope sells
exactly one fact, whether the *combat* fleet is home, and blurring it would make the most
valuable signal in the game approximate.

### D20 · The galaxy is the only screen — owner decision
The tab bar is gone. The disc fills everything between the header and the in-flight strip, and
every other surface opens over it. A world you leave in order to play is not the shell.
**Focus is the primitive:** tapping anything focuses it and opens a panel stating exactly what
the player is entitled to know about it, each fact labelled with how it was obtained and how
stale it is. The first surface that shows the player the *shape* of what they do not know.

### D21 · A commander is a name and a password, and there are ten galaxies — owner decision
**Identity.** Username and password, scrypt with in-row cost parameters, names folded to lower
case and unique. No email, no recovery yet. The guest door is gone: a season runs fourteen days
and a guest account lived in one browser's cookie jar.
**Ten galaxies of fifty, filled strictly in order.** Only the lowest-ordinal galaxy with a free
slot accepts anyone; the rest say what they are waiting for. The empty-shard risk's mitigation
used to be a promise a person had to keep; `frontierOrdinal` is that promise as a rule.
**One account, one planet, one galaxy**, enforced by a unique index — a service check and its
insert cannot be made atomic, and two tabs joining two galaxies both pass it.
**What it cost:** a fifty-world galaxy sits on the same disc, so neighbours are ~2× further
apart. No balance constant moved for this, and none should until a playtest says otherwise.
**Known limitation:** sign-out clears the cookie but the refresh JWT stays valid until it
expires. A revocation table is a session store, which is what statelessness bought.

### D22 · The opening is a budget; satellites are priced, not rationed — owner decision
**No starting fleet.** `START` = 2,060 alloy and 276 crystal, derived exactly from Core +
Refinery + Extractor to L2 plus two Wasps. The free twelve Wasps answered the only question the
opening asks — what do you spend on — in favour of the least interesting option.
**The Orbital Ring is retired**, not repurposed: rationing slots was its entire job. Legacy
`RING` rows are skipped on read.
**Price carries the identity choice** instead of a slot cap (`SATELLITE_COST_MULT`).
**What it cost, measured:** removing the cap took Aegis adoption 18% → 67% and raid returns
1.33–1.42 → 0.60–0.73. Repricing the satellite does not touch it — the mispricing was in the
SHIELD. `SHIELD.base` 700 → 40; it was only ever survivable because almost nobody could afford
an Aegis, which was an accident of scarcity rather than an equilibrium.

### D23 · The return overlay is deleted, and the wait becomes the screen — owner decision
"While you were gone" was a full-screen modal on the way in, and on a phone it fired far more
often than the absence it described — backgrounding a tab evicts the page, and the app
cold-started into the overlay after ninety seconds away, over and over. An interruption that
frequent trains the player to dismiss the one surface the design wanted them to read.
Every line it carried is an event, and events live in Signals; what is in flight is on the
strip, permanently. That is a stronger reading of Design Law #1 than a screen shown once.
**The loading screen is not a spinner.** It shows a fraction only where a real one exists, it
counts a failed asset as settled, and it opens on a deadline regardless. A progress bar that
lies is worse than none; a door that can hang is a game nobody can reach.

### D24 · The galaxy is public; intent is not — owner decision
Everything moving on the disc is visible to everybody, at real positions, for the whole flight,
wearing the neon that says what it is. Any of it can be tapped, and focusing it says what is in
it down to the hull.
**What stays private is the ROUTE.** The payload carries a bearing window — where a contact is
now and where it will be shortly — so there is no field a modified client could read to find
the world it left.
**Mining runs are the stated exception**, public in full: D19 built that race so two players
could arrive minutes apart and both know they were raced.
**Cargo is never public.** No ore, no loot, no resource figure in a contact.
**What it replaced:** anonymous motes, offset past attribution and visible only through the
middle 60% of a flight. It protected the fog completely and made a galaxy of real people feel
deserted, which is the one thing this disc must never feel.
**What it costs:** a departure is visible now, and a composition is readable where Radar L4 used
to sell a size estimate. **This moves the "nobody scouts" risk in the wrong direction.** If a
playtest says scouting stopped mattering, the levers in order are: narrow `BEARING_MINUTES`,
drop `fleet` from the payload, restore the old visible band.
**A route is only what is left to fly.** A line behind a craft is history, and history says
where it came from.

### D25 · Four instruments on the ground, four satellites in orbit — owner decision
One list of five things, all levelled the same way, all competing for orbit slots, all called
satellites. A telescope is not a satellite; a drill is not hardware at all.
**Instruments** sit on the ground, carry levels, take no slot: Telescope, Radar, Aegis, Veil.
**Satellites** are in orbit, take a slot, are bought ONCE, and have no levels:

| | What it changes | Price |
|---|---|---|
| **Uplink** | Unlocks the Telescope and the Radar | 1,500 / 500 |
| **Foundry** | Everything the works produce, +6% | 9,000 / 3,000 |
| **Derrick** | Prospectors carry 2.6× and fly 1.5× faster | 9,000 / 3,000 |
| **Beacon** | Every fleet that leaves flies 1.3× faster | 11,000 / 3,500 |

**The Core opens a slot at L1, L3, L5 and L9.** Four satellites against four slots is not a
checklist: the fourth slot is a Core 9 planet, so for the part of a season anybody plays a world
runs one, two or three, and which ones is who it is.
**The Uplink is the one gate**, and it is priced far below the others on purpose — a door priced
like a commitment is a fog layer most of the galaxy never opens. What it costs is the SLOT.
**The Drill became a craft.** Nothing gates a Prospector but `minShipyard`; the Derrick makes it
better. Gating a hull on an orbit slot had made mining an all-or-nothing detour.
**`SATELLITES.FOUNDRY.production` stays at 1.06.** A production multiplier compounds twice — the
bots buy ground defence as a ratio OF the stock it raises — so at +8% TURTLE tops the ladder on
every gate seed.
**Three modelling bugs were found here and each read as a balance signal:** the budget guard
reserved alloy while crystal went to zero; the GRINDER was permanently blind because instruments
and satellites were two separate buy passes; and the Derrick was charged for and never simulated.
**The simulator must not price what it refuses to simulate.**

### D26 · Every card says what it is, in words a child can read — owner decision
**Every card carries a TAG** — two or three words under the name, separate from the role
sentence. The role argues a decision; the tag answers *what is this*. A tag that needs a comma
has turned into a role. The test is a twelve-year-old, taken literally.
**An action control may shrink and may never be clipped.** `.act` was `flex-shrink: 0` with
`nowrap` on a control whose width is its content, so a two-resource shortfall ran off the card
and lost its last digit. The SHORT state stacks onto two lines.
**And the thing this pass found:** the disc had no asteroids on it at all, because
`/api/mining` changed shape and the client's Zod schema did not move with it. **Every gate was
green while a whole system was dark** — typecheck cannot see a runtime schema, the server suite
was correct, the client suite parses its own fixtures, and the request returned 200 with the
component rendering an empty field. `apps/server/test/contract.test.ts` is the answer: the
client's own schemas, run against a live app and a real database. **Adding a parsed route means
adding it there.**

### D27 · Two ground guns in opposite classes — measured decision
Ground defence gains the **Thorn**: Skirmisher-class, 16 atk, 60 hp, 1,600/240, buildable at
Shipyard 0.
With one ground hull its class is a binary, and both branches were measured and failed.
Bulwark-class: the Wasp hard-counters it, defence returns 0.33×, nobody builds it. Lance-class:
the only counter is a Bulwark behind Shipyard 4, so raiding stops paying — `RR` 1.11 and the
informed archetype loses two of five seeds.
Two hulls in opposite classes make **what a planet is strong against** a decision for the
defender and a question for the attacker — the only kind of problem the information layer can
be paid to solve. The smallest possible version of what OGame does with six structures.
**The price was swept, not chosen** (five seeds, 50 players, stats held):

| Thorn price | `RR` | Informed tops the ladder |
|---|---|---|
| 920 | 0.96 | 5/5, but raiding is net-negative |
| 1,380 | 1.21 | 5/5, still under the floor |
| **1,840** | **1.40** | **5/5, and `TAX` reached 0.100** |
| 2,300 | 1.36 | 3/5 |

Defence per planet went 11,631 → 26,279 and **`TAX` reached its floor for the first time**.
**`BULWARK.atk` was deliberately NOT raised.** It loses every equal-budget matchup including
against the Lance it counters, and raising it hands the season to whoever accumulates most: at
26 the informed archetype wins 5/5, at 32 → 2/5, at 52 → 0/5. It is a durability hull; the 210
hit points are the product, and exchange ratios cannot see that.
**Binds:** `GROUND_HULLS` keeps more than one member; no attacking hull hard-counters all of
them; every ground hull is counterable; the cheapest stays buildable at Shipyard 0.

### D28 · Flight bays — the unit of pacing is a flight, not a timer — owner decision
Every craft that leaves holds one **bay** for its round trip. A mining squadron is one bay
however many craft are in it. `flightSlots(core) = 3 + floor(core / 3)`.
D4 ruled out build timers correctly, and nothing took over the job timers were doing, which is
*occupying time*. A dark bay says *you have not finished your turn* — a fact about your planet,
not a notification, a streak or a bonus.
**Base three**, exactly the probe cap it replaces, so nothing possible today becomes impossible.
If playtest says the early game is too loose, the lever is the constant, not the formula.
**It removes more rules than it adds:** `PROBE.maxInFlight` is deleted, scouting is now more
tightly held because a probe competes with a raid for the same bay, and the unbounded-mining
exploit closes as a side effect.
**Ownership is per leg.** A return leg is stored with origin and target SWAPPED, so an inbound
enemy raid and your own fleet coming home are the same shape unless each leg is attributed by
kind: **an outbound leg belongs to its origin; a return leg belongs to its target.**
**The count is read under the planet row lock** — check-then-act outside it lets two racing
launches see the same free bay.
**A permanently failed event must release what it held.** Nothing ever read a `failed` row
again, and `claimMission` rolls the mission back on every throw, so a broken handler stranded a
flight for the season. `abandon()` cancels the mission and brings the craft home; `/health`
reports `failedEvents`.
**The simulator deliberately does not model bays:** peak concurrency is 1 raid against 5–6 bays,
so the constraint could never bind there.

### D29 · The opening grant stays at 2,060 — measured decision
The plan called for enlarging `START` so a new commander could end their first session with
something in the air. The grant is unchanged and the opening was made legible instead.
The precise cause of "the first session ends with nothing in flight": all three opening upgrades
are mandatory (no building may exceed the Core, and a new planet holds Core and Refinery both at
L1), they consume all 276 crystal exactly, and the cheapest flight is a probe at 50/50. **Crystal
closes the opening, and no amount of alloy fixes it.**
Measured across eight seasons at 50 players, moving only `START`:

| `START` | informed tops the ladder | `RR` | `TAX` |
|---|---|---|---|
| **2,060 / 276** | **7 of 8** | 1.28 | 0.073 |
| 2,110 / 326 (+ one probe) | 5 of 8 | 1.49 | 0.106 |
| 3,660 / 516 | 3 of 5 | 1.17 | 0.075 |

A looser opening improves raid returns and the tax on peaceful players — everyone acts sooner —
and pays for it out of the edge the informed player has.
> **The opening grant is a lever on how much thinking is worth**, and tightening it favours the
> player who thinks. That is the opposite of the intuition that a bigger opening is kinder.

**And the cheapest depth in the game**, one line on the launch sheet: *"Ships in flight cannot be
raided. Your planet can."* A fleet in flight is already untouchable and nobody was told. In OGame
this is fleetsave, nobody designed it, and their players took years to find it.

### D30 · Instruments stay cheap, because the fix costs more than the fault — measured decision
The fault is real: all four instruments at maximum cost 42,219, **less than one building step at
L10→L11**, and about ten hours of production for a developed planet.
Every fix breaks the gate. Eight seasons then the five-seed gate, moving `INSTRUMENT_LEVEL_WORTH`:

| Value | four @ L5 | vs a L10 step | gate |
|---|---|---|---|
| **1.0** | 42,219 | 0.86× | **passes** |
| 1.1 | 49,482 | 1.00× | `TAX` on 3 assertions |
| 1.5 | 96,480 | 1.96× | `ARR` on every seed + `RR` |
| 2.0 | 235,962 | 4.78× | `ARR` on every seed + `TAX` |

**Dearer instruments do not stop anyone buying them** — 34% own a telescope at every price
tested. What moves is where the rest of the money goes: the wealth split shifts from 15%
instruments / 57% buildings to 7% / 60%, and buildings are the one thing a raid can never take.
> **Raising the price of the un-losable thing pushes wealth into the other un-losable thing.**

The constant stays at 1 as a named no-op, because it is the lever somebody will reach for next
and the map of what it does is expensive to re-derive.

### D31 · Mined ore lands in the works — owner decision
A returning Prospector empties into the **works**, not into storage; `collectorCap` is the
ceiling and the two piles keep independent ceilings.
Mining carried no exposure of any kind — it sets no fleet status, craft in flight cannot be
raided, and the ore landed as spendable vault-protected stock. Income decoupled from the war
economy is the shape that emptied OGame's PvP through expeditions.
Three fixes from rules that already exist: throughput re-couples to the planet (a small planet
cannot process a big haul), mined ore becomes raidable at half rate with no vault cover, and it
has to be collected.
**The two ceilings stay independent.** One shared factor would throttle alloy delivery because
the *crystal* works were full, and a rock's crystal share runs to 0.65 while the crystal works
are a third the size.
**The panel states what the works can still take before the squadron is sent.** Without that the
honest rule reads as a bug.
Left alone deliberately: an uncontested miner still earns 3,636/h, ~86% of their own production.
Mining competes for bays and a pure miner scores exactly zero Dominion. Lucrative is not a
failure; free would be.

### D32 · Battles leave wreckage — owner decision
A resolved battle leaves a public **debris field** at the defender's coordinates holding
`DEBRIS.share` of the value of every non-ground hull destroyed on both sides. It decays over
three hours and anyone can harvest it.
**Debris is made of ships, and ships only die because somebody attacked** — strictly downstream
of combat, unlike the expedition it resembles. `DEBRIS.share < 1` is asserted.
Four things at once: the loser is partly refunded, a private fight becomes a public timed
contest, somebody not at war gets a reason to watch other people's, and a big battle becomes a
landmark at a known address with a clock on it.
**The information consequence is accepted deliberately:** a public field announces that a planet
was in a battle and roughly how big, which partly works around the Veil. It is why the mechanic
is worth having. The fallback is a field visible but not attributed, which costs the landmark
property that makes it good.
**Ground hulls contribute nothing** — they already have 60% salvage, and counting them twice
would make a fortress profit from being attacked. The predicate is `!HULLS[id].ground`, never
`MOBILE_HULLS`, which would silently drop a Prospector that really did die.
**Wealth, never Dominion.** Dominion is zero-sum and only combat makes it; wreckage was taken
from nobody, so crediting it would create score from nothing, silently. A test harvests a whole
field and asserts the galaxy-wide total is unchanged.
Built on the mining machinery (`mining_runs.target_kind`), not beside it. A field's value is
derived from the piles, the clock and what has been carried off — never stored.

### D33 · Doctrine is not built, and the reason generalises — measured decision
A second progression axis (three tracks, five levels, pick one) was built far enough to measure,
measured, and removed.

| `DOCTRINE.perLevel` | gate failures |
|---|---|
| 0.08 | 3 — `ARR`, `TAX` |
| **0.00** | **2 — `ARR`, `TAX`** |
| made unaffordable | **0** |

**At a bonus of zero it still fails: it is the purchase that breaks the gate, not the effect.**
`ARR` is the share of Wealth that can actually be taken. On seed 42 the median planet finished
27% at risk, 58% buildings, **2% doctrine** — and a sink worth two per cent tipped a band sitting
at 27% against a floor of 30%.
> **The gate has no room for ANY new un-losable sink.** This is D30 generalised. Any research
> tree, permanent upgrade or Wealth-counting cosmetic fails the same way, whatever its numbers.

What must change first, in order: give `TAX` headroom (it passes on the last digit), then
re-derive `ARR` honestly on more seeds — noting that `ARR`'s numerator already counts instruments
as at-risk although they cannot be destroyed. **Neither band may be widened to admit a feature.**
No code was kept: a placeholder in core gameplay logic is an unfiled bug. If it is attempted
again, the seam is an optional trailing `mods` on `resolveCombat`, applied in **both** `damageMap`
and `applyCasualties` — in only one, extra hull changes targeting without changing survivability.

### D34 · Three Prospectors, ever — owner decision
`PROSPECTOR.max = 3`, counted across every location. Uncapped, the only question a miner faces is
"how many more can I afford", so the fleet scales with wealth and mining decouples from the
which-rock-and-when decision D19 exists to create. A cap restores that; a price only delays it.
**Counted over ownership, not readiness.** `loadLocked` reads only units at home, so counting
that would let a player build three, send them out, and build three more — forever. The check
reads `totalUnitsOf` inside the planet row lock.
It forced `fleetAway` onto `/api/planet` so the build sheet can offer the truth. The cap is still
enforced server-side.

### D35 · The wreck model is the whole ring, placed once — implementation note
The asset is the entire annulus, already built of dozens of pieces. The first integration
instanced it fourteen times and drew fourteen rubble rings orbiting the planet.
Three traps with a general shape: `unitModel` takes the FIRST mesh in a file; a thin shell needs
`THREE.DoubleSide` (0.21 against 0.95 — single-sided it draws nothing for half of every turn,
which reads as a corrupt model rather than a material setting); and the model's own material
beats a flat tint.
Clearance is a MULTIPLE of the planet's radius, not a flat distance — a fixed gap put the ring at
2.6× a small world and 1.5× a large one, so the smallest planet got the coarsest rubble.
**What code cannot do here:** chunk size relative to the ring is baked into the mesh. Finer
particles are a different model.
Both tap targets must stay reachable: 0–12px selects the world, 16–28px the wreck. **Reload
between taps** when measuring — a focus test that does not is reading its own leftovers.

### D36 · An instrument stops where its own table stops — owner report, measured
Owner report: *"a lot of levels but the radar always shows 12 min → 12 min."* The tables are six
entries and `atLevel` clamps, so L5 was always the last level that bought anything — and nothing
enforced or said so. The owner's planet had reached **Radar 8** and **Telescope 6**, paying an
exponential price for levels that changed nothing.
Three fixes: `INSTRUMENT_MAX_LEVEL` is **derived** from table length and `raiseInstrument`
refuses past it; `telescopeSlots` is clamped to it (it was the one telescope effect with no table
and granted watch slots forever — an unbounded fog advantage anyone could buy); and two rows that
measured a clamped number switch to the figure that is still moving (a Shipyard's accuracy
against an unveiled target, a Veil's clarity against a fixed telescope).
The Aegis and the Veil keep no cap — both genuinely keep buying something at every level.
**The invariant:** at every level of every item, either the two figures differ or the row is
marked as having nothing left to sell. `gains.test.ts` walks every item × fifteen levels.
Grandfathered, not clawed back: levels already above the ceiling stay and simply cannot rise.

### D37 · Wreckage is a tenth, not a quarter — owner decision
`DEBRIS.share` 0.25 → **0.10**. A quarter of everything destroyed made a wreck worth more than
the raid that produced it, which is the expedition failure D32 exists to avoid. PROVISIONAL and
unmeasurable in the simulator, which models no combat in its mining and no mining in its combat.

### D38 · The galaxy has to look inhabited, and that is a latency problem — owner report
The server was right in both reports; what was broken was when the client asked.
The event stream never invalidated `traffic` or `mining` — an omission that does not fail loudly,
it renders a stopped world. **A neighbour's launch is the one thing no event can announce**,
because the stream fires only for what happens TO YOU, and the poll was sixty seconds: a player
opens the game with three fleets in the air and sees an empty disc for up to a minute. Twenty
seconds now, mining thirty.
Nothing refetched at the moment a craft landed, and every leg is drawn by an interpolation that
CLAMPS — so an arrival with a stale list is a craft parked on its target. `useArrivals` sets one
timer for the soonest known arrival.

### D39 · Both sides of a raid watch the same clock — owner report
The attacker counted down to 2m40s while the defender's warning read 2m55s on the same fleet.
`minutesRemaining` is rounded and the client rebuilt the instant from it; your own thread carries
an exact `arriveAt` inside `path`, and an inbound thread deliberately carries none.
`arriveAt` is now on every thread. **It costs the fog nothing:** the radar ladder sells whether
you are warned and how early, never the precision of the clock.

### D40 · A squadron is ten ships to a model, packed into a cone — owner decision
`PER_MODEL` 5 → 10; every flying asset 25% smaller; a solid cone instead of a shallow V.
Radius and depth grow with the **square root** of the index, which is what makes the cone solid
rather than a shell — square-root growth spreads points evenly through an area. The angle is the
golden angle, because any rational fraction of a turn repeats and repeated bearings read as
spokes. At twelve models the V reached 5.5 spacings across; this reaches under two.

### D41 · The Aegis is a panelled shell — owner decision
A hexagonal panel grid in a fragment shader, cold blue whitening with level, replacing two
stacked translucent spheres that read as a soap bubble.
Three traps: **`half` is a reserved word in GLSL ES** and the shader silently fails to compile
with it; **a backtick inside a shader comment ends the template literal**, so the dev server
answers 500 for the whole app and it looks nothing like a shader problem; and **`fwidth` used as
an offset moves a line rather than thinning it** — line width must be fixed in cell units with
`fwidth` only softening the edge.
The grid must appear across the whole dome, not only at the limb: a purely fresnel-weighted shell
shows a band a few pixels tall, and a 2D pattern cannot be read inside one. Cell interiors carry
no fill, which lets a player read their own world through the shield.

### D42 · First orders removed — owner decision
Removed at owner request with a better onboarding flow to follow. `lib/firstOrders.ts` and its
tests went with it rather than being left unreferenced.

### D43 · The drill flies at three times the rocks — owner instruction
Owner report: a Prospector sent at an asteroid "goes to a completely unrelated place". Not a
solver bug — measured over 3,483 launches the meeting was **1.10 revolutions ahead** and the aim
point sat a median 686 units from the rock the player had just tapped. Every flight was exact and
none was readable.
`PROSPECTOR.speed` is arithmetic, not a round number: `3 × (asteroidSpeedMin + asteroidSpeedMax) /
2 = 660`. The same sweep reads **0.34 revolutions** — a lead shot the eye can join up.
**Not a mining buff:** galaxy income is bounded by the ore that exists (~6,700/h against demand
two orders of magnitude larger), so a shorter trip changes who reaches a rock first, not yield.
**It also makes the solve well-posed.** Above `distanceFactor × asteroidSpeedMax` the intercept
function is strictly decreasing, so the root is unique and no scan step can straddle it. Asserted.

### D44 · A raid takes ten seconds to land, and you can watch it — owner instruction
The fleet is over the target at `arriveAt`; the battle is settled `COMBAT.engagementSeconds`
later. In between the squadron holds in orbit and fires on the world.
**It is a real server window, not an animation length.** `mission_arrival` is scheduled at
`arriveAt + engagement`, the mission is genuinely still `in_flight`, and nothing is decided.
Resolving on arrival and playing something afterwards would make the bombardment a re-enactment.
**`arriveAt` did not move and must not** — both sides read it (D39) and the radar counts to it.
**Only your own outbound raid is drawn.** ~~An inbound attack arrives radar-gated and stripped of
its composition, so there is no fleet in the payload to fire anything.~~ **SUPERSEDED BY D52:**
the engagement is published to the whole galaxy and everybody watches the same volley. The
inbound-attack reasoning still stands and is untouched — a defender's `pending` thread carries no
composition and no path — but the DISC draws the battle from the traffic payload, which every
player in the season receives.
Forced by this, and each is a trap with a general shape:
- **A leg ends in ORBIT, never at a world's centre** (`orbitStandoff`). The camera rig and the
  renderer must read the same standoff or a focused squadron drifts off centre. A return leg
  does not stand off at the END — a fleet coming home lands — but it does at its START, from the
  point the outbound leg stopped at (D51).
- **`orientedCraft` turns a model before it measures it.** A box round a body lying diagonally is
  a box round the diagonal. `Facing` may therefore be a measured BEARING rather than one of four
  compass points; a test asserts the named cases agree.
- **`Object3D.lookAt` takes a WORLD point.** The bombardment is solved in the squadron's own
  frame, and handing it local coordinates aims a round at an unrelated place — it shipped as "the
  missiles travel sideways".
- **Fire gets its colour from its TEXTURE, never a tint.** A sprite's `color` MULTIPLIES its map,
  so one white blob can only ever be one colour. `vfx.ts` bakes the ramp into canvas textures.
- **A plume WIDENS going back; a wake tapers.** Getting it backwards made the missile trail read
  as the ships' ribbon recoloured.
- **A CDP screenshot stalls `requestAnimationFrame`.** This galaxy renders on demand, so a
  screenshot loop starves the loop it is photographing — two harness runs produced thirty-three
  identical frames. Call `state.advance()` before each capture.

### D45 · The game says what it did — owner instruction
A full notification audit. The failure shape was the same seven times: **something happens, the
server records it correctly, and nobody is told.**
Four kinds became seven. `raid_result` — only the defender was ever told, so an annihilated fleet
produced no notification, no stream event and therefore not even a refetch. `probe_report` — the
intel panel did not refresh for a player who had it open. `unlock` — Design Law #2 had no
delivery mechanism at all; every piece existed and nothing imported any of them.
Still excluded permanently: storage nags, "we miss you", streaks, login bonuses.
**`announceUnlocks` is the only writer of `unlocksSeen`.** Two writers means whichever runs first
eats the other's news — and one of them was an endpoint no client calls.
**The radar's level is read when the warning fires**, not at launch. Frozen it was wrong both
ways: no radar meant no event scheduled, so buying one mid-flight bought nothing while the strip
warned anyway; and Radar 3 → 5 mid-flight was warned with an L3 payload.
**Notifications are idempotent by `(player_id, kind, ref_id)`.** A worker killed between COMMIT
and `complete()` has its event redelivered. `refId` is null only for news about the player, and
PostgreSQL treats NULLs as distinct.
**A notification payload is a contract, and it had no test.** The mining payload shared not one
field with the schema the client parsed, so every drill and salvage run reported "Your fleet is
home." on a green build. `contract.test.ts` runs the client's own parser over rows a real worker
wrote and fails on any generic fallback.
**A countdown is stored as an instant.** `etaMinutes` was measured when the row was written, so a
warning read an hour later still said "ETA 12 min".
Client-side: the beacon could not go back to zero (`markSeen` was fire-and-forget with nothing to
invalidate it); the toast held one message so a batch showed the OLDEST item; **`kind` was a Zod
enum**, so a server one deploy ahead of a phone rendered "Nothing yet" over a full mailbox; and
repeated scans were not folded.

### D46 · A flight with no event is released — bug fix
D28's safety nets all read the EVENT: `reap` requeues a dead claim, `fail` retries then abandons,
`/health` counts `failed` rows. **A mission whose event row is GONE is invisible to all three** —
one was found thirteen hours past its arrival, holding a bay, with health reporting `ok`.
`sweepStranded` releases them through the existing `abandon` path, matched on the event's own
KIND — a mission also has a `radar_warning`, and either would look like a live event.

### D47 · The target is not the owner, and a stale database refuses to run — bug fixes
Both found by a player; both invisible to a green gate.
**The only blind player was the target.** `galaxyTraffic` excluded any mission where the caller
was origin **or** target. That catches both legs of your own craft — and every enemy fleet flying
AT you. Strangers saw the anonymous contact and the one commander it was aimed at saw nothing.
Now attributed per leg, which is D28's rule applied where it was being approximated.
**A missing migration stopped the whole galaxy, silently.** Everything typechecked, every test
passed (the suite migrates its own database, so it *could not* see it), the server booted and
`/health` said `ok` — and `notify()` threw on every insert, so every worker tick threw, so **no
fleet in the galaxy ever landed again** for an hour. `assertSchemaCurrent` compares the journal
against `drizzle.__drizzle_migrations` at boot and names the command. Checked, never
auto-applied: N replicas racing the same DDL is worse.
**A repair that fails may not stop the queue.** The D46 sweep runs before events are claimed;
unguarded, one throw took the whole queue down.

### D48 · The launch overhead was the lead — owner report, measured
D43 raised the drill's speed and the aim point was still wrong, for a reason speed cannot touch.
Measured over 3,744 launches: median mining flight 4.44 min, of which **3.00 min (68%) was
`TRAVEL.baseMinutes`** — and a rock covers 660 units during the overhead alone, against a median
lead of 778. **85% of the gap was a fixed delay before the craft moved at all.**
`PROSPECTOR.launchMinutes = 0.4`. Median flight 4.44 → 1.86 min; median lead 0.29 → 0.127
revolutions. **`TRAVEL.baseMinutes` is untouched and must stay so** — it is priced into every
raid, every probe and the whole season simulator.
**And the other half was never geometry.** A stale payload is a craft PARKED on its destination,
because every leg interpolates and clamps. Both symptoms were reported as flight bugs and both
were a poll interval. The client wakes on the instant the payload already carries.

### D49 · The attack band is measured in tiers, and the radar is a circle — owner decisions
Two rules that were both invisible to the player, replaced by two that are readable off the map.

**Who may attack whom is a development-tier band.** `|coreTier(a) − coreTier(b)| ≤
ABUSE.tierBand` (2), so Tier 5 fights Tier 3 to 7. It replaces `ABUSE.rankFloor` — no attacking
anyone holding under 40% of your Wealth.
The problem was never the number, it was that nobody could see it: Wealth is private, and a
player learned the rule from a 403 after picking a fleet and reading the exposure line. Core tier
is already public on every world — it decides the silhouette the disc draws (D34) and is the one
free line on every dossier — so the band is checkable *before* a fleet is packed. It is also
wider: at `costMult` 1.70 a 40% Wealth floor was about a tier and a half.
**What it gives up** is protection against a hoarder — somebody who banks everything and builds
nothing is now in band with the players they out-hold. The bash limit is what keeps that from
being a farm. `coreTier` moved into `packages/rules` because the server, the simulator and the
client must now agree to the level on what tier a world is in.
**Measured: no effect on the season gate.** Every bot finishes at Core 7–10, i.e. tiers 3–4, so
a ±2 band admits every pairing. Disabling the check produced byte-identical gate output. Like the
Derrick (D25), this is a rule the simulator cannot price.

**A radar is a reach, not a countdown.** `INTEL.radarRange` = `[0,0,0,200,340,500]` units, and
the warning fires when a hostile fleet crosses inside the circle.
The old table was minutes, which made the radar's effective REACH depend on the attacker's hull
rather than on the defender's instrument: twelve minutes caught a Wasp fleet 460 units out and a
Bulwark fleet 210, so the heaviest and most dangerous thing in the game was the thing a radar saw
latest. It is also why a maxed radar read as worthless — twelve minutes is twelve minutes
whatever is coming.
A radius makes the notice fall out of the attacker's own speed. Against a typical 800-unit leg at
L5: Wasp 15 min, Lance 20, Hauler in tow 22, Bulwark siege 30. **Surprise is something an
attacker buys with speed, and a slow fleet is telegraphed** — two systems that already existed,
now interacting.
**D9 survives by arithmetic rather than by a clamp.** Notice is `oneWay × range / distance`, so a
long flight can never hand over its whole duration; only a raid launched from inside the circle
does, and such a raid is short anyway. The ceiling is a Bulwark fleet from exactly `range` away,
which is half an hour.
`radarLead(range, dist, oneWay)` is the one rule, called by both the scheduled warning and the
live `pendingThreads` gate — they can never share a computation, so they share a function.
`RADAR_RANGES` replaces `RADAR_LEADS` as the ladder the handler hops down; `INSTRUMENT_MAX_LEVEL`
is still derived from the table's length (D36).
**Binds:** `radarLeadMinutes` is gone. The upgrade row now sells a reach in units, directly
comparable to the Telescope's own range row.

### D50 · A contact keeps moving to the end of its flight — bug fix
Owner report, found from two accounts at once: the attacker watched their fleet fly while the
defender watched it park on the doorstep of its target and wait for a countdown with nothing left
to count.
A contact's bearing window used to be clamped to **four fifths of the leg**, and a window whose
end is already in the past collapses to a single point — `from` and `to` the same coordinate. The
client interpolates along that window, so for the whole final approach every craft in the galaxy
was drawn standing still, and on a short hop between neighbours it stood still *on* the planet.
The clamp is now a fixed 45-second margin.
**It costs the fog nothing, and that is worth stating** because "clamped short of arrival" reads
like a fog rule and is not one. The clamp only ever bounded the FORWARD extrapolation; the near
end has always been the craft's true current position, refreshed every twenty seconds until it
lands. What the margin buys is that the published window never points AT the destination, and
forty-five seconds buys that as well as four fifths of a leg did.

### D51 · One live galaxy, seen the same way by everyone — bug fixes
Owner report, then an audit of every surface where the server's truth and the client's picture
could disagree. Seven faults, all of them the same shape: a fact that was right in one payload and
wrong, stale or missing in the surface that drew it.

**A return leg started from inside the world it had just been holding off.** D44 gave an arriving
squadron a standoff; a return row is the outbound row with its two ends SWAPPED (D28), and only
the far end was offset — so at the instant a mission flipped, the craft jumped a full standoff
FORWARD into the planet and set off home from its centre. `legStandoff` now returns both ends and
`legStart` mirrors `legEnd`. Measured through the real client: the seam is 0.07 world units of
elapsed flight, where it used to be a standoff.

**Other people's craft were drawn inside the worlds they attacked.** A contact carries a bearing
window and no destination, so the renderer has nothing to stop short of, and the near end of that
window is the craft's TRUE position — which on final approach is the target's centre. The attacker
watched their raid hold in orbit; every other player watched the same raid fly into the planet and
vanish. The payload is the half that is right — a drawn radius is not a server fact — so the
reconciliation is geometric and lives in the client: `clearOfWorlds` puts any craft that would be
drawn inside a world onto its surface. It needs no destination and therefore discloses nothing.
The clearance is 1.15 radii, not the raid's two, so a craft passing an unrelated world does not
visibly swerve around it.

**The focus rail read a rounded figure while the strip beneath it read the clock.** Every flight
payload carries both an exact `arriveAt` and a `minutesRemaining` the server rounded when it
answered, and `pending` refetches once a minute — so the same fleet was shown two different times,
stacked, and only one of them moved. `minutesLeft` is now the single derivation both use.

**A foreign craft's rail left the clock's slot empty**, in the one position every other rail in the
game puts a countdown. The owner attributed the strip's figure to whatever they had just tapped.
The rail now names the absence — *Arrival unknown* — and the strip says whose flight it is.

**A salvage run was published as a mining run.** `harvest` has been in `ContactKind` since D32 and
nothing ever set it, so a craft flying to a wreck field wore the miner's amber and its panel
described a rock. Worse on the owner's own side: a harvest carries no `asteroidIndex`, so the rock
lookup could only miss — and `RunFocus` renders a miss as **"Rock has passed"**, told to a player
who had just sent four Prospectors at a field that was still there.

**The disc never refetched itself.** `/api/galaxy` carries three things that change because of
somebody else and can never produce an event for you: how developed each world is, what hardware
is in its orbit, and the telescope reading on every world you watch. On `staleTime` alone it
refetched on window focus and on nothing else, so a commander sitting on the galaxy read a
photograph — a neighbour's fleet shown HOME long after it left, labelled `live`. It polls at sixty
seconds now. **A poll is safe here because of the fog rule that looks like it should forbid one:**
a read is seeded per `(watchId, timeWindow)`, so asking again inside a window returns the same
answer and cannot buy a confirmation.
**Binds:** this keeps `watches.lastConfirmedAt` current for everyone rather than for whoever
happened to switch tabs most, which is a real if small change to how fresh a DEGRADED reading is.
It also makes `readTelescopes` write once per watched world per minute per player.

**`useNotifications` ignored its own `enabled` flag** — `useLiveAlerts(ready)` passed it to the
effect and not to the query — so every cold start fired `/api/notifications` on the landing page
(401) and again on the server list before the player had a planet (404).

### D52 · A living galaxy: the battle is public, the clock is the server's, nothing waits — owner instruction
The owner's direction, stated as a product requirement and now in `CLAUDE.md` and
`docs/product-vision.md`: **fun, utopian, epic — a NASA photograph you can fly around in, and one
that is happening RIGHT NOW.** Alive, immediate, beautiful, in that order. Everything below is
that requirement applied to what the code was actually doing.

**The combat cinematic is everybody's.** D44 drew the ten-second engagement for the attacker
alone: a contact carries a bearing and no destination, so a bystander's client had nothing to
fire at, and `windowOf` gave up at `arriveAt` — every other player in the galaxy watched a
squadron reach a world and blink out. A battle only one of the two people in it can see is a
database transaction with sound effects.
The contact is now published for the whole engagement with `engagement: { arriveAt, endsAt,
target }`, and the client solves the same `orbitStandoff` from the same drawn radius, so the
attacker and every stranger put the squadron in the same place to the metre. The volley is seeded
from the MISSION ID, which both sides now carry — `pending` gained `id` for exactly this — so it
is literally the same rounds leaving the same ships on every screen.
**What that discloses is a planet's coordinates, which are public on `/api/galaxy` for every
world in the disc, for the ten seconds a fleet is standing on top of it.** No owner, no origin,
no name; the bearing was visible for the whole flight; and the wreckage it leaves is public
anyway (D32). The intel ladder is untouched: knowing a raid is coming, and how long you have, is
still exactly what the Radar sells.

**A fleet that reaches its target always fires.** Win, lose or be annihilated — the ten seconds
are the payoff of a decision made forty minutes ago, and the mission is `in_flight` across all of
them, so there is no state in which a squadron arrives and vanishes without a shot.

**No arrival margin.** The bearing window stopped 45 seconds short of arrival (D50, and four
fifths of the leg before that) so it "never points at the destination". Both were a freeze: the
client interpolates along the window and a window whose end is past collapses to a point, so
every craft in the galaxy stood still for the last stretch of its flight — near enough to the
target to be drawn INSIDE it — and then blinked out. D50 already recorded that the margin cost
the fog nothing. It is gone; the window runs to the instant of arrival.

**One clock, and it is the server's.** Every craft, rock and countdown was drawn by comparing a
server timestamp against `Date.now()` — the DEVICE's clock. A phone two minutes out drew every
fleet two minutes further along its leg, every asteroid two minutes around its orbit and every
countdown two minutes short, silently, and differently from the player sitting next to them.
`serverNow()` is the offset-corrected clock; the offset is measured from `x-server-time` on every
response (epoch ms, off the injected clock — `Date` is a one-second fallback, which is a tenth of
the engagement window), debiased by half the round trip and smoothed.

**Nothing waits.** Three separate causes, all of them visible as the same thing — a squadron
hanging over a world with nothing left to do:
- `WORKER_POLL_MS` was **5000**, so every scheduled moment in the game was up to five seconds
  late. One second.
- The arrival refetch fired **once** and gave up, and the case it gave up on is the common one:
  the resolving event is scheduled for that same instant, the worker takes it on its next tick,
  and a refetch that lands first reads back a mission still `in_flight` — which React Query
  structurally shares, so nothing re-renders and nothing re-arms. It now **chases**: bounded,
  cancelled the moment the payload actually changes.
- A bystander had nothing armed at all for a raid they were only watching; both edges of the
  public engagement are now offered to the same hook.

**The read policy changed from "nothing polls" to "anything that can change because of somebody
else carries a timer".** The stream fires only for what happens TO YOU, and most of what makes
the disc feel inhabited happens to somebody else. `galaxy` at thirty seconds joins `traffic` at
twenty and `mining` at thirty. It is safe for the intel layer because a telescope read is seeded
per `(watchId, timeWindow)` — asking again inside a window cannot buy a confirmation — and the
write it provokes (`lastConfirmedAt`) is throttled to a quarter of a minute server-side.
**Superseded by D53:** those timers are a sixty-second safety net now, and the work is done by a
galaxy-wide broadcast on the same SSE socket. The seeding argument above is unchanged and is still
what makes refetching `/api/galaxy` safe at any rate.

**And more bombardment.** One-to-three rounds per drawn model put four rounds across ten seconds
for a typical raid. Four to eight, with a floor of 18 rounds on the whole volley so a SMALL raid
still reads as a bombardment and a ceiling of 40 shared per model so a twelve-model formation
does not arrive as a chord — and every drawn model still fires.
**Binds:** `ContactFocus` says "A raid is landing / Under fire" rather than "Somebody is moving";
D44's "only your own outbound raid is drawn" is superseded; `useNotifications` now honours its
`enabled` flag (it fired a 401 on the landing page and a 404 on the server list every cold start).

### D52b · The rest of the review — bug fixes
Nine more findings from the same review, worked through in severity order. The owner's ruling
on the one that was a design question came first: **composition stays public.** D24 made every
craft in the galaxy readable down to the hull, the defender included, and what the Radar
actually sells is ATTRIBUTION — that a fleet is coming for YOU, and how long you have. A
defender may piece it together from a short hop and cannot from a long one, and that asymmetry
is the game. Three files claimed otherwise; all three now state the real rule, and
`pendingThreads` still carries no composition because THAT payload is the attributed one.

**`/api/planet` published caps the economy does not use.** `advanceEconomy` fills the works to
`collectorCap(rate × productionMult)` and `collect` fills storage to `storageCap(rate ×
productionMult)`; every figure on the payload came off the BARE rate. With a Foundry in orbit
the works legitimately held more than the ceiling they were shown against — measured at
469,518 against a published 442,941 — so the Works meter pinned at 100% and Signals announced
"production is being thrown away" while it was still running. It also hid the satellite it
exists to price: a player who bought a Foundry saw the same per-hour figure as before.

**Thirteen routes the client parses were not in `contract.test.ts`**, against an invariant that
says every one of them is. They were all POSTs — the rule had been read as "every GET" — and
one had ALREADY drifted: `satelliteInstallSchema` lost its `level` field at D25, which is
precisely the failure the invariant names. All thirty routes are covered now.

**Signals judged the two piles on two different clocks.** The store was measured against the
projection and the works against the last fetch, so the header's Works meter hit 100% while
the one surface whose job is to SAY the works have stopped stayed silent for up to a poll.

**`POST /api/servers/:code/join` was not idempotent once a galaxy filled**, which is the normal
end state of every galaxy. `resolveJoinTarget` refuses on STATUS and ran before the idempotent
path, so a placed commander retrying — a client retry, a reinstall, a double-tap — got
`SHARD_FULL` and was locked out of their own world. The existing idempotency test never saw it
because its galaxy had room.

**A recalled probe reported the loss of nothing.** A probe carries no unit rows, so the count
was zero and the notification read "0 craft returned · that flight could not be completed".
The count was the right number and the wrong subject; the payload names the craft kind now.

**Five exported functions had no callers** — `asteroidAt` (whose docstring named a caller that
has never existed), `pruneAsteroidClaims`, `engagementProgress`, `worksHours`, `capacityHours`.
Deleted. A public surface a reader must assume is load-bearing costs more than the function.

**AND THE SEASON GATE MOVED, WITHOUT ANYTHING BEING TUNED.** The blind attacker's target
valuation counted `storageCap` alone while the docblock above it claimed — correctly, since
D16 — that it counted the works too. The scouted branch had been updated for D16; the blind
one had not. Every unscouted target was therefore under-valued by roughly the collector
ceiling, and blind raiding was suppressed across the whole galaxy. Fixing the expression to
match its stated rule lifted pooled `TAX` into band and put the informed archetype back on top
of every seed — the two assertions that had been red for four phases. `ARR` (0.298 / 0.299
against 0.308–0.326) is now the only red one. See `balance.md` § Current reading.

### D52a · What the review of D52 found — bug fixes
A code review of the working tree caught four things worth recording, two of them introduced by
D52 itself.

**`useProjected` mixed two epochs, and D52 is what made it matter.** The works and the store are
predicted forward between fetches from `dataUpdatedAt` — React Query's record of when a fetch
landed, and the one timestamp in the client that can only be taken from the DEVICE. `useNow` now
returns `serverNow()`, so the span became `real elapsed + offset`: on a phone whose clock is two
minutes slow the works jumped forward by two minutes' production the instant every fetch landed.
`toServerTime` moves it across. The file's old comment — "any consistent epoch works" — was
already false before D52, because `disruptedUntil` is a server timestamp and was being compared
against device time; both ends are now on one clock.

**The stranded-flight sweep ran on the queue's tick.** Two correlated `NOT EXISTS` scans over
tables that grow all season, before `claimDue`, every tick — defensible at five seconds and not at
one. `WORKER_POLL_MS` is now the latency of the whole world and is meant to keep going down;
tying a repair's cost to it means every future improvement in liveness is paid for again in table
scans. The sweep has its own 30-second cadence, and still runs unconditionally on a worker's FIRST
tick, which is when a crash is most likely to have left something to find.

**`wipeAllServers` could not wipe a galaxy that had been played.** `debris_fields` was missing
from the delete order and its foreign keys to `missions`, `planets` and `seasons` are all
`ON DELETE no action`, so `delete(missions)` raised a constraint violation and the whole
transaction rolled back. Every galaxy where a battle had left wreckage — every galaxy anyone has
actually played in — could not be reset. The three existing wipe tests never fought a battle,
which is exactly why they missed it.

**The Beacon only worked one way.** `launchAttack` passed `fleetSpeedMult(origin.orbit)`; the
return leg called the two-argument `fleetTravelMinutes`, so `boost` defaulted to 1 and a raid flew
out 1.3× faster and walked home. `packages/sim` already applied the multiplier to the return leg,
so the balance simulator was pricing a benefit the server did not deliver — the mirror image of
the standing rule that it must not price what it refuses to simulate. Both regression tests were
checked against the unfixed code first; the Beacon one needed a real raiding distance, because at
the seed's 150 units the whole-minute rounding swallows a 30% difference.

### D53 · The galaxy is live for everybody, and nothing waits for a round trip — owner instruction
The owner asked for the structures that contradict "a magnificent atmosphere, and as much as
possible happening live" to be found and fixed. The audit turned up eleven, in four families.
Two of the four turned out to be right already, and that is recorded here as well: a plan that
only lists what it changed cannot be checked.

**THE SCENE WAS RENDERED BY A `setInterval`.** The disc renders on demand, and the asking was a
timer at 24fps. 41.67ms against a 16.67ms refresh does not divide, so the requests landed 50ms,
33ms, 50ms apart and every moving thing inherited that beat — and Chromium throttles timers in a
page it thinks is backgrounded, which `tools/engagement.mjs` already carried three flags to work
around. The ticker is now `requestAnimationFrame`, and it asks for every Nth DISPLAY frame rather
than for a wall-clock interval, so each request lands on a vsync boundary. The stride is measured
and `floor`ed, never rounded: `Math.round` returns 4 at 90Hz, which is 22.5fps against a floor of
24, and it happens to survive at 60Hz on a floating-point accident — correct on the display
everybody develops against and wrong on the phones.

R3F unwinds its loop the moment its pending-frame count hits zero and needs a whole display frame
to restart, so asking one frame at a time caps the scene at every OTHER frame. Invisible at a
stride of two and the entire answer at a stride of one — which is what a device at or below the
floor gets, so a phone struggling to hold 24fps was being quietly halved to 12. It buys two frames
every two frames there. Measured on a headless renderer managing 14fps: 0.59 of the display's
frames before, 1.0 after.

**AND THE BOMBARDMENT NEVER ASKED FOR ONE AT ALL.** `Meteors` and the camera rig have always used
`state.invalidate()` from inside a frame; the volley did not, so the ten seconds the whole loop
pays for were drawn at the rate chosen for a rock on a forty-minute orbit — about twenty stepped
positions for a round crossing its gap, and a nozzle flickering at nearly seven hertz sampled three
and a half times a cycle. `<FullRate />` mounts with the volley and asks for every frame the
display will give, for exactly as long as the engagement lasts.

**THE GALAXY WAS LATE FOR EVERYONE BUT ITS OWNER.** `publish()` had exactly one caller in the
codebase — the notification writer — so the stream fired only for what happened TO YOU, and
everything else arrived on a poll: twenty seconds for a neighbour's launch, thirty for a world
changing shape. A short flight had covered a fifth of its leg before anybody but its owner knew it
existed, which is precisely how a galaxy of fifty real people comes to read as empty.

The same LISTEN/NOTIFY bus now carries a second topic, keyed on the SEASON — which is what
`/api/traffic`, `/api/galaxy` and `/api/mining` are already scoped by, so a subscriber hears about
exactly the rows it may read. A connection subscribes to both. **Measured end to end in a real
browser: a bystander saw a stranger's raid 821–872ms after the launch committed**, against a
twenty-second poll.

*What it costs, and why it is not a leak.* The payload is a shard id and a kind — no world, no
owner, no heading, no position — and a test asserts those are the only two keys on it. What it
says is what the poll it replaces said, sooner: go and read a payload you were already entitled to.
The rule at every publish site is that **a shard event fires exactly when the public payload it
points at has changed, and at no other time.** So a Command Core crossing a tier boundary publishes
and a Refinery reaching L7 does not; a satellite going up publishes and a Telescope going up does
not, because a ground instrument appears in no public payload (D15/D25) and a broadcast timed to it
would be the one fact on this channel that a refetch could not have shown. Building ships publishes
nothing. All of it is asserted in `broadcast.test.ts`, in both directions.

*What it costs in load.* Less than the polls it replaces. At fifty commanders the old floor was a
hundred and fifty requests a minute standing still; the new one is fifty plus one burst per real
event. The client coalesces events over 250ms and maps each kind to the one or two reads it
actually moves — a launch does not refetch `/api/galaxy`, which carries a telescope reading per
watched world. Measured: seven events under the blanket path produced 56 invalidations, and 2
under the routed one.

*And the polls became a net rather than the mechanism.* Sixty seconds across the board, which is
worse than before if the channel dies — so `/health` reports whether the bus is listening, how much
it has delivered and how long it has been silent. It does not fail the check on its own: a galaxy
running on its polls is degraded, not down.

**EVERY ACTION COST TWO ROUND TRIPS.** Each mutation returned a fragment — a level, a hull count,
two resource figures — and the client threw it away and refetched `/api/planet` to find out what
its own action had done. In a game whose construction model is "instant on payment, no build
timers", that is three to eight hundred milliseconds of a dead button after every tap. The body of
`GET /api/planet` is now `planetView()`, and every mutation returns it, built inside the same
transaction under the same row lock — free, because the lock is already held and the second
economy advance is a no-op. A launch returns its own `pendingThreads` too, from the same builder
the GET uses, so the squadron is on the disc on the frame the answer lands rather than a request
later. `contract.test.ts` asserts the view a mutation returns is byte-identical to the one GET
would have given; that test was checked against a deliberately stale view first.

**AND THEN THE LAST ROUND TRIP CAME OUT OF THE PLAYER'S WAY.** Upgrade, build, instrument,
satellite and collect are predicted on the tap and reconciled with the server's answer. This does
not weaken principle 1 — the client still decides nothing; the server validates against its own
figures inside a row lock and its answer overwrites the prediction, exactly as `useProjected` has
predicted the works since D16. What is new is the restraint: a predictor touches the two piles
being spent, the one thing being bought, and the price of the next one of it, and **declines**
whenever the answer is not certain — the Core ceiling, the Shipyard gate, the Uplink prerequisite,
the Prospector cap counted across craft that are away, an instrument with nothing left to sell.
A prediction that is only usually right is worse than none. Re-deriving storage caps, per-hour
rates, orbit slots and Wealth would be `planetView` written a second time in another language;
those land with the real answer two hundred milliseconds later and nobody is staring at a storage
ceiling in that time. **Measured in a real browser with the server held back two seconds: the
screen agreed with the tap in 683ms.**

*One thing this broke, found in review.* An optimistic write re-anchors React Query's
`dataUpdatedAt` to now, and the works are not stored but PROJECTED from it — so a payload carrying
a works figure from five minutes ago made the meter visibly drop and then be corrected. The
prediction now brings the works forward first, through the same `worksAt` the projection hook
uses, and a rollback restores that settled world rather than the pre-tap one.

**THE DISC RE-RENDERED ON A CLOCK, AND TWO PROPS DID NOT SURVIVE IT.** `GalaxyView` holds a
five-second clock, so it re-renders whether or not the galaxy has changed. That is meant to be
free. `watching` was built with `.map` inside the JSX and had a new identity every time, and it is
a dependency of the memo that resolves those worlds to positions, which is the dependency of the
memo that builds the watch beams' `BufferGeometry` — so a player with telescopes pointed uploaded a
fresh line buffer to the GPU on every tick, for beams that had not moved. Measured: the geometry id
changed on a twenty-second window before, and is stable after.

**TWO THINGS THE AUDIT EXPECTED TO FIND AND DID NOT.** The plan claimed the five-second clock put
the engagement transition up to five seconds late; it does not — the engagement comes off the
payload and off `useEngagement`'s own timers, and every figure that clock feeds is a whole-minute
one. And a first measurement suggested the scene leaked geometries at rest; it plateaus at 42, and
the growth was the models finishing loading. Both are recorded because a wrong diagnosis that is
quietly dropped is a wrong diagnosis somebody re-derives later.

**Two gaps the review of this work found in it.** `abandon()` and `sweepStranded` take a flight out
of the sky without announcing it, which the sixty-second net made three times more visible than the
twenty-second one had — they publish now. And `/api/stream` had no test of any kind, which was
tolerable when it carried rare news and is not now that the polls are a net under it; it is
exercised through a real socket, because `reply.hijack()` is exactly the part worth testing and
`app.inject` cannot reach it.

**What is deliberately NOT done.** Mining and salvage launches still cost two round trips: making
them one means returning `mining` and `pending` as well as `planet`, which is a larger change than
it looks and was not in the approved scope. The atmosphere half of the owner's instruction — worlds
being the only completely still object in a scene where everything else breathes — is a separate
pass, on the owner's decision.

### D53a · The worlds get air, and the plane stops being graph paper — owner instruction
The atmosphere half of D53, held back as its own pass on the owner's decision so it could be
looked at and dropped without losing the liveness work.

**A WORLD WAS THE ONLY DEAD OBJECT IN THE SCENE.** A hull sheds a wake, a shield breathes, a rock
tumbles, a watch beam pulses, a plume flickers — and the worlds, which are what the game is
about, had nothing happening at all and ended at a hard alpha cut, so each one sat on black like a
sticker. What was physically missing is the limb: a shell of gas scatters light forward, so a lit
planet is BRIGHTEST at its own edge and that brightness bleeds a little past the silhouette. It is
the single detail that separates a photographed planet from a sphere with a texture on it.

One extra instanced quad — one draw call for the whole galaxy, because the limb is the same
texture on every world where the bodies need a bucket per render. Two gradients do the work. The
radial one puts the peak just INSIDE where the planet's edge falls, so the band straddles the
silhouette; entirely outside it would be a halo, which this scene already uses to mean "selected".
The linear one takes nearly all of it off the dark side, because a ring of even width is a
manufactured object.

**BOTH OF THOSE ARE LESSONS FROM PHOTOGRAPHS, NOT FROM THEORY.** The first attempt, at a scale of
1.34 with a soft falloff, put half a radius of grey haze around every world and drowned the
selection ring — the same failure `BLAST_SIZE` records, and the same fix. The second, tightened but
with a gentle 1 → 0.24 light bias, survived the whole way round and read as a gasket bolted to the
planet. The third, at 1.16 with a 1 → 0.015 bias, is a warm crescent. The proportions that matter
are pinned in `planet-visuals.test.ts`: outside the world, well inside the selection ring, at most
a fifth of a radius, warm rather than neutral, and multiplied by the same `STANCE_LIGHT` the body
is — or the brightest pixel on the silhouette would be at full strength on exactly the worlds the
fog is dimming.

It also breathes, at eighteen seconds and one and a half per cent, phase-shifted per world. The
reason is the one already written on `Shields`: something perfectly still reads as a modelling
artefact rather than as an object.

**AND THE PLANE WAS A DIAGRAM.** Five complete circles of even brightness and sixteen radial spokes
running the full width, all at one opacity — against the nebula it was the most technical-looking
thing on screen, in a scene whose whole brief is that it is a photograph. The rings were made into
arcs with brightness varying around the circumference, and the spokes cut to eight and faded from
the core outward. **Superseded by D53b, which is where that turned out to be the wrong fix.**

**AND THE THIRD ITEM TURNED OUT TO BE A DIFFERENT BUG.** The loading gates on the planet sheet, the
intel screen and the reports list were expected to be near-dead code, and they were — but they
conflated a failed read with a slow one. React Query's `isPending` goes false the moment a query
errors while `data` stays undefined, so a gate written as `isPending || !data` falls through to its
loading branch forever: an animated pulse claiming progress on a request that has already given up
retrying. On the reports list it was worse, because an empty list and a failed one took the same
branch and the screen said **"nothing has been fought over yet"** about a request that never
arrived — the interface stating a fact about the season on the strength of a network error.
`ServersScreen` was the only surface with the error branch, and it is the pattern the other three
now follow. All three regressions were checked against the unfixed code first.

### D53b · The plane is photographed, not plotted — owner rejection
The owner looked at D53a's disc and asked whether it had worked. It had not, and the interesting
part is why: **the fix treated the symptom.**

D53a kept the rings and modulated their brightness around the circumference. Photographed from
directly overhead — which nobody had done, because the harness always framed a world — the plane
still read as a **targeting reticle**: concentric circles with radial spokes, exactly the thing
the change was supposed to remove. The graph-paper quality never came from the lines being even.
It came from them being LINES. Thin hard strokes at constant width are vector graphics, and there
are none of those in a telescope image, so no amount of varying the brightness along a stroke was
going to help.

So the strokes are gone. The plane is a painted plate now — spiral arms of gas and dust lying
flat, fading to nothing at the rim — built with the same three ideas as the backdrop, and
deliberately so: domain-warped noise for filaments, an independent field SUBTRACTING for dust
lanes, and a narrow palette. Two surfaces in one photograph built from different ideas about what
space looks like will always disagree. `fbm` is now exported from `nebula.ts` rather than copied.

It orients BETTER than the rings did. Arms carry rotation as well as extent, which concentric
circles cannot, and it is the same single draw call.

**Two more things came out of photographing it rather than reasoning about it.** The first plate
was sampled at a noise frequency of 3.1 and came back airbrushed — two smooth ribbons with no
grain at all — for the reason the nebula's own docblock already gives: fine structure reads as
something enormous and far away, coarse structure reads as fog in front of the camera. And the brightness took
two passes and an owner rejection to settle. At 0.5 the lower half of the disc was a blue wash that
a fog-dimmed world sat INSIDE rather than in front of, so the ceiling was set at "dimmer than
`STANCE_LIGHT.dark`" — the dimmest thing that has to stay legible against it.

**That ceiling was the wrong test, and the owner is what found it.** Legibility is not the rule.
The plate passed at 0.38 and was rejected on sight: the arms held the eye, and what a player is
meant to be looking at is the worlds. Scenery is not allowed to be the subject. It sits at 0.18
now, and the test asserts SUBORDINATION rather than mere darkness — comfortably under half the
dimmest world it sits behind — stated as the relationship, because the number is a taste and the
relationship is the decision.

What can be asserted is asserted. Most of a painted plate is judged from a photograph, but two of
its properties would ship a visible defect rather than a different-looking one, and jsdom has no
2D context to check the pixels — so the radial profile is a pure exported function and
`disc.test.ts` pins both: it reaches exactly nothing at the rim, or the plate has a cut circular
edge; and it is empty where `Core` already is, or the two stack into something that reads as a
STAR, which this galaxy deliberately does not have.

### D54 · The game is Astera Online, and the way out says your name — owner instruction
Three things, one pass.

**The name.** `Blindspace` is gone from every file in the repository. It was three different
strings doing three different jobs and each was renamed to the form that job needs: the package
scope is `@astera/*`, the Postgres role, database, container and LISTEN channel are `astera`,
`astera_test`, `astera-pg` and `astera_events`, the `<title>` and the manifest `name` are
**Astera Online**, and the two places a phone truncates — the manifest `short_name` and
`apple-mobile-web-app-title` — are **Astera**. The dev database is on tmpfs and is recreated by
every container start anyway, so renaming the role cost nothing that a restart was not already
costing. The repository DIRECTORY is still `blindspace`; renaming it would move the memory slug
and every absolute path in it, and it is not visible to a player.

**The identity.** The supplied art is a glow painted on a solid black plate. Dropped straight
onto the app that draws a black rectangle over the void — which is `#04060c`, and lit by two
radial gradients on the loading frame, so the box shows. Two derived files carry an alpha channel
instead, lifted so that `alpha = max(r,g,b)` and `colour = pixel / alpha`: composited over black
that is the original pixel for pixel, where the obvious `alpha = luminance` would have crushed
every mid-tone. Quantised to 255 colours, which is 66KB against 272KB and indistinguishable at
any size the game draws it. `Wordmark` is the single component both the front door and the
loading cover hang, because two hand-set headings is how a wordmark drifts. The app icons and the
two favicons are square crops of the same artwork with the words taken off — at 32px a wordmark
is a smudge — and `art.test.ts` resolves every one of them against `public/`, since nothing
regenerates these on a build.

**The way out.** Owner-reported: "there is no logout button, I cannot sign out." There was one,
and there had been since D21 — in the commander sheet, opened by a header control that is always
on screen. The control said SEASON and drew a duration under it, so what every player saw was a
clock, and nobody presses a readout. D21's argument was that "how long have I got" and "who am I,
and how do I leave" are the same question asked twice; that is true of the SHEET and was never
true of the LABEL. The control now carries the commander's own NAME with the season figure under
it, and the plate and chevron the other two header controls already had. Not a fourth icon
button: two stock columns share this row and have about ninety pixels each on a phone, which is
already the tightest thing in the interface. The name is set in the display face at its own
tracking rather than in `legend`, whose 0.14em costs three characters of a sixteen-character name
in a column this narrow — and a name truncated to "SHOT1E7…" identifies nobody.

**This generalises `I5`.** A surface reachable only as a side effect does not exist for the
player; so does a surface whose only permanent way in is labelled as something else. Before
shipping a surface, name the control that opens it — and check that the control names it back.

## Architecture

### A1 · One source of truth for game rules — LOCKED, foundational
`@astera/rules`: pure functions, zero runtime dependencies, no clock, no I/O, no ambient
randomness. The server decides outcomes with it, the simulator validates balance with it, the
client only predicts and renders.
**This constraint decided the entire stack** — it requires one language across client, server and
simulator, which is why Unity and Godot were rejected regardless of their other merits. Enforced
by ESLint; CI fails if the rules acquire a clock.

### A2 · React Three Fiber for the galaxy — LOCKED
Shares TypeScript with the server so the rules package is literally the same file, and 3D and DOM
UI compose in one tree — which matters when the game is 90% interface.
Rejected: Unity WebGL (15–25 MB payload, fatal for a 60-second comprehension target; C# breaks
A1), Godot 4 web (least mature target, breaks A1), Phaser (2D only), Babylon.js (close second,
heavier, thinner React story).
Capacitor and Tauri wrap the identical build for mobile and desktop. A packaging step, not a
project.

### A3 · Hybrid persistence — LOCKED
Lazy evaluation for anything continuous; scheduled events for anything that must happen at a
moment. No global tick, no per-planet loop. Resource production for 300 players costs exactly
zero background compute.

### A4 · SSE only, no WebSocket — LOCKED for MVP
Client→server is entirely REST; server→client is a handful of rare events. Fleet motion and
asteroid orbits are computed client-side from timestamps, so the living galaxy needs no streaming.

### A5 · Nothing is stored that a formula and a clock can derive — LOCKED
No fleet positions, no asteroid coordinates, no resource tick rows. A mission holds
`departAt`/`arriveAt`; the client interpolates. An asteroid holds radius, period and phase.

### A8 · REST + Zod, not GraphQL or tRPC — LOCKED, low stakes
~14 endpoints. Trivially debuggable, consumable from a future native shell, easy to rate-limit.
Shared Zod schemas give inferred end-to-end types anyway.

### A9 · Drizzle over Prisma — LOCKED, low stakes
SQL-first, so `FOR UPDATE` and `SKIP LOCKED` are first-class rather than raw-query escapes.

### A10 · SSE over Postgres LISTEN/NOTIFY, not an in-memory emitter — LOCKED
The API and the worker are separate process groups. An emitter would work perfectly in local dev —
where both happen to be one process — and fail silently in production, which is the worst possible
failure mode.
`publish()` is called **inside** the transaction that produced the event. NOTIFY is transactional:
delivered on COMMIT, discarded on rollback, so a client can never be told about a battle that was
subsequently undone.

### A11 · The unlock cascade is DERIVED, not stored — LOCKED
Unlocks are computed from history: a battle resolving unlocks the telescope, being scanned unlocks
the radar and the veil, watching someone unlocks the explorer. Stored flags drift from the events
that justify them. Only *what has been announced* is persisted (`players.unlocksSeen`).
The telescope unlocks whether the first fleet won or was annihilated — losing it and only then
being handed a telescope is the better lesson, and a wiped player is never left in a dead end.

### A12 · `probe_reports` is separate from `scan_events` — LOCKED
The two rows describe the same event from opposite sides: one names the target and its contents,
the other names the origin. Merging them puts fog enforcement one mistaken `select *` away from
telling a defender exactly who scanned them. Probe values are stored already fuzzed.

### A13 · Exactly one clock — LOCKED (invariant)
Every timestamp written to the database comes from the injected clock. **Never `defaultNow()`.**
This shipped broken once: `battle_reports.createdAt` used the database clock, which agrees closely
enough in production to hide it — and under a fixed clock the "while you were gone" window never
closed and every read replayed the same news forever.
