import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { PublicLandingScreen } from '../src/landing/public/PublicLandingScreen.js';
const analytics = vi.hoisted(() => ({ observe: vi.fn(), analyticsRecording: vi.fn(() => true), analyticsHeaders: () => ({ 'x-analytics-visitor': 'visit' }), ANALYTICS_READY_EVENT: 'astera:analytics-ready' }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => analytics);
vi.mock('../src/api/queries.js', () => ({ useServers: () => ({ data: undefined }) }));
vi.mock('../src/screens/LandingAuthDialog.js', () => ({ AuthDialog: () => <div>Login form</div> }));
vi.mock('../src/brand/Install.js', () => ({ InstallButton: () => null, useDesktopInstallOffer: () => false }));
beforeEach(async () => { vi.clearAllMocks(); analytics.analyticsRecording.mockReturnValue(true); localStorage.clear(); await i18n.changeLanguage('en'); });
it('separates a visible homepage, Play intent and failure to reach training', async () => {
  const onBegin = vi.fn(() => Promise.reject(new Error('offline')));
  render(<PublicLandingScreen onAuthenticate={vi.fn()} onBegin={onBegin} knownCommander={() => false} />);
  expect(analytics.observe).toHaveBeenCalledWith('landing_visible', expect.objectContaining({ surface: 'public_landing' }), 'live');
  const button = screen.getByRole('button', { name: /play/i });
  await userEvent.click(button);
  const play = analytics.observe.mock.calls.find(([name]) => name === 'play_clicked');
  expect(play?.[1]).toMatchObject({ surface: 'public_landing' });
  expect(play?.[1]).toHaveProperty('attemptId');
  await waitFor(() => { expect(analytics.observe).toHaveBeenCalledWith('training_load_failed', expect.objectContaining({ code: 'unavailable' }), 'live'); });
  expect(analytics.observe.mock.calls.some(([name]) => name === 'training_started')).toBe(false);
});
it('records login separately and accepts only one Play intent while opening', async () => {
  const onBegin = vi.fn(() => new Promise<void>(() => undefined));
  render(<PublicLandingScreen onAuthenticate={vi.fn()} onBegin={onBegin} knownCommander={() => false} />);
  await userEvent.click(screen.getByRole('button', { name: /already have a commander/i }));
  expect(analytics.observe.mock.calls.filter(([name]) => name === 'login_clicked')).toHaveLength(1);
  expect(analytics.observe.mock.calls.filter(([name]) => name === 'play_clicked')).toHaveLength(0);
  await userEvent.dblClick(screen.getByRole('button', { name: /play/i }));
  expect(onBegin).toHaveBeenCalledTimes(1);
  expect(analytics.observe.mock.calls.filter(([name]) => name === 'play_clicked')).toHaveLength(1);
});
it('does not record entry intent before permission', async () => {
  analytics.analyticsRecording.mockReturnValue(false);
  render(<PublicLandingScreen onAuthenticate={vi.fn()} onBegin={() => Promise.resolve()} knownCommander={() => false} />);
  await userEvent.click(screen.getByRole('button', { name: /play/i }));
  expect(analytics.observe).not.toHaveBeenCalled();
});
