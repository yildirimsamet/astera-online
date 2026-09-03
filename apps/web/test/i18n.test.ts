import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  BUILDING_IDS,
  INSTRUMENT_IDS,
  RESEARCH_PROJECT_IDS,
  SATELLITE_IDS,
  type ResearchProjectId,
} from '@astera/rules';
import i18n from '../src/i18n/index.js';
import { en } from '../src/i18n/locales/en/index.js';
import { tr } from '../src/i18n/locales/tr/index.js';
import {
  FALLBACK_LANGUAGE,
  LANGUAGES,
  LANGUAGE_LABEL,
  detectLanguage,
  matchLanguage,
} from '../src/i18n/languages.js';
import { describeError } from '../src/i18n/errors.js';
import { ApiError } from '../src/api/client.js';
import { compact, full, percent } from '../src/lib/format.js';
import { countdown, duration, staleness } from '../src/lib/time.js';

/**
 * "EKSİK HİÇ BİR YER KALMAMALI", MADE MECHANICAL.
 *
 * The type system already refuses a key that does not exist in English — `t()` is
 * bound to that tree — and refuses a Turkish tree whose SHAPE differs. What it
 * cannot see is the thing that actually goes wrong in a translation pass: a key
 * that exists and is empty, a key that was copied across without being
 * translated, and a sentence whose `{{placeholders}}` were dropped or renamed on
 * the way. All three render something wrong on a phone and nothing at all in
 * `tsc`.
 *
 * So this walks both trees leaf by leaf. Every failure names the exact path.
 */

type Tree = Record<string, unknown>;

/** Every leaf, as `a.b.c` → the string at it. */
function flatten(node: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof node === 'string') {
    out.set(prefix, node);
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Tree)) {
      for (const [path, leaf] of flatten(value, prefix ? `${prefix}.${key}` : key)) {
        out.set(path, leaf);
      }
    }
  }
  return out;
}

/** `{{name}}` and `{{count}}` — what a sentence promises its caller it will use. */
const placeholders = (text: string): Set<string> =>
  new Set([...text.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)].map((m) => m[1] ?? ''));

/** `<0>` and `<1>` — the spans `<Trans>` fills with markup. */
const tags = (text: string): Set<string> =>
  new Set([...text.matchAll(/<(\d+)>/g)].map((m) => m[1] ?? ''));

const ENGLISH = flatten(en);
const TURKISH = flatten(tr);

const RESEARCH_DETAIL_KEYS = {
  ISOTOPE_SPECTROMETRY: 'isotopeDetail',
  DENSE_FUEL_CELLS: 'denseDetail',
  GRAVITIC_CHARGES: 'graviticDetail',
  DEATH_STAR_PROTOCOL: 'deathStarDetail',
  DEUTERIUM_SYNTHESIS: 'synthesisDetail',
  YARD_AUTOMATION: 'yardDetail',
  PROSPECTOR_HOLDS: 'holdsDetail',
  CARGO_HOLDS: 'cargoDetail',
  SHIP_POWER: 'powerDetail',
  SHIP_ARMOR: 'armorDetail',
  SHIP_PROPULSION: 'propulsionDetail',
  EMPLACEMENT_DOCTRINE: 'groundDoctrineDetail',
  STARSHIP_ENGINEERING: 'engineeringDetail',
  INTERCEPTION_GRID: 'gridDetail',
  STRATEGIC_STOCKPILE: 'stockpileDetail',
} as const satisfies Record<ResearchProjectId, keyof typeof en.research>;

/**
 * Leaves that are SUPPOSED to read the same in both languages, and why.
 *
 * A proper noun, a punctuation mark, a symbol standing in for a missing figure,
 * or a name the Turkish glossary deliberately keeps. Anything not on this list
 * that matches its English counterpart is an untranslated string.
 */
