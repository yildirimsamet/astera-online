import { REPAIR_LADDER, openingProgress, type StarterFeature } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { ROAD, repairWait, tutorialStep, waitMode, type TutorialInput } from '../src/starter/tutorial/script.js';

/**
 * THE STARTER TUTORIAL'S ROAD (owner 2026-11-06: strict, cannot be skipped, the FlightSchool NPC).
 * Progress is read from the ship itself, so a reload or a second phone lands on the same step;
 * only reading a line and pressing a mark are remembered on the device.
 */
const order = (subject: string, stage: number) => ({ subject, stage });
const base = (over: Partial<TutorialInput> = {}): TutorialInput => ({
  modules: { ...openingProgress().modules },
  facts: [],
  queue: [],
  unlockToAnnounce: 'production',
  works: 60,
  canPayNext: false,
  probing: false,
  mining: false,
  crates: [],
  view: 'galaxy',
  acked: [],
  ...over,
});
const at = (input: TutorialInput) => tutorialStep(input);
const id = (input: TutorialInput) => { const step = at(input); return step.kind === 'step' ? step.id : step.kind; };
const ack = (...ids: string[]) => ({ acked: ids });
const pending = (feature: StarterFeature | null) => ({ unlockToAnnounce: feature });

describe('the first session, in order', () => {
  it('opens with a look around the ship, then the NPC, then the refinery coming online, then the first collect', () => {
    expect(id(base())).toBe('lookAround');
    expect(id(base(ack('lookAround')))).toBe('welcome');
    expect(id(base(ack('welcome')))).toBe('online');
    expect(id(base({ ...ack('welcome'), ...pending(null) }))).toBe('collect');
  });

  it('skips the collect when the works are already empty', () => {
    expect(id(base({ ...ack('welcome'), ...pending(null), works: 0 }))).not.toBe('collect');
  });

  it('first sends the player into the ship, then to the refinery repair', () => {
    const ready = base({ ...ack('welcome', 'collect'), ...pending(null), works: 0 });
    const outside = at(ready);
    expect(outside).toMatchObject({ kind: 'step', id: 'orderRefinery', nav: 'openShip' });
    expect(outside.kind === 'step' && outside.marks).toEqual(['[data-guide="dock-base"]']);
    const inside = at({ ...ready, view: 'ship' });
    expect(inside).toMatchObject({ kind: 'step', id: 'orderRefinery' });
    expect(inside.kind === 'step' && inside.nav).toBeUndefined();
    expect(inside.kind === 'step' && inside.marks[0]).toBe('[data-guide="repair-order"][data-step="REFINERY:2"]');
  });

  it('orders the extractor next, then waits for both, with nothing to press', () => {
    const s = base({ ...ack('welcome', 'collect'), ...pending(null), works: 0, view: 'ship' });
    expect(id({ ...s, queue: [order('REFINERY', 2)] })).toBe('orderExtractor');
    const waiting = at({ ...s, queue: [order('REFINERY', 2), order('EXTRACTOR', 1)] });
    expect(waiting).toMatchObject({ kind: 'step', id: 'waitFirst', marks: [] });
  });

  it('points at the antenna tab until the antenna card is up, then at its repair', () => {
    const s = base({ ...ack('welcome', 'collect'), ...pending(null), works: 0, view: 'ship', modules: { REFINERY: 2, EXTRACTOR: 1 } });
    const step = at(s);
    expect(step).toMatchObject({ kind: 'step', id: 'orderAntenna' });
    expect(step.kind === 'step' && step.marks).toEqual(['[data-guide="repair-order"][data-step="SURVEY:1"]', '[data-guide="repair-show"][data-step="SURVEY:1"]', '[data-guide="system-SURVEY"]']);
    expect(id({ ...s, queue: [order('SURVEY', 1)] })).toBe('orderExtractor2');
    expect(id({ ...s, queue: [order('SURVEY', 1), order('EXTRACTOR', 2)] })).toBe('waitAntenna');
  });

  /** Walk 2026-11-07: the antenna was done before the second extractor was ordered, and the road dropped it for good. */
  it('still asks for the second extractor when the antenna finished first', () => {
    const s = base({ ...ack('welcome', 'collect'), ...pending(null), works: 0, view: 'ship', modules: { REFINERY: 2, EXTRACTOR: 1, SURVEY: 1 } });
    expect(id(s)).toBe('orderExtractor2');
    expect(id({ ...s, queue: [order('EXTRACTOR', 2)] })).not.toBe('waitAntenna');
  });

  it('closes the ship when the antenna is up, so the antenna\'s card can be read on the galaxy', () => {
    const s = base({ ...ack('welcome', 'collect'), ...pending('intel'), works: 0, view: 'ship', modules: { REFINERY: 2, EXTRACTOR: 2, SURVEY: 1 } });
    expect(at(s)).toMatchObject({ kind: 'step', id: 'intelOnline', nav: 'closePage', marks: ['[data-sheet-close]'] });
    expect(at({ ...s, view: 'galaxy' })).toMatchObject({ kind: 'step', id: 'intelOnline', marks: ['[data-guide="unlock-try"]'] });
  });

  it('sends the probe, waits for its report, then opens Intel to read it', () => {
    const s = base({ ...ack('welcome', 'collect'), ...pending(null), works: 0, modules: { REFINERY: 2, EXTRACTOR: 2, SURVEY: 1 } });
    expect(at(s)).toMatchObject({ kind: 'step', id: 'probe', marks: ['[data-guide="probe"]', '[data-guide="objective"]'] });
    expect(id({ ...s, probing: true })).toBe('probeFlying');
    const reported = { ...s, facts: ['FIRST_PROBE_REPORT'] as const };
    expect(at(reported)).toMatchObject({ kind: 'step', id: 'openIntel', marks: ['[data-guide="dock-intel"]'] });
    expect(id({ ...reported, acked: [...s.acked, 'openIntel', 'openReport', 'report'] })).toBe('openCrates');
  });

  /**
   * Owner playtest 2026-11-07: Intel opened on a list, the probed ship sat at its foot, and the line
   * talked about resources nobody could see. The NPC takes the player to the report itself.
   */
  it('points at the probed ship in Intel, then reads its report with it on screen', () => {
    const s = base({ ...ack('welcome', 'collect', 'openIntel'), ...pending(null), works: 0, modules: { REFINERY: 2, EXTRACTOR: 2, SURVEY: 1 }, facts: ['FIRST_PROBE_REPORT'], view: 'other' });
    expect(at(s)).toMatchObject({ kind: 'step', id: 'openReport', step: 'press', marks: ['[data-known="probe"] button', '[data-guide="dock-intel"]'] });
    const opened = { ...s, acked: [...s.acked, 'openReport'], view: 'galaxy' as const };
    expect(at(opened)).toMatchObject({ kind: 'step', id: 'report', step: 'read', marks: ['[data-dossier-loot]'] });
    expect(at({ ...opened, view: 'other' })).toMatchObject({ id: 'report', nav: 'closePage' });
  });
});

