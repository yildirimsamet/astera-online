# Game Design

How the game works, system by system. Every system is listed with **the decision it
creates** — a system that creates no decision does not belong here.

Formulas and constants: `balance.md`. Why each choice was made: `decisions.md`. Unfamiliar
terms: `glossary.md`.

> Everything below is built and playable except **asteroid impacts**. Season freeze, personal
> records, the fifteen-minute afterglow and atomic successor rollover are live. The first
> Frontier slice is also live: research access, isotope asteroids, contested Deuterium and
> the Deuterium-priced Runner and shield-specialist Breacher all use the same
> ruleset as the rest of the galaxy.

## The loop

```
DEVELOP → ACCUMULATE → GATHER INFORMATION → SPOT OPPORTUNITY → CHOOSE TARGET
   → TAKE RISK → DISPATCH → WAIT OFFLINE → OUTCOME → GAIN / LOSS → NEW DECISION
```

Step 9 feeds step 3. **The battle report is the most accurate intel in the game**, which is
what closes the loop: every fight teaches you something about somebody you will fight again.

**The session is 4–6 minutes:** open, read what happened, check intel, make one or two
commitments, close with something in flight.

**The season is 14 days in four acts.** Land grab (1–3): everyone poor and blind, raids
cheap, learning who the neighbours are. The war (4–9): vision matters most, veils go up,
players choose an identity. Consolidation (10–13): fleets expensive, one bad read costs a
day. **The sunset (14):** upgrades no longer repay before the wipe, so everyone hoards.

The sunset is **engineered, not scripted**: because payback is 8–24h and the season ends,
investment stops being rational on the final day. Every player independently reaches the same
conclusion, so the whole galaxy is simultaneously rich and undefended. The economy produces
the finale.

## Ownership — the worlds

One commander per galaxy, with one uncapturable **capital** and up to three captured
**colonies**. Every controlled world is named, fixed in 3D and runs the complete planetary
economy. Ordinary raids are structurally non-destructive; only a Death Star can apply the
specific permanent level loss in D97/D98. A capital may be devastated but never captured;
colonies and neutral worlds may also transfer control on a qualifying second impact.

Raids take shields, satellites, units, stock and *production time*. They never touch
buildings. This is the mechanical guarantee behind ownership: **you can be robbed and set
back; you cannot be un-made.**

Across seasons an account keeps **record and cosmetics only, never power**. Inherited power
would end competition within two seasons. What carries over is who you *are*, not what you
*have*.

## Progression — five buildings

The **Command Core** is the level ceiling: no other building may exceed it. That produces one
clean recurring decision — *raise the ceiling, or fill it in?* — and gives every player a
single legible "how developed am I" number, which since D49 is also what decides who they may
fight.

| Building | Does | The decision it creates |
|---|---|---|
| **Command Core** | Level ceiling, orbit slots, flight bays | Breadth now, or depth now? |
| **Alloy Refinery** | Alloy/hr and alloy storage | The default safe investment |
| **Crystal Extractor** | Crystal/hr and crystal storage | Slow, but gates everything interesting |
| **Vault** | Storage capacity and protected stock | A larger purchase window vs investment elsewhere |
| **Shipyard** | Unlocks hulls, sets probe stealth and build throughput | Reach vs growth |

Five numbers, one portrait screen, no scrolling. **A hard cap.**

**Construction is committed on payment and completes through two independent queues** (D4).
Buildings, instruments, satellites and research share CONSTRUCTION; mobile hulls and ground
defence share YARD. Each queue is three orders deep and processes one order at a time. Cancelling
is a decision, not an undo: it refunds half the committed resources. A system-abandoned order
refunds everything. The Death Star keeps its separate sixty-minute strategic build (D97).

Queue gates read the world projected through every earlier order. A commander may therefore queue
Core 1→2 and then Refinery 1→2; they may not use a later order to justify an earlier one. Core and
Shipyard now sell throughput as well as access. Ground defence uses a faster derived throughput so
one Thorn at Shipyard 0 still completes inside the narrowest Radar L3 warning.

### Flight bays — concurrent operations, not construction

`bays = 3 + floor(core / 3)`. Every craft that leaves — a raid, a probe, a mining run — holds
one for its whole round trip. A squadron is one bay, because a squadron is one decision.

Build queues pace conversion of resources into holdings; flight bays ration concurrent operations
away from a world. They are deliberately separate constraints. A bay count remains a state the
interface can read, and a dark bay is an honest fact about the commander's current commitments.

## Economy — two produced resources, one contested material

