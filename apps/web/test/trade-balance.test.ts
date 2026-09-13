import { describe, expect, it } from 'vitest';
import { TRADE, quoteTrade, resourcesTotal, transferCargoCapacity, type Fleet } from '@astera/rules';
import { tradeRateSchema } from '../src/api/schemas.js';
import {
  balanceTake,
  dearestFirst,
  largestOffer,
  leadStride,
  offerCeiling,
  offerStep,
} from '../src/lib/trade.js';

/**
 * THE COUNTER DOES THE ARITHMETIC, NOT THE PLAYER. Owner report against the first
 * shipped sheet:
 *
 *   *"Kayan barları sağa sola çekiyorum, benim maximumum ne belli değil, bir halt
 *   belli değil. Her şeyi doğru ayarlamalıyım ki en alttaki buton aktif olsun.
 *   Kullanıcıya mı bırakacağız bunları? Oranlar belli."*
 *
 * The rate is published and fixed, so there is exactly one sensible thing to want:
 * every unit you paid for, back as goods. The first sheet made that an achievement
 * — three free sliders, a leftover the player had to notice and a commit button
 * that stayed dead until all of it happened to line up.
 *
 * SO THE ASK IS A SPLIT, NOT TWO AMOUNTS. The offer buys a fixed number of units;
 * the dearer of the two goods gets a slider and the cheaper absorbs the remainder
 * exactly, which is the owner's D183 worked example:
 *
 *   *"180 alaşım göndermek olarak ayarladıysam, 2 döteryum isterim değil mi,
 *   otomatik max ayarlanmalı. Döteryumu kendim kaydırarak 1'e çekersem, alacağım
 *   otomatik olarak 1 döteryum, 30 kristal olmalı."*
 *
 * D208 changes those quantities to 64 alloy, two deuterium and sixteen crystal;
 * the invariant remains: no leftover and no invalid state.
 */

const RATE = TRADE.rate;
const hold = (fleet: Fleet): number => transferCargoCapacity(fleet, {});

describe('which good the ask is dragged by', () => {
  /*
    THE CHEAPER GOOD IS THE ABSORBER, AND IT HAS TO BE — this is not a preference.
    A remainder can only be spent exactly by a good whose price divides it. On
    D208's 1 · 2 · 32 rate the cheaper price divides the dearer one; the generic
    ordering also supports persisted historical rates.
  */
  it('gives the slider to the dearer good, so the cheaper can absorb any remainder', () => {
    expect(dearestFirst('alloy', RATE)).toEqual(['deuterium', 'crystal']);
    expect(dearestFirst('crystal', RATE)).toEqual(['deuterium', 'alloy']);
    expect(dearestFirst('deuterium', RATE)).toEqual(['crystal', 'alloy']);
  });
});

describe("the owner's worked example", () => {
  /*
    The worked quantities derive from the occurrence rate. The rule is stable:
    the dear good leads, the cheap good absorbs, and the merchant keeps nothing.
    D208's 1 · 2 · 32 makes every lead notch exact; generic tests below retain the
    non-divisible historical case.
  */
  const fleet: Fleet = { ATLAS: 1 };
  const units = 20 * RATE.deuterium;
  const top = Math.floor(units / RATE.deuterium);

  it('tops the ask up to the whole offer in deuterium on its own', () => {
    const want = balanceTake(units, 'alloy', Infinity, RATE, hold(fleet));
    expect(want).toEqual({ alloy: 0, crystal: 0, deuterium: top });
  });

  it('pays the rest in crystal the moment the deuterium is dragged down', () => {
    const want = balanceTake(units, 'alloy', top - 2, RATE, hold(fleet));
    expect(want).toEqual({ alloy: 0, crystal: RATE.deuterium, deuterium: top - 2 });
  });

  it('pays all of it in crystal at the bottom of the slider', () => {
    const want = balanceTake(units, 'alloy', 0, RATE, hold(fleet));
    expect(want).toEqual({ alloy: 0, crystal: units / RATE.crystal, deuterium: 0 });
  });

  it('leaves the merchant nothing, wherever the slider sits', () => {
    for (let lead = 0; lead <= top; lead += 1) {
      const want = balanceTake(units, 'alloy', lead, RATE, hold(fleet));
      expect(quoteTrade({ alloy: units / RATE.alloy, crystal: 0, deuterium: 0 }, want, RATE).leftoverUnits)
        .toBe(0);
    }
  });
});

