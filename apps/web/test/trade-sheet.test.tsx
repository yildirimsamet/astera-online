import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRADE, quoteTrade, transferCargoCapacity } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { PlanetView } from '../src/api/schemas.js';
import { full } from '../src/lib/format.js';
import { planTradeRoute } from '../src/lib/navigation.js';
import type { TradeShipEvent } from '../src/lib/trade.js';
import { TradeSheet } from '../src/screens/TradeSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

/**
 * TİCARET KONVOYU — THE SCREEN THE WHOLE FEATURE IS DECIDED ON. D156.
 *
 * Everything under this sheet was already green before it existed: the rules, the
 * table, the service, the route and the craft. So the only thing that can be wrong
 * here is the thing this file tests — whether the player can SEE the decision, and
 * whether the screen and the server agree about what is legal.
 *
 * THE SECOND HALF IS THE ONE THAT MATTERS MOST. `services/trade.ts` refuses in a
 * fixed order, and a sheet that enables Send for a launch the server then refuses
 * is the exact bug D155 records on the pirate lane. Every refusal below is named
 * after the server code it maps to, so the two ladders can be compared row by row
 * rather than by reading two files side by side.
 */

const NOW = Date.now();
const SEASON_START = new Date(NOW - 600 * 60_000);

const merchant = (over: Partial<TradeShipEvent> = {}): TradeShipEvent => ({
  id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11',
  kind: 'TRADE_SHIP',
  startsAt: new Date(NOW - 30 * 60_000),
  endsAt: new Date(NOW + 150 * 60_000),
  rate: TRADE.rate,
  appearsAtMinute: 570,
  expiresAtMinute: 750,
  orbit: {
    radius: 1_100,
    period: (2 * Math.PI * 1_100) / TRADE.speed,
    phase: 0.7,
    inclination: 0.4,
    ascendingNode: 1.9,
    speed: TRADE.speed,
  },
  ...over,
});

/** A world that can actually fly the owner's worked example. */
const trader = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
): PlanetView => planetView(
  { fleet: { ATLAS: 12, DART: 4 }, ...over },
  { alloy: 5_000, crystal: 5_000, deuterium: 5_000, ...stock },
);

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: vi.fn<typeof globalThis.fetch>() });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
};

const sheet = (
  props: {
    planet?: PlanetView;
    event?: TradeShipEvent;
    onAim?: (at: { x: number; y: number; z: number } | null) => void;
    onLaunched?: () => void;
  } = {},
) => render(
  <TradeSheet
    merchant={props.event ?? merchant()}
    seasonStart={SEASON_START}
    planet={props.planet ?? trader()}
    onClose={vi.fn()}
    onLaunched={props.onLaunched ?? vi.fn()}
    {...(props.onAim ? { onAim: props.onAim } : {})}
  />,
  { wrapper },
);

/** The one control whose label carries the refusal. */
const commit = (): HTMLElement => screen.getByTestId('trade-commit');

/**
 * Drag a range input to a value.
 *
 * `userEvent` has no gesture for a slider, and `fireEvent.change` on a controlled
 * React input needs the native setter or React's own value tracker swallows the
 * event as a no-op. This is the standard workaround and it is what a drag does.
 */
