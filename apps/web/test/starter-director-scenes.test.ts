import { describe, expect, it } from 'vitest';
import { SHOT_MAX_MS } from '../src/starter/director/director.js';
import { TELESCOPE_PULL, WORK_GRACE_MS, contactScene, probeScene, rockScene, sceneAnnouncing, scenesFor, weldingBays, yardNeedScene, type ShipState } from '../src/starter/director/scenes.js';

/**
 * WHICH SCENE A CHANGE OF THE SHIP CALLS FOR (plan 2026-11-18 §5, Faz 5.2–5.6). The first look at the
 * ship is its report; a repair of the first road is shown where it is done, when it starts and when it
 * comes back; the hull's new look is a moment, never a swap; the dark is shown before the telescope.
 */
const name = (module: string): string => module.toLowerCase();
const opening: ShipState = { modules: { REFINERY: 1 }, queue: [], look: 'WRECKED', facts: [] };
const ids = (prev: ShipState | null, next: ShipState): string[] => scenesFor(prev, next, name).map(scene => scene.id);
/** The first road walked to its end, before any of the window's deeds. */
const ROAD_DONE: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 }, queue: [], look: 'PATCHED', facts: [] };

describe('the scenes a ship calls for', () => {
  it('opens a new ship with its report: the whole hull round, then the drive, the way out', () => {
    const [report] = scenesFor(null, opening, name);
    expect(report?.id).toBe('shipReport');
    expect(report?.beats.map(beat => beat.shot.kind)).toEqual(['ship', 'bay']);
    expect(report?.beats[0]?.tags).toEqual(['REFINERY', 'SURVEY', 'DEFENCE', 'CARGO', 'DRIVE']);
    expect(report?.beats[1]?.shot).toEqual({ kind: 'bay', system: 'DRIVE' });
    // Owner 2026-11-18: five systems named on the hull want time to be read.
    expect(report?.beats[0]?.ms).toBe(8000);
    expect(report?.keep).toBe(true);
  });

  it('opens a ship met again further on with nothing: it has seen its report', () => {
    expect(ids(null, { modules: { REFINERY: 2, EXTRACTOR: 1 }, queue: [], look: 'WRECKED', facts: [] })).toEqual([]);
  });

  it('shows a repair of the road where it is done, as it starts', () => {
    const [work] = scenesFor(opening, { ...opening, queue: [{ subject: 'REFINERY', stage: 2 }] }, name);
    expect(work?.id).toBe('repair:REFINERY:2:work');
    expect(work?.beats[0]?.shot).toEqual({ kind: 'bay', system: 'REFINERY' });
    expect(work?.beats[0]?.line).toBe('starter.director.repair.work');
    expect(work?.beats[0]?.vars).toEqual({ name: 'refinery' });
  });

  // Isolated player test 2026-11-18: a player saw the stores fall from 1,217 to 417 under the letterbox,
  // never tied it to the repair they had ordered, and quit. The scene says what the repair took.
  // Owner 2026-11-18: the shot stays on the bay until the repair is done; the done scene takes over from it.
  it('holds the repair\'s shot until it is due, and lets the done scene cut in', () => {
    const readyAt = new Date('2026-11-18T10:00:30.000Z');
    const [work] = scenesFor(opening, { ...opening, queue: [{ subject: 'REFINERY', stage: 2, readyAt }] }, name);
    expect(work?.beats[0]?.until).toBe(readyAt.getTime() + WORK_GRACE_MS);
    expect(work?.beats[0]?.yields).toBe(true);
  });

  it('says what the repair took from the stores, as it starts', () => {
    const cost = { alloy: 800, crystal: 300, deuterium: 0 };
    const [work] = scenesFor(opening, { ...opening, queue: [{ subject: 'REFINERY', stage: 2, cost }] }, name);
    expect(work?.beats[0]?.spend).toEqual(cost);
  });

  it('shows the repair come back, with what it is for, and the hull\'s new look as a moment of its own', () => {
    const before: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 }, queue: [{ subject: 'RADAR', stage: 1 }], look: 'WRECKED', facts: [] };
    const after: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, queue: [], look: 'PATCHED', facts: [] };
    const [done] = scenesFor(before, after, name);
    expect(done?.id).toBe('repair:RADAR:1:done');
    expect(done?.beats.map(beat => beat.line)).toEqual(['starter.director.repair.RADAR', 'starter.director.hull.PATCHED']);
    expect(done?.beats[0]?.shot).toEqual({ kind: 'bay', system: 'DEFENCE' });
    expect(done?.beats[1]?.shot.kind).toBe('ship');
  });

  it('shows only the return of a repair that was ordered and finished while away', () => {
    expect(ids(opening, { modules: { REFINERY: 2 }, queue: [], look: 'WRECKED', facts: [] })).toEqual(['repair:REFINERY:2:done']);
  });

  it('leaves the repairs past the road to the ship itself', () => {
    const road: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 }, queue: [], look: 'PATCHED', facts: [] };
    expect(ids(road, { ...road, queue: [{ subject: 'VAULT', stage: 1 }] })).toEqual([]);
    expect(ids(road, { ...road, modules: { ...road.modules, VAULT: 1 } })).toEqual([]);
  });

  it('shows the dark once the crystal furnace is back and the telescope is not', () => {
    const before: ShipState = { modules: { REFINERY: 2 }, queue: [{ subject: 'EXTRACTOR', stage: 1 }], look: 'WRECKED', facts: [] };
    const after: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1 }, queue: [], look: 'WRECKED', facts: [] };
    expect(ids(before, after)).toEqual(['repair:EXTRACTOR:1:done', 'dark']);
    const [, dark] = scenesFor(before, after, name);
    expect(dark?.beats[0]?.shot).toEqual({ kind: 'wide' });
    expect(dark?.beats[0]?.line).toBe('starter.director.dark');
  });

  it('holds every shot to three seconds at most', () => {
    const all = [
      ...scenesFor(null, opening, name),
      ...scenesFor(opening, { ...opening, queue: [{ subject: 'REFINERY', stage: 2 }] }, name),
      rockScene('rock-1'),
      contactScene({ kind: 'contact', id: 'c-1' }),
      probeScene({ id: 'ship-2', name: 'Vega' }),
      yardNeedScene(),
      ...scenesFor(ROAD_DONE, { ...ROAD_DONE, facts: ['FIRST_BATTLE_REPORT'] }, name),
    ];
    for (const scene of all) for (const beat of scene.beats) expect(beat.ms, `${scene.id}/${beat.id}`).toBeLessThanOrEqual(SHOT_MAX_MS);
    expect(all.every(scene => scene.once)).toBe(true);
  });

  // Plan §5 A6–A7: the field the telescope opened first, then its nearest rock.
  it('shows the telescope\'s field, then comes close to its first rock', () => {
    const [field, approach] = rockScene('rock-1').beats;
    expect(field?.shot).toEqual({ kind: 'wide', range: 11 });
    expect(field?.line).toBe('starter.director.field');
    expect(approach?.shot).toEqual({ kind: 'subject', focus: { kind: 'asteroid', id: 'rock-1' }, range: 2.4 });
  });

  it('comes close to the first rock and to the first contact without opening them', () => {
    expect(rockScene('rock-1').beats.at(-1)?.shot).toEqual({ kind: 'subject', focus: { kind: 'asteroid', id: 'rock-1' }, range: 2.4 });
    expect(rockScene('rock-1').id).toBe('rock');
    expect(contactScene({ kind: 'unknownSignal', id: 's-1' }).beats[0]?.line).toBe('starter.director.contact');
  });
});