describe('every offer the counter will take', () => {
  /*
    A SWEEP RATHER THAN A HANDFUL OF CASES. The three goods, three convoys and every
    offer the sheet can produce, against the two things the server would refuse for:
    a swap that does not balance, and a hold that cannot carry it. If the controls
    can reach an invalid state at all, this finds it.
  */
  const convoys: Fleet[] = [{ COURIER: 1 }, { WAYFARER: 1 }, { ATLAS: 2 }];
  const stores = { alloy: 50_000, crystal: 25_000, deuterium: 2_000 } as const;

  for (const give of ['alloy', 'crystal', 'deuterium'] as const) {
    for (const fleet of convoys) {
      it(`never offers an invalid ${give} swap from ${JSON.stringify(fleet)}`, () => {
        const room = hold(fleet);
        const top = largestOffer(stores[give], room, give, RATE);
        expect(top).toBeGreaterThan(0);

        /*
          ON THE GRID THE SLIDER ACTUALLY MOVES ON. One alloy is a single unit and
          the cheapest thing the merchant sells costs three, so it buys nothing at
          all — which is why `offerStep` exists and why the control cannot be
          dragged there. Sweeping off-grid amounts would be testing a state the
          player has no way to reach.
        */
        const step = offerStep(give, RATE);
        const grid = [step, 2 * step, top, top - step, Math.floor(top / 2 / step) * step];
        for (const amount of grid) {
          if (amount <= 0 || amount > top) continue;
          const offer = { alloy: 0, crystal: 0, deuterium: 0, [give]: amount };
          const units = amount * RATE[give];
          const [dear] = dearestFirst(give, RATE);
          const ceiling = Math.floor(units / RATE[dear]);

          for (const lead of [0, 1, ceiling, Math.floor(ceiling / 2)]) {
            const want = balanceTake(units, give, lead, RATE, room);
            const quote = quoteTrade(offer, want, RATE);

            expect(quote.refusal, `${give} ${amount} lead ${lead}`).toBeNull();
            expect(quote.leftoverUnits, `${give} ${amount} lead ${lead}`).toBe(0);
            expect(quote.requiredHold, `${give} ${amount} lead ${lead}`).toBeLessThanOrEqual(room);
            for (const value of Object.values(want)) expect(Number.isInteger(value)).toBe(true);
          }
        }
      });
    }
  }
});

