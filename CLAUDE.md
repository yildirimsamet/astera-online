# CLAUDE.md — Astera Online

Operating manual for a cold agent. Read it first, every session. Detail lives in `docs/`.

> **Keep this file small.** It is loaded into every session. Add a line only if a cold
> agent would get the work wrong without it. Delete a line the moment it stops being true.
> Rationale, measurements and history belong in `docs/`, never here. The same rule governs
> `docs/`: a living reference, not an archive.

## The product

A fast, **mobile-first multiplayer space game**, built by a three-person team and growing
toward medium-to-large scope, that makes a player think *"I wonder what happened"* after
they close it.

Each commander controls one protected capital and may win up to three colonies in a galaxy
of up to 300 real people. Nobody can see what anyone else holds. **Everything either side does
about that is the game.**

> **The fleet is the bet. The information is the game. The planet is the stake.**

**Design north star: simple to play, deep under the surface.** Depth comes from how few
systems *interact*, never from adding more. If you are about to add complexity to create
depth, strengthen a relationship between existing systems instead.

**Feel north star: fun, utopian, epic — a NASA photograph you can fly around in, and one
that is happening RIGHT NOW.** This is a requirement, not decoration, and every task is
judged against it as well as against correctness. Three tests, in order:

1. **Is it alive?** Things are happening to other people while you watch — fleets crossing,
   drills racing for a rock, a raid landing on a world you have nothing to do with. A disc
   where nothing moves has failed even when every number on it is right.
2. **Is it happening NOW?** Anything with a moment attached happens at that moment, on
   screen, for everybody at once. **Waiting is the enemy**: a state that has not arrived, a
   craft parked on its destination, a spinner where a decision should be, a squadron
   hanging over a world with nothing left to do. Solve it the cleanest way — predict and
   reconcile, wake on the instant the payload already names, publish the moment — never by
   making the player wait for a round trip.
3. **Is it beautiful?** Scale, depth and light. A world is a world, not a dot; a raid is a
   bombardment, not a status change. If a moment would be more magnificent and it costs the
   loop nothing, make it more magnificent.

None of this relaxes the principles below: the server is still the only authority, the fog
is still enforced in the query, and it is never a licence to add systems.
**Simple implementation, magnificent presentation.** Detail: `docs/product-vision.md`.

Nine emotions are gameplay requirements, not marketing: `OWNERSHIP` · `CURIOSITY` ·
`COMPETITION` · `AMBITION` · `RISK` · `OPPORTUNITY` · `RE-ENGAGEMENT` · `MEMORABILITY` ·
`FUN`. Every system serves at least one; the strong ones serve several.

## The loop

```
DEVELOP → ACCUMULATE → GATHER INTEL → SPOT OPPORTUNITY → CHOOSE TARGET
   → TAKE RISK → DISPATCH → WAIT OFFLINE → OUTCOME → GAIN / LOSS → NEW DECISION
```

Step 9 feeds step 3: the battle report is the most accurate intel in the game. Economy and
buildings are *infrastructure* for this loop, not the loop. If they become the main
activity, the product has regressed.

## Non-negotiable principles

1. **The client never decides an outcome.** It renders and sends intent.
2. **Ordinary raids never damage buildings.** Death Star strikes are the D97/D98 exception:
   they lower only the named levels on any enemy world. A capital can be devastated but
   never captured; only a non-capital can transfer control on a second hit.
3. **A launched fleet cannot be recalled.** Commitment must be irreversible or risk is theatre.
4. **Watching is silent; probing is loud.** You are never told who is watching you; you
   *are* told when someone probed you. That asymmetry produces the dread.
5. **Information has a price and a cost of use.** The cost of knowing is being known.
6. **Every session must end with something in flight.** Nothing pending = no reason to return.
   **NEEDS RE-DERIVING SINCE D63.** Flights are now shorter than a session — a raid
   is twelve minutes round trip — so this law has no long clock left to hang on. The
   game is real-time by owner decision; what replaces the return hook is open.
7. **Combat stays simple on purpose.** It is the resolution mechanic; skill lives in the
   information layer. This is the scope trade that pays for everything else.
8. **Low combat variance (±8%).** If randomness dominates, intel is worthless.
9. **A moment worth animating is worth everybody seeing.** The fog is about what you KNOW
   before a decision, never about hiding the world from the people living in it. A battle
   only its attacker can watch is a database transaction with sound effects (D52).
10. **The world is live, and the interface never makes anyone wait for it.** Anything with
    a moment attached happens at that moment, on screen, for everybody at once. Predict and
    reconcile; wake on the instant the payload already names; **broadcast what happens in the
    galaxy** (D53). A poll is a safety net under a live channel, never the mechanism. Never a
    spinner where a decision should be, and never two round trips for one tap.

## Source of truth

When two disagree, the higher wins: **locked product constraints** (mobile-first portrait,
three-person team, medium-to-large product trajectory, web first, **real-time persistent world**
(async retired at D63), one commander with a capital and up to three colonies,
server-authoritative) → `docs/game-design.md`
→ `docs/decisions.md` → the code → anything
marked `PROVISIONAL` → agent preference (lowest).

**If the code disagrees with the design, the code is not automatically right.** Find out
which decision is authoritative. If the change is correct, update the doc *first*.

## Invariants — do not break these

Each was paid for in iteration. `docs/decisions.md` holds the evidence.

**Score and balance**

| Rule | Why |
|---|---|
| Score is Dominion, not net worth | Wealth ladders reward passive play — builders finished at 2.1× raiders' net worth |
| Wreckage is Wealth, never Dominion | Dominion is zero-sum and only combat makes it; debris was taken from nobody |
| One battle transfers at most 10,000 Dominion | `round(10,000 × tanh(raw exchange / 10,000))` stays near-linear for small fights but one late fleet cannot erase a season; both sides receive exact opposites |
| `protectedHoursPerVault / capHoursPerVault < 0.5` | At most half a store is ever safe. Above it the vault protects everything and all PvP silently dies. This replaced `vaultMult < alloyMult`; both guard the same failure |
| `upgradeCost(L).alloy < storageCap(L, vault)` | If one upgrade costs more than a full store holds, the player cannot buy it and progression stops with nothing on screen to explain why. The pre-v2 curves crossed at L10 — this shipped |
| `SATELLITES.FOUNDRY.production` stays 1.06 | It compounds twice; at 1.08 TURTLE tops every gate seed |
| The hull table is priced on `atk · hp / value²` | Equal-budget power when damage is spread across a force. Attack-per-resource is the quantity that made the old Bulwark lose every equal-budget matchup, including against the Lance it counters. A tech tier buys ~15%; the counter cycle buys 156% |
| `START` is arithmetic | Exactly Core + Refinery + Extractor to L2 plus two Wasps. A test enforces it, and the REHEARSAL still runs on it — a beat says the crystal is gone exactly, and that has to stay true |
| **A planet is created with `PLANET_START` = `START` + `OPENING_BONUS`** | Owner decision D58, overriding "do not enlarge the opening grant". Granted once, at planet creation. The opening spends `START`; the cushion is what a commander finds when onboarding ends, instead of nothing to press. **It cost the central claim on one seed of five** — see below |
| `untouched()` compares against `PLANET_START`, never `START` | It is the claim's idempotency guard. Reading the wrong one makes every fresh planet look already-played, so the replay is skipped and all five rehearsal decisions are silently discarded |
| `DEBRIS.share` < 1 | Or a field is worth more than the fleets that died for it |
| **The vault floor is HOURS of each resource's own production** | One flat alloy figure was charged against crystal too, and crystal was unraidable for the whole opening — 13 of 26 live raids took nothing. Pricing the floor in hours makes that unrepresentable. `openingFloorAlloy` is the one flat term, it binds only on a very young world, and removing it cost `TI` and the informed archetype |
| A constant priced in another constant moves with it | `DEBRIS.minimum` and `START.alloy` are denominated in ship value; `DEBRIS.decayMinutes` in typical legs; build time in resources. Move one and the others follow, or a test fails somewhere unrelated |
| **Never widen a health band to admit a feature** | `ARR` was out of band through the whole v2 pass. Five constant-level levers were tried and none moved it; what did was modelling the build queue in the simulator. The bands did not move |
| Two levers are proven inert | The loot dial and `COMBAT.defenceSalvage`. What a loss COSTS cannot fix what an attack ACHIEVES |

