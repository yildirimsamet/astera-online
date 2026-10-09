import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  BUILDING_IDS,
  HULLS,
  INSTRUMENT_IDS,
  MULTI_WORLD,
  RESEARCH_PROJECT_IDS,
  SATELLITE_IDS,
  prospectorCeiling,
  type ResearchProjectId,
} from '@astera/rules';
import i18n from '../src/i18n/index.js';
import { de } from '../src/i18n/locales/de/index.js';
import { en } from '../src/i18n/locales/en/index.js';
import { es } from '../src/i18n/locales/es/index.js';
import { fr } from '../src/i18n/locales/fr/index.js';
import { ja } from '../src/i18n/locales/ja/index.js';
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
const LOCALES = { en, tr, fr, de, es, ja } as const;
const TRANSLATED_LOCALES = { fr, de, es, ja } as const;

describe('the Command Core explanation respects independent upgrades', () => {
  it.each(Object.entries(LOCALES))('names the Hangar exception in %s', (_, locale) => {
    expect(locale.vocabulary.building.CORE.detail).toContain(locale.vocabulary.building.HANGAR.name);
    expect(locale.planet.roles.coreClear).toContain(locale.vocabulary.building.HANGAR.name);
    expect(locale.directives.coreCeilingDetail).toContain(locale.vocabulary.building.HANGAR.name);
  });

  it('does not claim that Core levels shorten building upgrade timers', () => {
    expect(en.vocabulary.building.CORE.detail).not.toMatch(/shortens building time|no other building/i);
    expect(tr.vocabulary.building.CORE.detail).not.toMatch(/bina sürelerini kısaltır|hiçbir bina/i);
  });

  it('uses current names in the Academy instead of retired aliases', () => {
    for (const locale of Object.values(LOCALES)) {
      expect(locale.academy.steps.foundry).toContain(locale.vocabulary.satellite.FOUNDRY.name);
      expect(locale.academy.steps.veil).toContain(locale.vocabulary.instrument.VEIL.name);
      expect(locale.academy.steps.vault).toContain(locale.vocabulary.building.VAULT.name);
    }
  });
});

describe('risk and defence explanations follow the current rules', () => {
  it.each(Object.entries(LOCALES))('includes every emplacement affected by Doctrine in %s', (_, locale) => {
    for (const id of ['BASTION', 'HARPOON', 'THORN'] as const) {
      expect(locale.research.groundDoctrineDetail).toContain(locale.vocabulary.hull[id].name);
    }
  });

  /* Owner, 2026-10-08: a pirate raid can be called back once, so its launch no longer says it cannot. */
  it('launches a pirate raid without promising it cannot be called back', () => {
    for (const locale of Object.values(LOCALES)) {
      expect(locale.launch.holdPirate_one).not.toMatch(/geri çağrılamaz|no recall|kein Rückruf|aucun rappel|sin recuperación|呼び戻し不可/u);
      expect(locale.launch.holdPirate_other).not.toMatch(/geri çağrılamaz|no recall|kein Rückruf|aucun rappel|sin recuperación|呼び戻し不可/u);
    }
    expect(tr.launch.holdPirate_other).not.toContain('geri dönüşü yok');
  });

  it('does not promise loss-free convoy flights through radiation', () => {
    expect(en.convoy.boundary).toMatch(/radiation/i);
    expect(tr.convoy.boundary).toMatch(/radyasyon/i);
    expect(en.convoy.boundary).not.toMatch(/no losses/i);
    expect(tr.convoy.boundary).not.toMatch(/kayıp vermez/i);
  });
});

describe('the Store protection promise', () => {
  it('states the live ten-percent, eight-hour rule on both decision surfaces', () => {
    for (const locale of [en, tr]) {
      for (const copy of [locale.vocabulary.building.VAULT.role, locale.vocabulary.building.VAULT.detail, locale.planet.roles.vault]) {
        expect(copy).toMatch(/10/);
        expect(copy).toMatch(/8/);
        expect(copy).not.toMatch(/15/);
      }
    }
  });

  it('explains the current same-level producer purchase window', () => {
    expect(en.vocabulary.building.VAULT.detail).toContain('110%');
    expect(tr.vocabulary.building.VAULT.detail).toContain('110');
    for (const locale of [en, tr]) {
      expect(locale.vocabulary.building.VAULT.detail).toMatch(/L→L\+1|3→4/);
    }
  });
});