**Alloy** (common, builds everything) and **Crystal** (scarce, gates advanced hulls,
satellites and high building levels) are the two resources a planet produces. Their different
curves create composition pressure rather than one linear pile.

**Deuterium is never produced passively.** A planet begins with none. The Crystal Extractor
sets the containment ceiling for its storage and works without adding a sixth building. It is
fully raidable — the Vault protects zero — and it occupies the same fleet cargo as any other
material. Isotope Spectrometry reveals its contested asteroid source; the Runner consumes it
in a repeatable, losable hull rather than turning it into permanent background power.

**Production fills the works and stops there (D16).** One tap moves it into storage. Storage
caps at 12 hours of production, the works at 10, so a normal night wastes nothing and a long
absence still tops out.

### Why players hold raidable stock at all

Holding liquid resources is not a score strategy: Dominion is unchanged by either holding or
spending. A queue deliberately limits how quickly stock can become a building or fleet, so
committed work remains Wealth while uncommitted stock stays exposed to raids.

Players sit on growing piles because **upgrade costs are lumpy** and both queues are bounded. The
store fills, an order commits part of it, and production continues while that order runs. That
involuntary sawtooth, not any score incentive, is what makes raiding worth doing. **Cost lumpiness
and bounded build throughput are hard requirements, not tuning preferences.**

## Fleet — seven spacefaring hulls and two ground guns

| Hull | Class | Mathematical job | Cost of using it |
|---|---|---|---|
| **Wasp** | Skirmisher | Cheapest attack per alloy, fastest → shortest exposure. 1.6× into Bulwark-class, so it is the anti-turtle tool. 40 cargo | 24 HP evaporates against Lances |
| **Lance** | Lance | Highest raw attack. 1.6× into Wasps — the answer to a swarm. 50 cargo | 0.625× into Bulwark-class; useless against a fortified planet |
| **Bulwark** | Bulwark | The durability anchor. 1.6× into Lances. 70 cargo | Speed 199 gives the longest exposure on any route |
| **Hauler** | Support | 1,800 cargo. **The dedicated cargo hull; it contributes nothing to the fight** | Every Hauler slot is a combat slot you did not bring |
| **Runner** | Support | 300 cargo at speed 420. Lets light strike fleets trade capacity for a shorter exposure window | Dense Fuel Cells and contested Deuterium; poor cargo-per-cost means it cannot replace the Hauler |
| **Breacher** | Lance | Five times its normal effect against an active shield; the extra damage cannot spill into units | Gravitic Charges, contested Deuterium and no cargo; without a shield its 12 attack is deliberately inefficient |
| **Bastion** | Bulwark, ground | 1.35× more HP per resource than any ship, because it can never leave. Breaks Lances | Cannot attack. Swarms overwhelm it |
| **Thorn** | Skirmisher, ground | Light, cheap, buildable at Shipyard 0. Tears into heavy hulls | Lances pick it apart |
| **Prospector** | Support, mining | Mines rocks and harvests wreckage. Two per planet, ever | Dies with the garrison; competes for the same bays |

Counter cycle: **`WASP ▸ BULWARK ▸ LANCE ▸ WASP`** at 1.6× / 0.625×. Support hulls are prey
to everything and deal nothing.

**A fleet travels at the speed of its slowest ship**, so composition is a *time* decision as
well as a combat one. Heavy fleets win fights and lose windows — and since D49 they are also
seen coming from further away, because a radar catches a fleet at a distance.

### The Hauler is the most important ship in the design

It is what stops "send everything" from being universally correct. A pure combat fleet wins
the battle and carries almost nothing home; a hauler-heavy fleet carries everything and loses.
The optimal ratio depends on what you believe is in the target's vault — **exactly the thing
you had to scout to find out.** Loot capacity is where the information layer cashes out into a
number.

Support hulls are **shielded from fire while any combat hull on their side survives**, which
creates the escort decision: bring enough combat hulls to cover the cargo you brought.

## Combat

Three rounds, simultaneous fire, ±8% variance, no player input. Variance is deliberately
small: the whole game is built on information reducing uncertainty. **If randomness dominated
outcomes, intel would be worthless.**

Graded on **resource value destroyed**, not `ATK × HP` — that metric ignores the counter
matrix, so 26 Wasps and 1 Bastion read as equal "power" while one annihilates the other.

| Grade | Condition | Loot |
|---|---|---|
| `DECISIVE` | No defending units survive | 50% of raidable stock |
| `PARTIAL` | ≥45% of defender value destroyed | 25% |
| `REPELLED` | Below that | Nothing |