**Combat and defence**

| Rule | Why |
|---|---|
| Support hulls are shielded while combat hulls live | Otherwise Haulers die in round 1 and raiding cannot pay for itself |
| Ground defence is durable (60% salvage) | Consumable defence made 95% of attacks DECISIVE |
| Two ground guns in opposite classes; the cheapest buildable at Shipyard 0 | One gun makes defence a binary. Both branches were measured and failed |
| Ground hulls leave no wreckage | They already have 60% salvage; counting twice makes a fortress profit from being attacked |
| A raid lands at `arriveAt` and settles ten seconds later | `COMBAT.engagementSeconds` is a real server window; the mission stays `in_flight` throughout |
| **A Death Star HALVES; it never empties** | Zeroing a stale row and zeroing a current one give the same answer, so the old strike never had to care that production is lazy. Halving does: half of a figure one tick old is less than half of what is there, silently. Both kinds of world are advanced to `now` first — an owned one through `loadLocked`, a neutral through `advanceNeutralEconomy`, which nothing else on that path was calling. Composing is the point: a second impact takes half of what is LEFT (D113) |
| **A strike lowers the CORE, and nothing else except what the Core drags with it** | Every non-CORE building is bound by `CORE_CEILING`, so a Core that has just fallen leaves anything on the old ceiling one level above a limit `build.ts` will not sell. Those are clamped; a building two levels under it loses nothing. Aegis is the one instrument touched directly, by two, because it is what would blunt the next one (D113) |
| **A bombardment burns the scaffolding, and refunds nothing** | `cancelBuildOrder` returns half because cancelling is the player's own change of mind; a rocket landing on the site is not that. It is also the fix for a real hole: `applyOrderEffect` raises a building to `before + 1` without re-reading the Core, so an order placed at Core 12 could complete after a strike left Core 11 and stand where nothing could have built it. BUILDING orders only — instruments are effective-capped already, satellites are slot-gated, research has no level, hulls are in the other queue (D113) |
| **A fleet that reaches its target ALWAYS fires** — win, lose or be annihilated | The ten seconds are the payoff of a decision made forty minutes ago. A squadron that arrives and vanishes without a shot is the loop's one visible reward, deleted |

**Information**

| Rule | Why |
|---|---|
| Telescope reads are seeded per `(watchId, timeWindow)` | Otherwise pull-to-refresh defeats the entire fog layer |
| An instrument stops where its own effect table stops | `INSTRUMENT_MAX_LEVEL` is DERIVED from table length; no upgrade row may show an unchanged before-and-after |
| Radar is a RADIUS, not a countdown (D49) | It warns when a fleet crosses inside `radarRange`, so a slow fleet is telegraphed and a fast one is not — and a long flight never gives away all of itself |
| The defender's radar level is read when the warning FIRES | Frozen at launch it was wrong in both directions |
| Instruments and satellites are two different things (D25) | Four levelled INSTRUMENTS on the ground; four SATELLITES in orbit, each taking a slot |
| The Command Core opens orbit slots at 1, 3, 5 and 9 | Which one, two or three you run is who you are |
| The Uplink gates the Telescope and the Radar, and nothing else gates anything | The one prerequisite in the system. What it costs is the SLOT |
| A contact carries a bearing window, never a route | Position is public; intent is not. Mining and salvage runs are the stated exception — and so is a raid that has ALREADY LANDED (D52), for the ten seconds it is standing on the world |
| **A window says whether it is a heading or an arrival** | The client coasts past a heading so nothing freezes on a late read, and must NOT coast past a destination or it flies the craft through the world. `landing` is set only where the window is clamped to the arrival — the last minute, where the end point already IS the destination (D72) |
| Traffic excludes what you OWN, not what is aimed at you | Otherwise the one commander a raid is aimed at is the only one who cannot see it |
| **Whose leg it is has ONE definition, and three surfaces read it** | `legBelongsTo`: an outbound leg belongs to its origin, a return leg to its target. `pendingThreads` wrote its own version and special-cased only an inbound attack — so a probe flying at you, a probe flying home from you and a raider's survivors leaving your orbit all arrived as YOUR craft, with a route line and the other world's NAME on them. The same missions are in `traffic` too, so each was drawn twice on one disc (D72) |

**The world, and the worker that runs it**

