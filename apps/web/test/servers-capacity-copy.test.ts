import { describe, expect, it } from 'vitest';
import { SERVERS } from '@astera/rules';
import i18n from '../src/i18n/index.js';

/**
 * THE SEAT COUNT A PLAYER READS IS THE ONE THE SERVER ENFORCES.
 *
 * The server list's rule line said "300 commanders" as typed text, so raising
 * `SERVERS.capacity` to 1000 (2026-09-18) would have left the first thing the
 * game says about itself wrong. The number is interpolated, never typed.
 */
describe('the server list rule line', () => {
  for (const lng of ['en', 'tr']) {
    it(`${lng} states the galaxy capacity from the rules`, () => {
      const line = i18n.t('servers.rule', { lng, seats: SERVERS.capacity });
      expect(line).toContain(String(SERVERS.capacity));
      expect(line).not.toContain('{{');
      expect(line).not.toMatch(/\b300\b/);
    });
  }
});