const setAmount = (name: RegExp, value: number): void => {
  fireEvent.change(screen.getByRole('slider', { name }), {
    target: { value: String(value) },
  });
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

/* ── the arithmetic, before any pixels ───────────────────────── */

describe('planTradeRoute', () => {
  it('solves the meeting with the same interceptOrbit the server runs', () => {
    const route = planTradeRoute(
      { x: 0, y: 0, z: 0 },
      { orbit: merchant().orbit, expiresAtMinute: 750 },
      600,
      { ATLAS: 12 },
      { ATLAS: 12 },
      {},
      {},
    );
    expect(route).not.toBeNull();
    expect(route?.oneWayMinutes).toBeGreaterThan(0);
    // The rendezvous is a point in GAME units — `scene.ts` scales on the way to
    // the disc, and solving in world units would aim the convoy at a tenth of the
    // distance.
    const at = route?.rendezvous;
    expect(at).toBeDefined();
    expect(Math.hypot(at?.x ?? 0, at?.y ?? 0, at?.z ?? 0)).toBeCloseTo(1_100, 6);
  });

  it('refuses when the window shuts before anything could arrive', () => {
    const route = planTradeRoute(
      { x: 0, y: 0, z: 0 },
      { orbit: merchant().orbit, expiresAtMinute: 601 },
      600,
      { ATLAS: 12 },
      { ATLAS: 12 },
      {},
      {},
    );
    expect(route).toBeNull();
  });

  it('has no route at all with nothing selected', () => {
    expect(planTradeRoute(
      { x: 0, y: 0, z: 0 },
      { orbit: merchant().orbit, expiresAtMinute: 750 },
      600,
      {},
      { ATLAS: 12 },
      {},
      {},
    )).toBeNull();
  });

  it('charges both legs of fuel off the rendezvous distance, like the service does', () => {
    const route = planTradeRoute(
      { x: 0, y: 0, z: 0 },
      { orbit: merchant().orbit, expiresAtMinute: 750 },
      600,
      { ATLAS: 12 },
      { ATLAS: 12 },
      {},
      {},
    );
    expect(route?.fuel).toBeGreaterThan(0);
  });
});

/* ── the owner's worked example ──────────────────────────────── */

describe('the counter opens on a trade that already works', () => {
  /**
   * OWNER REPORT: *"Her şeyi doğru ayarlamalıyım ki en alttaki buton aktif olsun.
   * Kullanıcıya mı bırakacağız bunları? Oranlar belli."*
   *
   * The rate is published and fixed, so the sheet already knows what a full trade
   * looks like the moment there is a hold to put it in. Picking a carrier is the
   * only thing a commander has to do before Send is live; everything after that is
   * them choosing something OTHER than the maximum.
   */
  it('is live after one press, with nothing else configured', async () => {
    sheet();
    const user = userEvent.setup();
    expect(commit()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /max atlas/i }));
    expect(commit()).toBeEnabled();
    expect(commit()).toHaveTextContent(/send convoy/i);
  });

  it('offers only the three hulls with a hold', () => {
    sheet();
    // Owner instruction: *"Filo yollarken sadece cargo gemilerimizi seçebilmeliyiz."*
    // A Dart in a trade convoy costs a bay, bulk and fuel and carries nothing.
    for (const carrier of ['Courier', 'Wayfarer', 'Atlas']) {
      expect(screen.getByRole('button', { name: new RegExp(`max ${carrier}`, 'i') }))
        .toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /max dart/i })).toBeNull();
  });
});

describe('the split the owner described', () => {
  /**
   * *"180 alaşım göndermek olarak ayarladıysam, 2 döteryum isterim değil mi,
   * otomatik max ayarlanmalı. Döteryumu kendim kaydırarak 1'e çekersem, alacağım
   * otomatik olarak 1 döteryum, 30 kristal olmalı."*
   *
   * One slider, two readouts. The dearer good leads and the cheaper absorbs the
   * remainder exactly, so every unit paid for comes home and there is no leftover
   * for the player to notice, understand and clean up.
   */
  const openWith180Alloy = async (): Promise<void> => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max courier/i }));
    setAmount(/alloy to give/i, 180);
  };

  it('tops the ask up to two deuterium on its own', async () => {
    sheet({ planet: trader({ fleet: { COURIER: 1 } }) });
    await openWith180Alloy();

    expect(screen.getByTestId('trade-offer')).toHaveTextContent('180');
    expect(screen.getByTestId('trade-split').querySelector('[data-take="deuterium"]'))
      .toHaveTextContent('2');
    expect(screen.getByTestId('trade-split').querySelector('[data-take="crystal"]'))
      .toHaveTextContent('0');
  });

  it('pays the rest in crystal the moment the deuterium is dragged down', async () => {
    sheet({ planet: trader({ fleet: { COURIER: 1 } }) });
    await openWith180Alloy();
    setAmount(/what you take/i, 1);

    expect(screen.getByTestId('trade-split').querySelector('[data-take="deuterium"]'))
      .toHaveTextContent('1');
    expect(screen.getByTestId('trade-split').querySelector('[data-take="crystal"]'))
      .toHaveTextContent('30');
    expect(commit()).toBeEnabled();
  });

  it('leaves the merchant nothing, wherever the slider sits', async () => {
    sheet({ planet: trader({ fleet: { COURIER: 1 } }) });
    await openWith180Alloy();
    for (const at of [0, 1, 2]) {
      setAmount(/what you take/i, at);
      expect(commit(), `split at ${String(at)}`).toBeEnabled();
    }
  });
});

