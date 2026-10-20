import { render, screen } from '@testing-library/react';
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