describe('the largest offer a convoy can make', () => {
  it('is nothing at all without a carrier', () => {
    expect(largestOffer(50_000, hold({ DART: 9 }), 'alloy', RATE)).toBe(0);
  });

  /*
    BOTH LEGS, AND THE RETURN IS ALWAYS THE BINDING ONE. Sixty-six deuterium is
    sixty-six units of hold going out and up to 5,940 coming back, so an Atlas is
    full on the way home while the outbound trip rattles. That asymmetry is the
    whole feature, and it is why the ceiling is not simply "what is in the store".

    THE HAUL THAT SETS IT IS THE BULKIEST ONE — all of it in the cheapest good —
    because the player may choose that, and a ceiling that only holds for the
    lightest haul is a slider that lies at one end.
  */
  it('is bounded by the bulkiest haul it could be asked for, not by the store', () => {
    const room = hold({ ATLAS: 1 });
    const top = largestOffer(2_000, room, 'deuterium', RATE);
    /*
      The store holds 2,000; the convoy is what stops it, and it stops it here —
      ON THE OFFER'S OWN STRIDE. This used to assert the raw `floor(room / rate)`
      and passed by coincidence: at the old 6,000 hold that figure happened to land
      on the stride, and at D195b's 9,500 it does not. An offer that ignored the
      stride is exactly what D183 removed — it strands a scrap the counter keeps.
    */
    const step = offerStep('deuterium', RATE);
    expect(top).toBe(Math.floor(Math.floor(room / RATE.deuterium) / step) * step);
    expect(top % step).toBe(0);

    const bulkiest = balanceTake(top * RATE.deuterium, 'deuterium', 0, RATE, room);
    const quote = quoteTrade({ alloy: 0, crystal: 0, deuterium: top }, bulkiest, RATE);
    expect(quote.requiredHold).toBeLessThanOrEqual(room);
    expect(quote.returnVolume).toBeGreaterThan(quote.outboundVolume);
    /*
      And one more deuterium would not fit, which is what makes this the ceiling.
      Asserted on the arithmetic rather than through `balanceTake`, whose hold guard
      would clamp the answer back down to the room and report a fit that is really a
      refusal — testing the guard instead of the rule it guards.
    */
    expect(((top + step + 1) * RATE.deuterium) / RATE.alloy).toBeGreaterThan(room);
  });

  it('is bounded by the store when the store is the smaller wall', () => {
    const step = offerStep('alloy', RATE);
    const top = largestOffer(90, hold({ ATLAS: 1 }), 'alloy', RATE);
    expect(top).toBe(Math.floor(90 / step) * step);
    expect(top + step).toBeGreaterThan(90);
  });

  it('grows with the convoy, which is the answer to every hold refusal', () => {
    const one = largestOffer(50_000, hold({ ATLAS: 1 }), 'alloy', RATE);
    const two = largestOffer(50_000, hold({ ATLAS: 2 }), 'alloy', RATE);
    expect(two).toBeGreaterThan(one);
  });
});

