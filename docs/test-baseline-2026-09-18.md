# Değişiklik öncesi test hataları — 2026-09-18

Bu kayıt, kod değiştirilmeden önce başlatılan test çıktısından alınmıştır. Sunucu turu tamamlanmadan koşu durduruldu; liste görülen hataları içerir.

Tam çıktı: `/tmp/blindspace-baseline-tests-2026-09-18.log`

## packages/rules (15)

- the Garbage Collector in the catalogue > costs exactly what the owner set: 10k alloy and 5k crystal, nothing else
- the Garbage Collector in the catalogue > drinks the owner’s hand-set thirst, not what its price would say
- the Garbage Collector in the catalogue > is part of what a fleet is worth, never part of what it can fire
- the pirate lane is untouched by the collector > keeps the recorded admission prices and field membership through hull recalibration
- the deuterium refinery > uses the monthly plant curve independently of contested mining
- the authored Academy boundary > makes the Academy exit whole for the rewards its lessons claimed
- the pirate hoard > caps the deuterium a hoard can carry at a tankful, and keeps the levels apart
- the immutable convoy reward quote > uses combat-only firepower, independent quality thresholds and a proportional cargo clamp
- monthly economy > links the other purchases and moving targets to the same economy
- what a transport carries > carries more than it cost, at every rung
- the deuterium a hull costs to build > SENTINEL charges the monthly tier recipe
- the deuterium a hull costs to build > PRAETORIAN charges the monthly tier recipe
- the deuterium a hull costs to build > links deuterium to the monthly resource recipes
- the owner-selected 32:16:1 resource value > does not silently reprice the current Dominion fleet value
- finite monthly external supply > caps each day independently, including every possible captured pirate hull and its debris

## packages/sim (3)

- economic fleet calibration uses the real resolver > sizes only whole, affordable hulls, including zero and sub-hull budgets
- economic fleet calibration uses the real resolver > compares physical wallets without converting spare ore or granting missing fuel
- economic fleet calibration uses the real resolver > prices raid proceeds after real cargo, losses, salvage and prepaid fuel

## apps/web (1)

- predicting an instrument > declines an instrument that has nothing left to sell

## apps/server (1)

- every payload the client parses > GET /api/planet parses
