import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBAT, HULLS, groundSlots, hangarCapacity, hullBulk, type HullId } from '@astera/rules';
import type { PlanetView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { BuildSheet } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { compact, factor } from '../src/lib/format.js';
import { planetView } from './fixtures.js';

type MutationMock = (variables: unknown, options?: unknown) => void;
const build = vi.fn<MutationMock>();
vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return { ...actual, useBuild: () => ({ mutate: build, isPending: false }) };
});

/**
 * G2-e, 2026-11-14: THE SHIPYARD'S ORDER SHEET ON THE GAME KIT. The player's moment: "how many of
 * this hull, and what is it for?" The hull over its sky with where its ships are, what it beats
 * and what beats it, its figures, how many and the room they take, all above the fold; the long
 * reading one tap deeper; the order a weighted press, like Upgrade (owner, 2026-11-12: an order
 * that can be cancelled at half is a single heavy press).
 */

const v2Classes = (root: Element): string[] => [...root.querySelectorAll<HTMLElement>('[class]')]
  .flatMap((node) => [...node.classList])
  .filter((name) => /^(v2-|font-v2|text-micro|text-caption|text-v2|bg-v2|border-v2|text-faint|text-dim|text-bone|text-crystal|legend|num$)/.test(name));

const world = (over: Partial<Omit<PlanetView, 'planet'>> = {}, stock: Partial<PlanetView['planet']> = {}): PlanetView => planetView({
  buildings: { CORE: 8, REFINERY: 8, EXTRACTOR: 7, VAULT: 4, SHIPYARD: 4, HANGAR: 4 },
  fleet: { TALON: 8, DART: 12 },
  fleetAway: { TALON: 3 },
  ground: { THORN: 4 },
  capacity: { hangar: hangarCapacity(4), hangarUsed: 0, ground: groundSlots(8), groundUsed: 0 },
  ...over,
}, { alloy: 48_000, crystal: 16_000, deuterium: 2_400, alloyPerHour: 1_800, crystalPerHour: 600, ...stock });

const onNeed = vi.fn();
const onClose = vi.fn();
const open = (hull: HullId, planet: PlanetView = world()) => render(
  <QueryClientProvider client={new QueryClient()}>
    <ToastProvider>
      <div data-build-sheet>
        <BuildSheet hull={hull} planet={planet} held={{ alloy: planet.planet.alloy, crystal: planet.planet.crystal, deuterium: planet.planet.deuterium }}
          onNeed={onNeed} onClose={onClose} />
      </div>
    </ToastProvider>
  </QueryClientProvider>,
);

