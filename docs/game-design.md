# Game Design

How the game works, system by system. Every system is listed with **the decision it
creates** — a system that creates no decision does not belong here.

Formulas and constants: `balance.md`. Why each choice was made: `decisions.md`. Unfamiliar
terms: `glossary.md`.

> Everything below is built and playable except **asteroid impacts**. Season freeze, personal
> records, the five-minute afterglow and atomic successor rollover are live. The first
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

Ownership is public spatial structure as well as a label (D122). The galaxy always joins the
caller's capital and colonies with faint white filaments. Focusing another commander's
non-neutral world temporarily joins every world that commander controls, so a scattered domain
can be read without hunting through the disc. This reveals no fact beyond the public controller
identity already carried by each world, and a neutral focus produces no topology.

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

**Work commits on payment and completes through three independent queues** (D4).
Buildings, instruments and satellites use each world's CONSTRUCTION lane; mobile hulls and ground
defence use that world's YARD lane; research uses one commander-wide RESEARCH lane. Each queue is
three orders deep and processes one order at a time. Cancelling is a decision, not an undo: it
refunds half the committed resources. A system-abandoned order refunds everything. The Death Star
keeps its separate sixty-minute strategic build (D97), and so does the interception charge that
answers it (D139) — both are strategic assets on the world rather than queue orders, and both are
stopped by a bombardment and resumed by the recovery that follows.

**Research is bought on a surface of its own** (D140). The selected world pays, but the order enters
the commander's three-deep RESEARCH lane; no planet gains an extra lane and no Construction or Yard
slot is consumed. The screen draws that lane, its running project and the clock time it finishes.
Fifteen projects in four groups: the four
Frontier permissions that are found rather than bought, four economy ladders, five weapon
doctrines, and the two strategic permissions.

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

**Deuterium is produced, but only by a building you have to earn (T5).** A planet begins with
none and with no way to make any. The Deuterium Refinery is the only steady source, and its
ceiling is a research rung — three plant levels per rung of Deuterium Synthesis, which is the
Command Core's rule said a second time so there is nothing new to learn. Both its storage and
its works are sized from its own production now, and the Vault protects hours of that
production exactly as it does for alloy and crystal: a world with no plant still protects none,
because the floor was always hours of a resource's own rate.

**The Refinery is the floor and the rocks are the ceiling, and that ordering is the whole
design.** Measured on the gate seasons, the median commander used to end a fourteen-day season
holding TEN deuterium — it existed only on isotope asteroids, only after the season's
thirty-fifth hour, and only for whoever got there first. That was survivable while nothing
needed it. The refinery is a guaranteed trickle a player can plan around; Isotope Spectrometry
still reveals the fast, contested source that actually pays for Runners, Breachers, the last
research rungs and a Death Star. If the two ever met, the whole Frontier act would become dead
content — so the plant's curve is deliberately flatter than alloy's or crystal's, and a test
holds it below what a miner pulls off the rocks.

Deuterium is otherwise unchanged: fully raidable above the vault floor, the same fleet cargo as
any other material, and consumed by repeatable losable hulls rather than turned into permanent
background power.

**And every launch burns it (T6).** The charge is `mass x distance`, rounded up once per leg —
mass being the same `bulk` the Hangar rations, so one quantity says how big a fleet is in both
places. It is not priced on speed: a Bulwark already pays for being slow by being slow, and the
hull table is held at equal-budget power precisely so no second axis can quietly re-rate it.
D125 and D126 made distance an *information* cost; this makes the same axis an *economic* one,
which is the consistent version of one idea rather than a new tax.

**Full fuel or no launch, and it is paid before the ships leave.** A one-way budget is not a
cheaper raid, it is a stranded fleet, and a launched fleet cannot be recalled. A raid pays both
legs at launch; a transfer, a settlement and an empty-hold clan ship gift pay one leg, while a
resource-carrying clan transport pays its planned outbound and return legs. Deuterium loaded
as cargo is already spent as far as the flight is concerned — the guard reads the sum. No system
path ever asks for more (a rerouted leg flies on what was paid) and no cancellation gives any
back. **Probes and mining runs pay nothing**, and both exemptions are load-bearing: the probe is
what the measured intel gate counts, and deuterium comes off rocks, so charging a miner
deuterium is a deadlock with extra steps. A Death Star pays at construction and not again.

