import { describe, expect, it } from 'vitest';
import type { NotificationView } from '../src/api/schemas.js';
import { i18n } from '../src/i18n/index.js';
import { describeNotification, isThreat, signalFamily, signalGlyph } from '../src/lib/notifications.js';
import { DESTINATION } from '../src/shell/Signals.js';

/**
 * KURULUŞ SAATİ IN THE LOG (plan 2026-11-20 §4, Faz 2). Ten minutes before the five-fold hour ends the
 * commander reads how long is left and what to do with it; at its end, what the hour made. Both open the
 * capital, where the next build is ordered. Neither is a threat: a lock on the screen does not let them through.
 */
const at = new Date('2026-11-20T10:00:00.000Z');
const news = (kind: 'newcomer_hour_ending' | 'newcomer_hour_summary', payload: Record<string, unknown>): NotificationView => ({
  id: kind, kind, payload, refId: 'capital', seen: false, at,
});

describe('the founding hour in the log', () => {
  it('says how long is left and asks for the next build', () => {
    const line = describeNotification(news('newcomer_hour_ending', { until: '2026-11-20T10:10:00.000Z' }), at.getTime());
    expect(line).toBe('Founding hour: 10m of five-fold output left. Start your next build now.');
  });

  it('sums the hour: alloy, crystal and the builds finished', () => {
    const line = describeNotification(news('newcomer_hour_summary', { alloy: 1240, crystal: 455, builds: 4 }), at.getTime());
    expect(line).toBe('Founding hour over: your works made 1,240 alloy and 455 crystal, and 4 builds finished. They run at their own rate now.');
  });

  it('reads in Turkish as the game speaks it', async () => {
    await i18n.changeLanguage('tr');
    try {
      expect(describeNotification(news('newcomer_hour_summary', { alloy: 1240, crystal: 455, builds: 1 }), at.getTime()))
        .toBe('Kuruluş Saati bitti: tesislerin 1.240 alaşım ve 455 kristal üretti, 1 inşa tamamlandı. Artık normal hızında çalışıyor.');
    } finally { await i18n.changeLanguage('en'); }
  });

  it('writes nothing for a payload it cannot read', () => {
    expect(describeNotification(news('newcomer_hour_summary', { alloy: 'many' }), at.getTime())).toBeNull();
    expect(describeNotification(news('newcomer_hour_ending', {}), at.getTime())).toBeNull();
  });

  it('is a gain to act on, opened on the capital, and never a threat', () => {
    const ending = news('newcomer_hour_ending', { until: '2026-11-20T10:10:00.000Z' });
    const summary = news('newcomer_hour_summary', { alloy: 1, crystal: 1, builds: 0 });
    expect(signalFamily(ending)).toBe('gain');
    expect(signalFamily(summary)).toBe('gain');
    expect(signalGlyph(ending)).toBe('bell');
    expect(DESTINATION.newcomer_hour_ending).toEqual({ panel: 'planet' });
    expect(DESTINATION.newcomer_hour_summary).toEqual({ panel: 'planet' });
    expect(isThreat(ending)).toBe(false);
  });
});
