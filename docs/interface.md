# Interface architecture

How the screens are built and why. Sits under `game-design.md` and `decisions.md`, above the
code. Read with `visual-design.md`, which governs art rather than layout.

**The galaxy is the shell (D20).** Everything here is what opens *over* it.

## The five findings this rests on

1. **Progression UI is a state machine, and the states must be visible.** Every purchasable is
   in exactly one of four states — owned/complete, affordable, unaffordable, locked — and the
   standard failure is collapsing any two of them. A player who cannot tell "I already have
   this" from "I cannot have this yet" cannot read their own progress; one who cannot tell
   "I can't afford this yet" from "this needs something else first" cannot plan.
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

Commander identity is always `accounts.displayName`. Galaxy labels and focus
surfaces lead with the commander username; planet names are secondary location
copy. Intel and reports follow the same order without widening their existing fog
projection.

### I0 · Strategic state is read from shape before copy

The disc uses one persistent visual grammar wherever ownership can change: a cyan diamond
means your protected capital, a cyan triangle means your colony, an orange four-tick reticle
means every world controlled by your marked Rival, green means a neutral claim is open, and
red cracks/smoke mean a world is in Death Star recovery. Labels repeat the world kind and
state, but they are confirmation rather than the only explanation.

A neutral focus always shows the complete three-beat route — win the raid, open the claim,
send the Hauler — and shows the slot, ship, cargo and travel requirements before the raid as
well as during the claim. Every foreign world exposes Death Star devastation. A foreign colony
shows the two-impact capture route; a recovery colony adds the live capture deadline and whether
the ready Death Star can arrive inside it. A capital explicitly says that impact destroys stock,
fleet and levels but can never transfer control.
Unavailable actions stay visible with their reason instead of disappearing.
The settlement control names its first unmet requirement directly — colony slot, flight bay,
Hauler, founding cargo, arrival window or origin recovery — rather than relying on a disabled
state or colour-coded chips. While a neutral claim is open, the panel also states that another
ordinary raid is still possible but does not extend the claim, and that a Death Star impact
clears the claim and starts recovery instead of settling the world immediately.

Focus is a two-tap spatial interaction for every object the commander does not control. The
first tap selects it, zooms/follows it and shows only the collapsed rail; a second tap on that
same object expands its detail. Tapping a different object always starts again collapsed.
The commander's capital and colonies are the deliberate exception: their first tap opens the
planet management surface directly.

Storage capacity is not a hostile state. A full Alloy or Crystal meter keeps its
resource hue and closes with a hard end-cap; threat red remains reserved for an
attack, disruption, recovery or another state that can harm the commander. The
word "full" may confirm the shape, but it may not be the only way to read it.

### I1 · Locked reads as locked — art desaturates, copy does not

**The artwork carries the state; the words carry the promise.** A locked item's art is
desaturated and dimmed behind a lock; its name, its payload line and its requirement stay at
full strength, and the requirement is a button that takes you to whatever unlocks it.

**Owned or complete never reads as locked.** Its art remains in full colour with no badge or
success tint. Its terminal control keeps the same quiet, dashed hardware treatment as a lock
control but carries an open-lock glyph and the owned/max/complete label. A real unmet
prerequisite carries the closed-lock glyph. It has no prerequisite copy, price shortfall or
route forward. This applies equally to a satellite bought once, an instrument at the end of
its table and a completed Frontier project.

**Available but not owned is quiet, not locked.** Its art is greyed to say “not yours yet”, but
there is no lock mark because the player can buy it now. Only a real unmet prerequisite adds
the lock. Once an item exists at any level its current art is full colour; the next tier remains
the thing being offered.

This reverses an earlier rule that nothing is ever greyed out. That rule aimed at a real
failure — fading a whole row to 45% deletes the ambition the game runs on — and overcorrected
into a screen where a Bulwark you cannot build looked exactly like a Wasp you can, so the
player concluded they already had everything.

### I2 · Four categories, four tabs, fixed order

`Grow · Orbit · Defend · Reach`, always in that order, as a segmented control rather than a
scroll. **Order is fixed because a control that reorders itself destroys muscle memory.**

**Nothing on the bar gives advice.** A pip used to mark whichever problem the situation engine
ranked highest, and it was removed by owner decision (D56a): the tabs say what they ARE and the
choosing is the player's, rather than a second opinion sitting beside whatever else is on
screen. What survives of the ranking is which tab the screen OPENS on — a default, not a
recommendation.

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

The compact row is a scanner, not the full argument. It leads with the current and
next renders, the primary numeric delta and the action. The role sentence remains
available in the detail sheet; repeating it under every row is text doing the art's
job. Strategic hardware follows the same hierarchy: an unbuilt Death Star lives in
Reach with the other projects, while a building, paused or ready one rises above the
tabs because it has become live planetary state. Its plate is premium through mass,
material and silhouette; strategic red remains a small danger signal rather than
filling the whole card.

The permanent resource strip and Works use the same three-member order everywhere:
Alloy, Crystal, Deuterium. All three stores retain exact spendable figures without
ellipsis, and all three Works vessels remain visible even at zero so a Prospector
return cannot appear to land in an invisible pool.

### I4 · One notification centre, holding status as well as events

The seven server notification kinds, plus client-derived status the player would otherwise have
to notice for themselves — principally a full works. Nothing here is ever pushed out of the
app.

Unseen state clears when the centre is **opened**, not when the app loads. Status never enters
the count, because a badge that cannot be cleared teaches people to ignore badges. A run of
identical events folds to one row with a count rather than repeating down the screen.

