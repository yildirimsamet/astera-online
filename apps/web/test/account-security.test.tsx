import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { AccountSecurityEntry } from '../src/screens/AccountSecuritySheet.js';
import { PasswordResetSheet } from '../src/screens/PasswordResetSheet.js';
import i18n from '../src/i18n/index.js';

beforeEach(async () => { await i18n.changeLanguage('en'); });
function setup(path: 'account' | 'reset' | 'pending') {
  const requested: { path: string; body: unknown }[] = [];
  const challenge = { challengeId: '11111111-1111-4111-8111-111111111111', purpose: path === 'reset' ? 'reset' : 'bind', expiresAt: new Date(Date.now() + 600000).toISOString(), resendAvailableAt: new Date(Date.now() + (path === 'reset' ? 60000 : -1)).toISOString() };
  const fetcher: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    requested.push({ path: url, body });
    const result = url.endsWith('/security') ? { enabled: true, loginMethod: 'username', email: null, maskedEmail: null, verifiedAt: null,
      pending: path === 'pending' ? { ...challenge, target: 'pilot@example.com', deliveryStatus: requested.filter(call => call.path.endsWith('/security')).length > 1 ? 'failed' : 'queued' } : null }
      : url.endsWith('/verify') || url.endsWith('/complete') ? { ok: true, reauthenticate: true }
      : challenge;
    return Promise.resolve(new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  const api = new Api({ fetch: fetcher }); const ended = vi.fn(); api.onSessionEnded(ended);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={api}>{path === 'reset' ? <PasswordResetSheet onClose={vi.fn()} /> : <AccountSecurityEntry />}</ApiProvider></QueryClientProvider>);
  return { requested, ended };
}
describe('account email surfaces', () => {
  it('shows a delayed delivery failure while the pending verification stays open', async () => {
    const { requested } = setup('pending');
    const entry = await screen.findByRole('button', { name: /add email/i });
    vi.useFakeTimers();
    try {
      fireEvent.click(entry);
      await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
      expect(requested.filter(call => call.path.endsWith('/security'))).toHaveLength(2);
      expect(screen.getByRole('alert')).toHaveTextContent('The email could not be delivered');
      expect(screen.getByLabelText('Verification code')).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
  it('explains the optional recovery benefit and switches to code verification before ending the session', async () => {
    const { requested, ended } = setup('account');
    fireEvent.click(await screen.findByRole('button', { name: /add email/i }));
    expect(screen.getByText(/username sign-in will stop/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'pilot@example.com' } });
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    const code = await screen.findByLabelText('Verification code');
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    const user = userEvent.setup(); await user.click(code); await user.paste('012 345');
    expect(code).toHaveValue('012345');
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await waitFor(() => { expect(ended).toHaveBeenCalledWith('email'); });
    expect(requested.find(r => r.path.endsWith('/verify'))?.body).toMatchObject({ code: '012345' });
  });
  it('requires matching new passwords before submitting a reset code', async () => {
    const { requested, ended } = setup('reset');
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'pilot@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '012345' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-correct-password' } });
    fireEvent.change(screen.getByLabelText('Repeat new password'), { target: { value: 'different-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(requested.some(r => r.path.endsWith('/complete'))).toBe(false);
    fireEvent.change(screen.getByLabelText('Repeat new password'), { target: { value: 'new-correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    await waitFor(() => { expect(ended).toHaveBeenCalledWith('password'); });
  });
  it('lets a player correct a mistyped reset email without waiting for the resend cooldown', async () => {
    setup('reset');
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'typo@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByLabelText('Verification code');
    expect(screen.getByRole('button', { name: /resend available/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Use another email' }));
    expect(screen.getByLabelText('Email address')).toHaveValue('typo@example.com');
    expect(sessionStorage.getItem('astera:password-reset')).toBeNull();
  });
});