// Plan 2026-11-18 §5 A9–A11 and A13: the probe's report, the yard it calls for, the first ships, the ship again.
describe('the scenes after the road\'s first half', () => {
  it('turns to the ship the probe read, by name, without opening it', () => {
    const scene = probeScene({ id: 'ship-2', name: 'Vega' });
    expect(scene.id).toBe('probe');
    expect(scene.beats.map(beat => beat.shot)).toEqual([{ kind: 'subject', focus: { kind: 'planet', id: 'ship-2' } }]);
    expect(scene.beats[0]?.line).toBe('starter.director.probe');
    expect(scene.beats[0]?.vars).toEqual({ name: 'Vega' });
  });

  it('shows the empty yard, where the ships to carry a haul would come from', () => {
    const [beat] = yardNeedScene().beats;
    expect(yardNeedScene().id).toBe('yardNeed');
    expect(beat?.shot).toEqual({ kind: 'bay', system: 'CARGO' });
    expect(beat?.line).toBe('starter.director.yardNeed');
  });

  /*
    Owner, phone playtest 2026-11-18 (item 8): the telescope's own Prospector was announced as the yard's
    first ships, and the ships flew off for good ("gemilerim nereye gidiyor?"). Each repair that hands over
    craft says what it handed and where it is kept; the craft shown are those, and they dock again.
  */
  it('shows the yard\'s first two ships as it comes back, kept in the cargo bay', () => {
    const before: ShipState = { ...ROAD_DONE, modules: { ...ROAD_DONE.modules, SHIPYARD: 0 }, queue: [{ subject: 'SHIPYARD', stage: 1 }] };
    const [done] = scenesFor(before, ROAD_DONE, (module) => module.toLowerCase());
    expect(done?.id).toBe('repair:SHIPYARD:1:done');
    expect(done?.beats.slice(0, 2).map(beat => beat.id)).toEqual(['back', 'ships']);
    const ships = done?.beats[1];
    expect(ships?.shot.kind).toBe('ship');
    expect(ships?.line).toBe('starter.director.ships.SHIPYARD');
    expect(ships?.vars).toEqual({ count: 2, hull: 'dart' });
    expect(ships?.craft).toEqual({ hull: 'DART', count: 2 });
  });

  it('shows the telescope\'s Prospector as its own, found in the cargo bay, never as the yard\'s', () => {
    const before: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1 }, queue: [{ subject: 'TELESCOPE', stage: 1 }], look: 'WRECKED', facts: [] };
    const after: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 }, queue: [], look: 'WRECKED', facts: [] };
    const done = scenesFor(before, after, (module) => module.toLowerCase()).find(scene => scene.id === 'repair:TELESCOPE:1:done');
    const ships = done?.beats.find(beat => beat.id === 'ships');
    expect(ships?.line).toBe('starter.director.ships.TELESCOPE');
    expect(ships?.vars).toEqual({ count: 1, hull: 'prospector' });
    expect(ships?.craft).toEqual({ hull: 'PROSPECTOR', count: 1 });
  });

  // Owner 2026-11-18 (item 7): the bay that comes back does its module's own work.
  it('wakes the bay of a repair as its module, as the camera reaches it', () => {
    const before: ShipState = { modules: { REFINERY: 2 }, queue: [{ subject: 'EXTRACTOR', stage: 1 }], look: 'WRECKED', facts: [] };
    const after: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1 }, queue: [], look: 'WRECKED', facts: [] };
    const done = scenesFor(before, after, (module) => module.toLowerCase()).find(scene => scene.id === 'repair:EXTRACTOR:1:done');
    expect(done?.beats[0]?.shot).toEqual({ kind: 'bay', system: 'REFINERY' });
    expect(done?.beats[0]?.awaken).toEqual({ system: 'REFINERY', module: 'EXTRACTOR' });
    expect(done?.beats[0]?.reach).toBeUndefined();
  });

  /*
    Owner phone playtest 2026-11-18 (item 19): not a sphere drawn round the hull. The camera pulls back a
    little from the ship, and once it has, a breath later, the telescope's own reach opens.
  */
  it('pulls back from the ship as the telescope comes back, and opens its reach half a second after', () => {
    const before: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1 }, queue: [{ subject: 'TELESCOPE', stage: 1 }], look: 'WRECKED', facts: [] };
    const after: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 }, queue: [], look: 'WRECKED', facts: [] };
    const back = scenesFor(before, after, name).find(scene => scene.id === 'repair:TELESCOPE:1:done')?.beats[0];
    expect(back?.id).toBe('back');
    expect(back?.shot).toEqual({ kind: 'ship', range: TELESCOPE_PULL.range, seconds: TELESCOPE_PULL.seconds });
    expect(TELESCOPE_PULL.range).toBeGreaterThan(4.4);
    expect(back?.reach).toBe(TELESCOPE_PULL.seconds * 1000 + 500);
    expect(back?.awaken).toBeUndefined();
    expect(back?.ms).toBeGreaterThanOrEqual((back?.reach ?? 0) + 1400);
  });

  it('shows the ship again after its first battle: every system named, then the drive still to wake', () => {
    const [report] = scenesFor(ROAD_DONE, { ...ROAD_DONE, facts: ['FIRST_BATTLE_REPORT'] }, name);
    expect(report?.id).toBe('shipReport2');
    expect(report?.beats.map(beat => beat.shot.kind)).toEqual(['ship', 'bay']);
    expect(report?.beats[0]?.tags).toEqual(['REFINERY', 'SURVEY', 'DEFENCE', 'CARGO', 'DRIVE']);
    expect(report?.beats[0]?.line).toBe('starter.director.report2.round');
    expect(report?.beats[0]?.ms).toBe(8000);
    expect(report?.keep).toBe(true);
    expect(report?.beats[1]?.shot).toEqual({ kind: 'bay', system: 'DRIVE' });
    expect(report?.beats[1]?.tags).toEqual(['DRIVE']);
    expect(report?.beats[1]?.line).toBe('starter.director.report2.drive');
  });

  it('says the drive is ready once the jump window is open', () => {
    const open: ShipState = { ...ROAD_DONE, facts: ['FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'] };
    const [report] = scenesFor(open, { ...open, facts: [...open.facts, 'FIRST_BATTLE_REPORT'] }, name);
    expect(report?.beats[1]?.line).toBe('starter.director.report2.ready');
  });

  it('shows the second report once: a battle already reported calls for nothing', () => {
    const fought: ShipState = { ...ROAD_DONE, facts: ['FIRST_BATTLE_REPORT'] };
    expect(ids(fought, { ...fought, facts: [...fought.facts, 'FIRST_OUTPOST_VICTORY'] })).toEqual([]);
    expect(ids(null, fought)).toEqual([]);
  });
});

