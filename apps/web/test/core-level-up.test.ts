import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { worldRadius } from '@astera/rules';
import type { BuildOrderView } from '../src/api/schemas.js';
import {
  beginGrowth, CORE_SEEN_KEY, coreClocks, coreLevelAt, crossesPeak, drawnRadius, GROW_SETTLE_S, growthMoving, LEVEL_LANDS,
  levelFrame, levelKind, levelLength, levelUpKey, mergeSeen, nextLevelUp, owedLevelUps, pruneGrowth, readCoreSeen,
  rebaseStale, rememberCoreSeen, resetGrowth, TIER_LANDS, type CoreClock, type LevelUp,
} from '../src/galaxy/coreLevelUp.js';
import { chronicle as deChronicle } from '../src/i18n/locales/de/chronicle.js';
import { galaxy as deGalaxy } from '../src/i18n/locales/de/world.js';
import { chronicle as enChronicle } from '../src/i18n/locales/en/chronicle.js';
import { galaxy as enGalaxy } from '../src/i18n/locales/en/world.js';
import { chronicle as esChronicle } from '../src/i18n/locales/es/chronicle.js';
import { galaxy as esGalaxy } from '../src/i18n/locales/es/world.js';
import { chronicle as frChronicle } from '../src/i18n/locales/fr/chronicle.js';
import { galaxy as frGalaxy } from '../src/i18n/locales/fr/world.js';
import { chronicle as jaChronicle } from '../src/i18n/locales/ja/chronicle.js';
import { galaxy as jaGalaxy } from '../src/i18n/locales/ja/world.js';
import { chronicle as trChronicle } from '../src/i18n/locales/tr/chronicle.js';
import { galaxy as trGalaxy } from '../src/i18n/locales/tr/world.js';
import { planetView } from './fixtures.js';

/*
  THE COMMAND CORE LEVELS UP ON THE MAP (owner approved the lab look, 2026-11-13). Since D153 the world's
  drawn size follows the exact Core level, so the Core is the one building the galaxy sees finish. It
  plays when the queue's time runs out and the level is real — never on the button press — on the
  player's own worlds only. A level that crosses a tier (4, 7, 10 … 22) plays the bigger version with
  "Kademe N". Live on the map the light gathers first so the world steps exactly when the queue ends;
  a level that finished while the player was elsewhere plays on the next galaxy open. Client only: the
  queue's absolute finish times and a per-device record of the levels already shown.
*/

const T = Date.parse('2026-11-13T12:00:00Z');
const core = (id: string, level: number, finishes: number[] = []): CoreClock => ({ id, level, finishes });

const order = (over: Partial<Record<string, unknown>>): BuildOrderView => ({
  id: `o-${String(Math.random())}`, queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject: 'CORE', count: 1,
  startedAt: new Date(T - 60_000), finishesAt: new Date(T + 60_000), cost: { alloy: 1, crystal: 0, deuterium: 0 },
  ...over,
});

