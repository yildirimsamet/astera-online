import { REPAIR_LADDER, openingProgress, type RepairStep, type StarterFeature } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { ROAD, adviceMarks, repairWait, tutorialStep, waitMode, type TutorialInput } from '../src/starter/tutorial/script.js';
import { starter as de } from '../src/i18n/locales/de/starter.js';
import { starter as en } from '../src/i18n/locales/en/starter.js';
import { starter as es } from '../src/i18n/locales/es/starter.js';
import { starter as fr } from '../src/i18n/locales/fr/starter.js';
import { starter as ja } from '../src/i18n/locales/ja/starter.js';
import { starter as tr } from '../src/i18n/locales/tr/starter.js';

/**
 * THE STARTER GUIDE (owner 2026-11-08, N1). A short held core — power, the first collect, the first
 * repair — then an advisor the player answers by choosing, and a few first-time moments that each
 * speak once. Progress is read from the ship, so a reload or a second phone lands in the same place;
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
const step = (module: string, stage: number): RepairStep => REPAIR_LADDER.find(s => s.module === module && s.stage === stage)!;
/** Past the core: the second refinery is in. */
const awake = (over: Partial<TutorialInput> = {}) => base({ ...pending(null), works: 0, modules: { ...openingProgress().modules, REFINERY: 2 }, ...over });

describe('the core: the one moment that is held', () => {
  it('opens on the power card: the welcome and the refinery coming online are one moment', () => {
    expect(at(base())).toMatchObject({ kind: 'step', id: 'online', step: 'press', strict: true, marks: ['[data-guide="unlock-try"]'] });
  });

  it('then the first collect, which is passed over when the works are empty', () => {
    expect(at(base(pending(null)))).toMatchObject({ id: 'collect', strict: true, marks: ['[data-guide="works"]'] });
    expect(id(base({ ...pending(null), works: 0 }))).toBe('orderRefinery');
  });

  it('sends the player into the ship for the first repair, and points at it there', () => {
    const ready = base({ ...pending(null), works: 0 });
    expect(at(ready)).toMatchObject({ id: 'orderRefinery', nav: 'openShip', strict: true, marks: ['[data-guide="dock-base"]'] });
    const inside = at({ ...ready, view: 'ship' });
    expect(inside).toMatchObject({ id: 'orderRefinery', strict: true });
    expect(inside.kind === 'step' && inside.nav).toBeUndefined();
    expect(inside.kind === 'step' && inside.marks).toEqual([
      '[data-guide="repair-order"][data-step="REFINERY:2"]', '[data-guide="repair-show"][data-step="REFINERY:2"]', '[data-guide="system-REFINERY"]',
    ]);
  });

  it('holds the first repair\'s ten seconds, so its result is seen', () => {
    expect(at(base({ ...pending(null), works: 0, queue: [order('REFINERY', 2)] }))).toMatchObject({ id: 'waitFirst', step: 'wait', strict: true, marks: [] });
  });

  it('ends when the second refinery is in: nothing after it is held', () => {
    expect(at(awake())).toEqual({ kind: 'advise' });
  });

  it('never takes a ship that has ordered the repair back to the power card or the collect', () => {
    expect(id(base({ works: 40, queue: [order('REFINERY', 2)] }))).toBe('waitFirst');
  });
});

describe('the advisor', () => {
  // Owner 2026-11-08 (N1): after the core no repair, deed or crate is walked in order; the player chooses.
  it('takes over once the core is done and no first-time moment is due', () => {
    expect(at(awake({ modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1 } }))).toEqual({ kind: 'advise' });
  });

  it('names no step of its own: what to repair next is never a held step', () => {
    for (const s of ROAD) expect(s.id).not.toMatch(/^order(?!Refinery$)/);
  });
});

