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