describe('core level-up timeline', () => {
  it('the light gathers onto the world before anything detonates', () => {
    expect(levelFrame(0).gather).toBe(0);
    expect(levelFrame(LEVEL_LANDS * 0.5).gather).toBeGreaterThan(0);
    expect(levelFrame(LEVEL_LANDS * 0.5).gather).toBeLessThan(1);
    const before = levelFrame(LEVEL_LANDS - 0.01);
    expect(before.flash + before.ring + before.disc + before.step).toBe(0);
  });

  it('the world steps only at the detonation, overshoots a touch and settles on its new size', () => {
    expect(levelFrame(LEVEL_LANDS - 0.05).step).toBe(0);
    const peak = Math.max(...Array.from({ length: 60 }, (_, i) => levelFrame(LEVEL_LANDS + i * 0.02).step));
    expect(peak).toBeGreaterThan(1);
    expect(levelFrame(LEVEL_LANDS + 3).step).toBeCloseTo(1, 3);
  });

  it('a tier jump gathers longer, flashes longer, fires a second shock and writes its word', () => {
    expect(TIER_LANDS).toBeGreaterThan(LEVEL_LANDS);
    const t = (LEVEL_LANDS + TIER_LANDS) / 2;
    expect(levelFrame(t).flash).toBeGreaterThan(0);
    expect(levelFrame(t, 'tier').flash).toBe(0);
    expect(levelFrame(TIER_LANDS + 0.3, 'tier').flash).toBeGreaterThan(levelFrame(LEVEL_LANDS + 0.3).flash);
    expect(levelFrame(TIER_LANDS + 0.05, 'tier').disc2).toBe(0);
    expect(levelFrame(TIER_LANDS + 0.6, 'tier').disc2).toBeGreaterThan(0);
    expect(levelFrame(TIER_LANDS, 'tier').label).toBe(0);
    expect(levelFrame(TIER_LANDS + 0.6, 'tier').label).toBe(1);
    expect(levelFrame(TIER_LANDS + 2, 'tier').label).toBe(1);
    expect(levelFrame(levelLength('tier'), 'tier').label).toBe(0);
  });

  it('an ordinary level never writes a word nor fires the second shock', () => {
    for (let t = 0; t < levelLength('level'); t += 0.05) {
      expect(levelFrame(t).label).toBe(0);
      expect(levelFrame(t).disc2).toBe(0);
    }
  });

  it('is quiet once over, and bad clocks show nothing, never NaN', () => {
    for (const kind of ['level', 'tier'] as const) {
      const end = levelFrame(levelLength(kind) + 0.01, kind);
      expect(end.flash + end.label).toBeLessThan(0.01);
      expect(end.step).toBeCloseTo(1, 3);
      for (const t of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
        const frame = levelFrame(t, kind);
        expect(Object.values(frame).every(Number.isFinite)).toBe(true);
        expect(Object.values(frame).every((v) => v === 0)).toBe(true);
      }
    }
  });
});

describe('which Core levels are coming, from the queue', () => {
  it('reads the Core level and only the server-timed, running Core upgrades, soonest first', () => {
    const world = planetView({
      buildings: { ...planetView().buildings, CORE: 9 },
      queues: {
        CONSTRUCTION: [
          order({ finishesAt: new Date(T + 90_000) }),
          order({ finishesAt: new Date(T + 30_000) }),
          order({ subject: 'VAULT', finishesAt: new Date(T + 10_000) }),
          order({ finishesAt: new Date(T + 5_000), pausedAt: new Date(T - 1_000) }),
          { id: 'staged', queue: 'CONSTRUCTION', slot: 1, kind: 'BUILDING', subject: 'CORE', count: 1, cost: { alloy: 1, crystal: 0, deuterium: 0 }, staged: true },
          { id: 'tap', queue: 'CONSTRUCTION', slot: 1, kind: 'BUILDING', subject: 'CORE', count: 1, cost: { alloy: 1, crystal: 0, deuterium: 0 }, optimistic: true },
        ],
        YARD: [],
      },
    }, { id: 'home' });
    expect(coreClocks([world])).toEqual([{ id: 'home', level: 9, finishes: [T + 30_000, T + 90_000] }]);
  });

  it('a world with no queue reads as its level alone', () => {
    const world = planetView({ buildings: { ...planetView().buildings, CORE: 4 } }, { id: 'c1' });
    const { queues: _dropped, ...noQueues } = world;
    expect(coreClocks([noQueues])).toEqual([{ id: 'c1', level: 4, finishes: [] }]);
  });

  it('the level now counts every queued Core upgrade whose time has run out', () => {
    const c = core('home', 9, [T - 1, T + 1000]);
    expect(coreLevelAt(c, T)).toBe(10);
    expect(coreLevelAt(c, T + 1000)).toBe(11);
    expect(coreLevelAt(core('home', 9), T)).toBe(9);
  });

  it('a step that crosses a tier (every third level) is the bigger moment', () => {
    expect(levelKind(9, 10)).toBe('tier');
    expect(levelKind(10, 11)).toBe('level');
    expect(levelKind(11, 12)).toBe('level');
    expect(levelKind(5, 8)).toBe('tier');
    expect(levelKind(3, 4)).toBe('tier');
  });
});

