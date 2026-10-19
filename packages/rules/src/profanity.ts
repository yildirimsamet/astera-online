import { PROFANE_WORDS } from './profanityWords.js';

/**
 * Profanity in commander names, clan names/tags and chat. Server-enforced.
 *
 * A WORD is refused when (owner rules, 2026-10-19):
 *   1. it is a listed word, written any way: casing, Turkish/ASCII letters, leet
 *      (s1kt1r, 4mk, @, $), repeated letters (siiiiktir), separators (a.m.k, s i k t i r),
 *      invisible characters, camel-case names (KralSiktir);
 *   2. it is a listed word with noun endings (orospular, piçin, götünüze);
 *   3. it is made ENTIRELY of refused parts, one of them listed (amkmalı = amk+mal+ı);
 *      COMPOUND_ONLY parts are ordinary words on their own (Malta, anamal pass);
 *   4. a listed word of five letters or more covers at least half of it (aborospuc).
 * Anything else that merely contains a listed word is a different word and passes:
 * eksik, şikayet, götür, oynayarak, tamamında.
 *
 * A typed ş never matches an s in a word, and a typed ı never matches the i of the sik
 * family, so şikayet/sıkıldım pass while sikerim does not. ASCII-only text stays
 * ambiguous; ALLOWED keeps the few real words that collide with a listed spelling.
 */

const COMPOUND_ONLY = ['mal', 'it', 'ana', 'anan', 'kafa', 'kafalı', 'oğlu', 'çocuğu', 'herif', 'kurusu', 'evladı', 'soyu'];
/** Compared with the word as typed (lowercase): pic is English, piç is not. */
const ALLOWED = new Set(['got', 'gotten', 'pic']);
/** Plural, case, possessive and copula endings, folded (ı→i, ü→u). */
const SUFFIXES = [
  'lar', 'ler', 'da', 'de', 'ta', 'te', 'dan', 'den', 'tan', 'ten', 'dir', 'dur', 'tir', 'tur',
  'in', 'un', 'nin', 'nun', 'i', 'u', 'yi', 'yu', 'a', 'e', 'ya', 'ye', 'na', 'ne',
  'si', 'su', 'sin', 'im', 'um', 'iz', 'uz', 'ki', 'm', 'n',
];
const SHARE = 0.5;
const SHARE_MIN_LETTERS = 5;
/** Listed words that clean words carry at half their length or more (tamamında, oynayarak). */
const NOT_A_SHARE = ['yarak', 'penis', 'sakso', 'ambiti', 'amında', 'amından', 'amını', 'amına'];

