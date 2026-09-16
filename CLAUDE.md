# CLAUDE.md — Astera Online

Cold-agent operating manual. Read first each session. **Keep this file small:** only cross-cutting rules needed to avoid wrong implementation belong here. Rationale/history/measurements live in `docs/`; local traps live in file docblocks.

## Product

Astera Online is a **mobile-first persistent multiplayer space game** for up to 300 real players per galaxy. One commander owns one protected capital and may capture up to three colonies. Holdings are private until discovered.

> **The fleet is the bet. The information is the game. The planet is the stake.**

Design: **simple to play, deep through interactions—not more systems.**
Feel: **fun, utopian, epic; a live NASA photograph you can fly through.**

Every feature should strengthen at least one of: `OWNERSHIP · CURIOSITY · COMPETITION · AMBITION · RISK · OPPORTUNITY · RE-ENGAGEMENT · MEMORABILITY · FUN`.

The game must feel:

- **Alive:** player fleets, mining, battles, and public moments visibly happen.
- **Now:** server-timed moments appear on time; predict/reconcile instead of waiting on avoidable round trips.
- **Beautiful:** when gameplay cost is zero, favor scale, depth, light, and spectacle.

## Core loop

```text
DEVELOP → ACCUMULATE → GATHER INTEL → SPOT OPPORTUNITY → CHOOSE TARGET
→ TAKE RISK → DISPATCH → WAIT OFFLINE → OUTCOME → GAIN / LOSS → NEW DECISION
```

Battle reports create new intel. Economy/buildings support this loop; they are not the loop.


## How to work

> **IMPLEMENT → TEST → PLAY → EVALUATE → FIX → CONTINUE**

Decide architecture, libraries, queries, caching, components, internal APIs, tests, and small reversible UX details yourself.

Ask only before changing **core loop, risk/reward, PvP, ownership, seasons, progression, identity, or locked constraints**.

Do not reopen settled questions, polish docs indefinitely, wait for certainty, or redesign working systems speculatively.

If context is lost: `CLAUDE.md → docs/decisions.md → docs/balance.md → code → git log`. Never guess.

### Development discipline

**Tüm geliştirme veya güncellemeleri Test Driven Development methodu ile yapmak zorunlu, şart!.**
**Tek kelime bir kod dahi yazılıyorsa bu method'u uygulamak ZORUNLU, ŞART!**
**ANAYASA ALLAHIN EMRİ ŞART**

1. Requirement'ı analiz et
2. Tüm happy path ve tüm edge case'leri çıkar.
3. Bu task'ı yaparken; nerelere dokunulacak dokunacak? Çalışan bir logic'i kıracakmıyız veya kırabilir miyiz detaylıca incele.
3. Önce testleri yaz/güncelle/ekle
4. Gerekli testleri çalıştır → FAIL
5. Implementation yaz
6. Gerekli testleri çalıştır → PASS
7. Son bir code review yap: eksik, yanlış, hatalı, unutulan bir yer var mı kontrol et. Bir yeri kırdık mı kontrol et.
7. Tüm testleri çalıştır.

### Tasarım/Design discipline

**frontend'de yeni veya güncellenecek bir component, sayfa, section, element, tasarım, design vs her hangi bir şey yaparken, bu 4 kuralı takip etmen ŞART! ZORUNLU!**

#### The four questions every surface must answer

Owner instruction, and they outrank aesthetics on every screen in this game. A surface that
fails one of these is unfinished however finished it looks — and the failure is usually
invisible to whoever built it, because the builder already knows what the number means.

##### 1 · Clarity — does the player understand this?

Putting a value on screen is not the same as making it understood. Beside every figure a
player is meant to act on, they need to be able to answer:

- What does this represent?
- Is a big one good?
- How does it compare to MY equivalent?
- What else is it related to?
- Which decision am I supposed to use it for?

##### 2 · Predictability — can the player anticipate the outcome?

They do not need certainty. This game is *built* on not having it, and a screen that answered
"will I win" would end the bet the core loop is made of. But an outcome nobody can estimate
is indistinguishable from a random one, and it makes the whole intel layer worthless: nobody
pays for a reading that does not narrow anything.