describe('what plays, and when', () => {
  it('the first look on a device plays nothing: there is no record to compare with', () => {
    expect(owedLevelUps([core('home', 10)], null, T)).toEqual([]);
  });

  it('a level reached while the player was away plays on the next open, from the level last shown', () => {
    const seen = new Map([['home', 8], ['colony', 5]]);
    expect(owedLevelUps([core('home', 10), core('colony', 6)], seen, T)).toEqual([
      { id: 'home', from: 8, to: 10, kind: 'tier', tier: 4, start: T },
      { id: 'colony', from: 5, to: 6, kind: 'level', tier: 2, start: T },
    ]);
  });

  it('a world this device never saw (a new colony) and a level not higher play nothing', () => {
    const seen = new Map([['home', 10]]);
    expect(owedLevelUps([core('home', 10), core('new-colony', 7)], seen, T)).toEqual([]);
    expect(owedLevelUps([core('home', 9)], seen, T)).toEqual([]);
  });

  it('a queued upgrade plays live: the light starts gathering so the world steps as the queue ends', () => {
    const finish = T + 60_000;
    expect(nextLevelUp([core('home', 10, [finish])], T)).toEqual({ id: 'home', from: 10, to: 11, kind: 'level', tier: 4, start: finish - LEVEL_LANDS * 1000 });
    expect(nextLevelUp([core('home', 9, [finish])], T)?.start).toBe(finish - TIER_LANDS * 1000);
  });

  it('the soonest upgrade across the worlds is next; one already finished is owed, not next', () => {
    const next = nextLevelUp([core('home', 10, [T - 5, T + 80_000]), core('colony', 2, [T + 20_000])], T);
    expect(next?.id).toBe('colony');
    expect(nextLevelUp([core('home', 10, [T - 5, T + 80_000])], T)).toMatchObject({ from: 11, to: 12 });
    expect(nextLevelUp([core('home', 10, [T - 5])], T)).toBeNull();
    expect(nextLevelUp([], T)).toBeNull();
  });

  it('a second queued upgrade on the same world is next once the first has been taken', () => {
    const cores = [core('home', 10, [T + 60_000, T + 120_000])];
    expect(nextLevelUp(cores, T, new Map([['home', 11]]))).toMatchObject({ from: 11, to: 12, start: T + 120_000 - LEVEL_LANDS * 1000 });
    expect(nextLevelUp(cores, T, new Map([['home', 12]]))).toBeNull();
    expect(nextLevelUp([...cores, core('colony', 2, [T + 90_000])], T, new Map([['home', 12]]))?.id).toBe('colony');
  });
});

describe('what this device remembers after a look', () => {
  const look = (over: Partial<Parameters<typeof mergeSeen>[1]> = {}) => ({
    cores: [] as CoreClock[], owned: new Set(['home', 'colony', 'far']), now: T,
    shown: new Map<string, number>(), pending: new Set<string>(), ...over,
  });

  it('every own world on the map at its level now — lower too, so a rebuilt Core plays again', () => {
    const cores = [core('home', 10, [T - 1]), core('colony', 3)];
    expect(mergeSeen(null, look({ cores }))).toEqual(new Map([['home', 11], ['colony', 3]]));
    expect(mergeSeen(new Map([['home', 13]]), look({ cores }))).toEqual(new Map([['home', 11], ['colony', 3]]));
  });

  it('a step already on the map is remembered at its new level before its queue has run out', () => {
    const cores = [core('home', 10, [T + 900])];
    expect(mergeSeen(new Map([['home', 10]]), look({ cores, shown: new Map([['home', 11]]) }))).toEqual(new Map([['home', 11]]));
  });

  it('a step still waiting for its turn keeps the level last shown, so closing the game first owes it again', () => {
    const cores = [core('home', 10)];
    expect(mergeSeen(new Map([['home', 8]]), look({ cores, pending: new Set(['home']) }))).toEqual(new Map([['home', 8]]));
  });

  it('an own world this map does not draw keeps its record; a world no longer owned is forgotten', () => {
    const before = new Map([['home', 10], ['far', 5], ['lost', 6]]);
    expect(mergeSeen(before, look({ cores: [core('home', 10)] }))).toEqual(new Map([['home', 10], ['far', 5]]));
  });

  it('a look with nothing on the map changes nothing it still owns', () => {
    expect(mergeSeen(new Map([['home', 10]]), look())).toEqual(new Map([['home', 10]]));
  });
});

