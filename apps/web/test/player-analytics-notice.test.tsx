import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { AnalyticsSetting } from '../src/lib/playerAnalytics/Notice.js';
import { analyticsChoice } from '../src/lib/playerAnalytics/preference.js';
beforeEach(async () => { localStorage.clear(); vi.stubEnv('VITE_ASTERA_PLAYER_ANALYTICS', '1'); await i18n.changeLanguage('tr'); });
afterEach(() => { vi.unstubAllEnvs(); });
it('shows an off switch without asking for initial permission', async () => {
  render(<AnalyticsSetting />); expect(screen.queryByRole('dialog')).toBeNull(); expect(analyticsChoice()).toBeNull();
  const measured = screen.getByRole('switch', { name: /Oyun ölçümü/ });
  expect(measured).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(measured);
  expect(analyticsChoice()).toBe('denied'); expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
});
it('refreshes the preference after another tab changes it', () => {
  render(<AnalyticsSetting />); localStorage.setItem('astera.player-analytics.choice', JSON.stringify({ version: 1, decision: 'denied' }));
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'astera.player-analytics.choice' })); });
  expect(screen.getByRole('switch', { name: /Oyun ölçümü/ })).toHaveAttribute('aria-checked', 'false');
});
it('is absent while the build switch is off', () => {
  vi.stubEnv('VITE_ASTERA_PLAYER_ANALYTICS', '0'); render(<AnalyticsSetting />); expect(screen.queryByRole('switch')).toBeNull();
});
