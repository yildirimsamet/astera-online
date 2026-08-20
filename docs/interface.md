# Interface architecture

How the screens are built and why. Sits under `game-design.md` and `decisions.md`, above the
code. Read with `visual-design.md`, which governs art rather than layout.

**The galaxy is the shell (D20).** Everything here is what opens *over* it.

## The five findings this rests on

1. **Progression UI is a state machine, and the states must be visible.** Every purchasable is
   in exactly one of four states — owned, affordable, unaffordable, locked — and the standard
   failure is rendering the last two identically. A player who cannot tell "I can't afford
   this yet" from "this needs something else first" cannot plan.
2. **Preview before commit.** Show what a node *will* give before it is bought, and the tier
   beyond that. A tree that only displays what you own is a list of receipts.
3. **Progressive disclosure.** Reveal by stage and by demand, rather than stacking four
   categories and sixteen rows into one column.
4. **Density needs structure.** Tabs, bands and a recommended path are how a dense game stays
   readable on a phone.
5. **Caps pace sessions, and the honest version shows the waste.** The dark-pattern version
   pushes a notification; the honest one is on screen, in-app and factual: *this is full, and
   you have thrown away two hours.*

## The rules this sets

### I1 · Locked reads as locked — art desaturates, copy does not

**The artwork carries the state; the words carry the promise.** A locked item's art is
desaturated and dimmed behind a lock; its name, its payload line and its requirement stay at
full strength, and the requirement is a button that takes you to whatever unlocks it.

This reverses an earlier rule that nothing is ever greyed out. That rule aimed at a real
failure — fading a whole row to 45% deletes the ambition the game runs on — and overcorrected
into a screen where a Bulwark you cannot build looked exactly like a Wasp you can, so the
player concluded they already had everything.

### I2 · Four categories, four tabs, fixed order

`Grow · Orbit · Defend · Reach`, always in that order, as a segmented control rather than a
scroll. **Order is fixed because a control that reorders itself destroys muscle memory.** The
*recommendation* moves instead: a pip marks the tab that currently matters most.

**Where a tab holds more than one kind of thing, a BAND separates them** (D26). Orbit carries
four satellites that each cost a slot and four instruments that do not; Reach carries hulls
that fight, one that carries and one that mines. Those distinctions used to be prose between
the cards, which is prose nobody reads while scrolling. A band is a short label and one clause
of rule, and it is the only sub-heading level these surfaces have.

**Where a tab is deliberately incomplete, it says so and points.** The Aegis is the only shield
in the game and lives under Orbit, because all hardware stays on one surface for comparison —
so Defend ends with a pointer row to it, rather than a player concluding the game has no
shields.

### I2b · Every card answers "what is this" before "what does it cost"

A two- or three-word **tag** sits directly under the name on every purchasable card. It is not
the role sentence and must never collapse into it: the role argues a decision and is read by
someone choosing; the tag identifies the object and is read by someone scanning fourteen cards
trying to work out which is which. The bar is a twelve-year-old, taken literally — no jargon,
no mechanism, and if it needs a comma it has turned into a role.

### I2c · An action control may shrink; it may never be clipped

The button's width is its content — a shortfall in two resources is three times the width of
the word RAISE — so it is `flex-shrink: 1` with `min-width: 0`, and the SHORT state stacks onto
two lines rather than growing sideways off the card. The failure this replaces was a price
rendered with its last digit cut off, which is worse than no price: it is a wrong one.

### I3 · Every item has a detail sheet, and the sheet is the commit surface

Tapping a row opens the full picture: the tier ladder with art, what each level gives, what it
unlocks, the price, and the button. Buying from the sheet is what gives a purchase weight now
that build timers are gone — the weight comes from a considered commit and a visible
before-and-after, not from a wait.

### I4 · One notification centre, holding status as well as events

The seven server notification kinds, plus client-derived status the player would otherwise have
to notice for themselves — principally a full works. Nothing here is ever pushed out of the
app.

Unseen state clears when the centre is **opened**, not when the app loads. Status never enters
the count, because a badge that cannot be cleared teaches people to ignore badges. A run of
identical events folds to one row with a count rather than repeating down the screen.

### I5 · Every surface has a permanent way in

A surface reachable only as a side effect of something else happening does not exist for the
player. The Intel centre was openable **only** by tapping a notification of the right kind, so
a commander with an empty mailbox had no route at all to telescope readings, probe reports,
battle reports or the radar log — the surface that holds "the information is the game".

Every full surface now hangs off the header, which is the one piece of chrome that never
leaves: the works and its collect control, the **commander** control, **Intel**, and Signals.
Your own planet opens by tapping your own world, and every other surface opens by focusing the
thing it is about.

**A way in labelled as something else is not a way in.** The commander control — the account, the
galaxy, the season, and sign-out — was that same permanent header button for a long time, and it
still produced "there is no logout button, I cannot sign out": it said SEASON and drew a duration
under it, so it read as a clock, and nobody presses a readout. It carries the player's own name
now, with the season figure under it. A player hunting for the way out hunts for themselves.

**Before shipping a surface, name the control that opens it when nothing has happened — and check
that the control names it back.**

### I6 · A readout measures what the player owns, never what exists

A progress bar toward an unreachable total tells a player they are failing at something nobody
asked them to do. The Intel centre's coverage panel read "Watching 2 of 47" against every other
world in the galaxy and drew a 47-cell bar — but a telescope tops out at three watch slots, so
the figure was unreachable by a factor of fifteen and the bar could never pass 6%.

The denominator is what the player has: slots used against slots owned. The size of the galaxy
still appears, but as the *reason* a slot is a decision rather than as a target.