const IDENTICAL_ON_PURPOSE = new Set([
  // "Hangar" is the established Turkish aviation term as well as the English
  // one; replacing it only to make the strings differ would make the translation
  // less natural.
  'vocabulary.building.HANGAR.name',
  // Same word, same reason, on the launch sheet's room bar.
  'launch.hangarLabel',
  // And on the craft sheet's room figure, which names the same building.
  'action.statRoom',
  // A bare numeric placeholder has no language to translate. The label beside it
  // carries the Turkish wording.
  'gains.hangar.value',
  // Punctuation and stand-ins for a missing figure. Not words.
  'statusBar.works.idle',
  'galaxy.commander.galaxyUnknown',
  'galaxy.commander.endsUnknown',
  'focus.planet.reachUnknown',
  'focus.thread.craftUnknown',
  'focus.contact.craftUnknown',
  'launch.oneWayUnknown',
  'action.statCargoNone',
  'action.statFuelNone',
  'planetHero.shieldValue',
  'servers.joining',
  'units.rangeJoin',
  // The dash between the two ends of a probe's range. Punctuation.
  'rangeBand.join',
  'units.plus',
  'units.minus',
  'units.millions',
  // Nothing but placeholders and separators — no words of their own.
  'planet.queue.segment',
  'notifications.composition',
  'notifications.join',
  // The away-fleet note's list: "83 Dart · 2 Courier". The sentence around it is
  // translated (`launch.away`); the pair and the separator carry no words. Its
  // own keys rather than the notification pair above, because no surface shares
  // a string with another surface (D55).
  'launch.awayHull',
  'launch.awaySeparator',
  // " · {{planet}}" — a separator and a name the server supplies.
  'intel.radar.origin',
  // The same shape, naming which of the caller's own worlds was scanned.
  'intel.radar.onWorld',
  'notifications.unlock',
  'signals.repeat',
  'pendingStrip.more',
  'planet.orbit.slotsUsed',
  'gains.derrick.now',
  'gains.derrick.next',
  // Proper nouns and marks the Turkish glossary keeps.
  'onboarding.beats.wide.title',
  'landing.form.namePlaceholder',
  'vocabulary.instrument.RADAR.name',
  'vocabulary.instrument.AEGIS.name',
  // Fleet V2 keeps these mythological proper names unchanged in Turkish.
  'vocabulary.hull.LEVIATHAN.name',
  'vocabulary.hull.ATLAS.name',
  // The reward panel. A multiplier and a fraction are notation, not language —
  // "×3" and "3 / 5" are read the same in both. The LEVEL forms beside them are
  // not on this list, because `L5` is `S5` in Turkish (seviye) and a translated
  // pair is exactly what that difference should look like.
  'rewards.goalCount',
  'rewards.progressCount',
  // The instrument's own name, kept by the Turkish glossary — the same decision
  // `vocabulary.instrument.AEGIS.name` above records.
  'rewards.chains.AEGIS.name',
  // A handle and the address it points at. Translating either would send the
  // player somewhere that does not exist.
  'rewards.social.handle',
  'rewards.social.url',
  // YouTube is the embedded-video provider's proper name in both languages.
  'community.admin.tools.video',
]);

describe('the two languages hold the same keys', () => {
  it('has a Turkish leaf for every English one', () => {
    const missing = [...ENGLISH.keys()].filter((key) => !TURKISH.has(key));
    expect(missing).toEqual([]);
  });

  it('has no Turkish leaf English does not have', () => {
    const extra = [...TURKISH.keys()].filter((key) => !ENGLISH.has(key));
    expect(extra).toEqual([]);
  });

  it('has no empty string anywhere', () => {
    const blank = [...ENGLISH, ...TURKISH]
      .filter(([, text]) => text.trim().length === 0)
      .map(([key]) => key);
    expect(blank).toEqual([]);
  });

  /**
   * The one failure a shape check cannot see: a key copied across untranslated.
   * Every genuine exception is listed above with a reason, so a new match here is
   * always either a missed translation or a decision that needs writing down.
   */
  it('has no English left in the Turkish tree', () => {
    const untranslated = [...ENGLISH]
      .filter(([key, text]) => !IDENTICAL_ON_PURPOSE.has(key) && TURKISH.get(key) === text)
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });

  /**
   * The exception list has to stay honest, or it stops meaning anything.
   *
   * An allowance for a key that no longer matches is dead weight — and worse, it
   * is a standing permission to leave that key untranslated the next time
   * somebody edits it. The list may only name leaves that genuinely read the same
   * in both languages right now.
   */
  it('carries no stale exception', () => {
    const stale = [...IDENTICAL_ON_PURPOSE].filter(
      (key) => !ENGLISH.has(key) || ENGLISH.get(key) !== TURKISH.get(key),
    );
    expect(stale).toEqual([]);
  });
});

