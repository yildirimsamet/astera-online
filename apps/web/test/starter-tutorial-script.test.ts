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
 * THE STARTER GUIDE (owner 2026-11-08, N1 and N12). A short held core — power, the first collect, the
 * first repair — then one road through the game's mechanics that points and never holds, and a few
 * first-time moments that speak once. Progress is read from the ship, so a reload or a second phone
 * lands in the same place; only reading a line and pressing a mark are remembered on the device.
 */
const order = (subject: string, stage: number) => ({ subject, stage });
const base = (over: Partial<TutorialInput> = {}): TutorialInput => ({
  modules: { ...openingProgress().modules },
  facts: [],
  queue: [],
  unlockToAnnounce: 'production',
  works: 60,
  canPayNext: false,
  canBuildShip: true,
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
    expect(at(awake())).toMatchObject({ id: 'orderExtractor', strict: false });
  });

  it('never takes a ship that has ordered the repair back to the power card or the collect', () => {
    expect(id(base({ works: 40, queue: [order('REFINERY', 2)] }))).toBe('waitFirst');
  });
});

describe('the road through the first session (N12)', () => {
  const onRoad = (modules: Record<string, number>, over: Partial<TutorialInput> = {}) => awake({ modules: { REFINERY: 2, ...modules }, view: 'ship', canPayNext: true, ...over });
  const marksOf = (module: string, stage: number, system: string) => [
    `[data-guide="repair-order"][data-step="${module}:${String(stage)}"]`, `[data-guide="repair-show"][data-step="${module}:${String(stage)}"]`, `[data-guide="system-${system}"]`,
  ];

  it('goes from the crystal to the telescope, each lit on the ship', () => {
    expect(at(onRoad({}))).toMatchObject({ id: 'orderExtractor', step: 'press', strict: false, marks: marksOf('EXTRACTOR', 1, 'REFINERY') });
    expect(at(onRoad({}, { queue: [order('EXTRACTOR', 1)] }))).toMatchObject({ id: 'orderTelescope', marks: marksOf('TELESCOPE', 1, 'DEFENCE') });
  });

  // Owner playtest 2026-11-09: with both on the queue the radar came in while the telescope was being taught.
  it('never asks for the radar before the telescope has been taught', () => {
    expect(id(onRoad({ EXTRACTOR: 1 }, { queue: [order('TELESCOPE', 1)] }))).toBe('waitTelescope');
    expect(id(onRoad({ EXTRACTOR: 1, TELESCOPE: 1 }, { view: 'galaxy' }))).toBe('telescopeLook');
  });

  it('asks for the radar once the Prospector has been sent, and waits for it before the antenna', () => {
    const sent = { EXTRACTOR: 1, TELESCOPE: 1 };
    expect(at(onRoad(sent, { mining: true }))).toMatchObject({ id: 'orderRadar', marks: marksOf('RADAR', 1, 'DEFENCE') });
    expect(at(onRoad(sent, { mining: true, queue: [order('RADAR', 1)] }))).toMatchObject({ id: 'waitRadar', step: 'wait' });
    expect(id(onRoad({ ...sent, RADAR: 1 }, { mining: true }))).toBe('orderSurvey');
  });

  it('still teaches the telescope to a player who ordered the radar early', () => {
    const early = onRoad({ EXTRACTOR: 1, TELESCOPE: 1 }, { queue: [order('RADAR', 1)], view: 'galaxy' });
    expect(id(early)).toBe('telescopeLook');
    expect(id({ ...early, mining: true, view: 'ship' })).toBe('waitRadar');
  });

  it('keeps the radar\'s contact lesson behind the telescope\'s', () => {
    const early = onRoad({ EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, { view: 'galaxy', sight: { traffic: false, unknown: true } });
    expect(id(early)).toBe('telescopeLook');
    expect(id({ ...early, mining: true })).toBe('radarRing');
  });

  it('asks for the ship first when the player is out on the galaxy', () => {
    expect(at(onRoad({}, { view: 'galaxy' }))).toMatchObject({ id: 'orderExtractor', nav: 'openShip', marks: ['[data-guide="dock-base"]'] });
  });

  it('waits for the telescope, and only then opens its field', () => {
    const sensors = { EXTRACTOR: 1 };
    expect(at(onRoad(sensors, { queue: [order('TELESCOPE', 1)] }))).toMatchObject({ id: 'waitTelescope', step: 'wait' });
    expect(at(onRoad({ ...sensors, TELESCOPE: 1 }, { view: 'galaxy' }))).toMatchObject({ id: 'telescopeLook', step: 'read', marks: [] });
  });

  // Owner playtest 2026-11-08: the telescope is looked through first, then a rock is found by hand.
  describe('the first look through the telescope', () => {
    const open = (over: Partial<TutorialInput> = {}) => onRoad({ EXTRACTOR: 1, TELESCOPE: 1 }, { view: 'galaxy', ...over });
    const looked = { acked: ['telescopeLook', 'zoomRock'] };
    // Owner playtest 2026-11-09: a white ring was tapped without the rock ever being seen.
    it('has the player come closer before any rock is asked for', () => {
      expect(at(open({ acked: ['telescopeLook'] }))).toMatchObject({ id: 'zoomRock', step: 'gesture', marks: [] });
    });
    it('does not ask for a zoom with no rock to zoom on', () => {
      expect(id(open({ acked: ['telescopeLook'], noRocks: true }))).toBe('findRock');
    });
    it('does not ask for a zoom over a rock already open', () => {
      expect(id(open({ acked: ['telescopeLook'], rockOpen: true }))).toBe('mine');
    });
    it('has a rock found in the sky after the look', () => {
      expect(at(open(looked))).toMatchObject({ id: 'findRock', step: 'press', marks: ['[data-guide="sight-rock"]', '[data-guide="objective"]'] });
    });
    it('turns to the Prospector once the rock is open, and back when it is closed', () => {
      expect(at(open({ ...looked, rockOpen: true }))).toMatchObject({ id: 'mine', step: 'press', marks: ['[data-guide="mine"]', '[data-guide="objective"]'] });
      expect(at(open({ ...looked, rockOpen: false }))).toMatchObject({ id: 'findRock' });
    });
    it('is over with the first flight, on any phone', () => {
      expect(id(open({ mining: true }))).toBe('orderRadar');
      expect(id(open({ facts: ['FIRST_MINING_RETURN'] }))).toBe('orderRadar');
    });
    it('closes the note and the page before it speaks', () => {
      expect(at(open({ unlockToAnnounce: 'telescope' }))).toMatchObject({ id: 'telescopeLook', nav: 'dismissUnlock' });
      expect(at(open({ ...looked, unlockToAnnounce: 'telescope' }))).toMatchObject({ id: 'findRock', nav: 'dismissUnlock' });
      expect(at(open({ acked: ['telescopeLook'], unlockToAnnounce: 'telescope' }))).toMatchObject({ id: 'zoomRock', nav: 'dismissUnlock' });
      expect(at(open({ view: 'ship' }))).toMatchObject({ id: 'telescopeLook', nav: 'closePage' });
    });
  });

  it('does not wait on the flight: the antenna is next while the Prospector is out', () => {
    expect(at(onRoad({ EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, { mining: true }))).toMatchObject({ id: 'orderSurvey', marks: marksOf('SURVEY', 1, 'SURVEY') });
    expect(at(onRoad({ EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, { mining: true, queue: [order('SURVEY', 1)] }))).toMatchObject({ id: 'waitSurvey', step: 'wait' });
  });

  it('sends a probe at another ship once the antenna is in, and skips it when nobody is there', () => {
    const antenna = { EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1 };
    const flown = { mining: true, view: 'galaxy' as const };
    expect(at(onRoad(antenna, flown))).toMatchObject({ id: 'probe', step: 'press', marks: ['[data-guide="probe"]', '[data-guide="objective"]'] });
    expect(at(onRoad(antenna, { ...flown, probing: true }))).toMatchObject({ id: 'orderShipyard', nav: 'openShip' });
    expect(id(onRoad(antenna, { ...flown, alone: true }))).toBe('orderShipyard');
  });

  it('has the first ship built at the yard once it stands, then shows what is left of the ship', () => {
    const yard = { EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 };
    const facts = ['FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'] as const;
    const read = { acked: ['openIntel', 'openReport', 'report', 'collectMine'] };
    expect(at(onRoad({ EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1 }, { facts, ...read, queue: [order('SHIPYARD', 1)] }))).toMatchObject({ id: 'waitYard', step: 'wait' });
    expect(at(onRoad(yard, { facts, ...read }))).toMatchObject({ id: 'buildShip', step: 'press', marks: ['[data-commit] button', '[data-testid="yard-hull"][data-hull="DART"] button', '#ship-deck-yard'] });
    expect(at(onRoad(yard, { facts, acked: [...read.acked, 'buildShip'] }))).toMatchObject({ id: 'farewell', step: 'read', marks: ['[data-testid="ship-repair"]'] });
    expect(at(onRoad(yard, { facts, acked: [...read.acked, 'buildShip', 'farewell'] }))).toEqual({ kind: 'advise' });
    // Walk 2026-11-08: the yard's own crate pays for the first hull, and nothing was sending the player to it.
    const yardCrate = [{ id: 'REFINERY:2', state: 'opened' as const }, { id: 'SHIPYARD:1', state: 'ready' as const }];
    expect(at(onRoad(yard, { facts, ...read, canBuildShip: false, crates: yardCrate }))).toMatchObject({ id: 'openCrate', step: 'press' });
    expect(at(onRoad(yard, { facts, ...read, canBuildShip: true, crates: yardCrate }))).toMatchObject({ id: 'buildShip' });
    // Walk 2026-11-08: the road spends everything, and a hull 1 h 45 away is not a next step.
    expect(at(onRoad(yard, { facts, ...read, canBuildShip: false }))).toMatchObject({ id: 'farewell', step: 'read' });
  });

  it('asks for a crate when the next repair cannot be paid without it, however many were opened', () => {
    const crates = [{ id: 'REFINERY:2', state: 'opened' }, { id: 'TELESCOPE:1', state: 'ready' }] as const;
    const short = onRoad({ EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, { mining: true, canPayNext: false, crates });
    expect(at(short)).toMatchObject({ id: 'openCrate', step: 'press', marks: ['[data-guide="crate"]'] });
    expect(id({ ...short, canPayNext: true })).toBe('orderSurvey');
    expect(id({ ...short, crates: [{ id: 'REFINERY:2', state: 'opened' }] })).toBe('orderSurvey');
  });

  // Walk 2026-11-08: the telescope opened and the player was sent aboard for a crate before seeing a rock.
  it('asks for a crate only when a repair is the next thing: rocks and probes come first', () => {
    const crates = [{ id: 'REFINERY:2', state: 'opened' }, { id: 'TELESCOPE:1', state: 'ready' }] as const;
    expect(id(onRoad({ EXTRACTOR: 1, TELESCOPE: 1 }, { canPayNext: false, crates, queue: [order('RADAR', 1)] }))).toBe('telescopeLook');
    expect(id(onRoad({ EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1 }, { mining: true, canPayNext: false, crates }))).toBe('probe');
  });

  it('holds nothing anywhere on the road', () => {
    for (const input of [onRoad({}), onRoad({ EXTRACTOR: 1, TELESCOPE: 1 }, { view: 'galaxy' }), onRoad({ EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 })]) {
      expect(at(input)).toMatchObject({ strict: false });
    }
  });

  it('hands over to the advisor once it has been walked', () => {
    expect(at(awake({ modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1 }, ...ack('farewell') }))).toEqual({ kind: 'advise' });
  });

  it('does not walk a ship far past it back through the yard', () => {
    const modules = { REFINERY: 3, EXTRACTOR: 2, TELESCOPE: 1, RADAR: 1, SURVEY: 2, SHIPYARD: 1 };
    expect(at(awake({ modules, facts: ['FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'], acked: ['report', 'collectMine'], view: 'ship' }))).toEqual({ kind: 'advise' });
  });
});

describe('the first-time moments', () => {
  it('teaches the first crate once, when it is ready and none was ever opened', () => {
    const freed = awake({ view: 'ship', crates: [{ id: 'REFINERY:2', state: 'ready' }] });
    expect(at(freed)).toMatchObject({ id: 'firstCrate', step: 'press', strict: false, marks: ['[data-guide="crate"]'] });
    expect(at({ ...freed, view: 'galaxy' })).toMatchObject({ id: 'firstCrate', nav: 'openShip' });
    expect(id({ ...freed, canPayNext: true, crates: [{ id: 'REFINERY:2', state: 'opened' }, { id: 'SURVEY:1', state: 'ready' }] })).toBe('orderExtractor');
  });

  it('reads the first probe report where it is drawn, once', () => {
    const read = awake({ modules: { REFINERY: 2, EXTRACTOR: 1, SURVEY: 1 }, facts: ['FIRST_PROBE_REPORT'] });
    expect(at(read)).toMatchObject({ id: 'openIntel', strict: false, marks: ['[data-guide="dock-intel"]'] });
    expect(id({ ...read, ...ack('openIntel') })).toBe('openReport');
    // Walk 2026-11-08: Intel can open on the reports shelf, where the card's own door is what is pressed.
    expect(at({ ...read, ...ack('openIntel') })).toMatchObject({ marks: ['[data-known="probe"] button, [data-report-open]', '[data-guide="dock-intel"]'] });
    expect(at({ ...read, ...ack('openIntel', 'openReport') })).toMatchObject({ id: 'report', step: 'read', marks: ['[data-dossier-loot]'] });
    expect(id({ ...read, ...ack('openIntel', 'openReport', 'report') })).toBe('orderShipyard');
  });

  it('asks for the first haul when the Prospector is home, wherever the road has got to', () => {
    const home = awake({ modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, facts: ['FIRST_MINING_RETURN'], works: 100 });
    expect(at(home)).toMatchObject({ id: 'collectMine', marks: ['[data-guide="works"]'] });
    expect(id({ ...home, ...ack('collectMine') })).toBe('orderSurvey');
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
  it('has no report to read, so the road goes on to the yard', () => {
    expect(id(awake({ modules: { REFINERY: 2, EXTRACTOR: 2, SURVEY: 1 }, alone: true }))).toBe('orderShipyard');
  });
});

/**
 * THE RADAR IS TAUGHT ON A REAL CONTACT (plan F6). The lesson waits for the live world to give it a
 * subject: the scout's `?`, then the telescope naming it. Nothing is made up for a lesson.
 */
describe('the radar speaks on a real contact', () => {
  const late = awake({ modules: { REFINERY: 3, EXTRACTOR: 3, SURVEY: 1, SHIPYARD: 1, TELESCOPE: 1, RADAR: 1 }, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'], acked: ['report', 'collectMine', 'farewell'] });
  const traffic = { traffic: true, unknown: false };
  const blip = { traffic: false, unknown: true };
  it('introduces Radar 1 on the question mark, and only then', () => {
    expect(at(late)).toEqual({ kind: 'advise' });
    expect(at({ ...late, sight: blip })).toMatchObject({ id: 'radarRing', marks: ['[data-guide="sight-unknown"]'] });
    expect(at({ ...late, sight: blip, acked: [...late.acked, 'radarRing'] })).toMatchObject({ id: 'radarContact' });
  });
  it('closes with the three jobs once the telescope has named what the radar found', () => {
    const asked = [...late.acked, 'radarRing', 'radarContact'];
    expect(at({ ...late, sight: blip, acked: asked })).toEqual({ kind: 'advise' });
    expect(at({ ...late, sight: traffic, acked: asked })).toMatchObject({ id: 'sightTrio', marks: ['[data-guide="sight-craft"]'] });
    expect(at({ ...late, sight: traffic, acked: [...asked, 'sightTrio'] })).toEqual({ kind: 'advise' });
  });
  it('never takes the player off a page: it waits for them to be looking at the sky', () => {
    expect(at({ ...late, sight: blip, view: 'ship' })).toEqual({ kind: 'advise' });
    expect(at({ ...late, sight: blip, view: 'other' })).toEqual({ kind: 'advise' });
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

  // The first hunt (F4e): the probe button on an open outpost, else that outpost's flag, else the line.
  it('leads a hunt probe to its outpost, and the choice to the line that opens the reports', () => {
    const probe = { kind: 'hunt', hunt: { stage: 'probe', target: 'tevis' }, mining: true } as const;
    expect(adviceMarks(probe, 'galaxy')).toEqual({ marks: ['[data-guide="probe"]', '[data-outpost-guide="tevis"]', '[data-guide="objective"]'] });
    expect(adviceMarks(probe, 'ship')).toEqual({ marks: ['[data-sheet-close]'], nav: 'closePage' });
    expect(adviceMarks({ kind: 'hunt', hunt: { stage: 'decide' }, mining: false }, 'galaxy')).toEqual({ marks: ['[data-guide="objective"]'] });
    // Reading the reports is where the choice is made: no hand drags the player out of them.
    expect(adviceMarks({ kind: 'hunt', hunt: { stage: 'decide' }, mining: false }, 'other')).toEqual({ marks: [] });
    expect(adviceMarks({ kind: 'hunt', hunt: { stage: 'raid' }, mining: false }, 'galaxy')).toEqual({ marks: [] });
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
    waitTelescope: awake({ modules: { REFINERY: 2, EXTRACTOR: 1 }, queue: [order('TELESCOPE', 1)] }),
    waitRadar: awake({ modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 }, mining: true, queue: [order('RADAR', 1)] }),
    waitSurvey: awake({ modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, mining: true, canPayNext: true, queue: [order('SURVEY', 1)] }),
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
    expect(repairWait('waitTelescope', [timed('RADAR', 1, 180), timed('TELESCOPE', 1, 90)])).toEqual({ until: at(90), spanMs: 90_000 });
    expect(repairWait('waitRadar', [timed('RADAR', 1, 15)])).toEqual({ until: at(15), spanMs: 15_000 });
    expect(repairWait('mine', [timed('SURVEY', 1, 30)])).toBeNull();
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