| Rule | Why |
|---|---|
| You may attack within ±2 development tiers (D49) | `coreTier` is public on every world, so the rule is readable off the map before a fleet is packed. The band stays DEFINED on the tier even though the exact level is public now (D119) — the three-level bucket is the rule, not a limit on what the client could see |
| **A world wears its Core: a dyson ring from level 9, one more every three levels, four at most, red at 21** | One asset drawn one to four times at equal angles, so development reads as a project EXTENDED rather than replaced, and the colour eases across the whole reachable range. It starts at 9 so a ring means a commander who has built something, and ends at 21 because that is where the economy ends — no neutral world wears one, since the three tiers seed at Core 2, 5 and 8. **It publishes the exact Core level** — the ladder cannot be drawn from a three-level tier — so a probe's development reading is confirmation rather than news; the fleet, the guns, the shield and the stores are still private and are what decide a raid (D119) |
| **A shell is sized off the structure's inner SURFACE, never its nearest vertex** | The ring's inward spar tips reach 0.36 of its radius while the structure sits at 0.51; sizing on the tips inflated it 42% and pushed the visible band out to two world radii. A spar inside the world's radius is correct — a world is a billboard, not a sphere, so there is no volume to pierce and the far half is masked by its depth write (D119) |
| One account, one commander, one galaxy; galaxies fill strictly in order | The commander is one `players` row; D97 permits one capital and up to three colonies under it. The account/galaxy constraint remains database-enforced. |
| `/api/season` derives the galaxy from the caller, never from config | It carries the seed the client rebuilds the whole disc from |
| **Everything is built in one of two queues, three orders deep** | CONSTRUCTION takes buildings, instruments, satellites and research; YARD takes hulls. Cost is committed at order, cancel returns half, a system fault returns all. Gates read the projected state of the SAME queue only — the two run in parallel, so neither is ahead of the other (D4) |
| A ground gun finishes inside the narrowest radar warning it sells | That is the surviving half of the old instant-construction rule: 45 s against 2.0 min. Break it and the radar stops selling the window to arm |
| A planet owns at most two Prospectors, counted wherever they are | Otherwise mining scales with wealth instead of with the which-rock-and-when decision |
| **A flight is distance and speed, and nothing is added to it** | Three launch-overhead constants and three travel functions existed to charge a flat minute per leg. It read as 8% of a raid — invisible — and as 86% of a probe, where three speed increases in a row could not touch it because no speed divides a constant. The mining lead it was defending survived without it: the rock moves for the whole flight, which is what makes interception a solve. `travelExact` is the one model and `TRAVEL.distanceFactor` is the one dial (D121) |
| Mined ore lands in the WORKS, never in storage | Risk-free banked income decoupled from war is what emptied OGame's PvP |
| A Prospector outruns the rocks it hunts | It has to aim ahead of a moving target, so its speed is tied to the asteroid band and not to warship speed. It no longer has a launch overhead of its own — nothing does (D121) — and the lead survived it, because the rock moves for the whole flight and not just the launch |
| A flight bay is counted under the planet row lock | Check-then-act outside the lock lets two racing launches see the same free bay |
| An outbound leg belongs to its origin; a return leg to its target | Return legs are stored with the two SWAPPED |
| Every notification is idempotent by `(player_id, kind, ref_id)` | A worker killed between COMMIT and `complete()` has its event redelivered |
| **A shard broadcast fires exactly when the public payload it points at has changed** | It carries a shard id and a kind and nothing else, so it can only ever say "go and read what you were already entitled to". Publish on anything else and it becomes a timing signal for a fact the fog hides — which is why a Core crossing a tier publishes and a Refinery does not, and why `raiseInstrument` never does (D53) |
| **A caretaker world has nobody to tell, and that is not a reason to tell nobody** | `resolveNeutralBattle` wrote a battle report and sent no notification, so with 51 neutral worlds on the disc and the whole colonisation path running through raiding them, most of the early game resolved with no badge, no row in Signals and no way in to the report. It sends the raider the same `raid_result` a PvP raid does (D121a) |
| **A battle report says WHICH of your worlds it was** | With one world per commander it was implicit; D97 gave them up to four and "Raided by Sable" stopped naming the world that was hit — the most actionable fact there is, missing from the record of it. The defender's is the target; the attacker's is the mission origin, which is why the launch rows are read (D121a) |
| **A report names the world that was FOUGHT OVER, never the owner's capital** | The opponent lookup joins on `kind = 'CAPITAL'` because that is how a commander is identified — right for the defender's copy, wrong for the attacker's since D97: raid a colony and the report said their capital did not hold. `opponentPlanetId` is also what the dossier matches on, so a fleet killed at a colony was filed as a floor on the capital (D121a) |
| A raid tells BOTH sides, even when nothing comes back | An annihilated fleet used to produce no notification at all |
| **A clan is five seats, one galaxy, one season — and it cannot become a second game** | Friendly fire, a 24-hour ceasefire on separation, a receiver-bounded aid convoy, a tenth of docked raid loot as personal shares, and a score that is an audit of its members' PvP. No treasury, no buffs, no levels, no diplomacy (D114) |
| **A record of what happened is written from an IMMUTABLE snapshot, never from a live quota** | `attack_commitments.quota_clan_id` is rebound for twelve hours after launch so pre-attacking and then joining cannot reset a clan's ceiling — that is the point of it. A battle report reading the same column grew a clan tag on a raid that had already resolved. `attacker_clan_id` and `defender_clan_id` are the two columns a report may read, and nothing writes them twice (D114) |
| **Clan aid goes to somebody ELSE** | `sender.clanId === recipient.clanId` is trivially true when the two are one commander, so a solo founder — mature the instant the clan exists — could aim a convoy at their own world, collect the ×1.10 speed and the aid-only bay, and walk past `launchTransfer`'s `SELF_TRANSFER`. The guard is in `assertAidRelationship`, which both the quote and the launch pass through |
| **An aid quote publishes what is LEFT, never the ceiling it came from** | The allowance is four hours of the receiver's nominal Alloy and Crystal and a fifth of their Deuterium capacity — so `allowance / 4` is their aggregate Refinery, Extractor and Vault standing, which is what a probe is sold for. `remaining` is the only figure the interface ever wanted (D114) |
| **A player-private event names its own reads, exactly as a shard event does** | `private:clan-*` is a narrow invalidation only if something reads the prefix. Nothing did, so every clan chat message sent five clients through the full twenty-two-read resync — the same fan-out `readsForShardEvent` exists to prevent, arriving through the other door. An unknown private kind still falls back to the resync, because it did happen to this commander (D114) |
| `announceUnlocks` is the only writer of `unlocksSeen` | Two writers means whichever runs first eats the other's news |
| Every safety net reads the EVENT, so a flight whose event row is gone is invisible to all of them | `abandon()` releases a failed event's hold; `sweepStranded` releases the ones with no event at all; `/health` reports both |
| Housekeeping may never stop the event queue | One throw inside the stranded sweep took the whole queue down |
| The server refuses to run against a database it is ahead of | `assertSchemaCurrent` at boot. Checked, never auto-applied — N replicas racing the same DDL is worse |

**Client**