describe('queue refusals name the player’s next move', () => {
  it('explains that the 3 waiting orders must finish or be cancelled', () => {
    expect(en.planet.blocked.queueFull).toMatch(/3 orders.*finish or cancel/i);
    expect(tr.planet.blocked.queueFull).toMatch(/3 sipariş.*bitsin veya.*iptal/i);
    expect(tr.planet.blocked.queueFull).not.toMatch(/^o üretim sırası dolu$/i);
  });

  it('tells a full irreversible Research queue to wait, never to cancel', () => {
    expect(en.research.queueFull).toMatch(/3 research.*wait.*finish/i);
    expect(tr.research.queueFull).toMatch(/3 araştırma.*bitmesini bekle/i);
    expect(`${en.research.queueFull} ${tr.research.queueFull}`).not.toMatch(/cancel|iptal/i);
  });
});

describe('decision sheets explain every item', () => {
  it('has a substantial, item-specific explanation for every buildable in both languages', () => {
    const expected = {
      building: BUILDING_IDS,
      instrument: INSTRUMENT_IDS,
      satellite: SATELLITE_IDS,
      hull: ALL_HULLS,
    } as const;

    for (const locale of [en, tr]) {
      for (const [group, ids] of Object.entries(expected)) {
        const entries = locale.vocabulary[group as keyof typeof expected] as Record<
          string,
          { detail: string; role: string }
        >;
        expect(Object.keys(entries).sort(), group).toEqual([...ids].sort());
        for (const id of ids) {
          expect(entries[id]?.detail.trim().length, `${group}.${id}.detail`).toBeGreaterThan(60);
          expect(entries[id]?.detail, `${group}.${id} repeats its summary`)
            .not.toBe(entries[id]?.role);
        }
      }
    }
  });

  it('has a substantial, unique explanation for all fifteen research projects', () => {
    expect(Object.keys(RESEARCH_DETAIL_KEYS).sort()).toEqual([...RESEARCH_PROJECT_IDS].sort());
    for (const locale of [en, tr]) {
      const seen = new Set<string>();
      for (const id of RESEARCH_PROJECT_IDS) {
        const detail = locale.research[RESEARCH_DETAIL_KEYS[id]];
        expect(detail.trim().length, id).toBeGreaterThan(60);
        seen.add(detail);
      }
      expect(seen.size).toBe(RESEARCH_PROJECT_IDS.length);
    }
  });

  it('keeps the rule-sensitive explanations aligned with the mechanics', () => {
    // Power owns Nullifier's ordinary attack; its shield-only specialization stays separate.
    expect(en.research.powerDetail).toContain('Nullifier');
    expect(tr.research.powerDetail).toContain('Söndürücü');

    // Engineering is permission only, with one useful rung for each advanced tier.
    expect(en.research.engineeringDetail).toMatch(/first rung opens Tier 3.*second opens Tier 4/i);
    expect(tr.research.engineeringDetail).toMatch(/İlk kademe üçüncü seviye.*ikinci kademe dördüncü seviye/i);

    // Automation applies to mobile craft, not the separate ground-defence curve.
    expect(en.research.yardDetail).toContain('does not speed up ground defences');
    expect(tr.research.yardDetail).toContain('Yer savunmalarını hızlandırmaz');

    // Strategic stock is capped independently on every world.
    expect(en.research.stockpileDetail).toContain('on each world');
    expect(tr.research.stockpileDetail).toContain('her dünya için');

    // The weapon itself is consumed; there is no separately built charge.
    expect(en.research.deathStarDetail).not.toContain('separate charge');
    expect(tr.research.deathStarDetail).not.toContain('ayrı hazırlanan');
    expect(en.research.deathStarDetail).toContain('two hours');
    expect(tr.research.deathStarDetail).toContain('iki saat');
  });
});