**Every surface that commits a flight quotes it first, and the ship card states the rate.** The
raid sheet, the transfer sheet, the founding panel and the clan-aid form each draw the charge
against the tank it comes out of before anything is committed; the craft sheet carries a fifth
statistic beside attack, hull, speed and cargo — what one of that hull burns per thousand units
— because choosing between two hulls is where that comparison is actually made. A cost the
player meets only as a refusal is a rule they cannot see.

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
| **Wasp** | Skirmisher | Cheapest and fastest combat hull. 1.6× into Bulwark-class; 45 cargo | 25 HP and 0.625× into Lance-class |
| **Lance** | Lance | 1.6× into Wasps and Thorns; 60 cargo | 0.625× into Bulwarks and Bastions |
| **Bulwark** | Bulwark | 662 HP and 1.6× into Lance-class | Speed 65 makes it the slowest mobile hull and lengthens every fleet it joins |
| **Hauler** | Support | 2,200 cargo. **The dedicated cargo hull; it contributes nothing to the fight** | Speed 85 and every Hauler slot is a combat slot you did not bring |
| **Runner** | Support | 380 cargo at speed 125. Lets light strike fleets trade capacity for a shorter exposure window | Dense Fuel Cells and contested Deuterium; poor cargo-per-cost means it cannot replace the Hauler |
| **Breacher** | Lance | Five times its normal effect against an active shield; the extra damage cannot spill into units | Gravitic Charges, contested Deuterium and no cargo; without a shield its 55 attack receives no specialist bonus |
| **Bastion** | Bulwark, ground | Permanent heavy defence with 1.6× into Lances and Breachers | Cannot travel; Wasps receive the class advantage against it |
| **Thorn** | Skirmisher, ground | Low-cost permanent defence, buildable at Shipyard 0, with 1.6× into Bulwarks | Cannot travel; Lances and Breachers receive the class advantage against it |
| **Prospector** | Support, mining | Speed 825 and a base hold of 300; mines rocks and harvests wreckage; two per planet | Cannot raid, transfer or defend against an ordinary raid; still uses Hangar and flight-bay capacity |

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
| `DECISIVE` | No defending units survive and the shield is depleted | 70% of raidable stock |
| `PARTIAL` | ≥42% of defender value destroyed | 35% |
| `REPELLED` | Below that | Nothing |

Three grades rather than win/lose: binary outcomes make marginal attacks worthless and punish
good-but-imperfect reads.

**Breacher does not change the counter cycle.** It is Lance-class and its ordinary
55 attack resolves through the same damage map as every other ship. While an Aegis
shield remains, four additional copies of that class-adjusted damage hit only the
shield. The bonus is capped at the shield left in that round and never overkills
into ships or ground guns. Scouting an Aegis creates the choice; sending Breachers
blind is intentionally expensive and weak.

**A raid takes ten seconds to land (D44), and the whole galaxy watches the bombardment (D52).** The fleet is
over the target at `arriveAt` and the battle is settled ten seconds later; in between the
squadron holds in orbit and fires on the world. It is a real server window, not an animation —
nothing is decided until it closes.

**It always happens.** Win, lose or be annihilated, a fleet that reaches its target fires: the
ten seconds are the payoff of a decision made minutes ago (D63 — it was forty before), and there is no state in which a
squadron arrives and vanishes without a shot.

**And the bombardment is public.** Everyone in the season sees the same world under fire at the
same server-authored instant. That does not make the squadron public. Outside every sensor circle
only rockets/surface impacts are drawn from a deterministic, non-authoritative visual source; the
payload carries no real orbit point, approach bearing or mass. Radar adds an anonymous contact,
Telescope adds the fleet silhouette, and the attacker alone sees the exact formation. A battle
only its attacker can watch is not a living galaxy, but a public cinematic must not become a back
door around the information game.

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
| **Public** | Nothing | No | That a world is there, and where. Recovery and open claim windows, which are public moments (D127) | Live |
| **Remembered** | A probe, once | Yes, at the time | Owner, development, satellites, dome — **frozen** at the look, and going stale as its subject grows | One shot, for ever |
| **Telescope** | An instrument and a watch slot | **No** — you are never told who is watching | Fleet `HOME` / `AWAY` / `UNKNOWN`; return ETA at clarity ≥ +2; **and how much of the galaxy you see moving at all** | Live to 20 min stale |
| **Explorer** | Ships, a bay, and flight time | **Yes** — radar can catch the probe | Stock, defence, fleet size, at an accuracy tier | One shot |
| **Combat** | Ships, permanently | Obviously | Ground truth | Perfect |