| Rule | Why |
|---|---|
| **Type is eight steps and each one is a ROLE** | `hero · readout · figure · title · body · caption · label · micro`. The scale existed before D109 and was ignored: 346 hand-written `text-[Npx]` in eighteen sizes against nineteen uses of the tokens, and one heading level rendered at 11, 13, 18 or 21px depending on the file. `text-[`, `tracking-[` and `rounded-[` are refused by ESLint now, because a convention that is only documented decays back to whatever each author types |
| **Uppercase is `.legend`, `.name` or `.headline` — nothing else** | Forty-eight hand-built recipes stood beside `.legend`. A caption, a name and a section heading are three things; anything else that shouts is a fourth that should not exist. An empty state is a sentence, so it takes none of them |
| **One card word: `.plate`, with four states** | raised · `flush` · `inset` · `sunk`. `frame`, `panel` and `group` were three materials for one idea at seventeen, seventeen and nine uses, split by which year a screen was written in. `.group` was also Tailwind's `group-hover:` marker, so every purchasable row drew an unintended card and a second inset ring (D109) |
| **A border COLOUR on a box-shadow shape draws nothing** | `.plate`, `.slab` and their kin build their edge from `box-shadow` and carry no border width, so `border-alert/50` is dropped in silence. Eight of them shipped — including the only thing distinguishing an error toast from an informational one |
| **A negative margin means the padding is one level too high** | The planet screen was padded by the sheet, un-padded by a `-mx-4` in `GalaxyView` and re-padded by its own root: three declarations, net zero, no owner. `Sheet`'s `bleed` hands the inset to the caller, and fourteen of these are gone (D109) |
| **Spacing is `4 · 8 · 12 · 16 · 24 · 32`, and rhythm comes from `gap`** | Each step is a relationship — inside a control, between rows of a card, a card's inset, a surface edge, between cards, between sections. Margins on the pieces collapse and double; a parent's `gap` cannot |
| **Red on TYPE is `--color-threat-ink`, and a GAP is amber** | `--color-threat` is made for a fill, an edge or a mark; as eleven-pixel type on a near-black plate it falls under 3.5:1, which is how five unofficial reds grew beside it. A system you have not built is not an attack — DEFENCE and SHIELD sat side by side both reading "None", one red and one bone |
| **The page refuses the pinch GESTURE, never the CAPABILITY to magnify** | A pinch is a game control — the disc's canvas asks for `touch-action: none` and OrbitControls owns everything over it — while every surface around it is fixed chrome sized to the viewport, which browser zoom does not scale so much as break. Refused three ways because no one way holds everywhere: `touch-action: pan-x pan-y` on the root, Safari's `gesture*` events, and `wheel` with `ctrlKey`. Locking the scale in the viewport meta is NOT one of them: it removes magnification altogether, and `interface-accessibility.test.tsx` has forbidden those flags since before the pinch was a problem |
| **A control that can MOUNT under a finger answers only a press that began on it** | A synthesised click goes to whatever occupies the point at DISPATCH time, not at press time — so tapping a world opened the planet sheet and the tap's own click, arriving after the sheet had mounted, landed on the scrim now under the finger and closed it. Opening the same sheet from a DOM control never failed, because there the click is consumed by the button that was pressed. It is a race, so a delay only moves it. `useOwnPress` is the answer and it covers the whole class, not the one instance: every dismiss control AND both focus-rail controls, because the rail mounts on the bottom edge where a world can be tapped and the stray click lands on CLEAR. `detail === 0` exempts keyboard activation, which carries no `pointerdown` at all (D109a) |
| **Every world is focused before it is opened** | Capital and colonies use the same first-tap focus as the rest of the disc; only a repeated tap on that already-focused controlled world opens management. The first tap snapshots the previous active world as the source of any transfer to the newly active target. An already-active world focuses with no bottom rail; another controlled target gets a dedicated transfer route, never a hostile dossier with Send tacked onto its end. The active-world dropdown also focuses what it activates, so active Home and camera subject cannot disagree (D118). |
| Every route the client parses is in `apps/server/test/contract.test.ts` | A route whose shape moves answers 200, typechecks, passes both suites and goes dark |
| The client never pre-encodes a request body | `send()` serialises; a second `JSON.stringify` must be a compile error |
| **A mutation answers with the whole planet view, and it must equal what `GET` would say** | Built in the same transaction under the same lock, so it is free and authoritative. A view assembled from the objects the mutation happens to hold drifts, and the interface corrects itself silently on the next refetch (D53) |
| **An optimistic predictor DECLINES whenever the answer is not certain** | A prediction that is only usually right is worse than none: the flicker of a purchase un-happening lands on the one screen the game is played on. Every server guard is re-checked before predicting (D53) |
| **Every payload is identity-stable when nothing changed** | React Query's structural sharing treats a `Date` as a leaf compared by reference, and every schema parses instants with `z.coerce.date()` — so `traffic`, `pending` and `mining` were brand new objects on every read. Every memo below them re-ran, every route buffer was rebuilt, and the camera re-framed itself on data that had not moved (that is D69). One clause in `api/structural.ts`, installed once (D72) |
| **`shareStructure` is `replaceEqualDeep` plus ONE clause, and a test holds it to that** | It replaces the walker for every query in the app, so the property that bounds the risk is not "it handles Dates" but "it is otherwise identical". Writing `Object.is` instead of `===` looked tidier and silently changed the answer for `NaN` and `-0`; the conformance test against the library's own function is what found it (D72) |
| **A geometry lives as long as the craft, and is disposed with it** | Replacing a `geometry` prop drops the old buffer on the floor — nothing unmounted, so nothing freed it. Both ends of every route are written each frame anyway, so it never needed rebuilding: `useLine` allocates one and disposes it (D72) |
| **A reconnection is a resync** | The stream has no cursor and no backlog, so everything that happened while the socket was down was never delivered. Every open after the first re-reads the live set; the first is exempt because the queries have only just fetched (D72) |
| **A write cancels the reads it is about to overrule** | `useArrivals` invalidates `planet` and `pending` on every due arrival, so a launch pressed in that second had its new fleet overwritten by a list that predates it — the squadron appeared and blinked out. `useOptimisticPlanet` already cancelled on the way in; the way out did not (D72) |
| **Anything that renders the disc takes stable props** | `GalaxyView` holds a clock, so it re-renders on a timer whether or not the galaxy moved. An array built with `.map` in the JSX rebuilt the watch beams' GPU buffer every tick (D53) |
| The client parses a notification `kind` as a string, never an enum | One unknown value would erase the player's whole history instead of one line |
| Both sides of a raid read the same `arriveAt` | Rebuilding it from a rounded figure put them thirty seconds apart |
| **Every countdown comes off `arriveAt`, never off `minutesRemaining`** | The payload figure is rounded and up to a poll old. Two surfaces reading different ones put two disagreeing clocks for one fleet on screen at once (D51) |
| A stale payload is a craft PARKED on its destination, not a missing one | Every leg interpolates and CLAMPS. Wake on the instant the payload already names — and keep asking until the world has actually moved on (D52), because the resolving event lands on the worker's next tick |
| **One craft, one leg: the owner's picture and a stranger's are computed from ONE definition** | They were two — the owner stopped short of a world (D44) and the public window published the physical position — and both were right about their own inputs while disagreeing by more than a planet at the arrival. The visual leg lives in `packages/rules/src/view.ts`; the server publishes windows on it, the client draws its own craft along it, and `apps/server/test/one-galaxy.test.ts` walks both pictures second by second (D106) |
| **An effect everybody watches is a PUBLISHED moment and place, never one inferred from a flight** | A raid publishes `engagement`; a Death Star published nothing, so its detonation existed only on the attacker's client — the one payload it could be derived from, including for the commander it happened to. `impact` is the same shape and the same rule (D106) |
| **A Death Star does not survive its own strike** | The weapon IS the explosion. It hovered for eight seconds because both payloads legitimately still described it — the mission resolves on the worker's next tick, and the resolved mission is republished to carry the effect (D105). `useStrikeConsumed` is what those payloads MEAN (D106) |
| **A coast is a bridge over a late read, not a substitute for one** | It was half a window again, and a window is at least a minute — so a failed refetch drew a craft up to thirty seconds of flight past the truth. Harmless while it is still flying, because a coast runs at the true speed; the damage is past the arrival, where the real craft has stopped and the guess flies through the world (D106) |
| **Everything that moves reads `serverNow()`, never `Date.now()`** | The disc is drawn by comparing server timestamps against "now". A drifted phone drew every fleet at the wrong point of its leg, silently, and differently from everyone else's (D52) |
| `traffic`, `mining`, `pending` and `galaxy` need a timer as well as events | The stream fires only for what happens TO YOU — and a neighbour's world growing, re-arming or letting its fleet out is never about you (D51) |
| **`season` is the one read where the TIMER IS THE MECHANISM** | Presence has no moment to broadcast: `lastActiveAt` is stamped at most once a minute and `online` is a five-minute trailing window, so the figure DRIFTS rather than changing. A `staleTime` with no `refetchInterval` is not a refetch — the population in the corner of the disc was read once on mount and frozen for the life of the tab (D104) |
| **A craft clears the worlds its leg actually owns without ever pausing** | Surface/orbit clearance is baked into BOTH endpoints before interpolation; no per-frame world clamp may flatten motion or bend a leg around an unrelated map marker (D120) |
| **A world's atmosphere limb stays inside the selection ring** | Every world has a limb and exactly one has a ring. A limb that reached as far would make the marker read against a bright band instead of against space (D53a) |
| **A failed read is never drawn as a slow one** | `isPending` goes false on error while `data` stays undefined, so `isPending \|\| !data` pulses forever at a request that gave up — and on the reports list it announced an empty season (D53a) |
| The cover comes off when the disc is BUILT, not when the bytes land | Models still have to parse, compile and upload; `FirstFrame` reports the first real frame |
| Nothing on the way in blocks the player | A loading screen is an OVERLAY over a page that is already loading, never a gate in front of one |
| Every card carries a two-or-three-word tag, separate from its role sentence | The role argues a decision; the tag answers "what IS this" for someone scanning fourteen cards |
| **Background audio is a lifecycle problem, not a playback one** | Autoplay is refused on every cold tab; `pause()` rejects a pending `play()` with `AbortError`; and a teardown that only pauses leaves the media fetch and the decoder alive, which StrictMode's double mount turns into two tracks at once (D66) |
| **A control names the surface it opens** | A permanent way in is not enough. The commander sheet — the account, the galaxy, sign-out — hung off a header button that said SEASON and drew a duration, so it read as a clock and produced "there is no logout button" (D54) |
| **Galactic scenery carries no lines; ownership is the one semantic exception** | The graph-paper quality came from strokes being strokes, not from their brightness (D53b). D122 adds only faint curved white ownership filaments above that painted plane: always for your worlds, temporarily for the commander of a selected foreign world. Telescope watches draw no tether. |
| **A squadron's tap target grows with its drawn formation, but never covers all of it** | A fixed sphere made a 500-ship fleet selectable only at its lead craft. The radius now grows sublinearly with marker count, preserving a forgiving centre without turning the whole formation into an invisible wall (D122). |
| **No user-facing string is written in a component** | Every one lives in `apps/web/src/i18n/locales/`, one section per surface, and NOTHING is shared between surfaces — two controls that read the same today are two controls (D55) |
| **The Turkish is written in Turkish, not converted from the English** | Finish the sentence, verb over nominalisation, semicolon instead of the English dash, and the phrase that does the same job rather than the dictionary equivalent. The rules are at the top of `locales/tr/entry.ts`; the first attempt ignored them and read like a book translation |
| A refusal travels as a CODE plus its figures, never as a finished sentence | "All 4 flight bays are in use" cannot be translated after the fact. `GameError` carries `params`; named things travel as IDs and are resolved on the client (D55) |
| Numbers, dates and clocks go through `format.ts` and `time.ts` | `1.234.567` against `1,234,567`, `%40` against `40%`. `toFixed` is hard-wired to a full stop and put an English decimal inside a Turkish suffix |
| **A returning player is never offered onboarding** | Signing out lands on the front door with the sign-in form OPEN, and a device that has held a commander leads with sign-in instead of the rehearsal. The claim dialog asks you to CREATE a commander, so a signed-out player typed a new name and was handed a second account with a second planet in another galaxy — every rule intact, the funnel wrong (D68) |
| **The camera may be moved by an instruction and never by the absence of one** | A followed craft ends the moment it lands; reading that as "nothing is focused" handed the frame to the leash and threw the view across the disc. Losing a subject RELEASES the rig into free-look, and only the player clears it (D69) |
| **Anything that may re-frame the camera is keyed on `focusIdentity`, never on the subject getter** | The getter is a memo over six query results, all fresh arrays on every refetch — so the rig re-framed itself several times a minute while the player sat still (D69) |
| **A visitor plays before an account, and it costs the shard nothing** | `/api/preview` writes NOTHING — no account, no player, no planet and above all **no seat**. Fifty worlds fill strictly in order and that rule is the empty-shard risk's only mitigation; a seat spent on somebody who never came back is spent forever (D56) |
| **The rehearsal produces INTENTS; the server produces outcomes** | It renders the real screens against an `Api` whose `fetch` never leaves the device, and the claim replays what was pressed through the ordinary services. Predicting with `@astera/rules` is what lets the screen keep up with a finger; it is never a decision |
| **A guided beat leaves ONE thing pressable, and the way out is never one of the things locked** | Activations outside the target are cancelled — never pointer or touch events, which would cancel the scroll or the orbit they began. The allowance is a LIST, shallow to deep, because a gated control OPENS a surface; gating only the first seals the player inside the sheet they were told to open (D56) |
| **A rule measured in MINUTES breaks when speeds change; a rule measured in RATIOS does not** | D63 moved hull speeds ×9.46 and nine tests failed at once — none because the thing they tested had broken. `advance(10)` into a flight that was 27 minutes, a radar sweep in tenths of a minute, a lead asserted as `> 12`. Write the share, not the count |
| **An absolute duration stops being a fraction when flights get short** | `BEARING_MINUTES` equalled a whole leg, so a contact's window became a ROUTE and gave away the destination. `LEAD_TOLERANCE` was 77% of Radar L3's lead, so every rung warned at a wider circle than it sold. Both were invisible until the tempo moved (D63) |
| **A claim reopens once it has CLOSED, and is never extended while it is open** | The opener's guard was `claim_until IS NULL` and nothing ever puts an expired claim back to null, so a neutral world nobody reached in time was retired for the season — still raidable, worth nothing to take, and recoverable only by a Death Star landing on it. The other half of the guard is kept exactly: a raid landing inside a live window must not push its end back, or one commander with a spare squadron holds the claim open for ever (D112) |
| **A window that has to contain a flight is DERIVED from that flight** | The public claim window was typed as thirty minutes, which was exactly the widest two-Hauler crossing of a radius-1000 disc. D101 widened the disc 2.5× and listed every constant that took the factor; this one was not on it, so 52% of (capital, neutral) pairs became unsettleable by arithmetic and the six T3 worlds at the centre went out of reach from the rim. `SETTLEMENT_CLAIM_MINUTES` is now computed from `GALAXY_SPAN` and the settlement fleet, and the literal may not be typed back in (D111) |
| **Reward progress is COUNTED off the world, never accumulated into a counter** | Ten of eleven chains read rows the game keeps anyway — missions by kind, runs that arrived, levels standing. A chain added later is retroactive for free, nothing can drift from what it counts, and nothing on the path that produces progress has to be made idempotent (D64) |
| **`planets.builtEver` is the one reward tally that is stored, and it has to be** | A ship does not survive the thing it describes: it dies and its `units` row goes down with it. Every other metric is recoverable from the world; this one is not |
| **A reward id is parsed strictly and stored canonically** | The claim's once-only guarantee is a primary key on the id. `PROBE:1e0` and `PROBE:1:1` both used to resolve to `PROBE:1`, which is three keys for one tier and three payments (D64) |
| **A reward chain declares its SCOPE, and only `account` outlives the galaxy** | The ten counted chains are read off a world that ceases to exist, so they start again with it. The @JoinAstera bonus is one act by one person: it lives in `account_rewards` and NOTHING deletes from that table — not the wipe, not the idle-seat reclaim. Keyed on the player it was re-paid every time a seat turned over (D104) |
| **A reward grants ABOVE the storage cap, and is never clamped** | `OPENING_BONUS` already does this and its docblock says why: nothing clamps stored resources downward, so the grant is never lost. Clamping would make a reward evaporate at the moment it was earned |
| **Nothing about a commander's name is ever case-folded to compare it** | `'İ'.toLowerCase()` is `i` plus a combining dot in JavaScript AND in Postgres, so `lower(name) = lower($1)` cannot find `İhsan`. Compare as written, or fold both sides with the same normaliser that wrote the value (D64a) |
| **Read a file's docblock before editing it** | The 3D surface and its harnesses carry a dozen traps that each cost a bug — orbit standoffs, `lookAt` frames, sprite tinting, plume direction, a screenshot that stalls the frame loop. Every one is written at its own site in `apps/web/src/galaxy/` and `tools/` |