describe('the ask reads in the direction the slider moves', () => {
  /**
   * OWNER INSTRUCTION: *"Al kısmında alınan, yani tercih edilen sağda olmalı,
   * çünkü slider'ı o tarafa doğru çekiyoruz."*
   *
   * The slider's value IS the dear good, so dragging right buys more of it — and
   * the two readouts sat dear-first, which put the number that grows on the left
   * of the control that grows it. A readout that moves against its own handle is a
   * control the player has to translate before they can use it.
   */
  it('puts the good the handle buys on the right, under its own end', () => {
    sheet({ planet: trader({ fleet: { ATLAS: 1 } }, { alloy: 50_000 }) });
    const split = screen.getByTestId('trade-split');
    const marks = [...split.querySelectorAll('[data-take]')]
      .map((node) => node.getAttribute('data-take'));
    // Giving alloy buys crystal and deuterium; deuterium is the dear one.
    expect(marks).toEqual(['crystal', 'deuterium']);
    // And the labels under the ends agree with them, left to right.
    expect(split.textContent.indexOf('Crystal')).toBeLessThan(
      split.textContent.indexOf('Deuterium'),
    );
  });

  it('keeps the pairing whichever good is being given', async () => {
    sheet({ planet: trader({ fleet: { ATLAS: 1 } }, { deuterium: 2_000 }) });
    await userEvent.setup().click(screen.getByRole('button', { name: /^Deuterium$/i }));
    const marks = [...screen.getByTestId('trade-split').querySelectorAll('[data-take]')]
      .map((node) => node.getAttribute('data-take'));
    // Giving deuterium buys alloy and crystal; crystal is the dear one.
    expect(marks).toEqual(['alloy', 'crystal']);
  });
});

describe('why a full store still buys so little', () => {
  /**
   * OWNER REPORT: *"Bir sürü döteryumum var ama örneğin sadece 20-30 tane
   * verebiliyorum."*
   *
   * Because the convoy is sized by the leg that carries the most, and for a
   * commander selling the dear good that is always the way HOME: twenty deuterium
   * is twenty units of hold going out and eighteen hundred coming back. The screen
   * stated the ceiling and named what it bought, and never once said which of the
   * two legs had set it — so a hold of 6,000 next to an offer of 32 read as a bug.
   *
   * Both legs are drawn now, against the room they are competing for, and the
   * sentence appears only when the return is the binding one. D142: a quantity the
   * player must judge is drawn, not implied.
   */
  /** Selling the DEAR good: a little goes out and a great deal comes back. */
  const sellingDeuterium = async (): Promise<void> => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max atlas/i }));
    await user.click(screen.getByRole('button', { name: /^Deuterium$/i }));
  };

  it('draws both legs against the convoy’s room', async () => {
    sheet({ planet: trader({ fleet: { ATLAS: 1 } }, { deuterium: 2_000 }) });
    await sellingDeuterium();
    const legs = screen.getByTestId('trade-legs');
    expect(legs).toHaveTextContent(/out/i);
    expect(legs).toHaveTextContent(/home/i);
    // Through the shared formatter, so the assertion reads the grouped figure a
    // player sees rather than the raw one.
    expect(legs).toHaveTextContent(full(transferCargoCapacity({ ATLAS: 1 })));
  });

  it('says the return leg is the limit when the return leg is the limit', async () => {
    sheet({ planet: trader({ fleet: { ATLAS: 1 } }, { deuterium: 2_000 }) });
    await sellingDeuterium();
    expect(screen.getByTestId('trade-legs')).toHaveTextContent(/carries home/i);
  });

  it('says nothing of the sort when the offer is the bigger pile', async () => {
    // Alloy out, deuterium home: 2,880 units of alloy leave and 32 come back.
    sheet({ planet: trader({ fleet: { ATLAS: 1 } }, { alloy: 50_000 }) });
    await userEvent.setup().click(screen.getByRole('button', { name: /max atlas/i }));
    expect(screen.getByTestId('trade-legs')).not.toHaveTextContent(/carries home/i);
  });
});

