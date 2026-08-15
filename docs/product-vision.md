# Product Vision

## What this is

A **mobile-first, portrait, asynchronous multiplayer space game.** Each player owns one
planet in a galaxy of roughly 200 real people, at real 3D coordinates. Fleets physically
travel between planets over minutes. Combat resolves on the server while both players are
asleep.

The pitch in one line:

> **The fleet is the bet. The information is the game. The planet is the stake.**

## What this is not

Not a 4X. Not an MMO. Not an OGame clone. Not AAA. There is no colonisation, no alliance
diplomacy, no tech tree, no fleet micro-management, no manual combat.

The constraint that shapes everything: **one developer must be able to finish it.**

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
| **Ownership** | One planet, named, at fixed coordinates, structurally indestructible |
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
alternatives (see [decisions.md](decisions.md), A1). The reasoning:

1. **It is the differentiator.** Every async space game has fleets and raids. Almost none
   make *seeing and being seen* the core mechanic.
2. **It is the cheap one.** A telescope is a database query with a visibility predicate. A
   radar is an event log. Neither needs physics, simulation, or a combat renderer — which
   is precisely why one person can ship this. Combat, by contrast, is weeks of tuning.
3. **Its return moment refreshes itself.** Most async games return you to the *same*
   question every session: *did my thing finish?* Blindspace returns you to *new material* —
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

> **A small multiplayer game that makes the player want to check it again.**

A player closes the app, and some time later thinks: **"I wonder what happened."**
That is the retention loop. Everything else serves it.
