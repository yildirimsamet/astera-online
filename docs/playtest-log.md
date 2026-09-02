# Two days, real gaps

**This is not a build phase. Build nothing while it runs.**

The client is now good enough to be judged. What it has never had is a player. Every
problem found so far came from rendering the data and looking at it — the next several
come from living with it, and they cannot be found any other way.

## Setup, once

```bash
docker compose up -d
pnpm season migrate && pnpm season bootstrap   # if no world is live
pnpm season bootstrap --unattended 8           # DEV ONLY: neighbours to scout
pnpm dev
```

The client prints a `Network:` URL. **Open that on your phone**, not on the desktop.
This game is played standing up, one-handed, in four minutes. A desktop browser is a
different product.

Keep the tab open across the two days. If the season dies, `pnpm season status` says so.

## The rule

**Play in the gaps you actually have.** Not scheduled sessions — the gaps: waking up,
the kettle, the commute, lunch, the sofa, before bed. Four to six minutes each, three to
five times a day. Then close it and go away, because the entire design bets on what
happens while you are gone.

Do not fix anything mid-session. Write it down and keep playing. A session spent fixing
is a session not observed.

## After each session, answer four questions

Add a block below. Thirty seconds each, in whatever language you think in.

```
### Day N · time · how long since last session

WHY DID I OPEN IT?      (a notification? a fleet landing? boredom? nothing?)
WHAT DID I DO FIRST?    (the first thing your eye went to, not what you meant to do)
WHAT DECISION DID I MAKE?  (and did I have enough information to make it?)
WAS THERE SOMETHING IN FLIGHT WHEN I CLOSED IT?   (yes / no — and if no, why not)
FRICTION:               (anything that annoyed, confused or bored you)
```

## The two numbers that decide whether the design works

Count these across the whole two days:

| | Target | Why it is the one that matters |
|---|---|---|
| **Sessions that ended with something in flight** | ≥ 80% | Design Law #1. A session that ends with nothing pending is a session with no reason to come back. |
| **Attacks preceded by a probe or a telescope reading** | ≥ 50% | The project's real KPI. If you — who wrote the intel layer — attack blind, nobody will scout, and this is a worse OGame with extra steps. |

## Things to watch for specifically

- **Did the top directive ever tell you something you already knew, or something wrong?**
  It is a ranked model with hand-set weights. Two days will show whether the weights are.
- **Did you ever have to guess whether a world was in your tier band before packing a fleet?**
- **Did you ever not know what to do next?** Note the exact moment.
- **Did you ever want a number the interface did not give you?**
- **Did Signals feel like news, or like a badge to clear?**
- **Did you feel anything when a fleet landed?** If not, that is the most important
  finding available and it outranks every feature on the roadmap.
- **Battery and heat**, since it is a phone.

## At the end

Read your own notes and rank the problems by how often they appear, not by how annoying
they felt. Then fix the top three. Everything else waits for real players.


# Sessions

<!-- Add a block per session. Keep them short and honest. -->

## Fleet Catalog V2 — two-player release session

Run this only on a ruleset-v4 disposable/dev season after the real-phone Phase 9 measurement. Use
two human players on separate accounts and, if possible, separate phones. Do not disclose the
other player's exact composition; scouting and the visible counter language must do that work.

### Setup record

```
DATE / BUILD SHA:
PLAYER A / DEVICE / BROWSER:
PLAYER B / DEVICE / BROWSER:
SEASON ID / RULESET VERSION (must be 4):
NETWORK:
```

Give both players enough development to access T2 immediately. Give only one player the research
and Yard state needed for T3/T4 so the session also tests whether a lower-tier answer remains
rational. Preserve ordinary fuel, Hangar, travel, Radar and Aegis rules; do not bypass the parts
that create the tactical decision.

### Required decisions

1. Both players inspect the Shipyard without explanation and describe the difference between a
   Raider, Striker, Fortress, Escort and Transport.
2. Player A sends one fast Dart/Tempest-heavy raid and one slower, tougher composition at comparable
   resource value. Record quoted travel/exposure, the reason for each choice and whether the result
   matched the expectation.
3. Player B sees or probes the incoming/standing force, states the Skirmisher → Bulwark → Lance →
   Skirmisher answer aloud and builds a counter before the second fight.
4. Run one cargo decision each with Courier, Wayfarer and Atlas available. Record which transport
   was chosen for speed, which for capacity and whether one was always dominant.
5. Put Aegis on one target. Let Player A inspect it, then decide whether Nullifier belongs in the
   force. Repeat once against a target with no active shield; an automatic Nullifier inclusion is a
   failure.
6. Show locked T3/T4 rows to the player who lacks research. They must reach the correct research row
   without verbal guidance and explain the missing Engineering/Power/Armor requirement.
7. Give the advanced player a viable T3/T4 fleet and ask both players for a rational lower-tier ship
   they would still include. Price, speed, build time, counter or cargo are all valid reasons; “none”
   is a release-blocking balance observation.

### Observation record

```
FAST VS HEAVY — chosen fleets / quoted time / reason / result:
COUNTER READ — what player saw / predicted class answer / actual answer:
CARGO — Courier reason / Wayfarer reason / Atlas reason / universal winner if any:
AEGIS — Nullifier included with shield? / without shield? / why:
RESEARCH ROUTE — locked hull / first missing gate / wrong turns / understood effect:
LOW-TIER LATE GAME — hull / reason / would actually build?:
ONE-HANDED UI — clipped or unreachable actions:
DEVICE — peak heat / battery change / jank moment / memory-frame capture path:
```

### Acceptance

- Both players can explain the speed-versus-survival choice from the UI and mission quote.
- Both identify the visible counter cycle before committing the measured counter fight.
- Courier, Wayfarer and Atlas each receive at least one situationally rational choice; no universal
  transport emerges.
- Nullifier is chosen in response to an active Aegis and rejected at least once without one.
- Each tested T3/T4 lock leads to its correct Research row without outside explanation.
- At least one lower-tier hull appears in a rational late-game composition.
- No retired hull appears in UI, payload, report or persisted successor state.

Record every failure before changing balance or copy. After any correction, add the exact affected
test and re-run `pnpm verify`, the Fleet V2 balance matrix and the Phase 9 portrait visual gate.

## D150 · Pirate fleets — what a playtest has to answer

Shipped with measurement behind it but no play behind it. `docs/balance.md` holds the
generated-position visibility table; none of the following can be read off a simulator.

- **How many pirates does a session actually meet?** The model says a median of 16 in eight
  hours at the naked eye. If a real session meets none, `PIRATE.spawnPerSeatPerHour` and
  `SENSOR.baseRadius` are the two dials — both outside the forbidden list.
- **Does the reward feel like a prize or like a chore?** If commanders describe pirate raids as
  something they *have* to do every session, that is `CLAUDE.md`'s "micromanagement grows"
  regression signal and the answer is to make them rarer, not smaller.
- **Is pirate hunting REPLACING PvP?** The signal to watch is sessions ending with something in
  flight at a pirate and nothing in flight at a person. If it appears, the reward comes down —
  the acceptance bands do not move.
- **Is the level legible before the commit?** A commander who cannot say what an L4 costs them
  before they launch is meeting D124's failure, not the game's difficulty.
- **Does the ten-second fight read at the rendezvous?** Both craft hold at the meeting point;
  the volley crosses a fixed `PIRATE_STANDOFF` gap because there is no world to size it against.
  This is the one piece of the feature that has only ever been seen in code.
