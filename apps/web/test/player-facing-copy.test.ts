import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import i18n from '../src/i18n/index.js';
import { duration, untilReady } from '../src/lib/time.js';

/**
 * WHAT THE GAME IS ALLOWED TO CALL THINGS. Owner report.
 *
 * *"Bazı açıklamalarda örn gemi zırhı araştırmasında Fleet V2 gibi terimler var.
 * Bunlar kullanıcıyı ilgilendirmiyor. Filo, gemi falan demeliyiz."*
 *
 * "Fleet V2" is the name of a DECISION — D148, the catalogue rewrite — and it
 * belongs in `docs/` and in code docblocks where the next agent needs it. To a
 * commander it names nothing: there is no Fleet V1 in the game, no version number
 * anywhere else on any screen, and no way to find out what it means from inside
 * the fiction. It had reached fifteen strings across both trees, including the
 * label directly above the number a player is buying.
 *
 * The guard is on the LOCALE FILES rather than on a render, because that is where
 * the leak happens and because a new string cannot be written into either tree
 * without this failing.
 */
const LOCALES = join(process.cwd(), 'src/i18n/locales');

/** Every engineering word that means nothing to somebody playing the game. */
const INTERNAL = [
  /Fleet\s*V2/i,
  /\bD1[0-9]{2}\b/,
  /\bruleset\b/i,
];

describe('the locale trees speak the game, not the codebase', () => {
  for (const language of readdirSync(LOCALES)) {
    for (const file of readdirSync(join(LOCALES, language))) {
      it(`${language}/${file} names no internal term`, () => {
        /*
          COMMENTS COME OUT FIRST, and that is the whole subtlety of this guard. A
          docblock in a locale file may say "Fleet V2" — the next agent editing
          this copy is exactly the audience that needs the decision's name, and
          `research.ts`'s own header explains the rename with it. What may not say
          it is a string, because a string is the game speaking.
        */
        const source = readFileSync(join(LOCALES, language, file), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/^\s*\/\/.*$/gm, ' ');
        const strings = [...source.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)]
          .map((match) => match[2] ?? '');
        for (const term of INTERNAL) {
          const leak = strings.find((text) => term.test(text));
          expect(leak, `${String(term)} in ${language}/${file}`).toBeUndefined();
        }
      });
    }
  }
});

/**
 * A COUNTDOWN NEVER READS ZERO. Owner report:
 *
 *   *"Araştırmalarda ve bazı butonların üstünde '0d sonra araştırılabilir', '0d
 *   sonra açılır' gibi kötü UX writingler var. 0D diye bir şey olamaz."*
 *
 * Turkish abbreviates minutes as `d` (dakika), so a zero-minute countdown rendered
 * as "0d" — which reads as zero DAYS, and is a nonsense sentence either way: a
 * thing that opens in no time at all is a thing that is open. It came from
 * `duration(0)`, which fell past the sub-minute branch (`0 < minutes` excludes
 * zero) and formatted zero whole minutes.
 */
describe('a countdown', () => {
  it('never renders a zero quantity, in either language', async () => {
    await i18n.changeLanguage('tr');
    expect(untilReady(0)).toBe('birazdan');
    // A clock the server has already passed reads the same way, which is the
    // honest answer while a cached view catches up.
    expect(untilReady(-5)).toBe('birazdan');
    await i18n.changeLanguage('en');
    expect(untilReady(0)).toBe('any moment');
  });

  it('says the real figure everywhere above zero', async () => {
    await i18n.changeLanguage('en');
    expect(untilReady(0.5)).toBe(duration(0.5));
    expect(untilReady(7)).toBe(duration(7));
    expect(untilReady(60 * 25)).toBe(duration(60 * 25));
  });

  /*
    AND `duration` IS LEFT ALONE, deliberately. It measures a SPAN, where zero is a
    true answer somebody may want printed — a flight that took no time, a record
    with no age — and `i18n.test.ts` pins "0m" there on purpose. Counting down is
    the other question, and the two now have two functions.
  */
  it('leaves the span formatter saying zero when a span really is zero', async () => {
    await i18n.changeLanguage('en');
    expect(duration(0)).toBe('0m');
  });
});