describe('a translated sentence keeps the parts its caller passes it', () => {
  it('uses the same {{placeholders}} in both languages', () => {
    const broken: string[] = [];
    for (const [key, english] of ENGLISH) {
      const turkish = TURKISH.get(key);
      if (turkish === undefined) continue;
      const from = placeholders(english);
      const to = placeholders(turkish);
      // A plural variant may legitimately drop `{{count}}` from one form — but
      // never a name or a figure the caller computed.
      const lost = [...from].filter((name) => !to.has(name) && name !== 'count');
      const invented = [...to].filter((name) => !from.has(name));
      if (lost.length > 0 || invented.length > 0) broken.push(key);
    }
    expect(broken).toEqual([]);
  });

  it('uses the same <0> markup slots in both languages', () => {
    const broken: string[] = [];
    for (const [key, english] of ENGLISH) {
      const turkish = TURKISH.get(key);
      if (turkish === undefined) continue;
      if ([...tags(english)].sort().join() !== [...tags(turkish)].sort().join()) broken.push(key);
    }
    expect(broken).toEqual([]);
  });

  /**
   * i18next needs BOTH plural forms present for Turkish.
   *
   * Turkish takes no plural suffix after a numeral — "2 yuva", not "2 yuvalar" —
   * so the two forms are usually the same sentence, and the temptation is to
   * write only `_other`. i18next resolves `key_one` for count === 1 and falls
   * back to the bare key, NOT to `_other`, so a missing `_one` prints the key
   * path on screen for exactly the count a player sees most often.
   */
  it('gives every plural key both forms in both languages', () => {
    const incomplete: string[] = [];
    for (const tree of [ENGLISH, TURKISH]) {
      for (const key of tree.keys()) {
        if (key.endsWith('_one') && !tree.has(`${key.slice(0, -4)}_other`)) incomplete.push(key);
        if (key.endsWith('_other') && !tree.has(`${key.slice(0, -6)}_one`)) incomplete.push(key);
      }
    }
    expect(incomplete).toEqual([]);
  });
});

/**
 * A CAPABILITY THAT IS GATED MUST NAME ITS GATE — IN EVERY LANGUAGE.
 *
 * The unlock cascade fires at the moment the player feels a system's absence,
 * which for the Telescope is their first battle. It knows nothing about the
 * Uplink, and it should not: the moment is right. But `build.ts` refuses a
 * Telescope or a Radar without one, so a line reading "You may watch one planet.
 * Choose one." invited the player to do something the server would answer with
 * NEEDS_UPLINK.
 *
 * It was not hypothetical and it was not rare. On the live shard, 25 of 26
 * commanders had been told the Telescope was theirs; NONE of them owned an
 * Uplink, because nobody in the galaxy did.
 *
 * The Uplink is matched AS WRITTEN, never case-folded. `'İ'.toLowerCase()` is `i`
 * plus a combining dot in JavaScript, so folding a Turkish label to compare it is
 * a bug generator; the name is read out of the same locale tree the sentence
 * comes from, so renaming the satellite moves this test with it.
 */
describe('an unlock never promises what a gate refuses', () => {
  const GATED = ['TELESCOPE', 'RADAR'] as const;

  it('names the Uplink in the English body of every gated unlock', () => {
    for (const id of GATED) {
      expect(en.vocabulary.unlock[id].body).toContain(en.vocabulary.satellite.UPLINK.name);
    }
  });

  it('names the Uplink in the Turkish body of every gated unlock', () => {
    for (const id of GATED) {
      expect(tr.vocabulary.unlock[id].body).toContain(tr.vocabulary.satellite.UPLINK.name);
    }
  });

  /**
   * The ungated ones must NOT, or the sentence invents a prerequisite that does
   * not exist — the opposite failure, and just as misleading.
   */
  it('leaves the ungated unlocks free of it', () => {
    for (const id of ['EXPLORER', 'VEIL'] as const) {
      expect(en.vocabulary.unlock[id].body).not.toContain(en.vocabulary.satellite.UPLINK.name);
      expect(tr.vocabulary.unlock[id].body).not.toContain(tr.vocabulary.satellite.UPLINK.name);
    }
  });
});

