# Battle reports — what they are, and what each one must answer

Read before touching `apps/web/src/screens/BattleReports.tsx`, `apps/server/src/services/reports.ts`
or the `battle_reports` table. Sits under `game-design.md` and `decisions.md`.

> **A commander spends days building a fleet. The report is the only thing they get back.**
> Owner report: *"Bir sürü effect tasarım görsel vs. var ama günün sonunda kullanıcılar bir halt
> anlamıyor."* The data is almost all there. The failure is that the surface never answers, in
> order, the four questions a reader actually arrives with.

## The four questions a report must answer, in this order

1. **What happened?** One verdict, in the reader's own frame, and why that verdict and not
   another.
2. **What was on the other side?** Including — stated separately — whether there was ground
   defence, and what it did.
3. **Who died, and when?** Round by round, hulls rather than damage abstractions, with the
   reader's own survivors running alongside.
4. **What did it change?** Loot, Dominion, wreckage, disruption, salvage, capture.

Anything that does not serve one of those four is decoration and belongs below all of them or
nowhere. Measured against the four questions in `interface.md`, the old sheet failed
**Clarity** (an empty rounds plate for a walkover) and **Interaction cost** (twelve sections in
one scroll, the least consequential ones first).

## The seven reports

`kind` splits two ways in the payload and seven ways to a reader. Each row lists only what
differs from the common spine above.

| # | Situation | Discriminator | Carries | Must NOT show |
|---|-----------|---------------|---------|---------------|
| A1 | You raided a commander | `attacking`, `pirate: null`, `neutral: false` | loot, Dominion, wreck, clans, cargo cap | defence salvage, disruption (defender's) |
| A2 | You raided a neutral world | `neutral: true` | loot, wreck | a commander name, clan block |
| A3 | You raided a pirate | `pirate: {...}` | `damageMult` line, `capturedHull`, hoard | Dominion (a pirate moves none), disruption, a route's far end, ground defence |
| A4 | You were raided | `attacking: false` | defence salvage, disrupted minutes, your Aegis, **the whole force that arrived** (`theirFleet`, D164) | nothing about the attacker's HOME world |
| B1 | Your strategic weapon struck | `STRATEGIC`, `attacking` | level changes, destroyed orders, halved stock | — |
| B2 | You were struck | `STRATEGIC`, defending | the same, as losses | — |
| B3 | The strike was intercepted | `outcome: 'INTERCEPTED'` | which instrument fired (`trigger`) | damage figures that did not happen |

### The fog line, and why the report looks thin without it on screen

`reports.ts`: **a report tells you what someone brought, not what they kept.** The database
holds `attackerFleet` and `defenderFleet`. The query hands each side its own, because the
caller's roster minus the caller's losses is the caller's survivors — and it hands the
DEFENDER the attacker's roster as well (D164), because that fleet spent its engagement in
orbit over the defender's own world and naming it reports what they watched. The defender's
board is never handed the other way: what was standing at the target is a probe's product.

What that means for this surface:

- **Defending**, the arrived force IS the answer to "what was on the other side", so the
  bounded framing below is replaced rather than softened — there is no floor to state. It
  draws as one `SurvivorBar` per hull with the colours inverted (`side="theirs"`): survivors
  in the threat hue, because they are flying home with your ore; kills in the gain hue.
- **Attacking**, on **DECISIVE** the opponent's losses ARE their whole board, so "what was on
  the other side" is fully answered and should be stated as complete.
- **Attacking**, on **PARTIAL** and **REPELLED** the player knows a FLOOR and no more. The old
  sheet rendered that as an empty or short list with no explanation, which reads as a broken
  report rather than as a bounded one. It must say *what it knows*, that it is a floor, and
  that a probe is what closes the gap.
- A report written before `attacker_fleet` existed carries an empty roster, and a defender
  falls back to the wreckage exactly as an attacker does.

## The cases a battle can actually be in

Measured against `resolveCombat`, not assumed. Every row below is a real outcome of the
shipped resolver.

| Case | Setup | Result |
|------|-------|--------|
| Walkover | attacker vs no defending line, with or without Aegis | **DECISIVE, ZERO rounds**, shield untouched, no losses either side |
| Guarded Aegis vs Nullifier | Nullifiers vs units behind a shield | Nullifier adds shield-only damage; bonus never spills into units |
| Ground guns only | fleet vs Thorns | PARTIAL; **60% of the guns walk back out of their own wreckage** |
| Mutual annihilation | even trade | REPELLED, ends early, pays nothing, flies no return leg |
| Repelled clean | small fleet vs Citadels | REPELLED, attacker wiped, **defender loses nothing** |
| Support-only attacker | Couriers alone | REPELLED, all cargo dies, defender untouched (`counterMult` SUPPORT = 0) |
| Shield never breaks | small fleet vs big Aegis | REPELLED, shield still nearly full |
| Early finish | one side emptied | fewer than three rounds — **`rounds.length` is 0..3, never assume 3** |

### The two cases the surface got wrong

**A walkover has no rounds.** `rounds: []` rendered as an empty plate under a "How it went"
heading. The most common raid in the game — hitting an undefended world — produced the least
informative report. It needs its own sentence: *no defending force was standing here.* That
sentence must not claim there was no shield: D173 makes a charged but unguarded Aegis the same
walkover and leaves its charge untouched.

**A clean repel tells the attacker nothing, and did not say so.** `theirLosses` is `{}`, so the
sheet printed an empty list where the reader expected the fight's most valuable product.

## The production defect D173 fixed

Yasin sent 265 ships at a colony whose only craft were two non-combatant Prospectors. Its charged
Aegis made `resolveCombat` manufacture three zero-damage rounds, return `REPELLED` and suppress a
haul even though no defending line existed. The report was internally consistent with that result
and still visibly absurd: hundreds of armed ships displayed zero attack against nobody.

**Owner instruction:** *"Sıfır kişi varsa bu WIN sayılır ve yağmalanabilir kaynakları almaları
lazım."* D173 makes the garrison the first question. With no combat hull or ground gun, the raid is
DECISIVE before a round starts, takes the normal decisive haul, preserves non-combatant Prospectors
and leaves the idle Aegis charge untouched. With a defending line, Aegis and Nullifier continue to
work exactly as D95 specifies.

Held down by `packages/rules/test/aegis-grade.test.ts` and the Prospector server integration test,
including the report, loot-bearing return leg and unchanged shield.