describe('the shipyard and the first flight', () => {
  const after = base({
    ...ack('welcome', 'collect', 'openIntel', 'openReport', 'report'), ...pending(null), works: 0, view: 'ship',
    modules: { REFINERY: 2, EXTRACTOR: 2, SURVEY: 1 }, facts: ['FIRST_PROBE_REPORT'],
    crates: [{ id: 'REFINERY:2', state: 'ready' }, { id: 'SURVEY:1', state: 'ready' }],
  });
  it('opens the earned crates before ordering the next repairs', () => {
    expect(at(after)).toMatchObject({ id: 'openCrates', marks: ['[data-guide="crate"]'], chapter: 5 });
    const paid = { ...after, crates: after.crates.map(c => ({ ...c, state: 'opened' as const })) };
    expect(at(paid)).toMatchObject({ id: 'orderRefinery3' });
    expect(at({ ...paid, queue: [order('REFINERY', 3)] })).toMatchObject({ id: 'orderVault' });
    expect(at({ ...paid, queue: [order('REFINERY', 3), order('VAULT', 1)] })).toMatchObject({ id: 'waitRefinery' });
    const hot = { ...paid, modules: { ...paid.modules, REFINERY: 3 }, queue: [order('VAULT', 1)], crates: [...paid.crates, { id: 'REFINERY:3', state: 'ready' as const }] };
    expect(at(hot)).toMatchObject({ id: 'openRefineryCrate' });
    expect(at({ ...hot, crates: hot.crates.map(c => ({ ...c, state: 'opened' as const })) })).toMatchObject({ id: 'orderShipyard' });
  });
  it('orders Extractor 3, watches the yard, then sends and watches the first Prospector', () => {
    const built = { ...after, modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, VAULT: 1 }, queue: [order('SHIPYARD', 1)] };
    expect(at(built)).toMatchObject({ id: 'waitShipyard' });

    const crateReady = { ...built, modules: { ...built.modules, SHIPYARD: 1 }, queue: [], crates: [{ id: 'SHIPYARD:1', state: 'ready' as const }] };
    expect(at(crateReady)).toMatchObject({ id: 'openShipyardCrate' });
    const ready = { ...crateReady, crates: [{ id: 'SHIPYARD:1', state: 'opened' as const }], queue: [] };
    expect(at({ ...ready, works: 40 })).toMatchObject({ id: 'collectForExtractor', marks: ['[data-guide="works"]'] });
    expect(at(ready)).toMatchObject({ id: 'orderExtractor3' });
    // A focus panel hides the card on the galaxy: its close is the way to the card (owner playtest 2026-11-07).
    expect(at({ ...ready, view: 'galaxy', unlockToAnnounce: 'fleet' })).toMatchObject({ id: 'orderExtractor3', nav: 'dismissUnlock', marks: ['[data-guide="unlock-dismiss"]', '[data-focus-close]'] });
    const yard = { ...built, crates: [{ id: 'SHIPYARD:1', state: 'opened' as const }], modules: { ...built.modules, SHIPYARD: 1 }, queue: [order('EXTRACTOR', 3)], view: 'galaxy' as const };
    expect(at(yard)).toMatchObject({ id: 'mine', chapter: 6, marks: ['[data-guide="mine"]', '[data-guide="unlock-dismiss"]', '[data-guide="objective"]'] });
    expect(at({ ...yard, mining: true })).toMatchObject({ id: 'mineFlying', chapter: 6 });
    const home = { ...yard, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'] as const, works: 100 };
    expect(at(home)).toMatchObject({ id: 'collectMine', marks: ['[data-guide="works"]'] });
    expect(at({ ...home, acked: ['collectMine'] })).toMatchObject({ id: 'farewell' });
    expect(at({ ...home, acked: ['collectMine', 'farewell'], canPayNext: false })).toEqual({ kind: 'away' });
    expect(at({ ...home, acked: ['collectMine', 'farewell'], canPayNext: true })).toEqual({ kind: 'done' });
  });
});

