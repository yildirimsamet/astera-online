import { describe, expect, it } from 'vitest';
import { atesman, atesmanBand, sentences, syllables, textStats, words } from '../src/readability.js';

describe('Turkish syllables, words and sentences', () => {
  it('counts one syllable per vowel', () => {
    expect(syllables('merhaba')).toBe(3);
    expect(syllables('İSTİHBARAT')).toBe(4);
    expect(syllables('Gözlemevi')).toBe(4);
  });

  it('counts words that carry a letter or a digit, not stray punctuation', () => {
    expect(words('Filo yola çıktı — 2 sa. sonra')).toEqual(['Filo', 'yola', 'çıktı', '2', 'sa.', 'sonra']);
  });

  it('splits sentences on full stops, questions, exclamations and ellipses', () => {
    expect(sentences('Filo yola çıktı! Varışa az kaldı… Hazır mısın?')).toHaveLength(3);
    expect(sentences('Başlık')).toHaveLength(1);
    expect(sentences('')).toHaveLength(0);
  });
});

describe('Ateşman (1997) readability', () => {
  it('applies 198.825 − 40.175 × syllables per word − 2.610 × words per sentence', () => {
    // 5 words, 2 sentences, 7 syllables.
    expect(atesman('Bu bir test. Kısa cümle.')).toBeCloseTo(198.825 - 40.175 * 1.4 - 2.61 * 2.5, 3);
  });

  it('has nothing to say about text without words', () => {
    expect(atesman('—')).toBeNull();
  });

  it('names the band the score falls in', () => {
    expect(atesmanBand(95)).toBe('very-easy');
    expect(atesmanBand(75)).toBe('easy');
    expect(atesmanBand(55)).toBe('medium');
    expect(atesmanBand(40)).toBe('hard');
    expect(atesmanBand(10)).toBe('very-hard');
  });
});

describe('text statistics for a surface', () => {
  it('reports words, sentences and the longest sentence in words', () => {
    expect(textStats(['Filo yola çıktı.', 'Varış iki saat sonra, kalkan açık kalacak.'])).toEqual({ words: 10, sentences: 2, longestSentence: 7 });
  });
});
