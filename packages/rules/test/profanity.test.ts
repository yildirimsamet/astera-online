import { describe, expect, it } from 'vitest';
import { findProfanity } from '../src/profanity.js';

describe('findProfanity', () => {
  it.each([
    // plain roots, phrases and Turkish suffixes
    'siktir', 'siktir git', 'siktiğimin oyunu', 'orospu çocuğu', 'orospudur', 'amk', 'aq', 'oç', 'piç',
    'yarrak', 'yarağımı', 'amına koyayım', 'ananı sikeyim', 'pezevenkler', 'kahpe', 'ibneler', 'göt',
    'götveren', 'şerefsiz', 'yavşaklar', 'amcık', 'kaltak', 'taşşak geçme', 'it oğlu it', 'veled i zina',
    'geri zekalı', 'gerizekalı', 'salak', 'aptallar', 'fuck you', 'motherfucker', 'bitch',
    // casing: Turkish İ, ASCII caps and mixed case
    'SİKTİR', 'SIKTIR', 'SiKtIr', 'OROSPU', 'AMINA KOYAYIM',
    // ASCII without Turkish letters
    'serefsiz', 'amcik', 'orospu cocugu', 'yavsak', 'tassak', 'gotveren',
    // leet
    's1kt1r', '4mk', '@mk', '$iktir', '0r0spu', 'g0tveren', '5iktir', 'amq', 'y4rr4k', 'p1ç', 'amc1k',
    // separators and spacing
    'a.m.k', 'a_m_k', 'a-m-k', 's.i.k.t.i.r', 'o.ç', 'am.ına koyim', 'g.ö.t', 's i k t i r', 'a m k',
    // repeated letters
    'siiiiktir', 'yarraaaak', 'amkkkk', 'orrrospu',
    // inside a sentence
    'bu oyun amk ya', 'naber orospu', 'filomu yok etti şerefsiz',
    // names: camel case, underscores, squashed words
    'KralSiktir', 'orospu_avcisi', 'xx_amk_xx', 'AsteraPezevenk', 'BenimAdimKahpe',
    // noun endings and words made only of refused parts
    'orospular', 'piçin', 'götünüze', 'amkmalı', 'bokkafa', 'piçkurusu', 'siktirgitmalı',
    // a listed word covering half the word or more
    'aorospu', 'aborospu', 'aborospuc', 'abcorospude', 'kralorospu', 'aptallık', 'salakça',
    // invisible and full-width characters
    'si​ktir', 'ｓｉｋｔｉｒ',
    // dotless ı for i outside the sik family, and ! for i
    'ıbne', 'gerızekalı', 'f4hışe', 's!kt!r', 'p!ç', 'pıç', 'gıberim',
    // forms the source list taught: suffixed göt, squashed phrases, short spellings
    'götüne koyim', 'götündeki', 'amck', 'koduğumun', 'yrrak', 'it_oğlu_it', 'fck', 'o.çocuğu', 'ananızyrrak',
  ])('blocks %j', (text) => {
    expect(findProfanity(text)).not.toBeNull();
  });

  it.each([
    // Turkish words that share letters with a root
    'şikayet etmek istiyorum', 'sikayet', 'sıkıldım', 'sıkı çalış', 'sıkıntı yok', 'canım sıktı',
    'eksik', 'eksiktir', 'kesik', 'basık', 'musiki', 'fizik', 'kaşık', 'ışık', 'aşık', 'sikke',
    'buraya koyayım', 'şuraya sokayım', 'ana üs', 'ana menü', 'mal varlığı', 'Allah razı olsun',
    'ama', 'amin', 'amaç', 'amiral', 'tamam', 'tamamen', 'tamına kadar', 'Amsterdam', 'Malta',
    'malzeme', 'normal', 'kapitalist', 'Bokassa', 'anamal', 'malın', 'itiraf',
    // a refused word inside a different word is free (owner rule: whole words only)
    'aqua', 'Mkultra',
    // clan-tag initials that are also chat abbreviations
    'SG', 'OC', 'MK', 'OQ',
    'götür', 'götürdüm', 'götürmek', 'kaşar peyniri', 'köpek', 'meme', 'koca bir filo', 'oğlan',
    'sokak', 'sokağa çık', 'promo kodumun süresi', 'yavaş', 'yarasa', 'yara', 'yaram var',
    'oynayarak', 'bakarak', 'koşarak', 'ağlayarak', 'sıçan', 'sıçradı', 'sıcak', 'domates',
    'penisilin', 'saksofon', 'zikzak', 'zikir', 'boks', 'ibadet', 'ibre', 'Astera', 'galaksi',
    'komutan', 'veled', 'hayvan', 'kayyum', 'ezik meyve', 'gibisi var mı', 'onun gibi', 'aşıktır',
    // English and other languages
    'I am here', 'I got it', 'it has gotten worse', 'send a pic', 'picnic', 'pick one', 'class', 'pass',
    'assassin', 'Scunthorpe', 'cocktail', 'analysis', 'therapist', 'skim', 'skiing', 'ambition',
    'Sie sind', 'biting',
    'Ich bin hier', 'こんにちは', '',
  ])('allows %j', (text) => {
    expect(findProfanity(text)).toBeNull();
  });

  it('returns the refused word as the player wrote it, lowercased', () => {
    expect(findProfanity('iyi oyunlar, siktir!')).toBe('siktir');
    expect(findProfanity('Bu oyun AMK')).toBe('amk');
    expect(findProfanity('s.i.k.t.i.r')).toBe('siktir');
    expect(findProfanity('bu S1KT1R')).toBe('s1kt1r');
  });

  it('stays fast on long adversarial input', () => {
    const started = performance.now();
    for (const text of ['amk'.repeat(93), 'a'.repeat(280), `${'yarra'.repeat(55)}x`, 's i '.repeat(70)]) findProfanity(text);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