const sheet = (): HTMLElement => screen.getByRole('dialog');
const after = (first: Element, second: Element): boolean => (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

beforeEach(async () => {
  build.mockReset();
  onNeed.mockReset();
  await i18n.changeLanguage('en');
});

describe('the order sheet on the kit', () => {
  it('is a kit sheet, with nothing of the v2 or v1 type left in it', () => {
    open('TALON');
    expect(sheet().closest('.gk-sheet') ?? sheet().querySelector('.gk-sheet')).not.toBeNull();
    expect(v2Classes(sheet())).toEqual([]);
  });

  it('puts the hull over its sky with its class and where its ships are on the picture', () => {
    open('TALON');
    const hero = sheet().querySelector<HTMLElement>('[data-build-art]')!;
    const stage = hero.querySelector<HTMLElement>('.gk-hull__stage')!;
    expect(within(stage).getByRole('img', { name: 'Talon' })).toBeInTheDocument();
    expect(stage.querySelector('[data-scene-fit="contain"]')).not.toBeNull();
    expect(stage.querySelector('.gk-hull__class .gk-emblem')).not.toBeNull();
    expect(stage.querySelector('.gk-hull__class')).toHaveTextContent(/lance/i);
    expect(stage.querySelector('.gk-hull__where')).toHaveTextContent('8 in · 3 out');
  });

  it('wears the order on the picture, and the mark moves with the count', async () => {
    open('TALON');
    const mark = (): Element | null => sheet().querySelector('[data-build-art] .gk-hull__order');
    expect(mark()).toHaveTextContent('×1');
    await userEvent.click(screen.getByRole('button', { name: /more talon/i }));
    expect(mark()).toHaveTextContent('×2');
  });

  it('says what it beats and what beats it right under the picture, in your colour and in amber', () => {
    open('TALON');
    const strong = screen.getByTestId('counter-strong');
    const weak = screen.getByTestId('counter-weak');
    expect(strong).toHaveAttribute('data-tone', 'self');
    expect(strong).toHaveTextContent(/skirmisher/i);
    expect(strong).toHaveTextContent(factor(COMBAT.strongMult));
    expect(strong.querySelector('.gk-emblem')).not.toBeNull();
    expect(weak).toHaveAttribute('data-tone', 'warn');
    expect(weak).toHaveTextContent(/bulwark/i);
    expect(weak).toHaveTextContent(factor(COMBAT.weakMult));
    expect(after(sheet().querySelector('[data-build-art]')!, sheet().querySelector('[data-counter-cycle]')!)).toBe(true);
    expect(after(sheet().querySelector('[data-counter-cycle]')!, sheet().querySelector('[data-build-stats]')!)).toBe(true);
  });

  it('opens the whole cycle on the kit, this hull lit', async () => {
    open('TALON');
    await userEvent.click(screen.getByRole('button', { name: /class cycle/i }));
    const rung = sheet().querySelector('[data-counter-cycle] [data-rung="LANCE"]')!;
    expect(rung).toHaveAttribute('data-current', 'true');
    expect(rung.querySelector('.gk-emblem')).not.toBeNull();
    expect(v2Classes(sheet().querySelector('[data-counter-cycle]')!)).toEqual([]);
  });

  it('lays the six figures, the ship shield and the radiation guard in kit wells', () => {
    open('TALON');
    const stats = sheet().querySelector<HTMLElement>('[data-build-stats]')!;
    expect(stats.querySelectorAll('[data-stat]')).toHaveLength(8);
    expect([...stats.querySelectorAll('[data-stat]')].every((cell) => cell.classList.contains('gk-well'))).toBe(true);
    // the picture beside the figure, the label alone above it
    expect(stats.querySelector('[data-stat="attack"] dd svg')).not.toBeNull();
    expect(stats.querySelector('[data-stat="attack"] dt svg')).toBeNull();
    expect(stats.querySelector('[data-stat="room"]')).toHaveTextContent(String(hullBulk('TALON')));
  });

  it('explains the radiation guard behind its own kit button, and the cell takes the whole row', async () => {
    open('TALON');
    const cell = sheet().querySelector<HTMLElement>('[data-stat="radiation"]')!;
    const toggle = within(cell).getByRole('button', { name: /radiation protection/i });
    expect(toggle).toHaveClass('gk-round');
    await userEvent.click(toggle);
    expect(cell).toHaveAttribute('data-open');
    expect(cell).toHaveTextContent(/monuments/i);
  });

  // The count is the act: it sits in the foot over the price and the press, in the thumb's reach and
  // never scrolled away; what stops Max is beside it.
  it('asks how many in the foot, over the price and the press, with what stops Max beside it', () => {
    open('TALON');
    const count = sheet().querySelector<HTMLElement>('.gk-sheet__foot [data-build-count]')!;
    expect(count.querySelector('.gk-qty')).not.toBeNull();
    expect(count.querySelector('[data-fits]')).toHaveTextContent(/resources/i);
    expect(after(count, sheet().querySelector('[data-build-price]')!)).toBe(true);
    expect(sheet().querySelector('[data-room-bar]')).toHaveClass('gk-room', 'gk-well');
  });

  it('keeps the long reading under the count, one tap deeper', async () => {
    open('TALON');
    const about = sheet().querySelector<HTMLElement>('.gk-iabout')!;
    expect(after(sheet().querySelector('[data-room-bar]')!, about)).toBe(true);
    expect(sheet().querySelector('[data-item-detail]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /how it works/i }));
    const detail = sheet().querySelector('[data-item-detail]')!;
    expect(detail).toHaveClass('gk-well');
    // the ship shield's rule stays under its figure, never behind the tap
    expect(sheet().querySelector('[data-build-art] .gk-hullstats__note')).toHaveTextContent(/start full each battle/i);
  });

  it('draws a special role as a kit well under the figures, before the room', () => {
    open('NULLIFIER', world({ research: world().research.map((project) => ['STARSHIP_ENGINEERING', 'GRAVITIC_CHARGES'].includes(project.id)
      ? { ...project, level: 1, completed: true, discovered: true } : project) }));
    const role = screen.getByRole('region', { name: 'Special role' });
    expect(role).toHaveClass('gk-well');
    expect(after(sheet().querySelector('[data-build-stats]')!, role)).toBe(true);
    expect(after(role, sheet().querySelector('[data-room-bar]')!)).toBe(true);
  });
});

describe('the order itself', () => {
  it('puts the batch price and its time on the kit cost line, beside the yard queue', async () => {
    open('TALON');
    const price = sheet().querySelector<HTMLElement>('[data-build-price]')!;
    expect(price.querySelector('.gk-cost')).not.toBeNull();
    expect(within(price).getByTestId('build-sheet-time')).toHaveClass('gk-cost__time');
    await userEvent.click(screen.getByRole('button', { name: /more talon/i }));
    expect(price).toHaveTextContent(compact(HULLS.TALON.alloy * 2));
    expect(sheet().querySelector('[data-queue-fill]')).toHaveTextContent('0/3');
  });

  it('orders with one weighted kit press, the count that was chosen', async () => {
    open('TALON');
    await userEvent.click(screen.getByRole('button', { name: /more talon/i }));
    const commit = sheet().querySelector<HTMLElement>('[data-commit] button')!;
    expect(commit).toHaveClass('gk-btn', 'gk-btn--action');
    expect(commit).toHaveTextContent(/build 2/i);
    await userEvent.click(commit);
    expect(build).toHaveBeenCalledOnce();
    expect(build).toHaveBeenCalledWith({ hull: 'TALON', count: 2 }, expect.anything());
  });

  // The old door was one sentence of four upper-case lines; each need is its own chip now, a met one
  // ticked and an unmet one a door to its fix, and there is no count to choose for a hull the yard cannot build.
  it('a hull the yard cannot build yet lists each need as a chip, the unmet ones doors to their fix', async () => {
    open('TEMPEST', world({ buildings: { CORE: 8, REFINERY: 8, EXTRACTOR: 7, VAULT: 4, SHIPYARD: 2, HANGAR: 4 } }));
    const needs = [...sheet().querySelectorAll<HTMLElement>('[data-commit] .gk-arm__needs > li')];
    expect(needs).toHaveLength(1 + HULLS.TEMPEST.requiredResearch.length);
    expect(needs.every((need) => need.getAttribute('data-met') === 'false')).toBe(true);
    expect(sheet().querySelector('.gk-qty')).toBeNull();
    expect(sheet().querySelector('.gk-hull__order')).toBeNull();
    await userEvent.click(within(needs[0]!).getByRole('button', { name: /shipyard/i }));
    expect(onNeed).toHaveBeenCalledWith('SHIPYARD');
  });

  it('ticks a need that is already met', () => {
    open('TEMPEST');
    const shipyard = sheet().querySelector<HTMLElement>('[data-commit] .gk-arm__needs > li')!;
    expect(shipyard).toHaveAttribute('data-met', 'true');
    expect(shipyard).toHaveTextContent(/shipyard/i);
    expect(within(shipyard).queryByRole('button')).toBeNull();
  });

  it('a hull the store cannot pay says when on its face, and draws how far off each resource is', () => {
    open('STRONGHOLD', world({}, { alloy: 900, crystal: 200, deuterium: 20 }));
    const commit = sheet().querySelector<HTMLElement>('[data-commit] button')!;
    expect(commit).toBeDisabled();
    expect(commit).toHaveTextContent(/enough/i);
    expect(sheet().querySelector('[data-need-bar="alloy"]')).not.toBeNull();
  });

  it('a full Hangar says so in a kit note instead of a stepper, and offers no order', () => {
    const hangar = hangarCapacity(4);
    open('DART', world({ fleet: { RAMPART: Math.floor(hangar / hullBulk('RAMPART')) }, fleetAway: {} }));
    expect(sheet().querySelector('.gk-qty')).toBeNull();
    expect(sheet().querySelector('[data-build-count] .gk-inote')).toHaveTextContent(/hangar is full/i);
    expect(sheet().querySelector('[data-commit]')).toBeNull();
  });
});

describe('a ground gun on the kit', () => {
  it('stands rather than flies: no ship shield, the ground room, and "standing" on the picture', () => {
    open('THORN');
    expect(sheet().querySelector('.gk-hull__where')).toHaveTextContent('4 standing');
    expect(sheet().querySelectorAll('[data-build-stats] [data-stat]')).toHaveLength(7);
    expect(sheet().querySelector('[data-room-bar]')).toHaveTextContent(/ground room/i);
  });
});

describe('the order sheet in every language', () => {
  // The kit head's top line is one line; at 320 px it holds about 32 letters, and the French one was cut.
  it.each(['en', 'tr', 'fr', 'de', 'es', 'ja'])('keeps the ground gun\'s top line short enough for one line in %s', async (language) => {
    await i18n.changeLanguage(language);
    expect(i18n.language).toBe(language);
    expect(i18n.t('planet.buildSheet.eyebrowGround').length).toBeLessThanOrEqual(32);
  });
});
