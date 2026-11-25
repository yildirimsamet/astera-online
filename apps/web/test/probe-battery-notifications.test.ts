import { beforeEach, expect, it } from 'vitest';
import { describeNotification, signalFamily } from '../src/lib/notifications.js';
import i18n from '../src/i18n/index.js';
import type { NotificationView } from '../src/api/schemas.js';

/**
 * WHAT EACH SIDE HEARS WHEN A PROBE BATTERY FIRES (2026-11-24, plan §3.5, W2).
 *
 * The server reuses two kinds the client already routes: the defender's `scan_detected`
 * carries the shot and a window's count, the attacker's `probe_report` says the craft is
 * gone and why. A plain scan and a probe that came home read exactly as before.
 */
const notice = (kind: string, payload: unknown): NotificationView => ({ id: 'n', kind, seen: false, at: new Date(0), payload });

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

it('tells the defender how many probes the battery shot down over which world', () => {
  const n = notice('scan_detected', { shotDown: true, count: 3, planetId: 'p', planetName: 'Kestrel-12' });
  const text = describeNotification(n, 0)!;
  expect(text).toMatch(/shot down/i);
  expect(text).toContain('Kestrel-12');
  expect(text).toContain('3');
  expect(signalFamily(n)).toBe('gain');
});

it('keeps a plain scan exactly as it was', () => {
  const n = notice('scan_detected', {});
  expect(describeNotification(n, 0)).toBe(i18n.t('notifications.scanDetected'));
  expect(signalFamily(n)).toBe('watch');
});

it('tells the attacker the probe is gone and that a battery stands there', () => {
  const n = notice('probe_report', { shotDown: true, targetPlanetId: 'p', targetUsername: 'Vega', targetPlanetName: 'Kestrel-12' });
  const text = describeNotification(n, 0)!;
  expect(text).toMatch(/shot down/i);
  expect(text).toMatch(/battery/i);
  expect(signalFamily(n)).toBe('threat');
});

it('keeps a probe that came home a gain', () => {
  const n = notice('probe_report', { targetPlanetId: 'p', targetUsername: 'Vega', targetPlanetName: 'Kestrel-12' });
  expect(describeNotification(n, 0)).not.toMatch(/shot down/i);
  expect(signalFamily(n)).toBe('gain');
});

it.each(['tr', 'en', 'de', 'fr', 'es', 'ja'])('says all of it in %s', async (language) => {
  await i18n.changeLanguage(language);
  for (const key of ['notifications.scanShotDown', 'notifications.probeShotDown',
    'planet.probeBattery.eyebrow', 'planet.probeBattery.hint', 'planet.probeBattery.empty', 'planet.probeBattery.offline',
    'planet.probeBattery.level', 'planet.probeBattery.upgrade', 'planet.probeBattery.upgradeNote', 'planet.probeBattery.upgrading', 'planet.probeBattery.upgradeStarted'] as const) {
    expect(i18n.t(key)).not.toBe(key);
  }
  const { ApiError } = await import('../src/api/client.js');
  const { describeError } = await import('../src/i18n/errors.js');
  for (const code of ['PROBE_BATTERY_LOCKED', 'PROBE_BATTERY_BUSY', 'PROBE_BATTERY_MAX']) {
    expect(describeError(new ApiError(code, 'untranslated server message', 409, {}))).not.toBe('untranslated server message');
  }
});

/** The rule where it is looked up (plan step 9): the numbers come from the rule, in both wiki languages. */
it.each(['en', 'tr'] as const)('explains the probe battery in the %s wiki, numbers from the rule', async (language) => {
  const { getWikiArticle } = await import('../src/wiki/catalog.js');
  const { PROBE_DEFENCE } = await import('@astera/rules');
  const text = JSON.stringify(getWikiArticle('intel.probe-defence')?.sections[language]);
  for (const figure of [PROBE_DEFENCE.catchBase * 100, Math.round(PROBE_DEFENCE.catchMax * 100), PROBE_DEFENCE.levels.length,
    Math.round(PROBE_DEFENCE.catchPerLevel * 100)]) {
    expect(text).toContain(String(figure));
  }
  expect(text).not.toMatch(/\bbot\b/i);
  expect(JSON.stringify(getWikiArticle('intel.probes')?.sections[language])).toContain('intel.probe-defence');
});
