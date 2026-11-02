import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { ClaimDialog } from '../src/onboarding/ClaimDialog.js';
const observer = vi.hoisted(() => ({ observe: vi.fn(), ANALYTICS_READY_EVENT: 'astera:analytics-ready' }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => observer);
it('observes claim steps without the name, password or country fields', async () => {
  await i18n.changeLanguage('en');
  render(<ClaimDialog planetName="Aurora" onClaim={() => Promise.resolve()} onSignIn={() => undefined} />);
  expect(observer.observe).toHaveBeenCalledWith('claim_step_visible', { phase: 'name' }, 'live');
  await userEvent.type(screen.getByRole('textbox'), 'PrivateCommander');
  await userEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(observer.observe).toHaveBeenCalledWith('claim_step_visible', { phase: 'password' }, 'live');
  expect(JSON.stringify(observer.observe.mock.calls)).not.toContain('PrivateCommander');
});
