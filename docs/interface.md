# Interface architecture

> How the screens are built and why. Sits under `game-design.md` and `decisions.md`;
> above the code. Read with `visual-design.md`, which governs art rather than layout.

The galaxy is the shell (D1). Everything here is what opens *over* it.

---

## What the research says

Sources at the bottom. Five findings survived contact with this game.

**1 · Progression UI is a state machine, and the states must be visible.**
Every item in a progression system is in exactly one of four states — *owned*,
*affordable*, *unaffordable*, *locked* — and the standard failure is rendering the
last two identically, or rendering all four identically. A player who cannot tell
"I can't afford this yet" from "this needs something else first" cannot plan.

**2 · Preview before commit.** The reference implementations (skill trees, talent
grids) show what a node *will* give before it is bought, and show the tier beyond
that. A tree that only displays what you already own is a list of receipts.

**3 · Progressive disclosure.** Don't put everything on one surface. Reveal by
stage and by demand. This is the direct fix for a planet screen that stacks four
categories and sixteen rows into one column.

**4 · Strategy UI is allowed to be dense, but density needs structure.** Tabs,
segmentation, and a recommended path are how dense games stay readable on a phone.

**5 · Caps pace sessions; the honest version shows the waste.** Storage ceilings
are the mechanism behind "come back later" in every builder. The dark-pattern
version pushes a notification. The honest version is on-screen, in-app, factual:
*this is full, and you have thrown away two hours.*

---

## Decisions this sets

### I1 · Locked reads as locked — art desaturates, copy does not

Reverses the earlier rule that nothing is ever greyed out. That rule was aimed at a
real failure — fading a whole row to 45% deletes the ambition the game runs on —
but it overcorrected into a screen where a Bulwark you cannot build looks exactly
like a Wasp you can, and the player concludes they already have everything.

The split: **the artwork carries the state, the words carry the promise.** A locked
item's art is desaturated and dimmed behind a lock; its name, its payload line and
its requirement stay at full strength, and the requirement is a button that takes
you to the thing that unlocks it. You can always see what you are missing and why.

### I2 · Four categories, four tabs, fixed order

`Grow · See · Defend · Reach`, always in that order — a segmented control, not a
scroll. Order is fixed because a control that reorders itself destroys muscle
memory. The *recommendation* moves instead: a pip marks the tab that currently
matters most, scored the way the old sort scored it.

### I3 · Every item has a detail sheet, and the sheet is the commit surface

Tapping a row opens the full picture: the tier ladder with art, what each level
gives, what it unlocks, the price, and the button. Buying from the sheet is what
gives a purchase weight, now that D4 has ruled out build timers — the weight comes
from a considered commit and a visible before/after, not from a wait.

### I4 · One notification centre, and it holds status as well as events

Server notifications (incoming fleet, fleet home, raided, scan detected) plus
client-derived status the player would otherwise have to notice for themselves —
principally a full store. Nothing here is ever pushed out of the app, and the
excluded list from `game-design.md` still stands: no streaks, no login bonuses, no
"we miss you". Unseen state is real: it clears when the centre is opened, not when
the app loads.

---

## Sources

- [Game UI Design: The Complete Guide](https://www.uichallenges.design/guides/game-ui-design) — progression UI states, locked/affordable/prerequisite, recommended path
- [Skill Tree · Game UI Database](https://www.gameuidatabase.com/index.php?scrn=64) — reference implementations
- [Ins and Outs of Mobile Games UI Design](https://pixune.com/blog/mobile-games-ui-design-a-handy-guide/) — legibility, contrast, at-a-glance status
- [A Technical Guide to Mobile Game UI/UX Design](https://www.appnality.com/blog/guide-to-mobile-game-ui-ux-design/) — progressive disclosure
- [Game retention: 12 strategies](https://featureupvote.com/blog/game-retention/) — caps and the daily loop
- [How to keep players playing — Long-term Retention](https://www.gamedeveloper.com/business/how-to-keep-players-playing---long-term-retention) — near goal + far goal