**Production**

| Rule | Why |
|---|---|
| **`VITE_GA_ID` is inlined at BUILD time, so analytics needs a redeploy and not a restart** | The client is a directory of static files with no environment to read. Unset means no tag, no third-party request and no globals — that is the whole opt-out and it is the default (D67) |
| **The client and the API share ONE origin** | `credentials: 'same-origin'`, a `SameSite=Lax` refresh cookie and no CORS anywhere. Moving the API to `api.` ends every session at the first token expiry and makes `x-server-time` unreadable — which drops the disc onto the DEVICE clock and undoes D52 for everybody (D57) |
| **Routes are registered inside `app.after()`** | `register` QUEUES a plugin; routes added synchronously afterwards exist before it does. Registered the obvious way, every per-route rate limit was silently ignored — 200 to an unlimited flood, green typecheck, green tests |
| **A rate-limit refusal is a `GameError`** | Whatever `errorResponseBuilder` returns IS the error the handler receives, and a plain object arrives with no `statusCode` — so the handler cannot tell it from a bug and answers 500 |
| `TRUST_PROXY` is off unless nothing but the proxy can reach the port | Behind nginx `req.ip` is the proxy, so one bucket holds the whole internet and the first burst locks out every player. On a directly reachable server it is a limiter anyone walks past by inventing an address |
| **A seat idle for `SERVERS.idleDays` goes back to the galaxy, and the ACCOUNT survives** | Three hundred commanders of whom most are inert is not a full galaxy, it is an empty one nobody can join. The season presence is reclaimed and the record folds into `accounts.lifetime`; the commander signs back in and joins whatever is open (D70/D99) |
| **The reclaim sweep NEVER touches a world with anything in the air that names it** | Including a raid an active player launched at it thirty seconds ago. Deleting a mission out from under a live fleet stranded a real player's ships on this database once; an idle world is deferred to a later sweep instead (D70) |
| **The seat ceiling is the empty-shard mitigation** | `/api/onboarding/claim` is unauthenticated and takes one of 300 seats, filled strictly in order. Unlimited, a script spends the frontier in seconds (D99) |
| Migrations run BEFORE the new image serves | The server refuses to start against a database it is ahead of (D47), and that refusal is the good outcome. The reverse order answers every request and fails every worker tick |
| **`/health` reports; it never restarts anything** | Every 503 it produces describes state a restart would clear without fixing — and clearing it destroys the only evidence |
| `docker-compose.yml` is NOT the production file | It is tmpfs and its password is the word "astera". `docker-compose.prod.yml` is the one with a volume |