A commander or planet identity in Signals is set in bold. When the payload already
reveals that world's identity, the name is also a direct route back to the disc:
pressing it closes Signals, selects the world and flies the camera to it with the
focus detail kept collapsed. Chat usernames provide the same route for other
commanders in the local galaxy, and Leaderboard usernames do likewise. A conversation
or ranking never becomes a hunt through every world on the map.

Galaxy Chat's composer is fixed to the foot of its sheet. The message history is the
only scrolling region; reaching the newest message never pushes the textarea or Send
control below the viewport. Chat is absent from the pre-account rehearsal: before a
commander identity exists there is neither a launcher nor an unread request.

### I5 · Every surface has a permanent way in

A surface reachable only as a side effect of something else happening does not exist for the
player. The Intel centre was openable **only** by tapping a notification of the right kind, so
a commander with an empty mailbox had no route at all to telescope readings, probe reports,
battle reports or the radar log — the surface that holds "the information is the game".

Every full surface now hangs off the header, which is the one piece of chrome that never
leaves: the works and its collect control, the **commander** control, **Intel**, and Signals.
Your own planet opens by tapping your own world, and every other surface opens by focusing the
thing it is about.

The disc caption names the room as well as the map: `The disc · Vantage (EU-1)` / `Disk ·
Vantage (EU-1)`. The live online count keeps the opposite edge. A client talking to a server
that predates the shard name omits the room label instead of inventing one, and long names
truncate before they can push the live count off a portrait screen.

Leaderboard is a permanent commander-menu surface. It shows the whole local galaxy in
authoritative Dominion order: rank, commander username, planet, public Core tier and score.
The caller's row is highlighted. A score broadcast refreshes an open ladder immediately;
a public world update refreshes it too because Core tier is part of every row.

Galaxy Chat belongs directly to the disc and identifies people only by commander username.
Its permanent way in is a compact control at the lower-right of the Galaxy viewport, not a
commander-menu row.
The newest page opens at the bottom, older pages load through the cursor, and a submitted
message appears from the authoritative response. While the panel is open, `shard:chat`
keeps it live and the newest visible message advances the durable read marker. While it is
closed, the same event refreshes the unread count; a small red dot appears on the Galaxy
chat control itself. The player's own posts never light the dot.

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

Probe and battle reports share one position below Watching as two tabs, with Probe reports as
the default. Battle history must always be one tap away even when the probe history is long.
The controls are real tabs: selected state is announced, only the active panel is exposed, and
Left/Right/Home/End move both focus and selection. Radar remains below the report switcher.

An empty Intel surface demonstrates the missing capability before it explains it.
The Telescope is a lens with owned watch sockets; the Radar is a radius crossed by
a contact. Their renders are the subject of the plate, and the plate routes directly
to Orbit when installation is the next action. Reports lead with a visual verdict:
combat outcome, surviving/lost formations and round balance precede prose.

### I6a · Feedback stays where the state changed

A mutation's authoritative planet view remains the outcome, and the changed meter,
render, count or world state acknowledges it in place. A toast is supporting speech,
not the only evidence. Informational speech remains long enough to perceive; a refusal
remains longer and can be dismissed. Reduced-motion users receive the same state change
without depending on a sweep, pulse or morph.

### I6b · Capacity, condition and protection are shapes before they are prose

Anything rationed into slots is rendered as a **rack**, with every owned slot in a stable
position and its occupant inside it. An empty slot remains visible and visibly empty. A fraction
may confirm the rack, but a row of generic filled pips is not enough: it says that something is
used without saying what is using it. Orbit names the satellite in each socket; Telescope names
the world in each watch socket.

Anything depleted and restored is rendered as **current / maximum** with a meter. The Aegis is
not merely an owned level or a prose promise: its standing shield, full capacity and hourly
recovery are visible together. Zero remains a valid condition of an owned Aegis, never the same
state as having no Aegis.

Anything that protects unlike resources by unlike amounts is rendered **per resource**. The
Vault shows how much alloy, crystal and deuterium in the present stock is safe, including a real
zero. A combined safe/risk total may lead as the verdict, but it may never be the only figure;
otherwise the interface erases the asymmetric rule the player must make decisions against.

### I7 · A string in a component is a string that exists in one language

Every word a player reads lives in `apps/web/src/i18n/locales/`, keyed by the surface it belongs
to. Nothing is shared between surfaces: two controls that read identically today are still two
controls, because the day one of them is reworded — or translated differently, which happens
constantly between two languages — the other must not move with it.

**A sentence is translated whole, never assembled in JSX.** `Short {alloy} and {crystal}` hard-codes
where the verb sits, and Turkish puts it last. Anything with markup inside it goes through `<Trans>`
with numbered slots; anything with a figure in it takes the figure as a named value. The same rule
covers punctuation that looks like layout: `%40` and `40%` differ by which side the language puts
the sign on, so even that is a translated string rather than a template literal.

**The exception is a proper noun the product owns.** "Astera Online" is the name of the game (D54)
and does not get a Turkish form. Everything else does, including ship classes — "Wasp" carries
*cheap, fast, swarm* to an English reader and nothing at all to a Turkish one, so it is Atmaca.

### I8 · The language control is visible, not buried

Two languages is a pair, not a list, so it is a segmented control with both options on screen —
never a dropdown. The person who needs it is by definition the person who cannot read the label on
the menu that would take them to it, which is also why each option is written in its own language
("Türkçe", never "Turkish").

It appears twice on purpose. In the commander sheet, beside the galaxy and sign-out, because which
language you read the world in is an account fact and that is the one surface about the account
rather than the world. And on the front door, because a visitor who landed in the wrong language
has no account yet and cannot reach a sheet that only exists after they sign in.