describe('the ceiling says what it is', () => {
  /**
   * OWNER REPORT: *"Kayan barları sağa sola çekiyorum, benim maximumum ne belli
   * değil, bir halt belli değil."*
   *
   * A number alone is half an answer. Which of the three walls is binding decides
   * what the commander should do about it — wait for the mine, or add a ship — and
   * only the sheet knows which one it hit.
   */
  it('blames the convoy when the hold is the smaller wall', async () => {
    sheet({ planet: trader({ fleet: { COURIER: 1 } }, { alloy: 50_000 }) });
    await userEvent.setup().click(screen.getByRole('button', { name: /max courier/i }));
    expect(screen.getByTestId('trade-ceiling')).toHaveTextContent(/grow the convoy/i);
  });

  /**
   * AND IT SAYS WHAT THE CEILING IS WORTH, WHICH IS WHERE ITS LAST DIGITS COME
   * FROM. Owner report against an Atlas: *"Kapasitesi 6k ama bana max 5.940 alaşım
   * yüklememe izin veriyor. Neden?"*
   *
   * Because 6,000 alloy is not a whole number of deuterium and 5,940 is exactly
   * sixty-six of them. The old line claimed *"konvoyun ancak bunu taşır"*, which is
   * simply false — the convoy carries 6,000 — so the sixty-unit gap looked like a
   * fee, which is the first thing the owner ruled out. Stating the ceiling's worth
   * makes the figure mean something instead of looking shaved.
   */
  it('states what the ceiling buys, so its last digits are not a mystery', async () => {
    sheet({ planet: trader({ fleet: { ATLAS: 1 } }, { alloy: 50_000 }) });
    await userEvent.setup().click(screen.getByRole('button', { name: /max atlas/i }));
    const hold = transferCargoCapacity({ ATLAS: 1 });
    const top = Number(screen.getByTestId('trade-offer').textContent.replace(/\D/g, ''));
    expect(top).toBeLessThanOrEqual(hold);
    // 5,940 alloy is exactly 66 deuterium, and the line has to say so.
    expect(screen.getByTestId('trade-ceiling'))
      .toHaveTextContent(new RegExp(`${String(top / 90)}\\s*Deuterium`, 'i'));
  });

  it('blames the store when the store is the smaller wall', async () => {
    sheet({ planet: trader({ fleet: { ATLAS: 4 } }, { alloy: 90 }) });
    await userEvent.setup().click(screen.getByRole('button', { name: /max atlas/i }));
    expect(screen.getByTestId('trade-ceiling')).toHaveTextContent(/all this world has/i);
  });

  it('never lets the offer past its own ceiling, however hard it is dragged', async () => {
    sheet({ planet: trader({ fleet: { COURIER: 1 } }, { alloy: 50_000 }) });
    await userEvent.setup().click(screen.getByRole('button', { name: /max courier/i }));
    setAmount(/alloy to give/i, 50_000);
    // The hold, not the store — a Courier carries 700 and the offer has to fit in it.
    expect(Number(screen.getByTestId('trade-offer').textContent.replace(/\D/g, '')))
      .toBeLessThanOrEqual(transferCargoCapacity({ COURIER: 1 }));
    expect(commit()).toBeEnabled();
  });

  it('shrinks the offer with the convoy rather than refusing afterwards', async () => {
    sheet({ planet: trader({ fleet: { ATLAS: 2 } }, { alloy: 50_000 }) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max atlas/i }));
    const big = Number(screen.getByTestId('trade-offer').textContent.replace(/\D/g, ''));

    await user.click(screen.getByRole('button', { name: /fewer atlas/i }));
    const small = Number(screen.getByTestId('trade-offer').textContent.replace(/\D/g, ''));
    expect(small).toBeLessThan(big);
    expect(commit()).toBeEnabled();
  });
});