describe('the counter never keeps a scrap, and never rounds one off', () => {
  /**
   * OWNER REPORT, TWO SYMPTOMS AND ONE CAUSE:
   *
   *   *"Sayılar neden 1 2 birim az gösteriliyor? Komisyon falan mı var? Kargo
   *   hacmin 2900 ama 2898 gösteriyor."*
   *   *"Hepsini döteryum seçmeme rağmen 6 kristal kalıyor, neden?"*
   *
   * There is no fee — the owner ruled one out at the planning stage and none was
   * built. Both symptoms were `offerStep` derived against the CHEAPEST good on the
   * counter instead of the dearest. Snapping an alloy offer to a multiple of three
   * makes 2,900 into 2,898, and it leaves an offer that cannot be spent purely on
   * deuterium — 2,898 buys thirty-two of them and strands twenty units, which the
   * cheap good then mops up as six crystal nobody asked for.
   *
   * Against the DEAREST good instead, an alloy offer moves in nineties — ninety
   * alloy being exactly one deuterium — so the top of the split slider is always a
   * whole number of the dear good with nothing left over, and every position below
   * it divides exactly too, because the cheaper price always divides the dearer.
   */
  const room = hold({ COURIER: 1, WAYFARER: 1 });

  /*
    OFF THE RATE, NOT OFF REMEMBERED NUMBERS. These read 90 / 30 / 1, which were
    the answers for 1 · 3 · 90 and stopped being answers at the historical 1 · 2 · 9 rate. What
    the rule actually says is "one whole unit of the dearest good this offer buys",
    and stated that way the assertion survives the next rate change too.
  */
  it('moves the offer in whole units of the dearest good it buys', () => {
    for (const give of ['alloy', 'crystal', 'deuterium'] as const) {
      const step = offerStep(give, RATE);
      const [dear] = dearestFirst(give, RATE);
      expect(step, give).toBeGreaterThan(0);
      // One step of the offer is a whole number of the dear good — that is the rule.
      expect((step * RATE[give]) % RATE[dear], give).toBe(0);
      // And the SMALLEST such step: a coarser grid would cost the player offers.
      for (let smaller = 1; smaller < step; smaller += 1) {
        expect((smaller * RATE[give]) % RATE[dear], `${give} ${String(smaller)}`)
          .not.toBe(0);
      }
    }
  });

  it('takes the top of the slider as pure deuterium, with no crystal tail', () => {
    const top = largestOffer(50_000, room, 'alloy', RATE);
    const want = balanceTake(top * RATE.alloy, 'alloy', Infinity, RATE, room);
    expect(want.crystal).toBe(0);
    expect(want.deuterium).toBe((top * RATE.alloy) / RATE.deuterium);
  });

  it('is exact at every notch of the split, not only at the ends', () => {
    const top = largestOffer(50_000, room, 'alloy', RATE);
    const units = top * RATE.alloy;
    for (let lead = 0; lead <= units / RATE.deuterium; lead += 1) {
      const want = balanceTake(units, 'alloy', lead, RATE, room);
      const quote = quoteTrade({ alloy: top, crystal: 0, deuterium: 0 }, want, RATE);
      expect(quote.leftoverUnits, `lead ${String(lead)}`).toBe(0);
      expect(quote.refusal, `lead ${String(lead)}`).toBeNull();
    }
  });

  /**
   * AND THE SPLIT SNAPS TO A NOTCH THAT CLOSES, WHATEVER IT IS DRAGGED TO. D183.
   *
   * While the cheap price divided the dear one (1 · 3 · 90) every lead closed and
   * the stride was one. At 1 · 2 · 9 it is not: nine is odd, so taking a single
   * deuterium out of an even pile of units leaves an odd one and a unit no good can
   * spend. `leadStride` is the run of leads that do close, and `balanceTake` rounds
   * onto it — the promise is that the merchant keeps nothing, not that the slider
   * lands on the exact integer a thumb stopped at.
   */
  it('rounds the split onto a notch rather than keeping the scrap', () => {
    const stride = leadStride('alloy', RATE);
    expect(stride).toBeGreaterThan(0);
    const units = offerStep('alloy', RATE) * RATE.alloy * 2;
    for (let lead = 0; lead <= units / RATE.deuterium; lead += 1) {
      const want = balanceTake(units, 'alloy', lead, RATE, room);
      // Never above what was asked for, and never a scrap left on the counter.
      expect(want.deuterium, `lead ${String(lead)}`).toBeLessThanOrEqual(lead);
      expect(want.deuterium * RATE.deuterium + want.crystal * RATE.crystal).toBe(units);
    }
  });

  /** A rate whose cheap price divides its dear one is untouched: every lead closes. */
  it('leaves a divisible rate on a stride of one, exactly as before', () => {
    expect(leadStride('alloy', { alloy: 1, crystal: 3, deuterium: 90 })).toBe(1);
    expect(leadStride('crystal', { alloy: 1, crystal: 3, deuterium: 90 })).toBe(1);
  });
});

