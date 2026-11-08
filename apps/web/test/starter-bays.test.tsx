import { STARTER, dockBill, openingProgress, type VesselProgress } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { WorldProvider } from '../src/api/world.js';
import { VesselScreen } from '../src/starter/VesselScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { keys } from '../src/api/keys.js';
import { researchGain } from '../src/lib/gains.js';
import { roomOf } from '../src/lib/fleetPage.js';
import { ResearchPanel } from '../src/screens/ResearchPanel.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { wireVessel } from './starterVesselFixture.js';

const fleetOpen: VesselProgress = { ...openingProgress(), modules: { REFINERY: 3, SURVEY: 1, SHIPYARD: 1, HANGAR: 1 }, facts: [] };
const labOpen: VesselProgress = { ...fleetOpen, modules: { ...fleetOpen.modules, HANGAR: 2 }, facts: ['FIRST_MINING_RETURN'] };
const reported: VesselProgress = { ...labOpen, facts: ['FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT'] };

function show(over: Parameters<typeof wireVessel>[0]) {
  const ship = vesselSchema.parse(wireVessel({ alloy: 5000, crystal: 5000, deuterium: 200, ...over }));
  const posted: { path: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (init?.method === 'POST') posted.push({ path, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
    return Promise.resolve(new Response(JSON.stringify({ error: 'NOPE', message: 'nope' }), { status: 404 }));
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch, authTransport: null })}><WorldProvider><ToastProvider>
    <VesselScreen vessel={ship} fetchedAt={Date.now()} />
  </ToastProvider></WorldProvider></ApiProvider></QueryClientProvider>);
  return { posted };
}

const tabs = () => within(screen.getByTestId('ship-decks')).getAllByRole('tab').map(tab => tab.textContent);
const open = (name: RegExp) => { fireEvent.click(within(screen.getByTestId('ship-decks')).getByRole('tab', { name })); };

describe('the decks of a ship', () => {
  it('shows one deck and no switch while only repairs exist', () => {
    show({});
    expect(screen.queryByTestId('ship-decks')).toBeNull();
    expect(screen.getByTestId('ship-goal')).toBeTruthy();
  });

  it('adds the yard with the Shipyard, and the lab with the second Hangar', () => {
    show({ progress: fleetOpen });
    expect(tabs()).toEqual(['Repairs', 'Shipyard']);
  });

  it('names the lab once it opens', () => {
    show({ progress: labOpen });
    expect(tabs()).toEqual(['Repairs', 'Shipyard', 'Research']);
  });
});

describe('the yard aboard', () => {
  it('offers the hulls this galaxy builds and nothing else', () => {
    show({ progress: fleetOpen });
    open(/Shipyard/);
    const offered = screen.getAllByTestId('yard-hull').map(row => row.dataset.hull);
    expect(offered).toEqual([...STARTER.hulls]);
  });

  it('shows the room the yard fills, so a full hangar is read before the order', () => {
    show({ progress: fleetOpen, fleet: { DART: 6 } });
    open(/Shipyard/);
    expect(screen.getByTestId('yard-room').textContent).toContain(String(STARTER.hangarRoom[0]));
  });

  it('builds through the one build door the main game uses', async () => {
    const { posted } = show({ progress: fleetOpen });
    open(/Shipyard/);
    const dart = screen.getAllByTestId('yard-hull').find(row => row.dataset.hull === 'DART')!;
    fireEvent.click(within(dart).getAllByRole('button')[0]!);
    fireEvent.click(await screen.findByRole('button', { name: /^Build/ }));
    await waitFor(() => { expect(posted.at(-1)?.path).toContain('/api/planet/build'); });
    expect(posted.at(-1)?.body).toMatchObject({ hull: 'DART', count: 1 });
  });
});