**Engineering**

| Rule | Why |
|---|---|
| `packages/rules` has zero deps, no clock, no I/O, no ambient randomness | It is the single source of truth for server, simulator and client. ESLint enforces it; CI fails if broken |
| **What belongs in `rules` is not "is it game logic" but "must two processes agree on it"** | The visual leg is drawing geometry and it lives there (D106), because the server publishes a point the client has to draw in the same place it draws its own. A colour or a camera angle is one process's business and stays in the client |
| The simulator must not price what it refuses to simulate | Charging for an unmodelled benefit drains the galaxy's military |
| An interception is solved in continuous time | `travelExact`, not `travelMinutes` — a rock does not wait at a whole minute |
| Two-planet operations lock in ascending id order | Otherwise mutual raids deadlock |

## How to work

Default behaviour is **move the project forward**: `IMPLEMENT → TEST → PLAY → EVALUATE →
FIX → CONTINUE`.

**Decide yourself:** architecture, folder structure, libraries, queries, caching, component
design, internal APIs, test design, small UX details.

**Ask only when** a change alters the core loop, risk/reward, the PvP model, ownership,
season structure, progression, the game's identity, or a locked constraint.

**Never:** re-research settled questions, keep improving the design docs, wait for every
uncertainty before building, or redesign a working system because something better might
exist. Small, low-risk and reversible → pick the simplest option and move.

**When context is lost:** this file → `docs/decisions.md` → `docs/balance.md` → the code →
`git log`. Never re-invent lost context by guessing.

### Change discipline

> **Change what was asked for. Nothing else.**

If the task is "fix the shortfall label", the shortfall label changes and nothing else
does — not the neighbouring row, not a colour you noticed on the way past, not a refactor
that would have been nice.

Sometimes a change genuinely forces another. That is allowed, never silently:

1. Say it in the report — one line on what else moved and why it had to.
2. Write it down: `docs/decisions.md` for a rule, a comment at the site for a number.
3. Prove it was forced — a measurement, a failing test, a simulator run. Not an opinion.

If you cannot do all three, it was not forced. Leave it alone and mention it.

**Docs change in the same pass as the code.** A locked behaviour changes → update the
invariants table and add a decision. A system is retired → delete its rows and its prose. A
stale doc is worse than no doc, because the next reader trusts it.

### Anti-scope-creep

- Before adding anything: *"which core-loop problem does this solve?"* No answer → out.
- Never weaken core gameplay because it is hard to build. Ask instead: what is the simplest
  version that preserves the intended gameplay?
