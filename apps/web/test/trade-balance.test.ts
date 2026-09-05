import { describe, expect, it } from 'vitest';
import { TRADE, quoteTrade, resourcesTotal, transferCargoCapacity, type Fleet } from '@astera/rules';
import {
  balanceTake,
  dearestFirst,
  largestOffer,
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
 * exactly, which is the owner's own worked example:
 *
 *   *"180 alaşım göndermek olarak ayarladıysam, 2 döteryum isterim değil mi,
 *   otomatik max ayarlanmalı. Döteryumu kendim kaydırarak 1'e çekersem, alacağım
 *   otomatik olarak 1 döteryum, 30 kristal olmalı."*
 *
 * There is no leftover to explain because there is no leftover, and no invalid
 * state to refuse because the controls cannot produce one.
 */

const RATE = TRADE.rate;
const hold = (fleet: Fleet): number => transferCargoCapacity(fleet);

describe('which good the ask is dragged by', () => {
  /*
    THE CHEAPER GOOD IS THE ABSORBER, AND IT HAS TO BE — this is not a preference.
    A remainder can only be spent exactly by a good whose price divides it, and the
    cheaper price always divides the dearer one in this table (1 · 3 · 90). Hand the
    slider to the cheap good instead and the dear one is left with a fraction: three
    crystal of offer cannot become 0.033 deuterium.
  */
  it('gives the slider to the dearer good, so the cheaper can absorb any remainder', () => {
    expect(dearestFirst('alloy', RATE)).toEqual(['deuterium', 'crystal']);
    expect(dearestFirst('crystal', RATE)).toEqual(['deuterium', 'alloy']);
    expect(dearestFirst('deuterium', RATE)).toEqual(['crystal', 'alloy']);
  });
});

describe("the owner's worked example", () => {
  const fleet: Fleet = { ATLAS: 1 };
  const units = 180 * RATE.alloy;

  it('tops the ask up to two deuterium on its own', () => {
    const want = balanceTake(units, 'alloy', Infinity, RATE, hold(fleet));
    expect(want).toEqual({ alloy: 0, crystal: 0, deuterium: 2 });
  });

  it('pays the rest in crystal the moment the deuterium is dragged down', () => {
    const want = balanceTake(units, 'alloy', 1, RATE, hold(fleet));
    expect(want).toEqual({ alloy: 0, crystal: 30, deuterium: 1 });
  });

  it('pays all of it in crystal at the bottom of the slider', () => {
    const want = balanceTake(units, 'alloy', 0, RATE, hold(fleet));
    expect(want).toEqual({ alloy: 0, crystal: 60, deuterium: 0 });
  });

  it('leaves the merchant nothing, wherever the slider sits', () => {
    for (let lead = 0; lead <= 2; lead += 1) {
      const want = balanceTake(units, 'alloy', lead, RATE, hold(fleet));
      expect(quoteTrade({ alloy: 180, crystal: 0, deuterium: 0 }, want, RATE).leftoverUnits).toBe(0);
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
    // The store holds 2,000; the convoy is what stops it, and it stops it here.
    expect(top).toBe(Math.floor(room / RATE.deuterium));

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
    expect(((top + 1) * RATE.deuterium) / RATE.alloy).toBeGreaterThan(room);
  });

  it('is bounded by the store when the store is the smaller wall', () => {
    expect(largestOffer(90, hold({ ATLAS: 1 }), 'alloy', RATE)).toBe(90);
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

  it('moves the offer in whole units of the dearest good it buys', () => {
    expect(offerStep('alloy', RATE)).toBe(90);
    expect(offerStep('crystal', RATE)).toBe(30);
    expect(offerStep('deuterium', RATE)).toBe(1);
  });

  it('takes the top of the slider as pure deuterium, with no crystal tail', () => {
    const top = largestOffer(50_000, room, 'alloy', RATE);
    const want = balanceTake(top * RATE.alloy, 'alloy', Infinity, RATE, room);
    expect(want.crystal).toBe(0);
    expect(want.deuterium).toBe(top / 90);
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
    const hold = 6_000;
    const store = 100;
    const capped = offerCeiling(store, hold, 'deuterium', RATE);

    expect(capped.top).toBe(largestOffer(store, hold, 'deuterium', RATE));
    // The convoy cannot carry the crystal home, and that — not the store — is it.
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
