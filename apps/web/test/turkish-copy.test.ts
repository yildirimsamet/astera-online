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
  const en = i18n.getFixedT('en');

  it('says where a line sits without saying "gold"', () => {
    const clears = tr('counter.linesClears', { at: '12b' });
    const breaks = tr('counter.linesBreaks', { at: '12b' });
    expect(clears).toBe('Tam başarı sınırı: 12b');
    expect(breaks).toBe('kısmi başarı sınırı: 12b');
    // The rule this test exists for, held on the reading rather than the wording:
    // "12b altını" is read as GOLD before it is read as "what is under 12b", so the
    // line may never reach for `altı` to say where it sits.
    for (const line of [clears, breaks]) expect(line).not.toMatch(/alt[ıi]n/i);
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

  /**
   * THE SEASON RECORD, IN THE GAME'S OWN TURKISH.
   *
   * The archive block arrived with three English words the rest of the game had
   * already translated — and one of them, "Works", has its Turkish written five
   * lines from the top of the very file the block sits in: *"Works" için Türkçesi
   * HAVUZ*. A player who reads "havuz" on their planet screen and "Works" in their
   * season record is being shown one thing under two names, which is exactly what
   * the sentences above this test were written to stop.
   */
  it('uses the game’s own Turkish for the Works, a hull and a convoy', () => {
    expect(tr('leaderboard.archive.metrics.produced')).toContain('avuz');
    expect(tr('leaderboard.archive.metrics.produced')).not.toContain('Works');
    for (const key of ['shipsBuiltByHull', 'shipsLostByHull'] as const) {
      expect(tr(`leaderboard.archive.metrics.${key}`), key).not.toContain('Hull');
      expect(tr(`leaderboard.archive.metrics.${key}`), key).toContain('Gemi türüne');
    }
    for (const key of ['convoyAttempts', 'convoySuccesses', 'convoyDelivered'] as const) {
      expect(tr(`leaderboard.archive.metrics.${key}`), key).not.toMatch(/Convoy|convoy/);
      expect(tr(`leaderboard.archive.metrics.${key}`), key).toMatch(/onvoy/);
    }
  });

  /**
   * AND THE SENTENCE THE ERROR TEMPLATE BUILDS AROUND IT.
   *
   * `surface.unreachable` is `"{{what}} okunamadı."`, so every `what` is a subject
   * in the nominative — "Gezegenin okunamadı". The archive passed a DATIVE, which
   * reads "sezon kayıtlarına okunamadı": a sentence with no subject that a Turkish
   * reader stops on.
   */
  it('names the archive as a subject, not a destination', () => {
    expect(tr('surface.unreachable', { what: tr('leaderboard.archive.archiveIndex') }))
      .toBe('Sezon kayıtların okunamadı.');
  });

  /**
   * THE FIGURE THAT IS A SUM OF WORLDS, SAID AS ONE.
   *
   * Production time is counted per world and added up, so a commander holding four
   * worlds through a fourteen-day season reads "56g" — four times a season that
   * never lasted that long. The number is right; the label was not saying what it
   * was a number OF.
   */
  it('says production time is the total across every world', () => {
    expect(tr('leaderboard.archive.metrics.productiveTime')).toContain('dünya');
    expect(en('leaderboard.archive.metrics.productiveTime')).toContain('world');
  });

  /**
   * ONE QUANTITY, ONE NAME. The recap already had `damageDealt`; the archive added
   * a second key with the same words, and then read the DEALT half from its own
   * copy and the TAKEN half from the recap's. Two files to keep in step for one
   * pair of numbers on one screen is how they stop matching.
   */
  it('keeps one name for damage dealt', () => {
    expect(tr('seasonRecap.damageDealt')).toBe('Verilen hasar');
    expect(tr('leaderboard.archive.metrics.damageDealt', { defaultValue: '' })).toBe('');
  });

  /** Player words, not engineering words, on the two lines that explain a gap. */
  it('explains missing history without naming telemetry or seals', () => {
    for (const key of [
      'leaderboard.archive.emptyBoard',
      'leaderboard.archive.statsUnavailableHint',
      'leaderboard.archive.career.noTelemetry',
    ] as const) {
      expect(tr(key), key).not.toMatch(/mühürlen|telemetri/i);
      expect(en(key), key).not.toMatch(/sealed|telemetry/i);
    }
  });

  /**
   * THE FIELD'S FIGURE HAS TO FIT THE CARD IT IS PRINTED ON.
   *
   * `Stat` truncates, and the tightest slot this line lands in is a two-column
   * card on a 350px screen: about 139px of text at `--text-micro: 9px`, which is
   * roughly twenty-six characters. The first draft printed "Komutan ortalaması:
   * 27.000" — twenty-six characters before the number even arrives — and cut off
   * the one figure the comparison exists to show.
   *
   * The resource breakdown used to be tighter still at three columns, and the fix
   * there was the layout rather than the words: one pile per ROW, full width. The
   * budget below guards the remaining narrow case, measured against a seven-digit
   * number because that is the widest a season total gets.
   */
  it('prints the field’s figure so it fits the card instead of being truncated', () => {
    for (const t of [tr, en]) {
      const detail = t('leaderboard.archive.averageShort', { value: '1.250.000' });
      expect(detail.length, detail).toBeLessThanOrEqual(26);
    }
    // And the card says once what the word means, so it is never a riddle.
    expect(tr('leaderboard.archive.cohort', { count: 20 })).toContain('Diğerleri =');
    expect(tr('leaderboard.archive.cohort', { count: 20 })).toContain('ortalaması');
    expect(en('leaderboard.archive.cohort', { count: 20 })).toContain('Others =');
    expect(en('leaderboard.archive.cohort', { count: 20 })).toContain('average');
  });

  it('names the capital as the only Core that opens a colony slot in both languages', () => {
    expect(tr('focus.planet.colonySlotExplain')).toContain('ana gezegendeki Komuta Çekirdeği');
    expect(tr('focus.planet.colonySlotExplain')).not.toContain('en güçlü');
    expect(en('focus.planet.colonySlotExplain')).toContain("capital's Command Core");
    expect(en('focus.planet.colonySlotExplain')).not.toContain('strongest');
  });
});