- **Simple implementation ≠ simplified gameplay.** Prefer the first.
- Cut order if behind: asteroids → Radar L4–L5 → Aegis → cosmetics. **Never cut any part of
  telescope / explorer / radar / veil.** Those four are the game.
- Post-MVP and staying there: alliance diplomacy, inter-clan war treaties, active deception,
  fleet interception, combat replay and monetisation. D114's five-seat seasonal clan and its
  private clan chat are the deliberately bounded exception; they add cooperation without adding
  a second diplomacy game.

## Quality bar

A feature is done when **all three** hold: technical correctness + gameplay correctness +
UX quality. Compiling, passing tests and existing in the UI is only the first third.

> **CODE WITHOUT TESTS IS CODE THAT WAS NEVER WRITTEN. IT IS UNFINISHED WORK.**

```bash
pnpm verify        # 0 type errors · 0 lint errors · all tests green
```

Full detail in `docs/engineering-standards.md`. The short version:

- **Everything is typed. `any` is banned.** No casts to silence the compiler. Parse
  untrusted input with Zod at the boundary; never let unparsed data reach a service.
- **Zero lint errors, always.** If a rule is wrong, change the rule deliberately.
- **Test edge cases:** boundaries, malformed and adversarial input, concurrency, failure,
  time. Risk coverage, never line coverage.
- **When a test fails, find the root cause first.** Never bend a test to fit the code, or
  code to fit a wrong test. Many tests failing identically is one bug, not many.
- **No silent placeholders.** A `TODO` in core gameplay logic is a bug that has not been
  filed yet.
- **Verify frontend work by looking at it.** `node tools/visual.mjs` drives the real client
  and measures the scene. A green typecheck has shipped a frozen rock and a sideways ship.

### Server rules

- **Server-authoritative.** Resources, fleet state, combat, travel, cooldowns, loot and
  progression are decided server-side, inside a transaction, using `@astera/rules`.
- **The fog is enforced in the query, not the UI.** A modified client must not be able to
  read a field it was not entitled to.
- **Lazy evaluation for anything continuous; scheduled events for anything that must happen
  at a moment.** There is no global tick and no per-planet loop. A scheduled moment is late
  by at most one `WORKER_POLL_MS`, which is why it is a second and not five (D52) — that
  latency is visible as a squadron holding over a world with nothing left to do.
- **Nothing is stored that a formula and a clock can derive** — no fleet positions, no
  asteroid coordinates, no resource tick rows.
- Every mutating action: lock the planet row → advance economy inside the lock → validate
  against the rules → mutate → commit → emit.
- The world runs while the player is offline. For every timed system ask: what happens on
  restart? If the job runs twice? If two fleets land at once? If the request is retried? If
  the transaction dies halfway? Idempotency, retry and crash recovery are part of the
  feature, not a follow-up.
- Watch for: N+1 queries, unbounded queries, duplicate jobs, race conditions, oversized
  payloads, needless re-renders, heavy 3D scenes, memory leaks.

### Validating a new system

What decision does it create? Why should the player care? What does it interact with? How
does success feel? What does failure cost? Does it create opportunity, curiosity, a reason
to come back? Does it add micro-management? Would the game be better without it?

Weak answers mean it is not done — but do not turn perfect answers into a precondition for
building. When in doubt: `PROTOTYPE → PLAY → OBSERVE → DECIDE`.

**Regression signals — fix, don't excuse as "fine for MVP":** the loop becomes
`BUILD → WAIT → COLLECT → UPGRADE`; resource collection becomes the fun; other players stop
mattering; the intel → decision → action chain weakens; risk or opportunity disappears;
ownership fades; micro-management creeps in; it becomes technically impressive and
emotionally empty; new systems make old ones pointless.

## Current state

Phases 0–7 are done: the rules module and season simulator; the backend; the intel layer;
the return moment; the playable loop; the galaxy as the only screen (D20); accounts and ten
galaxies (D21); the owner's interface pass (D22–D26); the OGame pass (D27–D33); mining,
wreckage, engagement, notifications and the radar rebuild (D34–D50); the live galaxy and the
end of waiting (D51–D53); the name, the identity and the way out (D54); Turkish and English
(D55); the rehearsal — ninety seconds of the real game before there is an account (D56); production
on one origin, with the ceilings that a public door needs (D57); the reward panel and the one
menu that holds it (D64–D67); the returning door, the camera that stops moving on its
own, and seats that come back (D68–D71); one craft, one marker — the real-time
movement pass (D72); the interface system made real and mechanically enforced (D109) —
one type ladder, one card word, one control per idea, with `text-[`, `tracking-[` and
`rounded-[` refused by the linter; and the pass that made a battle report explain itself, gave
every notification a door, and deleted the launch overhead from every flight in the game (D121).

```
0 type errors · 0 lint errors · 2,382 tests
rules 338 · server 748 · web 1,229 · sim 67
```

**`pnpm verify` is GREEN again as of D121, and nobody edited the assertion to make it so.**
D112 had left one simulator assertion deliberately red, riding on a coincidence: exactly one
bot in 750 bot-seasons researched Gravitic Charges, and only on seed 99. D121 removed the
launch overhead from every flight in the game, which moved that bot's season, and the
assertion passes on its own terms. It was measured red before the change and green after —
if it goes red again, that is the same coincidence and D112 still records what it costs.

**The season gate is GREEN on all five seeds, with the bands unchanged.** `ARR` was the last
metric to come in and no constant moved it — five were tried. What moved it was modelling the
build queue in the simulator: a queue rate-limits how fast resources become buildings, so they
sit in the store, which is the losable side. `docs/balance.md` records the five levers that failed.

**The simulator still models a game we do not ship.** Its bots act on `loginsPerDay` — every 2.4
to 12 hours — which described an async world. Scaling it ×4 was tested and refuted. The gate
being green does not make the pacing right; it makes it unproven in the other direction. **Do not
tune the game against these numbers**, and note `ARR` passes as a median while dipping to
0.26–0.27 around days 7–10.

