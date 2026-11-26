import { expect, it } from 'vitest';
import { starter as de } from '../src/i18n/locales/de/starter.js';
import { starter as en } from '../src/i18n/locales/en/starter.js';
import { starter as es } from '../src/i18n/locales/es/starter.js';
import { starter as fr } from '../src/i18n/locales/fr/starter.js';
import { starter as ja } from '../src/i18n/locales/ja/starter.js';
import { starter as tr } from '../src/i18n/locales/tr/starter.js';

const LOCALES = { tr, en, de, es, fr, ja } as const;

/**
 * Owner phone playtest 2026-11-26. The handover at the open jump did not say "stay and the hold fills": it says the
 * player is ready, may go, and may also stay and play a little longer. The report's line says to read the rival
 * before attacking, not that no fleet goes unread.
 */
it('hands over the open jump as a free choice, in every language', () => {
  expect(tr.tutorial.line.farewell_open).toBe('Hazırsın: istersen ana galaksiye geçebilirsin, istersen kalıp biraz daha oynayabilirsin.');
  expect(tr.feature.migration.line).toMatch(/kalıp biraz daha oynayabilirsin/);
  for (const [code, starter] of Object.entries(LOCALES)) {
    for (const said of [starter.tutorial.line.farewell_open, starter.feature.migration.line]) {
      expect(said, code).not.toMatch(/ambar dolar|hold fills|Laderaum füllt|bodega se llena|soute se remplit|貨物室は満ち|とどまるほど/);
    }
  }
});

it('tells the player to read the rival before attacking, in every language', () => {
  expect(tr.tutorial.line.report).toBe('Işıklı kısım, bir zaferin taşıyacağı ganimet. Saldırmadan önce rakibi okumak iyidir.');
  for (const [code, starter] of Object.entries(LOCALES)) {
    expect(starter.tutorial.line.report, code).not.toMatch(/Okumadan filo|Read it first|Erst lesen|Léelo antes|Lis avant d|読んでから艦隊/);
  }
});

it('speaks of the empty yard once the probe is home, not while it searches', () => {
  expect(tr.director.yardNeed).toBe('Ganimeti taşıyacak gemimiz yok. Tersane yapar.');
  for (const [code, starter] of Object.entries(LOCALES)) {
    expect(starter.director.yardNeed, code).not.toMatch(/seeks|arıyor|sucht|busca|cherche|探して/);
  }
});
