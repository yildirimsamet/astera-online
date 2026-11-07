import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ClaimDialog } from '../src/onboarding/ClaimDialog.js';

/*
  Owner, 2026-10-20: with the cookie bar open, the claim sheet's Continue sat under it and a
  new commander could not finish signing up. The sheet stands on the bar's published height.
*/
it('keeps the claim sheet above an open cookie bar', () => {
  render(<ClaimDialog planetName="Kestrel" onClaim={vi.fn(() => Promise.resolve())} onSignIn={vi.fn()} />);
  expect(screen.getByRole('dialog')).toHaveClass('pb-[var(--consent-h,0px)]');
});

/*
  Owner playtest 2026-11-06: the password sheet was too tall, and the box to tick was one more chore.
  Joining is the agreement: the rules sit a tap away right above the button, and the acceptance the
  server records is sent with the claim as before.
*/
it('takes joining as agreeing, with the rules a tap away and no box to tick', async () => {
  const onClaim = vi.fn(() => Promise.resolve());
  render(<ClaimDialog planetName="Kestrel" onClaim={onClaim} onSignIn={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Commander name'), { target: { value: 'PolicyCommander' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue with this name' }));
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'fixture-password' } });
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.getByText(/By joining/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Community guidelines' })).toHaveAttribute('href', '/community-guidelines.html');
  expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/terms.html');
  const submit = screen.getByRole('button', { name: 'Join the galaxy' });
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  await waitFor(() => { expect(onClaim).toHaveBeenCalledWith('PolicyCommander', 'fixture-password', expect.any(String), { version: COMMUNITY_POLICY_VERSION, locale: 'en' }); });
});
