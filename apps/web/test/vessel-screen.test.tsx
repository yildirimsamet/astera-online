import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { REPAIR_LADDER, alloyRate, crystalRate, openingProgress, type VesselProgress } from '@astera/rules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { vesselSchema, type VesselView } from '../src/api/starterSchemas.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildingArt, instrumentArt } from '../src/ui/assets.js';
import { RESEARCH_SCENES, cardScene } from '../src/ui/atmosphere.js';
import { heroArt, moduleArt, pickStep, rateChange, systemOpen } from '../src/starter/shipScreen.js';
import { stepEffects, timeToAfford } from '../src/starter/steps.js';
import { VesselScreen } from '../src/starter/VesselScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { WorldProvider } from '../src/api/world.js';
import { wireVessel } from './starterVesselFixture.js';

const step = (module: string, stage: number) => REPAIR_LADDER.find(s => s.module === module && s.stage === stage)!;
const vessel = (over: Parameters<typeof wireVessel>[0] = {}) => vesselSchema.parse(wireVessel(over));

function show(ship: VesselView, answer: () => Response = () => new Response(JSON.stringify({ vessel: wireVessel() }), { status: 200, headers: { 'content-type': 'application/json' } })) {
  const requests: { path: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const path = (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (init?.method === 'POST') {
      requests.push({ path, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
      return Promise.resolve(answer());
    }
    return Promise.resolve(new Response(JSON.stringify({ error: 'NOPE', message: 'nope' }), { status: 404 }));
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch, authTransport: null });
  const tree = (current: VesselView) => (<QueryClientProvider client={client}><ApiProvider api={api}><WorldProvider><ToastProvider>
    <VesselScreen vessel={current} fetchedAt={Date.now()} />
  </ToastProvider></WorldProvider></ApiProvider></QueryClientProvider>);
  const view = render(tree(ship));
  return { requests, client, rerender: (next: VesselView) => { view.rerender(tree(next)); } };
}

beforeEach(() => { vi.useRealTimers(); });

describe('what a repair gives', () => {
  it('says how much more alloy a refinery stage makes', () => {
    expect(stepEffects(step('REFINERY', 2), openingProgress())).toContainEqual({ kind: 'rate', resource: 'alloy', perHour: Math.round(alloyRate(2) - alloyRate(1)) });
  });

  it('says how much crystal the first extractor stage starts', () => {
    expect(stepEffects(step('EXTRACTOR', 1), openingProgress())).toContainEqual({ kind: 'rate', resource: 'crystal', perHour: Math.round(crystalRate(1)) });
  });

  it('names the system a repair opens', () => {
    expect(stepEffects(step('SURVEY', 1), { ...openingProgress(), modules: { REFINERY: 1, EXTRACTOR: 1 } })).toContainEqual({ kind: 'feature', feature: 'intel' });
  });

  it('names no system that is already open', () => {
    const progress: VesselProgress = { ...openingProgress(), modules: { REFINERY: 2 } };
    expect(stepEffects(step('REFINERY', 3), progress).filter(effect => effect.kind === 'feature')).toEqual([]);
  });

  it('names what is handed over with the repair', () => {
    expect(stepEffects(step('SHIPYARD', 1), { ...openingProgress(), modules: { REFINERY: 3, SURVEY: 1 } }))
      .toContainEqual({ kind: 'ships', fleet: { DART: 2 } });
    expect(stepEffects(step('DEUTERIUM_PLANT', 1), openingProgress())).toContainEqual({ kind: 'deuterium', amount: 20 });
  });

  it('gives the hangar its room', () => {
    expect(stepEffects(step('HANGAR', 2), { ...openingProgress(), modules: { SHIPYARD: 1 } })).toContainEqual({ kind: 'room', room: 32 });
  });
});

describe('how long until a repair can be paid', () => {
  const rates = { alloyPerHour: 100, crystalPerHour: 50 };
  it('is nothing when the store already holds it', () => {
    expect(timeToAfford({ alloy: 100, crystal: 50 }, { alloy: 100, crystal: 50 }, rates)).toBe(0);
  });

  it('is set by the slower resource', () => {
    expect(timeToAfford({ alloy: 200, crystal: 100 }, { alloy: 100, crystal: 50 }, rates)).toBe(60);
    expect(timeToAfford({ alloy: 150, crystal: 150 }, { alloy: 100, crystal: 50 }, rates)).toBe(120);
  });

  it('counts what is waiting in the works, since a tap collects it', () => {
    expect(timeToAfford({ alloy: 200, crystal: 0 }, { alloy: 100, crystal: 0, bufferAlloy: 50, bufferCrystal: 0 }, rates)).toBe(30);
  });

  it('does not promise a time for a resource nothing is making', () => {
    expect(timeToAfford({ alloy: 0, crystal: 10 }, { alloy: 0, crystal: 0 }, { alloyPerHour: 100, crystalPerHour: 0 })).toBeNull();
  });
});

describe('an opening worth announcing', () => {
  it('says what opened and what it does, one at a time', () => {
    show(vessel({ unlockToAnnounce: 'intel' }));
    expect(screen.getByTestId('unlock-moment').textContent).toMatch(/dark points/);
  });

  /** Onboarding design §5.3: a system coming back is a moment, and "Try it" is the tutorial's mark. */
  it('names the system that came back, and offers to try it there and then', async () => {
    const { requests } = show(vessel({ unlockToAnnounce: 'intel' }));
    const moment = screen.getByTestId('unlock-moment');
    expect(moment.getAttribute('data-system')).toBe('SURVEY');
    expect(moment.textContent).toMatch(/online/i);
    const tryIt = within(moment).getByRole('button', { name: /try/i });
    expect(tryIt.getAttribute('data-guide')).toBe('unlock-try');
    fireEvent.click(tryIt);
    await waitFor(() => { expect(requests).toEqual([{ path: '/api/starter/unlocks/seen', body: { feature: 'intel' } }]); });
  });

  it('offers no "Try it" where there is nothing to show yet', () => {
    show(vessel({ unlockToAnnounce: 'chat' }));
    expect(within(screen.getByTestId('unlock-moment')).queryByRole('button', { name: /try/i })).toBeNull();
  });

  it('is gone with nothing to announce', () => {
    show(vessel());
    expect(screen.queryByTestId('unlock-moment')).toBeNull();
  });

  it('tells the server it has been read', async () => {
    const { requests } = show(vessel({ unlockToAnnounce: 'production' }));
    fireEvent.click(within(screen.getByTestId('unlock-moment')).getByRole('button', { name: /later/i }));
    await waitFor(() => { expect(requests).toEqual([{ path: '/api/starter/unlocks/seen', body: { feature: 'production' } }]); });
  });
});

describe('the ship screen', () => {
  const tab = (name: RegExp) => screen.getByRole('tab', { name });
  const queued = { id: 'order-1', queue: 'CONSTRUCTION', subject: 'REFINERY', stage: 2, count: 1,
    startedAt: '2026-11-04T10:00:00.000Z', readyAt: '2099-11-04T10:01:00.000Z', cost: { alloy: 154, crystal: 20, deuterium: 0 } };

  /**
   * A LOCK MEANS NOTHING CAN BE ORDERED THERE (player test A-04). The tab locked Survey while the
   * card under it offered "Repair": the tab read the ship as it is, the card as the queue leaves it.
   */
  it('locks no system whose repair the queue has already opened', () => {
    const radar = { ...queued, id: 'order-2', subject: 'RADAR', stage: 1 };
    show(vessel({ progress: { ...openingProgress(), modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 } }, queue: [radar] }));
    const survey = within(screen.getByRole('tablist')).getByRole('tab', { name: /Survey/ });
    expect(survey.getAttribute('aria-label')).not.toMatch(/locked/);
    expect(within(screen.getByRole('tablist')).getByRole('tab', { name: /drive/i }).getAttribute('aria-label')).toMatch(/locked/);
  });

  /**
   * THE STRIP SAYS IT GOES ON (player test F-02). Its end lay off the card's edge with nothing to say
   * so; a first-time player never scrolled it. Its label counts the repairs and moves it along.
   */
  it('counts the repairs on the strip and moves it along when asked', () => {
    show(vessel());
    const strip = screen.getByTestId('repair-strip');
    const scrollBy = vi.fn();
    strip.scrollBy = scrollBy;
    const more = screen.getByRole('button', { name: /^More repairs/ });
    expect(more.textContent).toMatch(new RegExp(`\\(${String(within(strip).getAllByRole('button').length)}\\)`));
    fireEvent.click(more);
    expect(scrollBy).toHaveBeenCalledOnce();
    expect(within(strip).getAllByRole('button')[1]!.textContent).toMatch(/\d/);
  });

  /** Retention plan §6.2: a repair frees a crate, and lifting its lid opens it on the server. */
  it('shows a crate a repair freed, and opens it with the held lid', async () => {
    const progress: VesselProgress = { ...openingProgress(), modules: { REFINERY: 2 } };
    const { requests } = show(vessel({ progress }), () => new Response(JSON.stringify({ vessel: wireVessel({ progress }), opened: ['REFINERY:2'] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const bay = document.querySelector('[data-guide="crate"]');
    expect(bay).not.toBeNull();
    fireEvent.keyDown(bay!, { key: 'Enter' });
    await waitFor(() => { expect(requests.some(request => request.path.endsWith('/api/starter/crates/open'))).toBe(true); });
  });

  /** The tutorial reaches a repair the card is not showing through its thumbnail (review 2026-11-06). */
  it('marks every thumbnail on the strip with its repair, and pressing it brings that card up', () => {
    const yardIn = { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 };
    show(vessel({ progress: { ...openingProgress(), modules: yardIn }, alloy: 5000, crystal: 5000 }));
    const thumb = screen.getByTestId('repair-strip').querySelector('[data-guide="repair-show"][data-step="REFINERY:3"]');
    expect(thumb).not.toBeNull();
    fireEvent.click(thumb!);
    expect(screen.getByTestId('next-repair').querySelector('[data-guide="repair-order"][data-step="REFINERY:3"]')).not.toBeNull();
  });

  describe('its first look', () => {
    it('opens on the repair to do next, what it costs and what it gives', () => {
      show(vessel());
      const card = within(screen.getByTestId('next-repair'));
      expect(card.getByText('Alloy Refinery')).toBeInTheDocument();
      expect(card.getByRole('button', { name: 'Repair' })).toBeEnabled();
      expect(card.getByTestId('repair-rate').textContent).toMatch(/\d/);
    });

    it('shows a production repair as what it makes now and what it will make', () => {
      show(vessel());
      const line = within(screen.getByTestId('next-repair')).getByTestId('repair-rate').textContent;
      expect(line).toContain(String(Math.round(alloyRate(1))));
      expect(line).toContain(String(Math.round(alloyRate(2))));
    });

    /** Owner playtest 2026-11-07: the card said "2 min" for a 90-second repair the NPC called 1 min 30 s. */
    it('gives a short repair its time to the second', async () => {
      const { durationPrecise } = await import('../src/lib/time.js');
      show(vessel({ progress: { ...openingProgress(), modules: { REFINERY: 2, EXTRACTOR: 2, SURVEY: 1 } } }));
      expect(within(screen.getByTestId('next-repair')).getByText(durationPrecise(step('REFINERY', 3).minutes))).toBeInTheDocument();
    });

    // "Repair 2/5" was read as either the stage held or the stage offered (player test B-08).
    it('counts a module\'s repairs from the first one the ship came with, naming the one offered', () => {
      show(vessel());
      expect(within(screen.getByTestId('next-repair')).getByText('Stage 2 of 5')).toBeInTheDocument();
    });

    // The ship's % counts required repairs only; an optional one says so (player test B-08).
    it('says an optional repair does not move the repair percentage', () => {
      show(vessel());
      fireEvent.click(within(screen.getByTestId('repair-strip')).getByRole('button', { name: /Alloy Refinery.*Stage 5 of 5/ }));
      expect(screen.getByTestId('next-repair').textContent).toContain('Optional · not counted in the repair %');
    });

    it('never prints a level: a ship has repairs', () => {
      show(vessel({ progress: { ...openingProgress(), modules: { REFINERY: 3, EXTRACTOR: 2 } } }));
      expect(document.body.textContent).not.toMatch(/\blevel\b|\blvl\b|\bLv\b/i);
    });

    it('shows the repair share of the whole ship', () => {
      show(vessel());
      expect(screen.getByTestId('ship-repair').textContent).toContain('5%');
    });

    // What the bar counts is the jump's, not the whole ship's (plan F7): a choice left undone is no repair missing.
    it('names the bar for leaving, not for the whole ship', () => {
      show(vessel());
      expect(screen.getByTestId('ship-repair').textContent).toMatch(/^Ready to leave/u);
      expect(screen.getByTestId('ship-repair').textContent).not.toMatch(/Repaired/u);
    });

    it('says why the repairs matter: the jump', () => {
      show(vessel());
      expect(screen.getByTestId('ship-goal').textContent).toMatch(/main galaxy/i);
    });

    it('shows the ship in its own state', () => {
      show(vessel());
      expect(screen.getByTestId('ship-hero').querySelector('img')?.getAttribute('src')).toMatch(/hero-[a-z]+-wrecked/);
    });
  });

  describe('the five systems', () => {
    it('are five tabs with their share repaired', () => {
      show(vessel());
      expect(screen.getAllByRole('tab')).toHaveLength(5);
      expect(tab(/refinery module/i).textContent).toContain('10%');
      expect(tab(/survey antenna/i).textContent).toContain('0%');
    });

    it('have the system of the next repair selected', () => {
      show(vessel());
      expect(tab(/refinery module/i).getAttribute('aria-selected')).toBe('true');
    });

    it('open a system on its own card when pressed', () => {
      show(vessel());
      fireEvent.click(tab(/survey antenna/i));
      expect(tab(/survey antenna/i).getAttribute('aria-selected')).toBe('true');
      expect(within(screen.getByTestId('next-repair')).getAllByText('Survey antenna').length).toBeGreaterThan(0);
    });

    it('say what a closed system needs, by name, and offer no button', () => {
      show(vessel());
      fireEvent.click(tab(/survey antenna/i));
      const card = within(screen.getByTestId('next-repair'));
      expect(card.getByTestId('repair-missing').textContent).toMatch(/Radar/);
      expect(card.queryByRole('button', { name: 'Repair' })).toBeNull();
    });

    it('mark a system nothing can be done on yet as locked', () => {
      show(vessel());
      expect(tab(/survey antenna/i).getAttribute('aria-label')).toMatch(/locked/i);
      expect(tab(/refinery module/i).getAttribute('aria-label')).not.toMatch(/locked/i);
    });

    it('can also be picked on the ship itself', () => {
      show(vessel());
      fireEvent.click(within(screen.getByTestId('ship-hero')).getByRole('button', { name: /survey antenna/i }));
      expect(tab(/survey antenna/i).getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('the steps of a system', () => {
    const strip = () => within(screen.getByTestId('repair-strip'));

    it('are all there to look at, done and to come', () => {
      show(vessel());
      fireEvent.click(tab(/survey antenna/i));
      expect(strip().getAllByRole('button')).toHaveLength(3);
    });

    it('open on the card when pressed, optional ones marked', () => {
      show(vessel());
      fireEvent.click(tab(/survey antenna/i));
      fireEvent.click(strip().getAllByRole('button')[2]!);
      expect(screen.getByTestId('next-repair').textContent).toMatch(/optional/i);
    });

    it('say that one is already done', () => {
      show(vessel({ progress: { ...openingProgress(), modules: { REFINERY: 3 } } }));
      fireEvent.click(strip().getByRole('button', { name: /Alloy Refinery.*Stage 2 of 5/ }));
      expect(screen.getByTestId('next-repair').textContent).toMatch(/repaired/i);
      expect(within(screen.getByTestId('next-repair')).queryByRole('button', { name: 'Repair' })).toBeNull();
    });

    it('say that one is under way', () => {
      show(vessel({ queue: [queued] }));
      fireEvent.click(strip().getByRole('button', { name: /Alloy Refinery.*Stage 2 of 5/ }));
      expect(screen.getByTestId('next-repair').textContent).toMatch(/in queue/i);
    });

    it('move the card on to the next repair once the shown one is ordered', () => {
      show(vessel({ queue: [queued] }));
      expect(within(screen.getByTestId('next-repair')).queryByText('Stage 2 of 5')).toBeNull();
    });
  });

  describe('the repair slots', () => {
    it('are always three, with one taken while a repair runs', () => {
      show(vessel({ queue: [queued] }));
      expect(within(screen.getByTestId('repair-slots')).getAllByTestId('repair-slot')).toHaveLength(3);
    });

    it('open the queue when a running repair is pressed, where it can be cancelled', () => {
      show(vessel({ queue: [queued] }));
      fireEvent.click(within(screen.getByTestId('repair-slots')).getAllByTestId('repair-slot')[0]!);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('take the repair on the card when an empty one is pressed', async () => {
      const { requests } = show(vessel());
      fireEvent.click(within(screen.getByTestId('repair-slots')).getAllByRole('button')[0]!);
      await waitFor(() => { expect(requests).toEqual([{ path: '/api/starter/repair', body: { module: 'REFINERY', stage: 2 } }]); });
    });

    it('offer nothing when the repair on the card cannot be ordered', () => {
      show(vessel());
      fireEvent.click(tab(/survey antenna/i));
      expect(within(screen.getByTestId('repair-slots')).queryAllByRole('button')).toHaveLength(0);
    });

    it('offer nothing when the repair on the card cannot be paid for', () => {
      show(vessel({ alloy: 100, crystal: 20, bufferAlloy: 0 }));
      expect(within(screen.getByTestId('repair-slots')).queryAllByRole('button')).toHaveLength(0);
    });

    it('have no shipyard lane, which a ship does not use', () => {
      show(vessel({ queue: [queued] }));
      expect(screen.queryByText(/yard/i)).toBeNull();
    });
  });

  describe('a ship that has fallen quiet', () => {
    it('says nothing while there is plenty of time', () => {
      show(vessel());
      expect(screen.queryByTestId('ship-quiet')).toBeNull();
    });

    it('warns in the last 12 hours, with the time left and how to stop it', () => {
      show(vessel({ quietAt: new Date(Date.now() + 5 * 3_600_000).toISOString() }));
      const warning = screen.getByTestId('ship-quiet').textContent;
      expect(warning).toMatch(/\b[45]\s?h/);
      expect(warning).toMatch(/repair/i);
    });

    it('says what happened once it sleeps, and how to come back', () => {
      show(vessel({ status: 'DORMANT' }));
      const notice = screen.getByTestId('ship-quiet').textContent;
      expect(notice).toMatch(/48/);
      expect(notice).toMatch(/repair/i);
    });

    it('can still be repaired, which is the way back', () => {
      show(vessel({ status: 'DORMANT' }));
      expect(within(screen.getByTestId('next-repair')).getByRole('button', { name: 'Repair' })).toBeEnabled();
    });
  });

  it('orders the repair on the card, as the ladder names it', async () => {
    const { requests } = show(vessel());
    fireEvent.click(within(screen.getByTestId('next-repair')).getByRole('button', { name: 'Repair' }));
    await waitFor(() => { expect(requests).toEqual([{ path: '/api/starter/repair', body: { module: 'REFINERY', stage: 2 } }]); });
  });

  it('says what a player short of resources can expect, instead of a dead button', () => {
    show(vessel({ alloy: 100, crystal: 20, bufferAlloy: 0 }));
    const card = within(screen.getByTestId('next-repair'));
    expect(card.getByRole('button', { name: 'Repair' })).toBeDisabled();
    expect(card.getByTestId('repair-wait').textContent).toMatch(/\d+ ?(s|m|min)/i);
  });

  it('tells them to go and do the thing when a repair waits on an event, not on money', () => {
    const progress: VesselProgress = {
      ...openingProgress(),
      modules: { REFINERY: 4, EXTRACTOR: 3, SURVEY: 1, VAULT: 1, SHIPYARD: 1, TELESCOPE: 1, RADAR: 1, AEGIS: 1, DEUTERIUM_PLANT: 2 },
    };
    show(vessel({ progress, alloy: 5000, crystal: 5000 }));
    const card = within(screen.getByTestId('next-repair'));
    expect(card.queryByRole('button', { name: 'Repair' })).toBeNull();
    expect(card.getByTestId('repair-missing').textContent).toMatch(/probe report/i);
    // And how that event comes, where a first-time player looked for it (player test A-05).
    expect(card.getByTestId('repair-how').textContent).toBe('Send a probe to a neighbouring ship.');
  });

  /**
   * THE AEGIS BRINGS PIRATES, AND THAT IS SAID BEFORE IT IS BOUGHT (player test D-01). The card read
   * "Opens defence · Aegis 75"; the raid it invites was told only once the repair was done. Since the
   * owner made it a choice (2026-11-08, N3) the way to the jump passes it by, and the player opens it
   * from the Defence tab.
   */
  it('says the Aegis invites attacks before it is repaired', () => {
    const progress: VesselProgress = {
      ...openingProgress(),
      modules: { REFINERY: 4, EXTRACTOR: 3, SURVEY: 1, VAULT: 1, SHIPYARD: 1, TELESCOPE: 1, RADAR: 1, DEUTERIUM_PLANT: 2 },
    };
    show(vessel({ progress, alloy: 5000, crystal: 5000 }));
    expect(screen.getByTestId('next-repair').getAttribute('aria-label')).not.toBe('Aegis');
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Ship systems' })).getByRole('tab', { name: /Defence/ }));
    const card = within(screen.getByTestId('next-repair'));
    expect(screen.getByTestId('next-repair').getAttribute('aria-label')).toBe('Aegis');
    // The choice is laid out both ways (plan F6, §2): what the shield brings, and what going without keeps.
    const choice = within(card.getByTestId('aegis-choice'));
    expect(choice.getByTestId('aegis-with').textContent).toMatch(/With the Aegis.*takes the damage first.*Pirates start coming.*After 12 h neighbours can attack you.*After a battle you can attack ships too/);
    expect(choice.getByTestId('aegis-without').textContent).toMatch(/Without it.*Neither pirates nor neighbours can attack you.*only outposts.*not needed to leave/);
    // A plain button does not take this one: it is held.
    expect(card.queryByRole('button', { name: 'Repair' })).toBeNull();
  });

  it('repairs the Aegis on a hold, never on a tap', async () => {
    const progress: VesselProgress = {
      ...openingProgress(),
      modules: { REFINERY: 4, EXTRACTOR: 3, SURVEY: 1, VAULT: 1, SHIPYARD: 1, TELESCOPE: 1, RADAR: 1, DEUTERIUM_PLANT: 2 },
    };
    const { requests } = show(vessel({ progress, alloy: 5000, crystal: 5000 }));
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Ship systems' })).getByRole('tab', { name: /Defence/ }));
    const hold = within(screen.getByTestId('aegis-choice')).getByRole('button', { name: /Take the Aegis/ });
    expect(hold.closest('[data-guide="repair-order"]')?.getAttribute('data-step')).toBe('AEGIS:1');
    fireEvent.click(hold);
    expect(requests).toEqual([]);
    fireEvent.pointerDown(hold);
    await waitFor(() => { expect(requests).toEqual([{ path: '/api/starter/repair', body: { module: 'AEGIS', stage: 1 } }]); });
  });

  it('keeps the choice shut until the yard is in', () => {
    const progress: VesselProgress = {
      ...openingProgress(),
      modules: { REFINERY: 4, EXTRACTOR: 3, SURVEY: 1, VAULT: 1, TELESCOPE: 1, RADAR: 1, DEUTERIUM_PLANT: 2 },
    };
    show(vessel({ progress, alloy: 5000, crystal: 5000 }));
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Ship systems' })).getByRole('tab', { name: /Defence/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Aegis, Stage 1 of/ }));
    const hold = within(screen.getByTestId('aegis-choice')).getByRole('button', { name: /Take the Aegis/ });
    expect(hold).toBeDisabled();
  });

  /**
   * A SECOND TAP DOES NOT BUY THE NEXT REPAIR (player test G-04). Ordering one moved the card on, and
   * the button under the finger already bought the next; it now waits a moment on a card just shown.
   */
  it('holds the button a moment when the card moves on under the finger', async () => {
    const queuedRefinery = { id: 'order-1', queue: 'CONSTRUCTION', subject: 'REFINERY', stage: 2, count: 1,
      startedAt: '2026-11-04T10:00:00.000Z', readyAt: '2099-11-04T10:01:00.000Z', cost: { alloy: 154, crystal: 20, deuterium: 0 } };
    const { rerender } = show(vessel({ alloy: 5000, crystal: 5000 }));
    const card = () => `${screen.getByTestId('next-repair').getAttribute('aria-label') ?? ''} ${within(screen.getByTestId('next-repair')).getByText(/^Stage /).textContent}`;
    const first = card();
    rerender(vessel({ alloy: 4846, crystal: 4980, queue: [queuedRefinery] }));
    expect(card()).not.toBe(first);
    expect(within(screen.getByTestId('next-repair')).getByRole('button', { name: 'Repair' })).toBeDisabled();
    await waitFor(() => { expect(within(screen.getByTestId('next-repair')).getByRole('button', { name: 'Repair' })).toBeEnabled(); });
  });

  it('reports a refusal in words and leaves the ship as it was', async () => {
    show(vessel(), () => new Response(JSON.stringify({ error: 'INSUFFICIENT_RESOURCES', message: 'x' }), { status: 409, headers: { 'content-type': 'application/json' } }));
    fireEvent.click(within(screen.getByTestId('next-repair')).getByRole('button', { name: 'Repair' }));
    await waitFor(() => { expect(screen.getByRole('status').textContent).not.toBe(''); });
    expect(screen.getByTestId('ship-repair').textContent).toContain('5%');
  });
});

describe('what a system shows', () => {
  const opening = openingProgress();

  it('picks the repair that can be ordered now, before those it cannot', () => {
    expect(pickStep('REFINERY', opening)).toMatchObject({ module: 'REFINERY', stage: 2 });
  });

  it('falls back to the first still to come when none can be ordered', () => {
    expect(pickStep('SURVEY', opening)).toMatchObject({ module: 'SURVEY', stage: 1 });
  });

  it('prefers a repair the jump needs over an optional one', () => {
    expect(pickStep('SURVEY', { ...opening, modules: { REFINERY: 1, EXTRACTOR: 1 } })?.required).toBe(true);
  });

  it('has nothing left on a finished system', () => {
    const modules = Object.fromEntries(REPAIR_LADDER.filter(s => s.system === 'CARGO').map(s => [s.module, 9]));
    expect(pickStep('CARGO', { ...opening, modules })).toBeNull();
  });

  it('is open with a repair to order, or once any repair is done', () => {
    expect(systemOpen('REFINERY', opening)).toBe(true);
    expect(systemOpen('SURVEY', opening)).toBe(false);
  });

  it('gives production its numbers, and nothing else any', () => {
    expect(rateChange(step('REFINERY', 2))).toEqual({ resource: 'alloy', from: Math.round(alloyRate(1)), to: Math.round(alloyRate(2)) });
    expect(rateChange(step('SURVEY', 1))).toBeNull();
  });

  it('draws every hull with its own art', () => {
    expect(heroArt('WEDGE', 'WRECKED')).toMatch(/hero-wedge-wrecked/);
    expect(heroArt('SEED', 'RENEWED')).toMatch(/hero-seed-renewed/);
  });

  it('draws a machine with the scene its menu card shows, so a planet looks familiar after the jump', () => {
    for (const module of ['REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'DEUTERIUM_PLANT', 'HANGAR'] as const) {
      expect(moduleArt(module, 1)).toBe(cardScene(buildingArt(module, 1))!.src);
    }
    for (const module of ['TELESCOPE', 'RADAR', 'AEGIS'] as const) expect(moduleArt(module, 1)).toBe(cardScene(instrumentArt(module, 1))!.src);
  });

  it('shows a machine as it looks at that repair, as a building does at that level', () => {
    expect(moduleArt('REFINERY', 9)).toBe(cardScene(buildingArt('REFINERY', 9))!.src);
    expect(moduleArt('AEGIS', 2)).toBe(cardScene(instrumentArt('AEGIS', 2))!.src);
  });

  it('borrows from the game for what no planet has, and paints no machine of its own', () => {
    expect(moduleArt('SURVEY', 1)).toMatch(/atmosphere\/uplink/);
    expect(moduleArt('DRIVE_HULL', 1)).toBe(RESEARCH_SCENES.STARSHIP_ENGINEERING.src);
    expect(moduleArt('DRIVE_THRUST', 1)).toBe(RESEARCH_SCENES.SHIP_PROPULSION.src);
  });

  it('points at a real file for every repair on the ladder', () => {
    for (const { module, stage } of REPAIR_LADDER) {
      expect(existsSync(join(import.meta.dirname, '../public', moduleArt(module, stage))), `${module} ${String(stage)}`).toBe(true);
    }
  });
});