describe('where the hull welds', () => {
  const order = (subject: string, stage: number, seconds: number, startedAt = 0) => ({ subject, stage, queue: 'CONSTRUCTION' as const, startedAt: new Date(startedAt), readyAt: new Date(startedAt + seconds * 1000) });
  it('welds the bay of a short repair while it runs, and no other', () => {
    expect(weldingBays([order('TELESCOPE', 1, 15)], 5_000)).toEqual([{ system: 'DEFENCE', module: 'TELESCOPE' }]);
    expect(weldingBays([order('TELESCOPE', 1, 15)], 16_000)).toEqual([]);
  });
  // A repair of hours would keep the galaxy drawing every frame for hours: it shows its clock instead.
  it('leaves a repair of more than two minutes still', () => {
    expect(weldingBays([order('REFINERY', 4, 3600)], 5_000)).toEqual([]);
  });
  // Owner 2026-11-18 (item 6): the bay names the module it welds, so a crystal repair throws crystal sparks.
  it('names a bay once however many of its repairs run, with the first module it welds, and ignores the yard', () => {
    expect(weldingBays([order('EXTRACTOR', 1, 5), order('REFINERY', 2, 5), { ...order('DART', 1, 5), queue: 'YARD' as const }], 1_000))
      .toEqual([{ system: 'REFINERY', module: 'EXTRACTOR' }]);
  });
});

// Live play 2026-11-18: the telescope came back on the hull, then a card said "Defence systems online"
// and asked to be closed before the sky would open. The scene is the announcement.
describe('which scene announces a system', () => {
  it('names the repair of the road that opens it', () => {
    expect(sceneAnnouncing('telescope')).toBe('repair:TELESCOPE:1:done');
    expect(sceneAnnouncing('radar')).toBe('repair:RADAR:1:done');
    expect(sceneAnnouncing('intel')).toBe('repair:SURVEY:1:done');
    expect(sceneAnnouncing('fleet')).toBe('repair:SHIPYARD:1:done');
  });

  it('names none for a system an event opens, or one open before the road', () => {
    expect(sceneAnnouncing('salvage')).toBeNull();
    expect(sceneAnnouncing('attack')).toBeNull();
    expect(sceneAnnouncing('production')).toBeNull();
    expect(sceneAnnouncing('migration')).toBeNull();
  });
});