describe('Telescope copy explains the asteroid discovery rule', () => {
  it('names asteroid discovery on both the upgrade card and the missing-instrument hint', () => {
    expect(en.vocabulary.instrument.TELESCOPE.detail).toMatch(/asteroid/i);
    expect(en.directives.noTelescopeDetail).toMatch(/asteroid/i);
    expect(tr.vocabulary.instrument.TELESCOPE.detail).toMatch(/asteroi[td]/i);
    expect(tr.directives.noTelescopeDetail).toMatch(/asteroi[td]/i);
  });
});

describe('which language a device lands in', () => {
  const nav = (...tags: string[]) => ({ language: tags[0] ?? '', languages: tags });

  it('takes English when the browser asks for it', () => {
    expect(detectLanguage(nav('en-GB', 'en'))).toBe('en');
  });

  it('takes Turkish when the browser asks for it', () => {
    expect(detectLanguage(nav('tr-TR'))).toBe('tr');
  });

  /**
   * A browser that lists several languages has said something useful about the
   * second and third entries. Reading only `navigator.language` threw that away
   * and dropped a `de, en` device onto the fallback rather than onto English.
   */
  it('reads past the first entry rather than giving up on it', () => {
    expect(detectLanguage(nav('de-DE', 'fr-FR', 'en-US'))).toBe('en');
  });

  it('falls back to Turkish for a language this build does not have', () => {
    expect(detectLanguage(nav('ja-JP', 'ko-KR'))).toBe(FALLBACK_LANGUAGE);
    expect(FALLBACK_LANGUAGE).toBe('tr');
  });

  it('does not mistake an unknown tag for the fallback', () => {
    expect(matchLanguage('de-DE')).toBeNull();
    expect(matchLanguage(undefined)).toBeNull();
    expect(matchLanguage('TR')).toBe('tr');
  });

  it('names every language in its own language', () => {
    for (const language of LANGUAGES) expect(LANGUAGE_LABEL[language].length).toBeGreaterThan(0);
    expect(LANGUAGE_LABEL.tr).toBe('Türkçe');
    expect(LANGUAGE_LABEL.en).toBe('English');
  });
});

describe('a refusal arrives in the language that is up', () => {
  const bay = () =>
    new ApiError('NO_FREE_BAY', 'All 4 flight bays are in use. Something has to land first.', 409, {
      total: 4,
    });

  it('keeps the figures the server sent', () => {
    expect(describeError(bay())).toContain('4');
  });

  it('says it in Turkish once Turkish is up', async () => {
    await i18n.changeLanguage('tr');
    const line = describeError(bay());
    expect(line).toContain('4');
    expect(line).toContain('rampa');
    await i18n.changeLanguage('en');
  });

  it('localises the fog-safe asteroid refusal instead of leaking the server fallback', async () => {
    const err = new ApiError(
      'ASTEROID_UNAVAILABLE',
      'That asteroid is not available to your sensors',
      404,
    );
    await i18n.changeLanguage('tr');
    expect(describeError(err)).toBe('Bu asteroit sensörlerinin erişiminde değil');
    await i18n.changeLanguage('en');
  });

  /** A hull arrives as an ID so the client can name it in either language. */
  it('names a hull rather than printing its id', async () => {
    const err = new ApiError('NOT_ENOUGH_SHIPS', 'Not enough DART at home', 400, { hull: 'DART' });
    expect(describeError(err)).toContain('Dart');
    await i18n.changeLanguage('tr');
    expect(describeError(err)).toContain('Ok');
    await i18n.changeLanguage('en');
  });

  /**
   * `context` rides in with the params, so one code with two wordings resolves
   * without a branch in `describeError`.
   */
  it('picks the variant the server asked for', () => {
    const plain = new ApiError('SERVER_LOCKED', 'Vantage is not open yet', 409, {
      shard: 'Vantage',
    });
    const pointed = new ApiError('SERVER_LOCKED', 'x', 409, {
      shard: 'Vantage',
      frontier: 'Kestrel',
      context: 'frontier',
    });
    expect(describeError(plain)).not.toContain('Kestrel');
    expect(describeError(pointed)).toContain('Kestrel');
  });

  /**
   * A server one deploy ahead sends a code this build has never heard of. The
   * English sentence is worse than a translation and enormously better than the
   * literal string `errors.SOMETHING_NEW`.
   */
  it('falls back to the server sentence for an unknown code', () => {
    const err = new ApiError('SOMETHING_NEW', 'A rule you have not met yet', 400);
    expect(describeError(err)).toBe('A rule you have not met yet');
  });

  it('never leaks a non-Error', () => {
    expect(describeError('boom')).toBe('Something went wrong');
  });
});