The Telescope is cheap, silent, and tells you **when**. The Explorer is costly, loud, and
tells you **what**. Neither substitutes for the other, so both stay live all season.

### The sensor horizon — how much galaxy is alive to you (D123)

**A craft in transit is published only to commanders whose current sensor spheres cover it.**
`sensorSphere` turns each controlled world's instrument levels into two finite radii. The
Telescope identifies a craft (with a 750-unit naked-eye floor); the wider Radar detects an
anonymous moving contact and progressively adds size/kind at its top rungs. The best answer
across all controlled worlds wins: `NONE → CONTACT → IDENTIFIED`.

**The fog covers craft; public moments cover effects.** Fleet, probe, mining and salvage craft —
including a fleet already engaging — all obey the same three zones. Bombardment and Death Star
impact effects, wreck fields and the Chronicle remain galaxy-wide. A discovered asteroid stays
known until it is gone, but another commander's Prospector is not thereby visible outside sensor
reach. D52's pillar is untouched: the galaxy still lights up with live battles everywhere, while
D123 remains the only authority on whether their source craft can be seen.

**There is no departure shroud.** A craft is visible from the first instant of a leg whenever
its current position is inside one of the caller's spheres. The contact still publishes only a
short bearing window, never its origin, destination or complete route.

Strategic interception is narrower than ordinary contact detection. Radar L1/L2 never create an
interception circle; the target world's effective Radar must be L3+ to fire by Radar. If that
Radar cannot acquire the Death Star, effective Telescope sight from any world the defender
controls may acquire it instead, while the ready charge must still be installed on the target.
The eight-second missile flight and collision are shown to both participants and to every other
commander whose Telescope identifies the collision point.

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
detectChance = clamp(0.15 + 0.13 × (radarL − probeStealthL), 0.05, 0.80)
accuracy     = clamp(0.55 + 0.12 × (probeL − veilL),         0.30, 1.00)
```

Reports are **bands, not numbers**. A cheap scout says "somewhere between 30k and 80k"; an
expensive one says 61,000. Those are genuinely different decisions. Floors and ceilings
guarantee that no investment buys perfect invisibility or perfect omniscience — **the fog
never fully lifts.**

**A probe is fast, and the rationing is a stated rule rather than a wait (D121).** The speed
is ×18 what it was and it pays no launch overhead, so a look at the neighbourhood costs about
twenty seconds and the widest crossing of the disc about eighty. What stops a commander reading one world over and over is
the flight bay every craft competes for, and **one look per world per hour, per commander** —
counted from the LAUNCH, so the hour is the same hour for a neighbour and for the far rim, and
held across every world one commander controls rather than sold once per colony. A flight the
server itself abandons never charges the hour.

Distance still decides what a look costs — 22× between the closest legal pair and the widest
crossing, which is a WIDER spread than the probe has ever had. The fixed launch charge was
what had been flattening it: a term no speed can divide grows as a share of the flight every
time the speed goes up. Removing it made the probe both faster and more distance-sensitive at
once.

### Radar

| Level | Detects | Message |
|---|---|---|
| L1 | 1,200-unit contact/warning; scan fact | "Incoming fleet · ETA 9 min." |
| L2 | 1,450 units; + scan bearing | "Scan detected from the galactic north-west." |
| L3 | 1,700 units; enables strategic interception after research | "Incoming fleet · ETA 9 min." |
| L4 | 1,900 units; + rough size | "Sizeable force inbound." |
| L5 | 2,200 units; + exact origin and composition | "Inbound from GRIMHOLD · 74 Wasp, 20 Lance, 12 Hauler." |

**The top two rungs were not sold at all until D123.** Every contact on the disc carried its
full roster, so a maxed Radar bought a bearing and two facts every player already had. A
ordinary Radar contact is only a silhouette — `LIGHT`, `MEDIUM` or `HEAVY`, bucketed from fleet
value. Telescope sight resolves the exact hulls and counts; an L5 attributed inbound warning
can also expose that roster through the defender's private warning channel.

Radar's clockless contact perimeter and timed-warning perimeter are provisionally merged at the
ranges above. L4 adds rough size; L5 adds craft kind on ordinary contacts and exact origin and
composition on an attributed inbound warning. Splitting the two tables later restores D9's
narrower warning window without changing the contact model.

**A radar is a circle, not a countdown (D49).** The warning fires when a hostile fleet crosses
inside its reach, so how much notice it buys depends on how fast that fleet chose to travel: a
Bulwark siege fleet is telegraphed and a Wasp strike is not. A long flight can never give away
its whole duration, because notice is `oneWay × range / distance`.

**The Radar warning is the highest-value ten lines of code in the project.** "Incoming fleet · ETA 9
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

**One true sphere**, radius 2000 and therefore a maximum point-to-point crossing of 4000. Every
gameplay coordinate — not merely its horizontal projection — lies inside that sphere. The three
painted galactic clouds are presentation planes, not collision or placement boundaries. The layout
is **deterministic from the season seed**, so the client regenerates it instead of downloading it.

The larger radius is also a larger navigable scene. The client keeps the established conversion of
50 game units per rendered world unit; it must not raise that divisor with the gameplay radius and
compress 351 worlds back into the old 50-player picture. At the widest camera distance the whole
sphere remains available as an overview, while ordinary play opens on a readable neighbourhood.

At most two galaxies of 300 commander seats, filled strictly in order (D99/D100). A v2 season also contains
51 neutral worlds: thirty T1, fifteen T2 and six T3. The sphere radius and travel rules do not scale with
population; the denser neighbourhood is an explicit consequence of the 300-player world, not a
hidden balance adjustment.

The population is spread through the whole sphere, not filled from one neighbourhood outwards. Capital
addresses use the seeded Poisson layout and each arriving commander takes the address furthest from
the commanders already present. Neutral placement is stratified as well: T1 worlds cover the playable
sphere by equal-volume radial strata, T2 worlds occupy an evenly distributed middle shell, and the six
T3 worlds share the contested central shell. Every tier spans all three axes; a flat ring is invalid.

```
travelExact = (distance / slowestShipSpeed) × 1.2
```

**Distance and speed, and nothing else (D121).** There used to be a flat launch overhead added
to the front of every leg — a minute for warships, a smaller figure for drills, and a third one
about to be added for probes, each with its own travel function. It read as 8% of a raid, which
is to say it read as nothing, and as 86% of a probe, where three speed increases in a row could
not touch it because no speed divides a constant. The mining lead it was defending survived
without it: a rock moves for the whole flight, which is what makes interception a solve rather
than a straight line. One model, one dial.

The mission lands at that continuous instant. A whole-minute ETA is a display
quote rounded at the edge, never the time stored on the mission (D83).

Distance is the real map boundary — no artificial range cap is needed, because a cross-galaxy
round trip in Bulwarks already costs two hours of being undefended.

**There is no development band any more (D127).** D49 limited attacks to ±2 tiers and kept tier
public so the rule could be read off the map before a fleet was packed; with development private
the band could only become a refusal at the gate, which is the failure D49 replaced a wealth
ratio for. What protects a small commander now is that nobody can SEE they are small — and
`ABUSE.bashLimit`, which is the whole of the anti-farming machinery.

**Asteroids orbit analytically** — position is a pure function of the clock, never stored,
never simulated. A rock carries a level that sets its ore, and interception is solved in
continuous time so a craft and its rock arrive together. **First to arrive takes what it can
carry**, which is the whole decision: which rock, and when.

Asteroid ore currently rolls a 17.5–45.5% Crystal share, 30% below the former band; the remainder
stays Alloy, so the change alters the resource mix without deleting ore. Separately, every hull
whose recipe contains Crystal pays 15% more Crystal than its ordinary tempo-scaled recipe. Hulls
with no Crystal requirement remain unchanged.

**The field is local opportunity, not a downloadable target list (D143).** A rock becomes known
when its real 3D orbit first passes through the 750-unit neighbourhood of any controlled world;
an effective Telescope enlarges that sphere. The sighting stays on the commander's map until the
rock is gone, but a later Telescope upgrade cannot claim crossings that happened earlier. The
schedule and raw indexes never reach the browser, so direct API automation has no unseen target
list to enumerate. Once two commanders have independently found the same rock, the ordinary public
race and visible mining route begin for both of them.

**A laden craft flies home at a third of the speed it went out (D117).** The trip out is a
race and stays one; the trip back is the price of having won it. What it costs is a flight
bay held three times as long and a craft on the disc, in the open, for the whole of it — so
"which rock, and when" now also asks how long you are willing to be committed. It does not
lower how much ore the galaxy takes out: the field is the bottleneck, not the round trip, and
the same rocks are emptied either way. Salvage runs pay the same price.

**Mined ore comes home into the works, not into storage (D31)** — so a miner collects like
everyone else, their haul is raidable at half rate with no vault cover, and what they can
absorb is set by the size of their planet rather than by how many craft they own. Mining is a
supplement and a race; it was briefly a risk-free living.

**What moves on the disc is public to those whose sensors cover it; where it is going is not
(D24, D123).** Radar detects a moving question mark and may add rough size/kind on its upper
rungs. Telescope is actual sight: an identified fleet can be tapped to read its exact hulls
and counts, and the formation shows the same information through real hull assets and count
pips. Owner, origin and destination remain hidden. Mining runs expose their route only after
their target has been discovered, so a route cannot reveal a hidden rock.

## Clans — five seats, useful cooperation, no diplomacy game

A clan is a five-commander seasonal team inside one galaxy. Founding one is a late-opening
commitment rather than a free menu action: the capital must have Command Core 7 and burns
5,000 Alloy plus 3,000 Crystal. A 12-hour adaptation period makes recruitment legible and
closes join/leave exploits while still giving the new member their tag, friendly-fire safety
and private chat at once.

The cooperation has three concrete answers to “why join?” First, members can send physical
ship gifts or Hauler resource deliveries with a 10% travel bonus and one aid-only flight bay.
Loaded transports return to their launch world after delivery; empty convoys transfer ownership.
Second,
10% of ordinary PvP loot that safely returns is split into claimable personal shares for the
mature roster snapshotted at launch. Third, both sides' Dominion movement contributes to a
seasonal clan ladder with cosmetic top-three recognition. None changes combat statistics:
information and the counter cycle remain what wins a battle.

Aid is a logistics decision, not a bank transfer. Only Haulers carry resources. A loaded
convoy spends only its delivered cargo against the receiver's rolling per-resource allowance
and returns every hull; an empty convoy gifts its hulls and spends their full build cost. The
receiver opts in, and a convoy whose permissions or destination cease to be valid returns intact.
Membership reveals current clanmate names and world locations, never their Telescope/Radar
spheres, contacts or any development/hardware readings those instruments earned.
The depot is likewise not a leader-owned treasury: every share belongs to a named commander,
is purse-capped against their economy and is manually claimed into their capital.

Clanmates cannot launch Attack, Probe or Death Star missions against each other. Former
clanmates receive a 24-hour ceasefire, while missions already in the air always finish. The
normal personal three-attacks-per-target limit remains; a current clan also has a five-launch
aggregate limit per target commander per 12 hours. Both are launch commitments, so changing
worlds or membership cannot erase them.

The social surface is deliberately bounded: applications and invitations expire in 24 hours,
only the leader manages seats, and clan chat is seasonal plain text with no direct messages or
attachments. There are no clan levels, officers, technology, shared radar, diplomacy, wars or
resource prizes. The system creates five-person stories without creating a parallel strategy
game a three-person studio would have to operate.

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

**Thirteen notifications, and the list is closed.** Seven from the single-world game —
`incoming fleet` · `raided` · `raid result` · `fleet returned` · `scan detected` ·
`probe report` · `unlock` — and six D97 added with colonies and the Death Star:
`strategic incoming` · `death star result` · `colony captured` · `colony lost` ·
`settlement success` · `settlement lost`.

The test for admitting one: **it reports something that happened TO YOU, that you could not
have predicted, and that you can act on.** Nothing else passes it.

**And every one of them is a door (D121).** A notification names the surface that deals with
it, and where that surface holds more than one list it names the list too — "you were raided"
opens the Intel centre ON the battle reports, not beside them. A kind with no destination is
silent by construction: the row renders and the tap does nothing, which is how five of the six
D97 kinds shipped. The list above is asserted against the server's own enum, and the client's
routing table is asserted against the same list.

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
