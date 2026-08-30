# Product Vision

## What this is

A **mobile-first, portrait, asynchronous multiplayer space game.** Each player owns one
planet in a galaxy of fifty real people, at real 3D coordinates. Fleets physically
travel between planets over minutes. Combat resolves on the server while both players are
asleep.

The pitch in one line:

> **The fleet is the bet. The information is the game. The planet is the stake.**

## What it has to FEEL like

> **Fun, utopian, epic. A NASA photograph you can fly around in — and one that is
> happening right now, not one that is being reported to you.**

This is a product requirement, not decoration, and it outranks convenience. Three tests,
in order:

1. **Is it alive?** The disc is a place where things are happening, to other people, while
   you watch. Fleets crossing, drills racing for a rock, a raid landing on a world you have
   nothing to do with. If a player sits on the galaxy and nothing moves, the product has
   failed even if every number on the screen is correct.
2. **Is it happening NOW?** Anything with a moment attached happens at that moment and is on
   screen at that moment, for everybody at once. Not on the next poll, not when the worker
   gets round to it, not once the payload catches up. **Waiting is the enemy** — a state
   that has not arrived, a craft parked on its destination, a spinner where a decision
   should be, a squadron hanging over a world with nothing left to do.
3. **Is it beautiful?** Scale, depth and light. A world is a world, not a dot; a raid is a
   bombardment, not a status change; the sky is deep and the disc is enormous. If a moment
   would be more magnificent and it costs nothing the loop cares about, make it more
   magnificent.

### What that forbids

- **A screen that waits for a server round trip to say what happened.** Predict, render, and
  reconcile — the server stays the only authority on the OUTCOME, never on the frame rate.
- **A moment nobody can watch.** If it is worth animating it is worth everybody seeing;
  see D52, which made the combat cinematic public because a battle only its attacker can
  see is a database transaction with sound effects. The cinematic being public never makes
  its hidden source craft public; D123 still decides whether that is absent, Radar contact or
  Telescope silhouette.
- **Dead air inside a state.** Arrive, fight, leave. Nothing in this game stands still
  waiting for a timer that has already expired.
- **A rule that is enforced by the interface refusing to move.** If a payload is late, the
  world keeps running off the clock it already has and corrects itself when the truth lands.

The limits this does NOT relax: the server is still the only authority (P1), a fleet still
cannot be recalled (P3), the fog is still enforced in the query (P4/P5), and none of this
is a licence to add systems. **Simple implementation, magnificent presentation.**

## What this is not

Not a 4X. Not an MMO. Not an OGame clone. Not AAA. There is no alliance
diplomacy, no tech tree, no fleet micro-management, no manual combat.

The production constraint that shapes everything: **a three-person team must be able to
build, operate and grow this into a medium-to-large game without losing coherence.** Team
growth expands production capacity; it does not justify systems that weaken the core loop.

## Who it is for

An adult who plays on a phone in gaps — commute, lunch, before bed. Three to five
sessions a day, four to six minutes each. They will not read a tutorial. They like feeling
clever more than they like feeling powerful. They will check the app during a meeting if
they think someone might be moving on them.

## The nine emotions

These are **gameplay requirements**, not marketing copy. Each is listed with the mechanism
that is supposed to produce it, so you can check whether it still does.

| Emotion | Produced by |
|---|---|
| **Ownership** | One protected capital and up to three won colonies, named at fixed coordinates |
| **Curiosity** | The clarity gradient — information that is real but possibly stale |
| **Competition** | The first attacker becomes a named antagonist, on purpose, by design |
| **Ambition** | Dominion is one legible integer where every action lands |
| **Risk / fear of loss** | "Home defence after launch: 4 units. Exposed for 28 minutes." Plus permanent ship death |
| **Opportunity** | Fleet-status visibility — someone else's fleet leaving is a countdown only you can see |
| **Re-engagement** | Design Law #1: no state exists in which nothing is pending |
| **Memorability** | Named rivals, a scan from a bearing you cannot place, a bluff that worked |
| **Fun** | All of the above, arriving in under six minutes |

## Design north star

**SIMPLE TO PLAY. DEEP UNDER THE SURFACE.**

Few systems, learned fast. Depth comes from how those systems interact, never from adding
more of them.

The two laws that fall out of it:

> **Design Law #1** — A player must never be able to reach a state where nothing is
> pending. If a session can end clean, there is no reason to come back. This outranks
> every other rule.

> **Design Law #2** — Every system unlocks at the exact moment the player feels its
> absence. No tutorial, no feature tour. The player's own confusion is the trigger.

## Why the core tension is information, not combat

This was the single most consequential design decision, and it was made against real
alternatives (see [decisions.md](decisions.md), D1). The reasoning:

1. **It is the differentiator.** Every async space game has fleets and raids. Almost none
   make *seeing and being seen* the core mechanic.
2. **It is the leverage point.** A telescope is a database query with a visibility predicate.
   A radar is an event log. Neither needs physics, simulation, or a combat renderer — which
   is precisely where a three-person team can spend production capacity without multiplying
   systems. Combat, by contrast, is weeks of tuning.
3. **Its return moment refreshes itself.** Most async games return you to the *same*
   question every session: *did my thing finish?* Astera Online returns you to *new material* —
   sightings, absences, scans from a bearing you do not recognise, patterns that only mean
   something across three visits.
4. **It manufactures the two hardest emotions.** Curiosity and fear cannot be produced by
   numbers going up. They are produced by not knowing.
5. **It creates skill depth without content.** Two players with identical planets play
   completely differently. Depth from rules, not from more things to build.

## The acceptance test

Everything is measured against this. It is testable, and it is the gate.

| Checkpoint | Requirement |
|---|---|
| T+0:00 | Understood in **under 60 seconds**, no tutorial |
| T+0 → 6:00 | At least **one irreversible commitment** |
| T+6:00 | Exits with **at least one unresolved thread** |
| Away | The player can name a specific question: *"I wonder if ___"* |
| Return | **≥ 2 things changed that the player did not cause** |
| Loop | The return itself creates the next thread |

## The single sentence that defines success

At the end of MVP, what exists should not be *"a lot of features in a working prototype."*
It should be:

> **A growing multiplayer game that makes the player want to check it again.**

A player closes the app, and some time later thinks: **"I wonder what happened."**
That is the retention loop. Everything else serves it.