Three grades rather than win/lose: binary outcomes make marginal attacks worthless and punish
good-but-imperfect reads.

**Breacher does not change the counter cycle.** It is Lance-class and its ordinary
12 attack resolves through the same damage map as every other ship. While an Aegis
shield remains, four additional copies of that class-adjusted damage hit only the
shield. The bonus is capped at the shield left in that round and never overkills
into ships or ground guns. Scouting an Aegis creates the choice; sending Breachers
blind is intentionally expensive and weak.

**A raid takes ten seconds to land (D44), and the whole galaxy watches it (D52).** The fleet is
over the target at `arriveAt` and the battle is settled ten seconds later; in between the
squadron holds in orbit and fires on the world. It is a real server window, not an animation —
nothing is decided until it closes.

**It always happens.** Win, lose or be annihilated, a fleet that reaches its target fires: the
ten seconds are the payoff of a decision made minutes ago (D63 — it was forty before), and there is no state in which a
squadron arrives and vanishes without a shot.

**And it is public.** Everyone in the season sees the same squadron holding over the same world
firing the same rounds — the volley is seeded from the mission id, which both sides carry. For
those ten seconds the traffic payload names the WORLD being hit, and nothing else: no owner, no
origin, no name, and no clue who is going to win. A battle only its attacker can see is not a
living galaxy, and the fog was never about hiding the world from the people living in it — it is
about what you know BEFORE a decision. Knowing a raid is coming, and how long you have, is still
exactly what the Radar sells.

### The defence chain

```
Aegis shield → ground defence → home fleet → loot phase → disruption
```

**Ground defence is two guns in opposite classes (D27), and choosing between them is the
defender's only composition decision.** A Bastion is Bulwark-class: it breaks Lances and is
overwhelmed by swarms. A Thorn is Skirmisher-class: it tears into heavy hulls and is picked
apart by Lances. Build one kind and a raider who scouts you brings its counter; build both and
you are strong against nothing in particular. **"How much defence do they have" becomes "what
KIND", which is a question only the information layer can answer.**

**60% of destroyed ground units rebuild free.** Durable defence puts genuine uncertainty back
into the attack decision — with consumable defence ~95% of attacks resolved DECISIVE, and if
blind raiding never fails there is nothing for information to reduce.

### Disruption

A successful raid knocks the target's works offline: 15 min on DECISIVE, 5 on PARTIAL and 0 on REPELLED (D73). A later raid refreshes this window but cannot stack it beyond 15 minutes from now.
Refreshes rather than stacks, capped at 15 min pending. **Ordinary raids never damage
buildings** — the ownership pillar holds — but the victim loses *compounding* rather than
merely stock. Death Star damage is the explicit exception in D97/D98. It may damage any
enemy world, while control transfer remains impossible for capitals. It is
the only thing that makes raiding competitive with building over a season.

### Wreckage

A resolved battle leaves a public debris field at the defender's coordinates holding 10% of
the value of every non-ground hull destroyed on both sides. It decays over twenty minutes (D63) and
anybody can harvest it (D32, D37). A private fight becomes a public, timed, contested second
event — and somebody who is not at war gets a reason to watch other people's.

## The information layer — this is the game

Everything above exists so that this has stakes.

| Tier | Costs | Detectable | Tells you | Latency |
|---|---|---|---|---|
| **Public** | Nothing | No | Planet, owner, coordinates, development tier, satellites in orbit, whether a dome is up | Live |
| **Telescope** | An instrument and a watch slot | **No** — you are never told who is watching | Fleet `HOME` / `AWAY` / `UNKNOWN`; return ETA at clarity ≥ +2 | Live to 20 min stale |
| **Explorer** | Ships, a bay, and flight time | **Yes** — radar can catch the probe | Stock, defence, fleet size, at an accuracy tier | One shot |
| **Combat** | Ships, permanently | Obviously | Ground truth | Perfect |

The Telescope is cheap, silent, and tells you **when**. The Explorer is costly, loud, and
tells you **what**. Neither substitutes for the other, so both stay live all season.

> **The most valuable fact in the game is "is their fleet home?"** Opportunity and fear are
> the same mechanic seen from two ends. Every other piece of intel is context for that bit.

### Telescope vs Veil — the clarity gradient