describe('switching which good you give', () => {
  /**
   * OWNER REPORT: *"Ticaret gemisi focus sheetinde kaynak takas sliderları bug'lı,
   * kaynak degisimi yapınca max gibi stateler birbirine giriyor."*
   *
   * Three pieces of state describe one trade — which good leaves, how much of it,
   * and how the ask is split — and two of them are meaningless against the wrong
   * third. A ceiling of 5,940 belongs to alloy; carried onto a deuterium offer it
   * is thirty times the store. A split of "sixty deuterium" belongs to an alloy
   * offer; carried onto a deuterium offer there is no deuterium to take at all.
   *
   * The sweep is over every ORDER of switches rather than a single path, because
   * the failure is a stale value surviving a transition and any one path only
   * proves the transition it walks.
   */
  const goods = ['Alloy', 'Crystal', 'Deuterium'] as const;

  it('leaves no state behind, in any order of switches', async () => {
    sheet({ planet: trader({ fleet: { ATLAS: 2 } }, { alloy: 50_000, crystal: 25_000, deuterium: 2_000 }) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max atlas/i }));

    for (const good of [...goods, ...goods].reverse()) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^${good}$`, 'i') }));
      // Whatever the sheet is showing after the switch has to be a legal trade,
      // and the commit has to be live without the player touching anything else.
      expect(commit(), good).toBeEnabled();
      const offered = Number(screen.getByTestId('trade-offer').textContent.replace(/\D/g, ''));
      expect(offered, good).toBeGreaterThan(0);
      // The ceiling belongs to the good on screen, never to the one before it.
      expect(screen.getByTestId('trade-ceiling').textContent).toContain(
        screen.getByTestId('trade-offer').textContent,
      );
    }
  });

  it('carries no split from the good before it', async () => {
    sheet({ planet: trader({ fleet: { ATLAS: 2 } }, { alloy: 50_000, deuterium: 2_000 }) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max atlas/i }));

    // Drag the alloy trade's split to its cheap end, then change the good.
    setAmount(/what you take/i, 0);
    await user.click(screen.getByRole('button', { name: /^Deuterium$/i }));

    // The new trade opens at ITS maximum, not at the old trade's floor.
    const split = screen.getByRole('slider', { name: /what you take/i });
    expect(split).toHaveValue(split.getAttribute('max'));
    expect(commit()).toBeEnabled();
  });

  it('keeps the offer inside the new good’s store', async () => {
    // Deuterium is the scarce store; an alloy ceiling carried onto it would be
    // thirty times what this world holds.
    sheet({ planet: trader({ fleet: { ATLAS: 2 } }, { alloy: 50_000, deuterium: 120 }) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max atlas/i }));
    await user.click(screen.getByRole('button', { name: /^Deuterium$/i }));

    const offered = Number(screen.getByTestId('trade-offer').textContent.replace(/\D/g, ''));
    expect(offered).toBeLessThanOrEqual(120);
    expect(commit()).toBeEnabled();
  });
});

describe('the refusals a commander can still meet', () => {
  /**
   * The controls above cannot produce an unbalanced swap, an over-full hold or an
   * offer bigger than the store, so those rungs of `services/trade.ts`'s ladder are
   * unreachable from this screen by construction — which is the point of the
   * rebuild. What remains are the refusals that are about the WORLD rather than
   * about the trade, and every one of them still states its own reason.
   */
  it('EMPTY_FLEET · nothing chosen yet', () => {
    sheet();
    expect(commit()).toBeDisabled();
    expect(commit()).toHaveTextContent(/choose a convoy/i);
  });

  it('TRANSFER_NEEDS_CARGO_HULL · a world with no carrier at all', () => {
    sheet({ planet: trader({ fleet: { DART: 6 } }) });
    expect(commit()).toHaveTextContent(/choose a convoy/i);
    expect(screen.getByTestId('trade-hold')).toHaveTextContent(/pick one/i);
  });

  it('TRADE_WINDOW_CLOSED · the merchant has already gone', async () => {
    sheet({ event: merchant({ startsAt: new Date(NOW - 200 * 60_000), endsAt: new Date(NOW - 1) }) });
    await userEvent.setup().click(screen.getByRole('button', { name: /max atlas/i }));
    expect(commit()).toHaveTextContent(/gone/i);
    expect(commit()).toBeDisabled();
  });

  it('NO_FREE_BAY · every bay is already in the air', async () => {
    sheet({ planet: trader({ flight: { used: 3, total: 3 } }) });
    await userEvent.setup().click(screen.getByRole('button', { name: /max atlas/i }));
    expect(commit()).toHaveTextContent(/bay/i);
    expect(commit()).toBeDisabled();
  });

  it('INSUFFICIENT_FUEL · the tank cannot cover both legs', async () => {
    sheet({ planet: trader({ fleet: { ATLAS: 12 } }, { deuterium: 0, alloy: 5_000 }) });
    await userEvent.setup().click(screen.getByRole('button', { name: /max atlas/i }));
    expect(commit()).toHaveTextContent(/deuterium/i);
    expect(commit()).toBeDisabled();
  });

  it('CANNOT_INTERCEPT · no rendezvous before the window shuts', async () => {
    sheet({ event: merchant({ expiresAtMinute: 601 }) });
    await userEvent.setup().click(screen.getByRole('button', { name: /max atlas/i }));
    expect(commit()).toHaveTextContent(/before your convoy/i);
    expect(commit()).toBeDisabled();
  });

  it('never enables a swap the rules package would refuse', async () => {
    sheet();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max atlas/i }));
    for (const good of ['Alloy', 'Crystal', 'Deuterium']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^${good}$`, 'i') }));
      expect(commit(), good).toBeEnabled();
    }
  });
});