describe('a ship that is already further along', () => {
  it('never drags a veteran back: past the first mining return there is nothing to teach', () => {
    const modules: Record<string, number> = {};
    for (const s of REPAIR_LADDER.slice(0, 10)) modules[s.module] = Math.max(modules[s.module] ?? 0, s.stage);
    expect(at(base({ modules, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'], acked: ['collectMine', 'farewell'], canPayNext: true, unlockToAnnounce: null }))).toEqual({ kind: 'done' });
  });

  /**
   * Review 2026-11-06: the ship's card shows the first orderable repair of the tab, which need not be
   * the one the NPC names (Extractor 2 left unordered after a reload shows before Refinery 3). The
   * repair's thumbnail on the strip is the way to it, so the gate never closes on a missing mark.
   */
  it('reaches a repair the card is not showing through its thumbnail on the strip', () => {
    const s = base({ ...ack('welcome', 'collect'), ...pending(null), works: 0, view: 'ship', queue: [order('REFINERY', 2)] });
    const step = at(s);
    expect(step.kind === 'step' && step.marks[1]).toBe('[data-guide="repair-show"][data-step="EXTRACTOR:1"]');
  });

  it('picks up at the first repair not yet ordered, wherever the reload happened', () => {
    expect(id(base({ ...pending(null), works: 0, view: 'ship', queue: [order('REFINERY', 2)] }))).toBe('orderExtractor');
  });
});

describe('the road the server counts', () => {
  /** The admin funnel lives on the server, which ships only `src/api` of this app. */
  it('walks the shared step list, in its order', async () => {
    const { ROAD } = await import('../src/starter/tutorial/script.js');
    const { STARTER_TUTORIAL_STEPS } = await import('../src/api/starterTutorialSteps.js');
    expect(ROAD.map(step => step.id)).toEqual([...STARTER_TUTORIAL_STEPS]);
  });
});

/**
 * Owner playtest 2026-11-06: alone in a new galaxy, the probe line pointed at a neighbour that did not
 * exist and nothing on screen answered. A lesson with no subject is passed over, not waited on.
 */
describe('a galaxy with nobody else in sight', () => {
  const s = base({ ...ack('welcome', 'collect'), ...pending(null), works: 0, modules: { REFINERY: 2, EXTRACTOR: 2, SURVEY: 1 }, alone: true });

  it('moves past the probe lesson to the crates', () => {
    expect(id(s)).toBe('openCrates');
  });

  it('still teaches the probe once a ship is there to read', () => {
    expect(id({ ...s, alone: false })).toBe('probe');
  });

  it('never cuts off a probe already flying or a report already in', () => {
    expect(id({ ...s, probing: true })).toBe('probeFlying');
    expect(id({ ...s, facts: ['FIRST_PROBE_REPORT'] })).toBe('openIntel');
  });
});

/** Owner playtest 2026-11-06: the first thing after the prologue is the ship itself, and that the view moves. */
describe('the first look', () => {
  it('opens on the galaxy with a look around the ship, before the officer speaks', () => {
    const fresh = base({ unlockToAnnounce: null });
    expect(at(fresh)).toMatchObject({ kind: 'step', id: 'lookAround', step: 'read', marks: [] });
    expect(id({ ...fresh, ...ack('lookAround') })).toBe('welcome');
  });

  it('is not asked again of a commander who already heard the welcome', () => {
    expect(id(base({ unlockToAnnounce: null, ...ack('welcome') }))).not.toBe('lookAround');
  });
});

describe('the first crate', () => {
  const freed = base({
    ...ack('welcome', 'collect'), ...pending(null), works: 0, view: 'ship',
    modules: { REFINERY: 2, EXTRACTOR: 1 }, crates: [{ id: 'REFINERY:2', state: 'ready' }],
  });

  it('is taught the moment the first repair frees it, not chapters later', () => {
    expect(at(freed)).toMatchObject({ kind: 'step', id: 'firstCrate', step: 'press', chapter: 2, marks: ['[data-guide="crate"]'] });
    expect(at({ ...freed, view: 'galaxy' })).toMatchObject({ id: 'firstCrate', nav: 'openShip' });
  });

  it('gives way to the antenna once the crate is open', () => {
    expect(id({ ...freed, crates: [{ id: 'REFINERY:2', state: 'opened' }] })).toBe('orderAntenna');
  });

  it('never holds a commander who already moved on to the antenna', () => {
    expect(id({ ...freed, queue: [order('SURVEY', 1)] })).not.toBe('firstCrate');
  });
});

/**
 * OWNER PLAYTEST 2026-11-07: "Oyuncuyu 10 sn'den fazla, bir şey yapmasına izin vermeden kitleyemeyiz."
 * A wait is held only while it is short; past ten seconds the player roams, past a minute the NPC leaves
 * and comes back when the work is done.
 */
describe('how a wait holds the player', () => {
  const at = (s: number) => new Date(Date.UTC(2026, 10, 7, 12, 0, s));
  const order = (subject: string, stage: number, seconds: number) => ({ subject, stage, startedAt: at(0), readyAt: at(seconds) });

  it('times a repair wait by the repairs it waits for, not by everything queued', () => {
    const wait = repairWait('waitRefinery', [order('REFINERY', 3, 90), order('VAULT', 1, 120)]);
    expect(wait).toEqual({ until: at(90), spanMs: 90_000 });
    expect(repairWait('waitFirst', [order('REFINERY', 2, 10), order('EXTRACTOR', 1, 10)])).toEqual({ until: at(10), spanMs: 10_000 });
    expect(repairWait('waitAntenna', [])).toBeNull();
    expect(repairWait('probeFlying', [order('SURVEY', 1, 30)])).toBeNull();
  });

  it('holds ten seconds, lets the player roam to a minute, and leaves past it', () => {
    expect(waitMode({ until: at(10), spanMs: 10_000 })).toBe('lock');
    expect(waitMode({ until: at(30), spanMs: 30_000 })).toBe('roam');
    expect(waitMode({ until: at(90), spanMs: 90_000 })).toBe('away');
    expect(waitMode({ until: at(60), spanMs: 60_000 })).toBe('away');
  });

  it('never holds a wait it cannot time', () => {
    expect(waitMode(undefined)).toBe('roam');
  });
});

// A wait belongs to the work, never to the screen the commander happens to open.
describe('waits never navigate', () => {
  for (const [index, wait] of ROAD.entries()) {
    if (wait.kind !== 'wait') continue;
    for (const view of ['galaxy', 'ship', 'other'] as const) {
      it(`${wait.id} stays a wait in ${view}`, () => {
        const answer = at(base({ view, acked: ROAD.slice(0, index).map(s => s.id) }));
        expect(answer).toMatchObject({ id: wait.id, step: 'wait' });
        expect(answer.kind === 'step' && answer.nav).toBeUndefined();
        expect(wait.place).toBe('any');
      });
    }
  }
});

it('repairs a missing second extractor even on an older ship that already has its probe report', () => {
  const answer = at(base({ modules: { REFINERY: 2, EXTRACTOR: 1, SURVEY: 1 }, facts: ['FIRST_PROBE_REPORT'], view: 'ship', acked: ['openIntel', 'openReport', 'report'], unlockToAnnounce: null }));
  expect(answer).toMatchObject({ id: 'orderExtractor2', step: 'press' });
});

describe('the ship sees, detects and reads', () => {
  const late = base({ modules: { REFINERY:3,EXTRACTOR:3,SURVEY:1,SHIPYARD:1,TELESCOPE:1 }, facts:['FIRST_PROBE_REPORT','FIRST_MINING_RETURN'], works:0,unlockToAnnounce:null,acked:['collectMine','farewell'] });
  it('introduces a completed telescope, and waits for a queued one', () => {
    expect(at(late)).toMatchObject({id:'telescopeRing',chapter:7,step:'read',marks:['[data-guide="sight-telescope"]']});
    expect(at({...late,modules:{...late.modules,TELESCOPE:0},queue:[order('TELESCOPE',1)]})).not.toMatchObject({chapter:7});
  });
  it('shows traffic and continuity once each, then goes quiet', () => {
    expect(at({...late,acked:[...late.acked,'telescopeRing']})).toMatchObject({id:'telescopeTraffic'});
    expect(at({...late,acked:[...late.acked,'telescopeRing','telescopeTraffic']})).toMatchObject({id:'telescopeTrack'});
    expect(at({...late,acked:[...late.acked,'telescopeRing','telescopeTraffic','telescopeTrack']})).toEqual({kind:'away'});
  });
  it('introduces Radar 1 and closes with the three different jobs', () => {
    const radar={...late,modules:{...late.modules,RADAR:1},acked:[...late.acked,'telescopeRing','telescopeTraffic','telescopeTrack']};
    expect(at(radar)).toMatchObject({id:'radarRing',chapter:8});
    expect(at({...radar,acked:[...radar.acked,'radarRing']})).toMatchObject({id:'radarContact'});
    expect(at({...radar,acked:[...radar.acked,'radarRing','radarContact']})).toMatchObject({id:'sightTrio'});
    expect(at({...radar,acked:[...radar.acked,'radarRing','radarContact','sightTrio']})).toEqual({kind:'away'});
  });
});
