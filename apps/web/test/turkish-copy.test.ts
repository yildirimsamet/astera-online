import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';

/**
 * THE D199 SENTENCES, AS A TURKISH READER READS THEM. Found in review, on the phone
 * screenshots: four lines that were grammatical to the writer and wrong to the
 * reader, and two names that said one thing two ways.
 *
 *   · "Hatta 3 yük gemisi var" — "hatta" is first read as "moreover", not "in the line".
 *   · "12b altını temizler" — "altını" is first read as "gold", not "what is under".
 *   · "Sondan fark edildi" — "noticed FROM the probe"; the probe is what was noticed.
 *   · "×2,0 katı" — the multiplier said twice.
 *   · "Aegis şarjı" in the dossier and "Kalkan gücü" in the note and the battle
 *     report, for one quantity; "Duvarın şekli" for what the class split is.
 *   · "Üzerine gelen güç" — the last bare "güç" on a surface, which D199 retired.
 */
describe('the Turkish the force readings are written in', () => {
  const tr = i18n.getFixedT('tr');

  it('says where a line sits without saying "gold"', () => {
    expect(tr('counter.linesClears', { at: '12b' })).toBe('12b altındakini temizler');
    expect(tr('counter.linesBreaks', { at: '12b' })).toBe('12b altındakini kırar');
  });

  it('says where the transports stand without saying "moreover"', () => {
    expect(tr('counter.noteUnarmed', { count: 3, band: '1–5' })).toBe('Savunmada 1–5 yük gemisi var');
    expect(tr('counter.noteUnarmed', { count: 1, band: '1' })).toBe('Savunmada 1 yük gemisi var');
  });

  it('says it was the probe that was noticed', () => {
    expect(tr('counter.noteSeen')).toBe('Sondanı fark ettiler');
    expect(tr('counter.noteSomeAway')).toBe('Sonda vardığında filolarının bir kısmı dışarıdaydı');
  });

  it('states a ratio once', () => {
    expect(tr('dossier.defenceRatio', { ratio: '2,0', world: 'Kestrel' }))
      .toBe('Kestrel üzerindekinin yaklaşık 2,0 katı.');
  });

  it('names the class split and the dome the way the rest of the game does', () => {
    expect(tr('dossier.shapeLabel')).toBe('Savunma dağılımı');
    expect(tr('counter.noteShapeUnread')).toBe('Savunma dağılımı okunmadı');
    expect(tr('dossier.shieldLabel')).toBe('Kalkan gücü');
    expect(tr('reports.calculation.shieldCharge')).toBe('Kalkan gücü');
  });

  it('never calls a force bare "güç"', () => {
    expect(tr('reports.theirBoardArrived')).toBe('Üzerine gelen filo');
    expect(tr('clan.strength.waiting')).toBe('Tüm ekibin kuvvetleri ölçülüyor');
  });

  it('names the capital as the only Core that opens a colony slot in both languages', () => {
    expect(tr('focus.planet.colonySlotExplain')).toContain('ana gezegendeki Komuta Çekirdeği');
    expect(tr('focus.planet.colonySlotExplain')).not.toContain('en güçlü');
    const en = i18n.getFixedT('en');
    expect(en('focus.planet.colonySlotExplain')).toContain("capital's Command Core");
    expect(en('focus.planet.colonySlotExplain')).not.toContain('strongest');
  });
});