const FOLD: Record<string, string> = {
  ç: 'c', ğ: 'g', ö: 'o', ü: 'u', w: 'v', '1': 'i', '4': 'a', '@': 'a', '0': 'o', '3': 'e', '5': 's', $: 's',
  '7': 't', '8': 'b', '€': 'e', à: 'a', á: 'a', â: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', ú: 'u', ù: 'u', û: 'u',
};
const WORD = /[\p{L}\p{N}@$€]+/gu;
const SEPARATORS = /(?<=[\p{L}\p{N}@$€])[._\-*'’`~|+,/\\]+(?=[\p{L}\p{N}@$€])/gu;
const SPELLED_OUT = /(?<![\p{L}\p{N}@$€])[\p{L}\p{N}@$€](?:\s+[\p{L}\p{N}@$€](?![\p{L}\p{N}@$€]))+/gu;

/**
 * Keeps ı and ş (the two letters that change meaning). Three or more of one letter
 * become one (siiiiktir); a double stays, because yarra is not yara.
 */
const strictFold = (word: string): string =>
  Array.from(word, ch => FOLD[ch] ?? ch).join('').replace(/(.)\1{2,}/gu, '$1');
const lenient = (strict: string): string => strict.replace(/ı/g, 'i');
/** A listed ş also matches a typed s; a listed s never matches a typed ş. */
const spellings = (word: string): string[] => {
  const folded = lenient(strictFold(word));
  return folded.includes('ş') ? [folded, folded.replace(/ş/g, 's')] : [folded];
};

interface Lexicon {
  listed: Set<string>; twoLetter: Set<string>; mild: Set<string>; suffixes: Set<string>;
  phrases: string[]; shares: string[]; longest: number;
}
let lexicon: Lexicon | undefined;
/** Built on first use: importing the rules package costs nothing where this is unused. */
function load(): Lexicon {
  if (lexicon) return lexicon;
  const listed = new Set(PROFANE_WORDS.filter(word => !word.includes(' ') && word.length >= 3).flatMap(spellings));
  const excluded = new Set(NOT_A_SHARE.flatMap(spellings));
  lexicon = {
    listed,
    // Two letters are too little to fold or extend (aq+ua is aqua, oc is a clan tag): exact only.
    twoLetter: new Set(PROFANE_WORDS.filter(word => word.length < 3)),
    mild: new Set(COMPOUND_ONLY.flatMap(spellings)),
    suffixes: new Set(SUFFIXES),
    phrases: PROFANE_WORDS.filter(word => word.includes(' ')).flatMap(phrase => phrase.split(' ').map(spellings)
      .reduce<string[]>((all, options) => all.flatMap(start => options.map(next => `${start} ${next}`.trim())), [''])),
    shares: [...listed].filter(word => word.length >= SHARE_MIN_LETTERS && !word.startsWith('sik') && !excluded.has(word)),
    longest: Math.max(...[...listed].map(word => word.length)),
  };
  return lexicon;
}

/** Rules 1–3: listed parts, mild parts and endings that use up the whole word. */
function composed(word: string, strict: string, lex: Lexicon): boolean {
  // Per position: reachable without a listed part (false) and/or with one (true).
  const reached = Array.from({ length: word.length + 1 }, () => new Set<boolean>());
  reached[0]!.add(false);
  for (let from = 0; from < word.length; from++) {
    for (const listedSoFar of reached[from]!) {
      for (let to = from + 1; to <= Math.min(word.length, from + lex.longest); to++) {
        const part = word.slice(from, to);
        // The sik family needs a typed i: sıkı is not siki.
        if (lex.listed.has(part) && !(part.startsWith('sik') && strict.slice(from, to) !== part)) reached[to]!.add(true);
        if (lex.mild.has(part) || (from > 0 && lex.suffixes.has(part))) reached[to]!.add(listedSoFar);
      }
    }
  }
  return reached[word.length]!.has(true);
}

/** Rule 4: long listed words covering half the letters or more. */
function mostlyListed(word: string, lex: Lexicon): boolean {
  const covered = new Array<boolean>(word.length).fill(false);
  for (const listed of lex.shares) {
    for (let at = word.indexOf(listed); at >= 0; at = word.indexOf(listed, at + 1)) covered.fill(true, at, at + listed.length);
  }
  return covered.filter(Boolean).length >= word.length * SHARE;
}

function normalise(text: string): string {
  return text.normalize('NFKC').replace(/[\p{Cf}­]/gu, '')
    .replace(/[İI]/g, 'i').toLowerCase().normalize('NFC').replace(/\p{M}/gu, '')
    .replace(/!(?=\p{L})/gu, 'i');
}

/** The ways a player hides a word: as typed, punctuation-joined, letter-spaced, camel-case. */
function candidates(text: string): string[] {
  const plain = normalise(text);
  const joined = plain.replace(SEPARATORS, '');
  const camel = normalise(text.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')).replace(SEPARATORS, '');
  return [plain, joined, joined.replace(SPELLED_OUT, run => run.replace(/\s+/g, '')), camel];
}

/** The first refused word (lowercase, as typed), or null when the text is clean. */
export function findProfanity(text: string): string | null {
  const lex = load();
  for (const candidate of candidates(text)) {
    const typed = candidate.match(WORD) ?? [];
    const folded = typed.map(strictFold);
    const line = ` ${folded.map(lenient).join(' ')} `;
    const phrase = lex.phrases.find(entry => line.includes(` ${entry} `));
    if (phrase) return phrase;
    for (const [index, word] of typed.entries()) {
      if (lex.twoLetter.has(word)) return word;
      if (ALLOWED.has(word)) continue;
      const strict = folded[index]!;
      const loose = lenient(strict);
      if (composed(loose, strict, lex) || mostlyListed(loose, lex)) return word;
    }
  }
  return null;
}