describe('numbers and clocks follow the language', () => {
  it('groups thousands the way the language does', async () => {
    expect(full(1234567)).toBe('1,234,567');
    await i18n.changeLanguage('tr');
    expect(full(1234567)).toBe('1.234.567');
    await i18n.changeLanguage('en');
  });

  /**
   * `toFixed` is hard-wired to a full stop, which put `12.4b` on a Turkish
   * screen — an English number wearing a Turkish suffix.
   */
  it("uses the language's decimal mark in the compact form", async () => {
    // Under ten thousand keeps one decimal; above it, none. Both forms have to
    // survive the language change — the suffix as well as the separator.
    expect(compact(1240)).toBe('1.2k');
    expect(compact(12400)).toBe('12k');
    await i18n.changeLanguage('tr');
    expect(compact(1240)).toBe('1,2b');
    expect(compact(12400)).toBe('12b');
    await i18n.changeLanguage('en');
  });

  it('puts the percent sign on the side the language puts it', async () => {
    expect(percent(0.4)).toBe('40%');
    await i18n.changeLanguage('tr');
    expect(percent(0.4)).toBe('%40');
    await i18n.changeLanguage('en');
  });

  it("counts down in the language's own units", async () => {
    expect(countdown(3_840_000)).toBe('1h 04m');
    expect(countdown(18_000)).toBe('18s');
    expect(countdown(0)).toBe('now');
    expect(duration(45)).toBe('45m');
    expect(staleness(0.5)).toBe('live');

    await i18n.changeLanguage('tr');
    expect(countdown(3_840_000)).toBe('1s 04d');
    expect(countdown(18_000)).toBe('18sn');
    expect(countdown(0)).toBe('şimdi');
    expect(duration(45)).toBe('45d');
    expect(staleness(0.5)).toBe('canlı');
    await i18n.changeLanguage('en');
  });

  /**
   * A SPAN SHORTER THAN A MINUTE HAS TO SAY SO. D121.
   *
   * `duration` rounded to whole minutes and every span in the game was longer
   * than one, so the case never came up. A probe that pays no launch overhead
   * crosses to a neighbour in 29 seconds, and the sentence a player reads at the
   * moment they commit to it said "reports back in 0m" — the interface telling
   * somebody their craft takes no time to fly.
   */
  it('says the seconds when a span is shorter than a minute', async () => {
    expect(duration(0.49)).toBe('29s');
    expect(duration(0.087)).toBe('5s');
    // A minute and over is untouched, so no other surface in the game moves.
    expect(duration(1)).toBe('1m');
    expect(duration(1.49)).toBe('1m');
    // Zero is still nothing rather than "0s": a span of no length is not a wait.
    expect(duration(0)).toBe('0m');
    // And a span too short to name is one second, never zero of them.
    expect(duration(0.004)).toBe('1s');

    await i18n.changeLanguage('tr');
    expect(duration(0.49)).toBe('29sn');
    expect(duration(1)).toBe('1d');
    await i18n.changeLanguage('en');
  });
});

describe('every key the tree holds actually resolves', () => {
  /**
   * The belt to the type system's braces.
   *
   * `t()` returning the key path is what a missing resource looks like on screen,
   * and it is silent. `exists` asks the real instance the same question the
   * renderer will ask it, with the fallback turned OFF — otherwise every English
   * lookup would pass by falling through to Turkish, which is precisely the hole
   * this is here to close.
   */
  it.each(LANGUAGES)('registers every leaf in %s', (language) => {
    const unresolved = [...ENGLISH.keys()].filter(
      (key) => !i18n.exists(key, { lng: language, fallbackLng: false }),
    );
    expect(unresolved).toEqual([]);
  });
});