```
Clarity = observerTelescopeLevel − targetVeilLevel

  ≥ +2   FULL          status + return ETA, live
    +1   CLEAR         status only, live
     0   INTERMITTENT  shown, refreshes only every 20 min, 25% of refreshes dropped
    −1   DEGRADED      reads UNKNOWN 70% of the time
  ≤ −2   BLIND         always UNKNOWN
```

**The interesting state is `INTERMITTENT`**: real information that may be stale. The player
sees *"fleet HOME — 18 min ago"* and must decide whether that is still true. Matching a
rival's Veil is not a wall you bounce off; it is a fog you reason inside.

The Veil **hides, it never lies** — status becomes `UNKNOWN`, never a false `HOME`.

A telescope also has **range** and a **re-pointing cooldown** (D18), so distance constrains
what you may know and *who you watch* is a commitment rather than a browse.

### Explorer

```
detectChance = clamp(0.25 + 0.18 × (radarL − probeStealthL), 0.05, 0.95)
accuracy     = clamp(0.55 + 0.12 × (probeL − veilL),         0.30, 1.00)
```

Reports are **bands, not numbers**. A cheap scout says "somewhere between 30k and 80k"; an
expensive one says 61,000. Those are genuinely different decisions. Floors and ceilings
guarantee that no investment buys perfect invisibility or perfect omniscience — **the fog
never fully lifts.**

### Radar

| Level | Detects | Message |
|---|---|---|
| L1 | Probes | "Scan detected." |
| L2 | + bearing | "Scan detected from the galactic north-west." |
| **L3** | **Fleets crossing 200 units** | "Incoming fleet. ETA 9 min." |
| L4 | 340 units, + size estimate | "…est. 60–90 ships." |
| L5 | 500 units, + exact origin and composition | "GRIMHOLD · 74 Wasp, 20 Lance, 12 Hauler." |

**A radar is a circle, not a countdown (D49).** The warning fires when a hostile fleet crosses
inside its reach, so how much notice it buys depends on how fast that fleet chose to travel: a
Bulwark siege fleet is telegraphed and a Wasp strike is not. A long flight can never give away
its whole duration, because notice is `oneWay × range / distance`.

**Radar L3 is the highest-value ten lines of code in the project.** "Incoming fleet · ETA 9
minutes" converts a passive loss into an active decision, because the player still has three
real options: **spend the stock** so there is nothing to take, **launch their own fleet out**
so it survives, or **stand and fight**. They cannot recall. Every choice costs something. This
is the most intense thing an async game can do, and it needs no realtime infrastructure.

## Hardware — two kinds, and the identity choice

**Four INSTRUMENTS on the ground**, levelled, taking no slot: Telescope, Radar, Aegis, Veil.
They are what the information game is made of, and each has a ladder.

**Four SATELLITES in orbit**, each taking a slot, bought once, no levels: the **Uplink**
(gates the Telescope and the Radar), the **Foundry** (production), the **Derrick** (mining),
the **Beacon** (fleet speed).

**The Command Core opens a slot at L1, L3, L5 and L9.** Four satellites against four slots is
not a checklist, because the fourth slot is a Core 9 planet: for the part of a season anybody
plays, a world runs one, two or three, and **which ones is who it is**.

**The Uplink is the one gate in the whole system.** It multiplies nothing and defends nothing;
it is the only route to the two instruments that SEE. That is what makes a planet's first slot
a real decision — eyes, or production, or faster drills.

**Hardware in orbit is public; its levels are not (D15).** A dome reads as a dome to everyone,
because deterrence only works if it is legible. How strong it is still costs a probe.

## Galaxy, travel and mining

**A thin disc**, radius 2500, ±300 thickness — legible on a portrait phone at any zoom, and it
looks like a galaxy. Designed skeleton, randomised placement, **deterministic from the season
seed**, so the client regenerates the static layout instead of downloading it.

The larger radius is also a larger navigable scene. The client keeps the established conversion of
50 game units per rendered world unit; it must not raise that divisor with the gameplay radius and
compress 351 worlds back into the old 50-player picture. At the widest camera distance the whole
disc remains available as an overview, while ordinary play opens on a readable neighbourhood.

At most two galaxies of 300 commander seats, filled strictly in order (D99/D100). A v2 season also contains
51 neutral worlds: thirty T1, fifteen T2 and six T3. The disc radius and travel rules do not scale with
population; the denser neighbourhood is an explicit consequence of the 300-player world, not a
hidden balance adjustment.