describe('a step the map could not draw on time', () => {
  const up: LevelUp = { id: 'home', from: 10, to: 11, kind: 'level', tier: 4, start: T };

  it('plays from the start when its slot comes late (the map was hidden), rather than being skipped', () => {
    expect(rebaseStale(up, T + 16)).toBe(up);
    expect(rebaseStale(up, T + 60_000)).toEqual({ ...up, start: T + 60_000 });
  });

  it('each step has its own sound, so two steps on one world within a minute both sound', () => {
    expect(levelUpKey(up)).not.toBe(levelUpKey({ ...up, from: 11, to: 12 }));
    expect(levelUpKey(up)).not.toBe(levelUpKey({ ...up, id: 'colony' }));
  });
});

describe('who you meet changes only when the tallest Core crosses a tier', () => {
  const tierUp = (id: string): LevelUp => ({ id, from: 9, to: 10, kind: 'tier', tier: 4, start: T });

  it('the tallest world crossing a tier changes who you meet', () => {
    expect(crossesPeak(tierUp('home'), [core('home', 9), core('colony', 6)], T)).toBe(true);
  });

  it('a colony crossing a tier the tallest world already holds or passed does not', () => {
    expect(crossesPeak(tierUp('colony'), [core('home', 13), core('colony', 9)], T)).toBe(false);
    expect(crossesPeak(tierUp('colony'), [core('home', 12), core('colony', 9)], T)).toBe(false);
  });

  it('an ordinary level never does', () => {
    expect(crossesPeak({ ...tierUp('home'), from: 10, to: 11, kind: 'level' }, [core('home', 10)], T)).toBe(false);
  });
});

describe('the tier word over the world', () => {
  const pairs = {
    de: [deGalaxy, deChronicle], en: [enGalaxy, enChronicle], es: [esGalaxy, esChronicle],
    fr: [frGalaxy, frChronicle], ja: [jaGalaxy, jaChronicle], tr: [trGalaxy, trChronicle],
  } as const;

  it('is the word the rest of the game uses for a tier, in every language', () => {
    for (const [locale, [galaxy, chronicle]] of Object.entries(pairs)) {
      const word = galaxy.coreTierUp.replace('{{tier}}', '').trim().toLocaleLowerCase(locale);
      // Without its placeholders: `{{tier}}` would match "tier" by itself.
      expect(chronicle.launcherCoreTier.replace(/\{\{\w+\}\}/g, ' ').toLocaleLowerCase(locale), locale).toContain(word);
    }
  });
});

describe('the record of levels shown on this device', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('is null until written, and only for the commander it was written for', () => {
    expect(readCoreSeen('me')).toBeNull();
    rememberCoreSeen('me', new Map([['home', 10]]));
    expect(readCoreSeen('me')).toEqual(new Map([['home', 10]]));
    expect(readCoreSeen('someone-else')).toBeNull();
  });

  it('a damaged record reads as a first look, never as a crash', () => {
    localStorage.setItem(CORE_SEEN_KEY, '{nope');
    expect(readCoreSeen('me')).toBeNull();
    localStorage.setItem(CORE_SEEN_KEY, JSON.stringify({ self: 'me', levels: { home: 'ten' } }));
    expect(readCoreSeen('me')).toBeNull();
  });

  it('blocked storage reads as a first look and a write is silently dropped', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readCoreSeen('me')).toBeNull();
    expect(() => { rememberCoreSeen('me', new Map([['home', 1]])); }).not.toThrow();
  });
});

