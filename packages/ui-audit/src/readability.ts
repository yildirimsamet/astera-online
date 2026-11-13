/**
 * HOW MUCH TEXT, AND HOW HARD IT READS.
 *
 * Ateşman (1997) adapts Flesch to Turkish: 198.825 − 40.175 × syllables per word −
 * 2.610 × words per sentence. A Turkish syllable has exactly one vowel, so counting
 * vowels counts syllables. Scores run past 100 for very short text; they are reported
 * as they are.
 */

const VOWELS = /[aeıioöuüâîûAEIİOÖUÜÂÎÛ]/g;

export function syllables(word: string): number {
  return word.match(VOWELS)?.length ?? 0;
}

/** Whitespace-separated tokens that carry a letter or a digit. */
export function words(text: string): string[] {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));
}

/** Sentences end at . ! ? or …; a run of words without one is one sentence. */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).filter((sentence) => words(sentence).length > 0);
}

export function atesman(text: string): number | null {
  const list = words(text);
  if (list.length === 0) return null;
  const syllableCount = list.reduce((sum, word) => sum + syllables(word), 0);
  const sentenceCount = Math.max(1, sentences(text).length);
  return 198.825 - 40.175 * (syllableCount / list.length) - 2.61 * (list.length / sentenceCount);
}

export type AtesmanBand = 'very-easy' | 'easy' | 'medium' | 'hard' | 'very-hard';

/** Ateşman's bands: 90+ primary school, 70–89 middle, 50–69 high school, 30–49 university, below 30 academic. */
export function atesmanBand(score: number): AtesmanBand {
  if (score >= 90) return 'very-easy';
  if (score >= 70) return 'easy';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'hard';
  return 'very-hard';
}

export interface TextStats {
  words: number;
  sentences: number;
  /** Words in the longest sentence. */
  longestSentence: number;
}

export function textStats(texts: readonly string[]): TextStats {
  let wordCount = 0;
  let sentenceCount = 0;
  let longestSentence = 0;
  for (const text of texts) {
    wordCount += words(text).length;
    for (const sentence of sentences(text)) {
      sentenceCount += 1;
      longestSentence = Math.max(longestSentence, words(sentence).length);
    }
  }
  return { words: wordCount, sentences: sentenceCount, longestSentence };
}