| Area | State |
|---|---|
| `packages/rules` | Complete. Economy, combat, travel, intel, loot, dominion, galaxy generation, disruption |
| `packages/sim` | Complete, and it mirrors the build queue. Five-seed season gate at 50 players — see above |
| Auth · servers | Username and password, scrypt, refresh rotation. At most two galaxies of 300, filled in order (D99/D100) |
| Planet | Five buildings, two ground guns, four instruments, four satellites. Lazy economy under row locks |
| Build queues | Two per world, three deep: CONSTRUCTION and YARD. Cost committed at order, half back on cancel, all back on a system fault. Completion is a scheduled event with the same idempotency guard the Death Star uses; `/health` reports stranded orders (D4) |
| Fleet · worker | Launch guards, arrival → combat → loot → disruption → return. `SKIP LOCKED` claim, reaper, crash recovery tested |
| Intel | Telescope with clarity gradient and windowed seeding, probes with detection and bands, radar as a detection radius, veil applied server-side |
| Notifications | Seven kinds, both sides of everything, idempotent, payloads held by a contract test |
| Asteroids · wreckage | A mining economy with exact interception; public decaying debris fields. A salvage run is its own contact kind (D51) |
| Engagement | A raid holds in orbit for ten seconds and bombards, **and the whole galaxy watches it** — same hold, same volley, same mission id on every screen (D52), at the display's real frame rate (D53) |
| Live channel | Two topics on one SSE socket: what happened to YOU, and what happened in your GALAXY. A stranger's launch reaches every screen in under a second; the polls are a sixty-second net under it, and `/health` says whether the channel is up (D53). Every reconnection re-reads the live set, because the channel has no backlog (D72) |
| Look | Nebula, a power-law starfield with diffraction spikes, meteors, dust, bloom. Worlds carry an atmosphere limb — warm on the lit side, gone on the dark one — and the galactic plane is a painted plate of spiral arms and dust lanes — no lines anywhere (D53a, D53b) |
| Web client | The galaxy is the only screen. Focus anything and a rail states what you know and how you know it. Everything animated runs on `serverNow()`, so every player watches the same instant (D52). One tap, one round trip — and the deterministic spends are predicted and reconciled, so the screen agrees with the tap immediately (D53) |
| Language | Turkish and English, detected from the device and switchable on the front door and in the commander sheet. Resources are compiled in, so the first frame is never in the wrong language. Every element owns its strings; a refusal is localised off its code with the server's figures kept (D55) |
| Identity | **Astera Online** everywhere — package scope, database, container, channel, title, manifest. The painted wordmark on the front door and the loading cover, and app icons cut from the same artwork (D54) |
| Onboarding | A stranger plays the real galaxy for ninety seconds before an account exists: the public preview takes no seat, the beats gate to one control at a time, and the claim makes the account, takes the seat and replays the opening in one call (D56) |
| Deployment | Live at `asteraonline.space`. Host nginx serves the built client and proxies `/api` to one container; Postgres in a second with a named volume and a nightly dump. Rate limits on the login and the seat. `./deploy/deploy.sh` (D57) |
| Rewards | Eleven chains, counted off the world rather than accumulated; claimed once under the planet lock, granted above the storage cap so a raider can take them. Ten are season-scoped; the @JoinAstera bonus is a human reading a DM plus `season reward NAME`, and it is paid once per ACCOUNT for ever (D64, D64a, D104) |
| Score · analytics | One looped track defaults to 0.35, has persisted mute and level controls, pauses with the tab and resumes from the same instant (D66/D107). GA4 behind `VITE_GA_ID`, deferred to idle, absent unless configured (D67) |
| Seats | A world idle for three days is reclaimed by the worker and its seat handed back; the account survives and rejoins from the server list. Never touches a world with a flight in the air (D70) |
| Season lifecycle | `season_end` event kind exists; **no handler** |

**The single most important gap is a player.** The loop is playable end to end and has
never been lived with — the onboarding now gets a stranger to a committed fleet, but nobody
has walked it who did not build it.

## Next

1. **Play it for two days in real gaps**, on a phone, then fix what that reveals — see
   `docs/playtest-log.md`. Everything below is smaller than one real session.
2. **Re-derive the simulator for real-time pacing.** Its bots still act on `loginsPerDay`.
   Until that is done, every gate reading is an indicator rather than a result.
3. **Asteroid impacts and the Drill** — generated and stored, never scheduled.
4. **Idempotency keys on the launch path** — `request_log` exists and is unused, so a
   double-tapped order on a flaky connection places two.

## Known risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Information is invisible.** If the intel feed reads as a boring list, there is no game | Highest | Disproportionate UX effort there. Test with people who are not you |
| **Empty shard.** Async PvP with twelve players is nothing | High | Enforced by the frontier rule; still pre-fill galaxy 1 by invitation |
| **Nobody scouts** — the game degrades into a worse OGame | High | Track scout-before-attack rate; target ≥50% by day 3 |
| **3D production outruns the frame and art direction** | High | Give assets owners, budgets and acceptance shots; profile every milestone before scaling it |
| **Casual players get farmed** — the 2-logins/day archetype finishes at −10k to −19k Dominion | Open | The only unresolved *design* problem. Needs real players, not more simulation |
| **Three-person key-person bottlenecks** | Real | Explicit ownership, reviewable milestones and docs for every critical production path |

## Known issues

- `request_log` exists but idempotency keys are not wired into the launch or order path.
- `PROVISIONAL` constants: vault floor, disruption duration, shield curve, season length,
  asteroid parameters. Settled by playtest, not by argument. Marked in `constants.ts`.
- `build_orders_slot_check` hard-codes `BETWEEN 0 AND 2` in SQL while `BUILD.queueDepth` lives
  in the rules. Nothing binds the two; changing the constant needs a migration.
- A captured colony keeps the previous owner's in-flight build orders. Plausible, untested,
  and unstated — reclaim clears them explicitly, capture does not.
- Simulator bots have no skill variance. **Do not tune ladder spread against the simulator.**

### Dev-loop traps that look like broken code

- Changing `packages/rules` needs **both** dev servers restarted — the API caches the
  generated galaxy per process, and Vite does not watch the linked workspace package.
- Tailwind v4's `@theme` publishes colours as `--color-alloy`, not `--alloy`. A bare
  `var(--alloy)` resolves to nothing, which makes any surrounding `color-mix()` an invalid
  declaration the browser drops in silence.
- A three.js component authored for one camera is not portable to another. `Dust` is sized
  for a camera outside a 20-unit disc; inside that radius every near point renders as a
  flat square.
- Drizzle's `sql` template cannot bind a JS `Date` through postgres.js.
- `'İ'.toLowerCase()` is `i` **plus a combining dot** in JavaScript, so `/istihbarat/i` does not
  match `İstihbarat`. Never case-fold a Turkish label to compare it — match it as written.
- Adding a dependency to `apps/web` makes Vite re-optimise, and the open dev server answers 504
  until it is restarted. It looks exactly like a blank page.
- `RETURNING` does not preserve a subquery's `ORDER BY`.

## The docs

| File | Read it when |
|---|---|
| `docs/product-vision.md` | You need to know *why* this game exists |
| `docs/game-design.md` | You need to know how a system is meant to work |
| `docs/decisions.md` | Before changing anything that feels settled |
| `docs/balance.md` | Before touching a number |
| `docs/architecture.md` | Before writing server code |
| `docs/deployment.md` | Before shipping a change, and before touching anything that runs on the server |
| `docs/engineering-standards.md` | **Before writing any code at all** |
| `docs/interface.md` | Before changing a screen |
| `docs/visual-design.md` | Before making or asking for art |
| `docs/playtest-log.md` | Before and during a real play session |
| `docs/glossary.md` | Dominion? Clarity? Veil? Salvage? |

## The one thing to remember

The goal is not to finish the features.

> **It is to make a multiplayer game that leaves the player, some time after closing
> it, thinking: "I wonder what happened."**
