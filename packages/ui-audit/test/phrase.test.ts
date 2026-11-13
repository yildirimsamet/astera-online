import { describe, expect, it } from 'vitest';
import { phrase, phrases } from '../src/drivers/phrase.js';

describe('reading the game\'s own words', () => {
  it('finds a phrase in each language, so a driver presses the same button in all six', async () => {
    expect(await phrase('tr', 'skins', 'skins.tryOnWorld')).toBe('Gezegenimde dene');
    expect(await phrase('en', 'skins', 'skins.tryOnWorld')).toBe('Try on my world');
  });

  it('fails loudly on a phrase that is not there', async () => {
    await expect(phrase('tr', 'skins', 'skins.nope')).rejects.toThrow(/tr\/skins: skins.nope/);
  });

  it('lists the phrases under a key', async () => {
    expect(await phrases('tr', 'notificationCenter', 'notificationCenter.local.title')).toMatchObject({ fleet: 'Filo eve döndü' });
  });
});