describe('every notch of the split is reachable, not just the dear end', () => {
  /**
   * OWNER REPORT: *"Veriyorum bölümü 96 döteryum, kristal hiç istemiyorum yani en
   * sola çektim → gelen alaşım 30 adet. Bu ne saçmalık?"*
   *
   * The ceiling was solved against the DEAREST good — "would this offer fit coming
   * home if I took it all in crystal" — which is the LIGHTEST possible haul. Drag
   * the split the other way and the haul is the heaviest one instead: ninety-six
   * deuterium is 8,640 units, and 8,640 units of alloy needs 8,640 of hold in a
   * convoy that has 2,900. `balanceTake` then quietly clamped the split up off its
   * own floor, so the slider sat pinned at the left showing 2,870 crystal and 30
   * alloy — arithmetic that is correct and reads as nonsense.
   *
   * The ceiling is solved against the CHEAPEST good now: the most this convoy can
   * carry home in its BULKIEST form. Every position of the split then fits by
   * construction, the slider runs its whole length, and the answer at the far end
   * is the one the label promises.
   */
  const room = hold({ COURIER: 1, WAYFARER: 1 });

  it('lets the cheap end of the slider actually be the cheap end', () => {
    const top = largestOffer(2_000, room, 'deuterium', RATE);
    const want = balanceTake(top * RATE.deuterium, 'deuterium', 0, RATE, room);
    expect(want.crystal).toBe(0);
    expect(want.alloy).toBe(top * RATE.deuterium);
    expect(resourcesTotal(want)).toBeLessThanOrEqual(room);
  });

  it('fits at BOTH ends of every split, for every good on the counter', () => {
    for (const give of ['alloy', 'crystal', 'deuterium'] as const) {
      const top = largestOffer(50_000, room, give, RATE);
      const units = top * RATE[give];
      const [dear] = dearestFirst(give, RATE);
      for (const lead of [0, Math.floor(units / RATE[dear])]) {
        const want = balanceTake(units, give, lead, RATE, room);
        const offer = { alloy: 0, crystal: 0, deuterium: 0, [give]: top };
        const quote = quoteTrade(offer, want, RATE);
        expect(quote.requiredHold, `${give} at lead ${String(lead)}`).toBeLessThanOrEqual(room);
        expect(quote.leftoverUnits, `${give} at lead ${String(lead)}`).toBe(0);
        expect(quote.refusal, `${give} at lead ${String(lead)}`).toBeNull();
      }
    }
  });

  /*
    THE SPLIT IS NEVER CLAMPED ANY MORE, and that property is worth pinning rather
    than the numbers: a floor that can bind is a slider whose left end is a lie
    about what it does.
  */
  it('never has to push the split up off its own floor', () => {
    for (const give of ['alloy', 'crystal', 'deuterium'] as const) {
      const top = largestOffer(50_000, room, give, RATE);
      const [dear] = dearestFirst(give, RATE);
      expect(balanceTake(top * RATE[give], give, 0, RATE, room)[dear], give).toBe(0);
    }
  });
});

describe('the smallest offer worth making', () => {
  /*
    THE STEP IS ALSO THE FLOOR. Whatever the slider's first notch is, it has to buy
    something: an offer that cannot reach the cheapest good on the counter is a
    payment with no goods against it, which is the `EMPTY_WANT` refusal wearing a
    slider. Three alloy is one crystal; one crystal is three alloy; one deuterium
    is ninety.
  */
  it('buys at least one of the cheaper good, for every good on the counter', () => {
    for (const give of ['alloy', 'crystal', 'deuterium'] as const) {
      const step = offerStep(give, RATE);
      const want = balanceTake(step * RATE[give], give, Infinity, RATE, hold({ ATLAS: 1 }));
      expect(resourcesTotal(want), give).toBeGreaterThan(0);
    }
  });
});

/**
 * THE CEILING AND ITS REASON COME OFF ONE CALCULATION. D166.
 *
 * The sheet printed WHY the offer stops where it does — "all this world has" or
 * "grow the convoy" — and worked that out with its own arithmetic: the ceiling used
 * `rate[cheapest]` (the return leg's wall), the caption used `rate[dearest]`. Two
 * formulas for one number, and they disagreed in the case that matters most.
 *
 * Concretely, giving deuterium with one Atlas (hold 6,000) against a world holding
 * 100 deuterium: the real ceiling is 66, set by what the convoy can carry HOME. The
 * caption's own sum made the convoy wall 6,000, saw 100 < 6,000 and printed "at
 * most 66 — all this world has" over a world that plainly held a hundred. The
 * player was told to wait for production when the fix was to add a ship, which is
 * the Clarity failure the caption exists to prevent.
 */
