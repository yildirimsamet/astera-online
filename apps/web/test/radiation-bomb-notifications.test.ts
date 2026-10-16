import { expect, it } from 'vitest';
import { describeNotification, signalGlyph } from '../src/lib/notifications.js';
import { DESTINATION } from '../src/shell/Signals.js';
import type { NotificationView } from '../src/api/schemas.js';
const notice = (kind: string, payload: unknown): NotificationView => ({ id: 'notice', kind, seen: false, at: new Date(0), payload });
it('describes one bomb hit and its repair refund, with its real report destination', () => {
  const n = notice('radiation_bomb_result', { targetKind: 'PLANET', targetId: 'target', targetName: 'Asterion',
    level: 2, outcome: 'HIT', activeUntil: new Date(3600000).toISOString(), repairsCancelled: 2 });
  const text = describeNotification(n, 0);
  expect(text).toContain('L2'); expect(text).toContain('Asterion'); expect(text).toContain('refund');
  expect(DESTINATION.radiation_bomb_result).toEqual({ panel: 'report', stop: 'battles' });
  expect(signalGlyph(n)).toBe('strategic');
});
it('explains protection at impact and names an intercepted radiation bomb accurately', () => {
  expect(describeNotification(notice('radiation_bomb_result', { level: 1, outcome: 'INEFFECTIVE', targetName: 'Asterion' }), 0)).toMatch(/protected/i);
  expect(describeNotification(notice('strategic_intercepted', { weaponKind: 'RADIATION_BOMB', level: 3,
    defended: false, range: 100 }), 0)).toMatch(/L3.*intercepted/i);
});

it.each(['tr','en','de','fr','es','ja'])('provides bomb refusals and operating rules in %s', async language => {
  const { default: i18n } = await import('../src/i18n/index.js');
  const { ApiError } = await import('../src/api/client.js');
  const { describeError } = await import('../src/i18n/errors.js');
  await i18n.changeLanguage(language);
  for (const code of ['RADIATION_BOMB_UNAVAILABLE','RADIATION_BOMB_LOCKED','RADIATION_BOMB_EXISTS',
    'RADIATION_BOMB_NOT_READY','RADIATION_IMPACT_PENDING','RADIATION_RESEARCH_PENDING']) {
    expect(describeError(new ApiError(code,'untranslated server message',409,{}))).not.toBe('untranslated server message');
  }
  for (const key of ['stock','effect','workshop','noRecall','ineffective','refund','intercepted'] as const) {
    expect(i18n.t(`planet.radiationBomb.${key}`)).not.toBe(`planet.radiationBomb.${key}`);
  }
  await i18n.changeLanguage('en');
});


it('describes actual colony loyalty and only the faults supplied to the defender', () => {
  const text = describeNotification(notice('radiation_bomb_result', { level: 3, outcome: 'HIT',
    targetKind: 'PLANET', targetName: 'Colony', loyalty: { before: 80, after: 65 }, faults: ['CORE_OUTAGE'] }), 0);
  expect(text).toContain('80% → 65%');
  expect(text).toMatch(/Core/i);
  expect(describeNotification(notice('radiation_bomb_result', { level: 3, outcome: 'HIT',
    loyalty: { before: 7, after: 0 } }), 0)).toMatch(/neutral/i);
});