describe('the world drawn at its new size through the step', () => {
  afterEach(() => { resetGrowth(); });
  const node = (coreLevel: number, scale = 1) => ({ id: 'home', coreLevel, radius: worldRadius(coreLevel) * scale });
  const at = T + 1000;

  it('a world nobody is growing is drawn as the map says', () => {
    expect(drawnRadius(node(10), T)).toBe(node(10).radius);
  });

  it('a level learned late (on open) holds the old size until the detonation, then steps up', () => {
    beginGrowth('home', { from: 9, to: 10, at, base: 10 });
    expect(drawnRadius(node(10), at - 1)).toBeCloseTo(worldRadius(9), 9);
    expect(drawnRadius(node(10), at + 3000)).toBeCloseTo(worldRadius(10), 4);
  });

  it('live, the world steps at the queue end even while the map still says the old level', () => {
    beginGrowth('home', { from: 10, to: 11, at, base: 10 });
    expect(drawnRadius(node(10), at - 1)).toBeCloseTo(worldRadius(10), 9);
    const peak = Math.max(...Array.from({ length: 40 }, (_, i) => drawnRadius(node(10), at + i * 25)));
    expect(peak).toBeGreaterThan(worldRadius(11));
    expect(drawnRadius(node(10), at + 3000)).toBeCloseTo(worldRadius(11), 4);
  });

  it('keeps the map\'s own scale (a starter galaxy draws its worlds smaller)', () => {
    beginGrowth('home', { from: 10, to: 11, at, base: 10 });
    expect(drawnRadius(node(10, 0.5), at + 3000)).toBeCloseTo(worldRadius(11) * 0.5, 4);
  });

  it('moves only from its start through the settle, so the field re-draws only then', () => {
    expect(growthMoving(T)).toBe(false);
    beginGrowth('home', { from: 10, to: 11, at, base: 10 });
    expect(growthMoving(at - 500)).toBe(true);
    expect(growthMoving(at + GROW_SETTLE_S * 1000 - 1)).toBe(true);
    expect(growthMoving(at + GROW_SETTLE_S * 1000 + 1)).toBe(false);
  });

  it('hands the world back to the map once it has caught up, or once the map says otherwise', () => {
    const later = at + GROW_SETTLE_S * 1000 + 1;
    beginGrowth('home', { from: 10, to: 11, at, base: 10 });
    pruneGrowth([node(10)], later);
    expect(drawnRadius(node(10), later)).toBeCloseTo(worldRadius(11), 4);
    pruneGrowth([node(11)], later);
    expect(drawnRadius(node(10), later)).toBe(node(10).radius);

    beginGrowth('home', { from: 10, to: 11, at, base: 10 });
    pruneGrowth([node(9)], later);
    expect(drawnRadius(node(9), later)).toBe(node(9).radius);

    beginGrowth('home', { from: 10, to: 11, at, base: 10 });
    pruneGrowth([], later);
    expect(growthMoving(at)).toBe(false);
  });
});

describe('wired into the galaxy', () => {
  it('the galaxy screen hands its worlds\' Core clocks to the map, and the map plays them', () => {
    expect(readFileSync('src/screens/GalaxyView.tsx', 'utf8')).toMatch(/cores=\{cores\}/);
    const canvas = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');
    expect(canvas).toMatch(/<CoreLevelUps nodes=\{nodes\} cores=\{cores\} selfId=\{selfId\} \/>/);
  });

  it('every drawn body of a world reads its drawn size, and the field re-draws while one grows', () => {
    const field = readFileSync('src/galaxy/PlanetField.tsx', 'utf8');
    expect(field.match(/drawnRadius\(node, /g)?.length).toBeGreaterThanOrEqual(2);
    expect(field).toMatch(/growthMoving\(/);
    expect(readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8')).toMatch(/drawnRadius\(node, /);
  });

  it('the Dyson shell about a world grows with it', () => {
    expect(readFileSync('src/galaxy/DysonShells.tsx', 'utf8')).toMatch(/shellRadius\(drawnRadius\(wearer\.planet, /);
  });

  it('a step is remembered when it takes its slot, not when it is queued, and says who you meet only at the peak', () => {
    const levelUps = readFileSync('src/galaxy/CoreLevelUps.tsx', 'utf8');
    const queue = /const queue = useCallback\(([\s\S]*?)\n {2}\}, \[\]\);/.exec(levelUps)?.[1] ?? '';
    expect(queue).not.toMatch(/rememberCoreSeen/);
    expect(levelUps).toMatch(/rebaseStale\(/);
    expect(levelUps).toMatch(/crossesPeak\(/);
    expect(levelUps).toMatch(/word\.peak && [\s\S]{0,260}coreTierUpLine/);
  });

  it('plays only the player\'s own worlds: the clocks come from their own planets', () => {
    expect(readFileSync('src/screens/GalaxyView.tsx', 'utf8')).toMatch(/coreClocks\(worlds\)/);
  });
});