describe('the Repair Station aboard', () => {
  const hurt = [{ hull: 'DART', count: 2, damageBp: 5000 }] as const;

  // Owner 2026-11-08 (N2): the outpost is the shipyard's first fight, so the station opens with the yard.
  it('stands in the yard before any battle report', () => {
    show({ progress: labOpen, fleet: { DART: 2 }, damage: hurt });
    open(/Shipyard/);
    expect(screen.getByTestId('ship-dock')).toBeInTheDocument();
  });

  it('says which ships are hurt and what mending them costs before the press', () => {
    show({ progress: reported, fleet: { DART: 2 }, damage: hurt });
    open(/Shipyard/);
    const bill = dockBill(hurt);
    const dock = within(screen.getByTestId('ship-dock'));
    expect(dock.getByTestId('dock-hurt').textContent).toContain('2');
    expect(dock.getByTestId('dock-bill').textContent).toContain(String(bill.cost.alloy));
  });

  it('takes everything hurt in one press', async () => {
    const { posted } = show({ progress: reported, fleet: { DART: 2 }, damage: hurt });
    open(/Shipyard/);
    fireEvent.click(within(screen.getByTestId('ship-dock')).getByRole('button'));
    await waitFor(() => { expect(posted.at(-1)?.path).toContain('/repairs'); });
    expect(posted.at(-1)?.body).toEqual({ all: true });
  });

  // Owner 2026-11-06: nothing mends itself on landing, here as in the main game.
  it('offers the station for a scratch too, and never says it mends itself', () => {
    show({ progress: reported, fleet: { DART: 2 }, damage: [{ hull: 'DART', count: 2, damageBp: 1500 }] });
    open(/Shipyard/);
    const dock = within(screen.getByTestId('ship-dock'));
    expect(dock.getByTestId('dock-hurt').textContent).toContain('2');
    expect(dock.getByRole('button')).toBeTruthy();
    expect(screen.getByTestId('ship-dock').textContent).not.toMatch(/mends itself|on landing/iu);
  });

  it('counts down the job that is running and offers no second one', () => {
    const start = new Date(Date.now() - 60_000).toISOString();
    const end = new Date(Date.now() + 600_000).toISOString();
    show({ progress: reported, fleet: { DART: 2 }, damage: hurt, queue: [{ id: 'o', queue: 'DOCK', subject: 'DOCK', stage: 1, count: 1, startedAt: start, readyAt: end, cost: { alloy: 1, crystal: 1, deuterium: 0 } }] });
    open(/Shipyard/);
    const dock = within(screen.getByTestId('ship-dock'));
    expect(dock.queryByRole('button')).toBeNull();
    expect(dock.getByTestId('dock-clock').textContent).toMatch(/\d/);
  });
});

describe('the lab aboard', () => {
  function lab(queue: unknown[] = []) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(keys.planet, vesselToPlanetView(vesselSchema.parse(wireVessel({ alloy: 9000, crystal: 9000, progress: labOpen, queue }))));
    const fetch: typeof globalThis.fetch = () => Promise.resolve(new Response('{}', { status: 404 }));
    render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch, authTransport: null })}><WorldProvider><ToastProvider>
      <ResearchPanel />
    </ToastProvider></WorldProvider></ApiProvider></QueryClientProvider>);
  }

  it('says from the start that the research stays with the ship', () => {
    lab();
    expect(document.body.textContent).toContain('This research stays with the ship');
    expect(document.body.textContent).not.toContain('all worlds you own');
  });

  it('tells the ship its own queue: one project, no commander, no other worlds', () => {
    lab();
    const said = document.body.textContent;
    expect(said).toMatch(/one project at a time/i);
    expect(said).not.toMatch(/commander|every world|three projects/i);
  });

  it('refuses a second project before the server has to, and says why', () => {
    lab([{ id: 'o1', queue: 'RESEARCH', subject: 'SHIP_POWER', stage: 1, count: 1, startedAt: '2026-11-05T10:00:00.000Z', readyAt: '2099-11-05T12:00:00.000Z', cost: { alloy: 1, crystal: 1, deuterium: 0 } }]);
    Element.prototype.scrollIntoView = () => undefined;
    fireEvent.click(document.querySelector('[data-star="SHIP_ARMOR"]')!);
    expect(document.querySelector('[data-blocked-reason]')?.textContent).toMatch(/one project at a time/i);
  });

  it('promises no rung this galaxy does not have', () => {
    lab();
    expect(document.body.textContent).not.toMatch(/Level 3|third/i);
  });

  it('counts a ladder to the top it has here, not the main game\'s', () => {
    expect(researchGain('SHIP_POWER', 0, 2).ceiling).not.toBe(researchGain('SHIP_POWER', 0).ceiling);
    expect(researchGain('SHIP_POWER', 2, 2).maxed).toBe(true);
    expect(researchGain('SHIP_POWER', 2).maxed).toBeUndefined();
  });
});

describe('the Fleet page aboard', () => {
  it('draws no ground room for a world that has none', () => {
    const empty = { hangar: 20, hangarUsed: 0, ground: 0, groundUsed: 0 };
    expect(roomOf(empty).ground).toBeNull();
    expect(roomOf({ ...empty, ground: 4 }).ground).toMatchObject({ total: 4 });
  });
});
