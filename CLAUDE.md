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