describe('the first-time moments', () => {
  it('teaches the first crate once, when it is ready and none was ever opened', () => {
    const freed = awake({ view: 'ship', crates: [{ id: 'REFINERY:2', state: 'ready' }] });
    expect(at(freed)).toMatchObject({ id: 'firstCrate', step: 'press', strict: false, marks: ['[data-guide="crate"]'] });
    expect(at({ ...freed, view: 'galaxy' })).toMatchObject({ id: 'firstCrate', nav: 'openShip' });
    expect(at({ ...freed, crates: [{ id: 'REFINERY:2', state: 'opened' }, { id: 'SURVEY:1', state: 'ready' }] })).toEqual({ kind: 'advise' });
  });

  it('reads the first probe report where it is drawn, once', () => {
    const read = awake({ modules: { REFINERY: 2, EXTRACTOR: 1, SURVEY: 1 }, facts: ['FIRST_PROBE_REPORT'] });
    expect(at(read)).toMatchObject({ id: 'openIntel', strict: false, marks: ['[data-guide="dock-intel"]'] });
    expect(id({ ...read, ...ack('openIntel') })).toBe('openReport');
    expect(at({ ...read, ...ack('openIntel', 'openReport') })).toMatchObject({ id: 'report', step: 'read', marks: ['[data-dossier-loot]'] });
    expect(at({ ...read, ...ack('openIntel', 'openReport', 'report') })).toEqual({ kind: 'advise' });
  });

  it('sends the first Prospector, watches it, collects its haul, then hands over', () => {
    const yard = awake({ modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, VAULT: 1, SHIPYARD: 1 } });
    expect(at(yard)).toMatchObject({ id: 'mine', step: 'press', strict: false, marks: ['[data-guide="mine"]', '[data-guide="unlock-dismiss"]', '[data-guide="objective"]'] });
    expect(at({ ...yard, mining: true })).toMatchObject({ id: 'mineFlying', step: 'wait' });
    const home = { ...yard, facts: ['FIRST_MINING_RETURN'] as const, works: 100 };
    expect(at(home)).toMatchObject({ id: 'collectMine', marks: ['[data-guide="works"]'] });
    expect(at({ ...home, ...ack('collectMine') })).toMatchObject({ id: 'farewell', step: 'read' });
    expect(at({ ...home, ...ack('collectMine', 'farewell') })).toEqual({ kind: 'advise' });
  });

  it('never drags a veteran back: past the first haul there is nothing to teach', () => {
    const modules: Record<string, number> = {};
    for (const s of REPAIR_LADDER.slice(0, 10)) modules[s.module] = Math.max(modules[s.module] ?? 0, s.stage);
    expect(at(base({ modules, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'], acked: ['report', 'collectMine', 'farewell'], unlockToAnnounce: null, works: 0 }))).toEqual({ kind: 'advise' });
  });

  // A focus panel hides the card on the galaxy: its close is the way to the card (owner playtest 2026-11-07).
  it('closes an unlock note that hides the card a moment points at', () => {
    const crate = awake({ crates: [{ id: 'REFINERY:2', state: 'ready' }], unlockToAnnounce: 'intel' });
    expect(at(crate)).toMatchObject({ id: 'firstCrate', nav: 'dismissUnlock', marks: ['[data-guide="unlock-dismiss"]', '[data-focus-close]'] });
  });
});

/**
 * Owner playtest 2026-11-06: alone in a new galaxy, the probe line pointed at a neighbour that did not
 * exist. A report lesson with no report to read is passed over, never waited on.
 */
describe('a galaxy with nobody else in sight', () => {
  it('has no report to read, so the advisor speaks', () => {
    expect(at(awake({ modules: { REFINERY: 2, EXTRACTOR: 2, SURVEY: 1 }, alone: true }))).toEqual({ kind: 'advise' });
  });
});

describe('the ship sees, detects and reads', () => {
  const late = awake({ modules: { REFINERY: 3, EXTRACTOR: 3, SURVEY: 1, SHIPYARD: 1, TELESCOPE: 1 }, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'], acked: ['report', 'collectMine', 'farewell'] });
  it('introduces a completed telescope, and waits for a queued one', () => {
    expect(at(late)).toMatchObject({ id: 'telescopeRing', step: 'read', strict: false, marks: ['[data-guide="sight-telescope"]'] });
    expect(at({ ...late, modules: { ...late.modules, TELESCOPE: 0 }, queue: [order('TELESCOPE', 1)] })).toEqual({ kind: 'advise' });
  });
  it('shows traffic and continuity once each, then goes quiet', () => {
    expect(at({ ...late, acked: [...late.acked, 'telescopeRing'] })).toMatchObject({ id: 'telescopeTraffic' });
    expect(at({ ...late, acked: [...late.acked, 'telescopeRing', 'telescopeTraffic'] })).toMatchObject({ id: 'telescopeTrack' });
    expect(at({ ...late, acked: [...late.acked, 'telescopeRing', 'telescopeTraffic', 'telescopeTrack'] })).toEqual({ kind: 'advise' });
  });
  it('introduces Radar 1 and closes with the three different jobs', () => {
    const radar = { ...late, modules: { ...late.modules, RADAR: 1 }, acked: [...late.acked, 'telescopeRing', 'telescopeTraffic', 'telescopeTrack'] };
    expect(at(radar)).toMatchObject({ id: 'radarRing' });
    expect(at({ ...radar, acked: [...radar.acked, 'radarRing'] })).toMatchObject({ id: 'radarContact' });
    expect(at({ ...radar, acked: [...radar.acked, 'radarRing', 'radarContact'] })).toMatchObject({ id: 'sightTrio' });
    expect(at({ ...radar, acked: [...radar.acked, 'radarRing', 'radarContact', 'sightTrio'] })).toEqual({ kind: 'advise' });
  });
});

describe('where the hand goes for a chosen opportunity', () => {
  it('leads to a repair through the ship, its tab and its thumbnail', () => {
    expect(adviceMarks({ kind: 'repair', step: step('EXTRACTOR', 1) }, 'galaxy')).toEqual({ marks: ['[data-guide="dock-base"]'], nav: 'openShip' });
    expect(adviceMarks({ kind: 'repair', step: step('EXTRACTOR', 1) }, 'ship')).toEqual({
      marks: ['[data-guide="repair-order"][data-step="EXTRACTOR:1"]', '[data-guide="repair-show"][data-step="EXTRACTOR:1"]', '[data-guide="system-REFINERY"]'],
    });
    expect(adviceMarks({ kind: 'repair', step: step('SHIPYARD', 1) }, 'ship').marks.at(-1)).toBe('[data-guide="system-CARGO"]');
  });

  it('collects from the works anywhere, and flies from the galaxy', () => {
    expect(adviceMarks({ kind: 'collect' }, 'ship')).toEqual({ marks: ['[data-guide="works"]'] });
    expect(adviceMarks({ kind: 'probe' }, 'galaxy')).toEqual({ marks: ['[data-guide="probe"]', '[data-guide="objective"]'] });
    expect(adviceMarks({ kind: 'mine' }, 'ship')).toEqual({ marks: ['[data-sheet-close]'], nav: 'closePage' });
  });

  it('loads fuel aboard, under the drive', () => {
    expect(adviceMarks({ kind: 'fuel' }, 'ship')).toEqual({ marks: ['[data-guide="fuel"]', '[data-guide="system-DRIVE"]'] });
    expect(adviceMarks({ kind: 'fuel' }, 'other')).toEqual({ marks: ['[data-sheet-close]'], nav: 'closePage' });
  });

  it('points at nothing for a state: a wait or a deed under way is said, not pressed', () => {
    expect(adviceMarks({ kind: 'wait', readyAt: new Date() }, 'galaxy')).toEqual({ marks: [] });
    expect(adviceMarks({ kind: 'underway', what: 'mine' }, 'galaxy')).toEqual({ marks: [] });
  });
});

describe('the road the server counts', () => {
  /** The admin funnel lives on the server, which ships only `src/api` of this app. */
  it('walks the shared step list, in its order', async () => {
    const { STARTER_TUTORIAL_STEPS } = await import('../src/api/starterTutorialSteps.js');
    expect(ROAD.map(s => s.id)).toEqual([...STARTER_TUTORIAL_STEPS]);
  });
});

// A wait belongs to the work, never to the screen the commander happens to open.
describe('waits never navigate', () => {
  const waits = {
    waitFirst: base({ ...pending(null), works: 0, queue: [order('REFINERY', 2)] }),
    mineFlying: awake({ modules: { REFINERY: 3, SURVEY: 1, SHIPYARD: 1 }, mining: true }),
  };
  for (const [wait, input] of Object.entries(waits)) {
    for (const view of ['galaxy', 'ship', 'other'] as const) {
      it(`${wait} stays a wait in ${view}`, () => {
        const answer = at({ ...input, view });
        expect(answer).toMatchObject({ id: wait, step: 'wait' });
        expect(answer.kind === 'step' && answer.nav).toBeUndefined();
      });
    }
  }
});

/**
 * OWNER PLAYTEST 2026-11-07: "Oyuncuyu 10 sn'den fazla, bir şey yapmasına izin vermeden kitleyemeyiz."
 * A wait is held only while it is short; past ten seconds the player roams, past a minute the NPC leaves
 * and comes back when the work is done.
 */
describe('how a wait holds the player', () => {
  const at = (s: number) => new Date(Date.UTC(2026, 10, 7, 12, 0, s));
  const timed = (subject: string, stage: number, seconds: number) => ({ subject, stage, startedAt: at(0), readyAt: at(seconds) });

  it('times the first repair\'s wait by that repair alone', () => {
    expect(repairWait('waitFirst', [timed('REFINERY', 2, 10), timed('EXTRACTOR', 1, 10 * 60)])).toEqual({ until: at(10), spanMs: 10_000 });
    expect(repairWait('waitFirst', [])).toBeNull();
    expect(repairWait('mineFlying', [timed('SURVEY', 1, 30)])).toBeNull();
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

/** Every step the guide speaks has its line in each language, and no line outlives its step. */
it('has a line in every language for each step it speaks, and none for a step it no longer has', () => {
  const ids = ROAD.map(step => step.id).sort();
  const chapters = [...new Set(ROAD.map(step => String(step.chapter)))].sort();
  for (const starter of [en, tr, de, fr, es, ja]) {
    expect(Object.keys(starter.tutorial.line).sort()).toEqual(ids);
    expect(Object.keys(starter.tutorial.chapter).sort()).toEqual(chapters);
  }
});