describe('the rendezvous is drawn while the decision is open', () => {
  it('reports the meeting point and takes it back on the way out', async () => {
    const onAim = vi.fn<(at: { x: number; y: number; z: number } | null) => void>();
    const { unmount } = sheet({ onAim });
    await userEvent.setup().click(screen.getByRole('button', { name: /max atlas/i }));

    const aimed = onAim.mock.calls.filter(([at]) => at !== null);
    expect(aimed.length).toBeGreaterThan(0);

    onAim.mockClear();
    unmount();
    // The cleanup is the load-bearing half: a mark left behind is a target sitting
    // on the galaxy as though the player had committed to it. D155.
    expect(onAim).toHaveBeenCalledWith(null);
  });

  it('marks nothing at all while no craft is chosen', () => {
    const onAim = vi.fn<(at: { x: number; y: number; z: number } | null) => void>();
    sheet({ onAim });
    expect(onAim.mock.calls.every(([at]) => at === null)).toBe(true);
  });
});

/* ── the commitment ──────────────────────────────────────────── */

describe('committing the convoy', () => {
  it('takes two presses and warns that nothing can be recalled', async () => {
    sheet();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /max atlas/i }));
    await user.click(screen.getByRole('button', { name: /^Deuterium$/i }));

    await user.click(commit());
    expect(screen.getByText(/A launched convoy cannot be recalled/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('posts exactly the body the server parses', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response(
      JSON.stringify({
        runId: 'r1',
        occurrenceId: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11',
        fleet: { ATLAS: 12 },
        give: { alloy: 0, crystal: 0, deuterium: 1000 },
        want: { alloy: 60000, crystal: 10000, deuterium: 0 },
        rate: TRADE.rate,
        departAt: new Date(NOW).toISOString(),
        arriveAt: new Date(NOW + 900_000).toISOString(),
        flightMinutes: 15,
        intercept: { x: 1, y: 2, z: 3 },
        fuel: 200,
        pending: [],
        planet: trader(),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = new Api({ fetch: fetchMock });
    render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <ToastProvider>
            <TradeSheet
              merchant={merchant()}
              seasonStart={SEASON_START}
              planet={trader()}
              onClose={vi.fn()}
              onLaunched={vi.fn()}
            />
          </ToastProvider>
        </ApiProvider>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max atlas/i }));
    await user.click(screen.getByRole('button', { name: /^Deuterium$/i }));
    setAmount(/deuterium to give/i, 200);
    await user.click(commit());
    await user.click(screen.getByTestId('trade-confirm'));

    const call = fetchMock.mock.calls.at(-1);
    expect(call?.[0]).toContain('/api/trade/launch');
    const raw = call?.[1]?.body;
    const body: unknown = JSON.parse(typeof raw === 'string' ? raw : '{}');
    const posted = body as {
      originPlanetId: string;
      occurrenceId: string;
      fleet: Record<string, number>;
      give: { alloy: number; crystal: number; deuterium: number };
      want: { alloy: number; crystal: number; deuterium: number };
    };
    expect(posted.originPlanetId).toBe('p1');
    expect(posted.occurrenceId).toBe('2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11');
    expect(posted.fleet).toEqual({ ATLAS: 12 });
    // WHAT THE COUNTER DERIVED, SENT VERBATIM — and it balances, which is the one
    // property the server re-checks inside its own transaction.
    expect(posted.give.deuterium).toBe(200);
    expect(quoteTrade(posted.give, posted.want, TRADE.rate).refusal).toBeNull();
    expect(quoteTrade(posted.give, posted.want, TRADE.rate).leftoverUnits).toBe(0);
  });
});

describe('the sheet reads naturally in Turkish', () => {
  it('names the merchant and the two piles in Turkish', async () => {
    await i18n.changeLanguage('tr');
    sheet();
    expect(screen.getByTestId('trade-hold')).toHaveTextContent(/ambar/i);
    expect(screen.getByText('Veriyorum')).toBeInTheDocument();
    expect(screen.getByText('Alıyorum')).toBeInTheDocument();
  });
});