The line: **the player must be able to form an expectation and be wrong about it.** Give the
inputs and the rule; withhold the answer.

##### 3 · Decision support — do they hold what they need to choose?

Rules must be discoverable *where they are used*, in the amount needed *at that moment*. The
two failure modes are equally bad:

- **Too much** — a twenty-page wiki, or every rule on every card.
- **Too little** — dropping the player into a system with no explanation at all.

Progressive disclosure is the answer: the row states the fact, the sheet one tap deeper
states the rule. *The worked example:* the counter cycle decides every fight in the game and
its multipliers appeared in exactly one place — the battle report, after the fleet was
already lost. A rule taught as a post-mortem is not decision support (D124).

And the adjacent case: **a player must be able to sense why a feature exists.** If a mechanic
leaves them asking "why am I doing this", the answer to *what does it get me* and *when
should I use it* is missing from the surface, not from the player.

##### 4 · Interaction cost — how much work is this to use?

Scroll is a cost. So is a tap, and so is a screen change. Ten items a player wants to
COMPARE, at one screen each, is a different product from the same ten at two screens.

On a 350-wide phone, density and screen economy outrank decorative whitespace — but not
blindly: **space must carry a purpose.** The 74px art socket earns its height (a render at
40px reads as a favicon); a paragraph under a collapsed band does not.

#### The question behind all four

**Does this interface SHOW, or does it HELP?** An interface can present every fact a player
needs and still leave them unable to decide, and that is the state this project's screens
were found in. Showing more is not helping more.

Yaptıgın/Güncellediğin/Fixledigin herhangi bir işte tasarım/design ile ilgili yapılması gerekenler varsa asla atlanmamalı!
**Her zaman şunu düşünmelisin: "Oyuncu API'yi anlamaz. Oyuncu gördüğünü anlar, gösterileni bilir!"**
**Sana her hangi bir şey yap dedigimde, bu işin tasarım/design kısmını sakın atlama. Çok önemli bak bu konu.**

## Quality bar

> **CODE WITHOUT TESTS IS UNFINISHED WORK.**

```bash
pnpm verify
```

Required: zero type errors, zero lint errors, expected tests green.

`pnpm lint` gives type-aware ESLint a 4 GB Node heap through the root script. The full workspace
regularly exceeds Node's 2 GB default; do not bypass the script with a bare `eslint .` invocation.

- Ban `any`/compiler-silencing casts; parse untrusted boundaries with Zod.
- Diagnose root cause before changing code/tests.
- Test adversarial input, concurrency, failure, and time.
- No silent placeholders in core gameplay.
- Visually verify frontend changes with `node tools/visual.mjs`.

A new system must create a meaningful decision and strengthen interaction/risk/opportunity/curiosity/return reason without unnecessary micromanagement. If uncertain: **PROTOTYPE → PLAY → OBSERVE → DECIDE**.

Regression signals: loop becomes `BUILD → WAIT → COLLECT → UPGRADE`; resources replace players as the fun; intel→decision→action weakens; micromanagement grows; result is technically impressive but emotionally empty.

## Docs map

Dökümanlar güncel ve kesin bilgiyi içermiyor olabilir. **Kod'un kendisi ve Testler = Kesin Bilgi**

| File                            | Read before                          |
| ------------------------------- | ------------------------------------ |
| `docs/product-vision.md`        | Judging product purpose              |
| `docs/game-design.md`           | Changing system behavior             |
| `docs/balance.md`               | Changing numbers / simulator tuning (Sakın tüm dosyayı okuma, tüm dosya çok uzun. Gerekli kelime ve konuları keserek oku!)  |
| `docs/architecture.md`          | Server architecture                  |
| `docs/deployment.md`            | Shipping / operations                |
| `docs/engineering-standards.md` | Writing code                         |
| `docs/interface.md`             | Screens / interaction                |
| `docs/visual-design.md`         | Art / 3D                             |
| `docs/playtest-log.md`          | Playtesting                          |
| `docs/review-sight.md`          | Touching Telescope/Radar/probe sight |
| `docs/review-onboarding.md`     | Onboarding / new-player experience   |
| `docs/glossary.md`              | Terms                                |

## One thing to remember

> **Build a multiplayer game that leaves players wondering, “What happened?” after they close it.**