describe('why the offer stops where it does', () => {
  it('names the wall that actually set the ceiling', () => {
    /*
      THE STORE IS BIG AND THE CONVOY IS SMALL. The figures were 6,000 of hold
      against 100 deuterium, which was convoy-bound at 1 · 3 · 90 (a hundred
      deuterium is 9,000 units and 9,000 alloy does not fit in 6,000) and is store-
      bound at the historical 1 · 2 · 9 rate. The CASE is "the convoy is the shorter of the two",
      so the store moves rather than the assertion.
    */
    const hold = 600;
    const store = 100_000;
    const capped = offerCeiling(store, hold, 'deuterium', RATE);

    expect(capped.top).toBe(largestOffer(store, hold, 'deuterium', RATE));
    // The convoy cannot carry the alloy home, and that — not the store — is it.
    expect(capped.top).toBeLessThan(store);
    expect(capped.wall).toBe('hold');
  });

  it('says the store when the store really is the shorter of the two', () => {
    const capped = offerCeiling(10, 6_000, 'deuterium', RATE);
    expect(capped.top).toBe(10);
    expect(capped.wall).toBe('store');
  });

  /** Whatever the goods, the reason is never a different number from the ceiling. */
  it('never reports a wall that is above the ceiling it returns', () => {
    for (const give of ['alloy', 'crystal', 'deuterium'] as const) {
      for (const store of [0, 10, 500, 50_000]) {
        for (const hold of [0, 900, 6_000, 40_000]) {
          const capped = offerCeiling(store, hold, give, RATE);
          expect(capped.top).toBe(largestOffer(store, hold, give, RATE));
          if (capped.wall === 'store') expect(capped.top).toBeLessThanOrEqual(store);
        }
      }
    }
  });
});


/**
 * THE SPLIT'S ARITHMETIC ASSUMES WHOLE PRICES, AND THE BOUNDARY HAS TO SAY SO.
 * D183.
 *
 * `leadStride` divides the cheap price by `gcd(dear, cheap)`, and a greatest common
 * divisor of two fractions is not a number anybody should reason about — a rate of
 * 1.5 would produce a stride that snaps the split onto positions which leave a
 * remainder, quietly reintroducing the scrap the whole mechanism exists to prevent.
 *
 * `TRADE.rate` is authored as whole numbers and the occurrence freezes what it was
 * dealt, so this is unreachable in practice. It is asserted anyway because the
 * schema is the boundary, and "the code happens to only ever be called correctly"
 * is exactly the assumption that stops being true when somebody edits the table.
 */
describe('what the counter requires of a rate', () => {
  it('is whole numbers, at the wire and in the table', () => {
    for (const good of ['alloy', 'crystal', 'deuterium'] as const) {
      expect(Number.isInteger(RATE[good]), good).toBe(true);
      expect(RATE[good]).toBeGreaterThan(0);
    }
    // The parser refuses a fraction rather than handing one to `gcd`.
    expect(() => tradeRateSchema.parse({ alloy: 1.5, crystal: 2, deuterium: 9 })).toThrow();
    expect(() => tradeRateSchema.parse({ alloy: 0, crystal: 2, deuterium: 9 })).toThrow();
    expect(tradeRateSchema.parse({ ...RATE })).toEqual({ ...RATE });
  });

  /** Whatever the whole-number rate, a stride is a usable positive step. */
  it('produces a workable stride for every whole rate', () => {
    for (const rate of [
      { alloy: 1, crystal: 2, deuterium: 32 },
      { alloy: 1, crystal: 2, deuterium: 9 },
      { alloy: 1, crystal: 3, deuterium: 90 },
      { alloy: 1, crystal: 1, deuterium: 1 },
      { alloy: 2, crystal: 7, deuterium: 13 },
    ]) {
      for (const give of ['alloy', 'crystal', 'deuterium'] as const) {
        const stride = leadStride(give, rate);
        expect(Number.isInteger(stride), `${give} of ${JSON.stringify(rate)}`).toBe(true);
        expect(stride).toBeGreaterThan(0);
      }
    }
  });
});