The population is spread across the whole disc, not filled from one neighbourhood outwards. Capital
addresses use the seeded Poisson layout and each arriving commander takes the address furthest from
the commanders already present. Neutral placement is stratified as well: T1 worlds cover the playable
disc, T2 worlds form an evenly spaced middle ring, and the six T3 worlds share the contested centre.
The season seed rotates and perturbs those patterns, but may never leave a broad empty wedge or put a
tier into one visible clump.

```
travelExact = 1 + (distance / slowestShipSpeed) × 1.2
```

The mission lands at that continuous instant. A whole-minute ETA is a display
quote rounded at the edge, never the time stored on the mission (D83).

Distance is the real map boundary — no artificial range cap is needed, because a cross-galaxy
round trip in Bulwarks already costs two hours of being undefended.

**You may attack within ±2 development tiers (D49).** Tier is public on every world, so the
question "may I fight them" is answerable off the map before a fleet is packed.

**Asteroids orbit analytically** — position is a pure function of the clock, never stored,
never simulated. A rock carries a level that sets its ore, and interception is solved in
continuous time so a craft and its rock arrive together. **First to arrive takes what it can
carry**, which is the whole decision: which rock, and when.

**Mined ore comes home into the works, not into storage (D31)** — so a miner collects like
everyone else, their haul is raidable at half rate with no vault cover, and what they can
absorb is set by the size of their planet rather than by how many craft they own. Mining is a
supplement and a race; it was briefly a risk-free living.

**Everything moving on the disc is public; where it is going is not (D24).** Any craft can be
tapped and its composition read, but the route belongs to the commander who sent it. Mining
runs are the stated exception, public in full, because D19 built that race for two people to
know they were raced.

## Competition — Dominion

```
raw battle value = loot from players + enemy unit value destroyed
                 − own unit value destroyed

battle transfer = round(10,000 × tanh(raw battle value / 10,000))
Dominion        = sum of battle transfers
```

The defender receives the exact negative of the attacker's transfer. It is therefore **exactly
zero-sum across the galaxy, only combat generates it, and one battle moves at most 10,000
Dominion.** The smooth bound is nearly linear for small exchanges but prevents one late-season
fleet from erasing a season's score. It still rewards winning fights *efficiently*, which is what
scouting buys.

It also **scores defence**: repelling a raid destroys the attacker's ships, which is Dominion
for the defender. A fortress that is never attacked scores zero; a fortress that is attacked
and holds, climbs.

A player who never fights scores exactly 0 and sits mid-table however rich they are — which is
why **no anti-turtle machinery is needed anywhere else in the design.**

Net worth survives as **Wealth**: displayed, never ranked.

The first live-season rollout is prospective: battles resolved before the deployment retain their
recorded Dominion; only battles resolved afterwards use the bounded transfer.

## What the game tells you

**Seven notifications, and the list is closed:** `incoming fleet` · `raided` · `raid result` ·
`fleet returned` · `scan detected` · `probe report` · `unlock`.

The test for admitting one: **it reports something that happened TO YOU, that you could not
have predicted, and that you can act on.** Nothing else passes it.

Explicitly excluded, permanently: "your storage is full", "we miss you", daily login bonuses,
streak warnings. Every one is a dark pattern. A full works is a STATUS — true until you act on
it — so it lives in the "Right now" section of Signals and never enters the unread count,
because a badge that cannot be cleared teaches people to ignore badges.

**There is no return overlay** (D23). What happened is in Signals, read when the player
chooses; what is still in flight is on the strip, permanently.

The **Galaxy Chronicle** is separate from private notifications. It remembers only public
state transitions from the last 24 hours: bombardments, Core tier crossings, isotope races
ending, wreckage appearing or being fully claimed, Dominion leadership changes and the War,
Consolidation and Sunset act boundaries. It never names who mined or salvaged, and never
records probes, research, cargo, composition, loot or launch intent. An entry may lead back
to a world only while that world still exists; an exhausted asteroid is history, not a dead
action button.

## The unlock cascade

No tutorial exists. Each system unlocks at the moment the player feels its absence:

| The feeling | Unlocks | Trigger |
|---|---|---|
| "I want to do something." | Fleet + Attack | t = 0 |
| "Where did his fleet go?" | **Telescope** | First fleet resolves — win *or* lose |
| "Was someone poking at me?" | **Radar** | First incoming scan or attack |
| "I can't tell if he's rich." | **Explorer** | First ambiguous telescope reading |
| "I don't want to be seen." | **Veil** | First successful scan against you |
| "I can't run all of these." | **Orbit slots** | Command Core L3 |

The telescope unlock fires on the first battle resolving *either way*. Losing your first fleet
and only then being handed a telescope is the better lesson.