describe('Vocabulary describes the calibrated catalogue, not its retired stats', () => {
  /** Owner decision, 2026-10-06: a success line counts only fights the wing comes home from. */
  it('requires a surviving ship for success without promising the whole fleet survives', () => {
    expect(en.counter.compareRule).toContain('at least one ship surviving');
    expect(tr.counter.compareRule).toContain('en az bir geminin sağ kalması');
    expect(fr.counter.compareRule).toContain('au moins un vaisseau survivant');
    expect(de.counter.compareRule).toContain('mindestens ein überlebendes Schiff');
    expect(es.counter.compareRule).toContain('al menos una nave superviviente');
    expect(ja.counter.compareRule).toContain('少なくとも1隻が生き残る');
    expect(en.counter.compareRule).not.toMatch(/all ships survive|guaranteed/i);
  });

  it('scopes research speed to the capital Core and distinguishes transport speed', () => {
    expect(en.vocabulary.building.CORE.detail).toMatch(/capital[’']s Core determines research time/);
    expect(tr.vocabulary.building.CORE.detail).toMatch(/Araştırma süresini.*ana gezegendeki Çekirdek/);
    expect(tr.vocabulary.hull.ARGOSY.role).toContain('en düşük nakliyeci hızına');
  });

  /** 2026-10-06: a paced fleet comes home at its own pace; the copy must say so and never "full speed". */
  it('tells every pace picker that the way home keeps the pace', () => {
    const fullSpeed = /full speed|tam hızla|voller Geschwindigkeit|toda velocidad|pleine vitesse|全速力/i;
    const samePace = {
      en: /same speed/i, tr: /aynı hızla/i, de: /gleichen Tempo|derselben Geschwindigkeit/i, es: /misma velocidad/i,
      fr: /même vitesse/i, ja: /同じ速度/u,
    } as const;
    for (const [lng, locale] of Object.entries({ en, tr, de, es, fr, ja })) {
      for (const hint of [locale.launch.paceHint, locale.transfer.paceHint, locale.clanWar.paceHint]) {
        expect(hint, lng).not.toMatch(fullSpeed);
        expect(hint, lng).toMatch(samePace[lng as keyof typeof samePace]);
      }
    }
  });

  /** 2026-10-06: every hold flies 2.5x — the Argosy is the slowest HOLD, no longer the slowest hull. */
  it('never calls the lifted Argosy the slowest hull in the game', () => {
    const slowestHull = /slowest hull|en yavaş gövde|langsamste Rumpf|casco más lento|coque la plus lente|最も遅い船体/i;
    for (const locale of [en, tr, de, es, fr, ja]) {
      expect(locale.vocabulary.hull.ARGOSY.role).not.toMatch(slowestHull);
    }
    const slowest = (['COURIER', 'WAYFARER', 'ATLAS', 'ARGOSY', 'CITADEL'] as const)
      .reduce((a, b) => (HULLS[a].speed <= HULLS[b].speed ? a : b));
    expect(slowest).toBe('CITADEL');
  });

  it('teaches an attack-led Lance profile in both languages', () => {
    for (const id of ['PIKE', 'TALON', 'BALLISTA', 'CATACLYSM', 'NULLIFIER'] as const) {
      expect(HULLS[id].atk, id).toBeGreaterThan(HULLS[id].hp);
      const english = en.vocabulary.hull[id];
      const turkish = tr.vocabulary.hull[id];
      expect(`${english.role} ${english.pitch}`, id).toMatch(/attack exceeds hull strength/i);
      expect(`${turkish.role} ${turkish.pitch}`, id).toMatch(/saldırısı dayanımından yüksek/i);
    }
  });

  it('describes Escorts as same-price, harder-hitting and less durable Fortress alternatives', () => {
    for (const [escort, fortress] of [
      ['WARDEN', 'RAMPART'], ['SENTINEL', 'STRONGHOLD'],
      ['PRAETORIAN', 'LEVIATHAN'], ['PALADIN', 'CITADEL'],
    ] as const) {
      for (const resource of ['alloy', 'crystal', 'deuterium'] as const) {
        expect(HULLS[escort][resource], escort).toBe(HULLS[fortress][resource]);
      }
      expect(HULLS[escort].atk, escort).toBeGreaterThan(HULLS[fortress].atk);
      expect(HULLS[escort].hp, escort).toBeLessThan(HULLS[fortress].hp);
      expect(en.vocabulary.hull[escort].role, escort).toMatch(/more.*attack.*less hull.*same price/i);
      expect(tr.vocabulary.hull[escort].role, escort).toMatch(/aynı bedelde.*daha az dayan/i);
    }
  });

  it('does not imply higher-tier Raiders are faster, or Atlas is the largest hold', () => {
    for (const id of ['VIPER', 'TEMPEST', 'CORSAIR'] as const) {
      expect(HULLS[id].speed, id).toBe(HULLS.DART.speed);
    }
    expect(en.vocabulary.hull.VIPER.detail).toContain('same base speed');
    expect(tr.vocabulary.hull.VIPER.detail).toContain('Temel hızı Ok ile aynıdır');
    expect(HULLS.ARGOSY.cargo).toBeGreaterThan(HULLS.ATLAS.cargo);
    expect(en.vocabulary.hull.ATLAS.role).toContain('tier-three');
    expect(tr.vocabulary.hull.ATLAS.role).toContain('3. kademe');
    expect(en.vocabulary.hull.CORSAIR.pitch).not.toContain('heaviest guns');
    expect(tr.vocabulary.hull.CORSAIR.pitch).not.toContain('en ağır silah');
  });

  it('names the third mining-craft slot and capital-only colony gates', () => {
    expect(prospectorCeiling({})).toBe(2);
    expect(prospectorCeiling({ PROSPECTOR_HOLDS: 3 })).toBe(3);
    expect(en.vocabulary.hull.PROSPECTOR.detail).toContain('Prospector Holds level 3');
    expect(tr.vocabulary.hull.PROSPECTOR.detail).toContain('Kazıcı Ambarları 3. seviye');
    expect(en.research.holdsRole).toContain('third Prospector slot');
    expect(tr.research.holdsRole).toContain('üçüncü Kazıcı yuvasını');
    for (const core of MULTI_WORLD.colonyCoreThresholds) {
      expect(en.vocabulary.building.CORE.detail).toContain(String(core));
      expect(tr.vocabulary.building.CORE.detail).toContain(String(core));
    }
    expect(en.vocabulary.building.CORE.detail).toContain('On the capital, levels');
    expect(tr.vocabulary.building.CORE.detail).toContain('Ana gezegende 9, 13 ve 16');
  });

  it('explains the loaded-return speed relative to outbound speed in every language', () => {
    for (const [locale, wording] of [
      [en, /half its outbound speed/], [tr, /gidiş hızının yarısında/],
      [de, /Hälfte der Hinfluggeschwindigkeit/], [fr, /moitié de la vitesse aller/],
      [es, /mitad de la velocidad de ida/], [ja, /往路の半分の速度/],
    ] as const) {
      expect(locale.vocabulary.hull.PROSPECTOR.detail).toMatch(wording);
      expect(locale.vocabulary.hull.PROSPECTOR.detail).not.toMatch(/1238|1547|619|773/);
    }
  });

  it('includes Argosy everywhere a resource-carrier list is taught', () => {
    for (const [copies, list, name] of [
      [ENGLISH, /Courier.*Wayfarer/, 'Argosy'],
      [TURKISH, /Kurye.*Seyyah/, 'Argosi'],
    ] as const) {
      for (const [path, copy] of copies) {
        if (list.test(copy)) expect(copy, path).toContain(name);
      }
    }
  });
});

const RESEARCH_DETAIL_KEYS = {
  ISOTOPE_SPECTROMETRY: 'isotopeDetail',
  DENSE_FUEL_CELLS: 'denseDetail',
  GRAVITIC_CHARGES: 'graviticDetail',
  DEUTERIUM_SYNTHESIS: 'synthesisDetail',
  YARD_AUTOMATION: 'yardDetail',
  AI_ROBOTS: 'robotsDetail',
  PROSPECTOR_HOLDS: 'holdsDetail',
  CARGO_HOLDS: 'cargoDetail',
  SHIP_POWER: 'powerDetail',
  SHIP_ARMOR: 'armorDetail',
  SHIP_PROPULSION: 'propulsionDetail',
  EMPLACEMENT_DOCTRINE: 'groundDoctrineDetail',
  STARSHIP_ENGINEERING: 'engineeringDetail',
  INTERCEPTION_GRID: 'gridDetail',
  STRATEGIC_STOCKPILE: 'stockpileDetail',
  INDUSTRIAL: 'industrialDetail',
} as const satisfies Record<ResearchProjectId, keyof typeof en.research>;

/**
 * Leaves that are SUPPOSED to read the same in both languages, and why.
 *
 * A proper noun, a punctuation mark, a symbol standing in for a missing figure,
 * or a name the Turkish glossary deliberately keeps. Anything not on this list
 * that matches its English counterpart is an untranslated string.
 */
const IDENTICAL_ON_PURPOSE = new Set([
  // A commander's name, a bullet and the monument's own (translated) name: no words of its own.
  'monument.honoured',
  // The player explicitly names this channel DM in both languages.
  'chat.dm.title',
  // The build-time tag is the formatted duration and nothing else — `duration()`
  // is what speaks Turkish here. Its accessible name, `upgradeRow.takesLabel`, is
  // the sentence, and that one IS translated.
  'upgradeRow.takes',
  // "Lv3" IS A MARK, NOT A WORD. It is two Latin letters and a numeral, and it
  // means the same thing to a Turkish reader as it does to an English one —
  // "Sv3" would be a translation of the abbreviation rather than of the fact, and
  // the fact is the tier. The rank badge on the disc draws the same figure as
  // stars, in no language at all.
  'planet.reach.hullTier',
  // "Hangar" is the Turkish word too (TDK: hangar), not a stand-in.
  'vocabulary.building.HANGAR.name',
  // "Premium" is how a Turkish storefront names its tier, too — the store's badge (2026-09-25).
  'skins.premium',
  'fleetPage.hangar',
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
  'units.rangeJoin',
  // The dash between the two ends of a probe's range. Punctuation.
  'rangeBand.join',
  // A multiplication sign and a placeholder. The verdict beside it — Güçlü, Zayıf,
  // Eşit — is what carries the Turkish, and that one is translated.
  'counter.multiplier',
  // The dot between the two firepower lines and between the notes under them.
  // Punctuation; the lines and notes it separates are translated. D199.
  'counter.lineJoin',
  // "Probe, 2m ago" — the source and the age are both translated where they are
  // made; the comma between them is all this string holds. D199.
  'counter.compareRecord',
  'units.plus',
  'units.minus',
  'units.millions',
  // Nothing but placeholders and separators — no words of their own.
  'planet.queue.segment',
  'notifications.composition',
  'notifications.join',
  // Two server-supplied names separated by punctuation; there is no prose to translate.
  'clanWar.wave',
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
  // "Radar" is the Turkish word for the instrument too (D4's third shelf).
  'intel.shelf.radar',
  'notifications.unlock',
  // Network/provider names, not prose: "USDT · TRC-20", "SOLANA" and "Shopier"
  // are the same proper nouns in every language.
  'community.donate.cryptoTrc20',
  'community.donate.cryptoSolana',
  'community.donate.cardHeading',
  'signals.repeat',
  'pendingStrip.more',
  // Notification title is two already-localised runtime values joined by punctuation.
  'notifications.colonyFault',
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
  // Named cosmetic collections and the internationally used craft acronym.
  'skins.productring-aurora',
  'skins.productring-helios',
  'skins.productprobe-ufo',
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
  // Two clocks and a slash. There is no word in it to translate, and the key
  // exists so a language that writes elapsed-after-total can still reorder it.
  'menu.trackClock',
  // Wiki is the same established product label in both editions.
  'menu.guideLabel',
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

describe('every added language keeps the locale contract', () => {
  it.each(Object.entries(TRANSLATED_LOCALES))('%s has exactly the English leaves', (_, locale) => {
    const tree = flatten(locale);
    expect([...tree.keys()].sort()).toEqual([...ENGLISH.keys()].sort());
  });

  /*
   * Seen in the v2 bell at 350 px: a German signal headed "GALAXY-EREIGNIS" in a
   * tree that says "Galaxie" everywhere else. "Galaxy Focus" is excepted: it names a
   * control and is written that way in every language until the clan pages move (F6).
   */
  it('names the galaxy in German, not in English', () => {
    const english = [...flatten(de)]
      .filter(([, text]) => /\bGalaxy\b(?! Focus)/.test(text))
      .map(([key, text]) => `${key}: ${text}`);
    expect(english).toEqual([]);
  });

  /*
   * The View sheet's count line is one string per count, each carrying its own
   * separator. Seen at 350 px in German: "134 Welten· 1 Pirat" — two of them had
   * lost the space before the dot, in German and Spanish.
   */
  /*
    Seen on the v2 launch sheet in German: "40 Startseite" (a homepage) for the ships at
    home, and a one-way flight headed "Einbahnstraße" (a one-way street).
  */
  it('says "at home" and "arrival" in German, not a homepage and a street', () => {
    expect(de.launch.atHome).not.toMatch(/Startseite/);
    expect(de.launch.arrive).not.toMatch(/Einbahnstra/);
  });

  /* The same slip in Spanish, seen at 350 on the v2 launch rows: "40 inicio" (a start page). */
  it('says "at home" in Spanish, not a start page', () => {
    expect(es.launch.atHome).not.toMatch(/inicio/);
    expect(es.launch.atHome).toMatch(/en casa/);
  });

  it('opens every appended galaxy count with its own spaced separator', () => {
    const appended = ['fleetAway_one', 'fleetAway_other', 'rocks_one', 'rocks_other', 'pirates_one', 'pirates_other', 'wrecks_one', 'wrecks_other'];
    const glued = Object.entries(LOCALES).flatMap(([language, locale]) => {
      const tree = flatten(locale);
      return appended
        .map((key) => `galaxy.${key}`)
        .filter((key) => !tree.get(key)?.startsWith(' · '))
        .map((key) => `${language}.${key}`);
    });
    expect(glued).toEqual([]);
  });

  it('has no blank strings in any locale', () => {
    const blank = Object.entries(LOCALES).flatMap(([language, locale]) =>
      [...flatten(locale)]
        .filter(([, text]) => text.trim().length === 0)
        .map(([key]) => `${language}.${key}`),
    );
    expect(blank).toEqual([]);
  });

  it('keeps placeholders, markup slots, and plural pairs in every locale', () => {
    const broken: string[] = [];
    for (const [language, locale] of Object.entries(TRANSLATED_LOCALES)) {
      const tree = flatten(locale);
      for (const [key, english] of ENGLISH) {
        const translated = tree.get(key);
        if (!translated) {
          broken.push(`${language}.${key}:missing`);
          continue;
        }
        const missingPlaceholders = [...placeholders(english)].filter(
          (name) => !placeholders(translated).has(name) && name !== 'count',
        );
        const inventedPlaceholders = [...placeholders(translated)].filter(
          (name) => !placeholders(english).has(name),
        );
        if (missingPlaceholders.length > 0 || inventedPlaceholders.length > 0) {
          broken.push(`${language}.${key}:placeholder`);
        }
        if ([...tags(english)].sort().join() !== [...tags(translated)].sort().join()) {
          broken.push(`${language}.${key}:tag`);
        }
      }
      for (const key of tree.keys()) {
        if (key.endsWith('_one') && !tree.has(`${key.slice(0, -4)}_other`)) {
          broken.push(`${language}.${key}:plural`);
        }
        if (key.endsWith('_other') && !tree.has(`${key.slice(0, -6)}_one`)) {
          broken.push(`${language}.${key}:plural`);
        }
      }
    }
    expect(broken).toEqual([]);
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

  it('has a substantial, unique explanation for every research project', () => {
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
    expect(en.research.engineeringDetail).toMatch(/Level 1.*Tier 3.*Level 2.*Tier 4/i);
    expect(tr.research.engineeringDetail).toMatch(/1\. seviye.*3\. kademe.*2\. seviye.*4\. kademe/i);

    // Live Yard orders use hullWorkMinutes for both ships and ground defences.
    expect(en.research.yardDetail).toContain('including Prospectors and ground defences');
    expect(tr.research.yardDetail).toContain('Kazıcılar ve yer savunmaları dahil');

    // And the robots are its opposite number: the surface, never the yard. D198.
    expect(en.research.robotsDetail).toContain('Ships and ground defences use the Yard and are unaffected');
    expect(tr.research.robotsDetail).toContain('Gemiler ve yer savunmaları Tersaneyi kullanır; etkilenmezler');

    // Strategic stock is capped independently on every world, and both capacities
    // name their real figures (owner, 2026-10-01): 1 → 2 weapons, 2 → 4 charges.
    expect(en.research.stockpileDetail).toContain('each planet');
    expect(tr.research.stockpileDetail).toContain('her gezegene ayrı');
    expect(en.research.stockpileRole).toMatch(/1 to 2/);
    expect(tr.research.stockpileRole).toMatch(/1’den 2’ye/);
    expect(en.research.gridRole).toMatch(/2(?: charges)? to 4/);
    expect(tr.research.gridRole).toMatch(/2’den 4’e/);
    // The Grid no longer "grants access": the first two charges need no research.
    expect(en.research.gridDetail).not.toMatch(/grants access/i);
    expect(tr.research.gridDetail).not.toMatch(/erişim verir/i);

    // Build duration comes from the rule, never from a translated literal.
    expect(en.planet.deathStar.buildTime).toContain('{{duration}}');
    expect(tr.planet.deathStar.buildTime).toContain('{{duration}}');

    // What a hit does, where the weapon is built and where it is fired. D179 retired
    // fleet destruction and capture; the colony loyalty cost is the owner's 2026-10-01 rule.
    for (const copy of [en.planet.deathStar.dangerHint, en.focus.planet.strikeConfirm.keeps]) {
      expect(copy).not.toMatch(/destroys every fleet|capture/i);
      expect(copy).toMatch(/1 hour|one hour/);
      expect(copy).toMatch(/{{loss}} loyalty/);
      expect(copy).toMatch(/neutral/i);
    }
    for (const copy of [tr.planet.deathStar.dangerHint, tr.focus.planet.strikeConfirm.keeps]) {
      expect(copy).not.toMatch(/tüm filoyu|ele geçir/i);
      expect(copy).toContain('1 saat');
      expect(copy).toMatch(/{{loss}} sadakat/);
      expect(copy).toMatch(/tarafsız/i);
    }
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

  it.each([
    ['fr-FR', 'fr'],
    ['de-DE', 'de'],
    ['es-ES', 'es'],
    ['ja-JP', 'ja'],
  ] as const)('takes %s when the browser asks for it', (tag, language) => {
    expect(detectLanguage(nav(tag))).toBe(language);
  });

  /**
   * A browser that lists several languages has said something useful about the
   * second and third entries. Reading only `navigator.language` threw that away
   * and dropped a `de, en` device onto the fallback rather than onto English.
   */
  it('reads past the first entry rather than giving up on it', () => {
    expect(detectLanguage(nav('ko-KR', 'de-DE', 'en-US'))).toBe('de');
  });

  it('falls back to Turkish for a language this build does not have', () => {
    expect(detectLanguage(nav('ko-KR', 'zh-CN'))).toBe(FALLBACK_LANGUAGE);
    expect(FALLBACK_LANGUAGE).toBe('tr');
  });

  it('does not mistake an unknown tag for the fallback', () => {
    expect(matchLanguage('ko-KR')).toBeNull();
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

  it('localises every intergalactic convoy refusal in both languages', async () => {
    const refusals = [
      ['CONVOY_ALREADY_RAIDED', 'already struck', 'zaten saldırdı'],
      ['CONVOY_FLEET_ALREADY_AWAY', 'fleet committed', 'zaten yolda'],
      ['CONVOY_NEEDS_COMBAT_FLEET', 'fleet with firepower', 'ateş gücü'],
      ['CONVOY_OUT_OF_REACH', 'gone before', 'ayrılacak'],
      ['CONVOY_QUOTE_CHANGED', 'moved beyond', 'ilerledi'],
      ['CONVOY_WINDOW_CLOSED', 'no intergalactic convoy', 'konvoy yok'],
    ] as const;

    for (const [code, , turkish] of refusals) {
      const err = new ApiError(code, `server fallback: ${code}`, 409);
      await i18n.changeLanguage('tr');
      expect(describeError(err).toLocaleLowerCase('tr')).toContain(turkish);
    }
    await i18n.changeLanguage('en');
    for (const [code, english] of refusals) {
      const err = new ApiError(code, `server fallback: ${code}`, 409);
      expect(describeError(err).toLowerCase()).toContain(english);
    }
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

  /** Unknown diagnostics cannot establish a player-facing reason or outcome. */
  it('uses a localised explanation for an unknown code', () => {
    const err = new ApiError('SOMETHING_NEW', 'A rule you have not met yet', 400);
    expect(describeError(err)).toBe(i18n.t('errors.unknown'));
  });

  it('never leaks a non-Error', () => {
    expect(describeError('boom')).toBe(i18n.t('errors.unknown'));
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

    // The mocks' "1 sa 26 dk": "1s 04d" read as English seconds and days.
    await i18n.changeLanguage('tr');
    expect(countdown(3_840_000)).toBe('1 sa 04 dk');
    expect(countdown(18_000)).toBe('18 sn');
    expect(countdown(0)).toBe('şimdi');
    expect(duration(45)).toBe('45 dk');
    expect(duration(25 * 60)).toBe('1 g 1 sa');
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
    expect(duration(0.49)).toBe('29 sn');
    expect(duration(1)).toBe('1 dk');
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
