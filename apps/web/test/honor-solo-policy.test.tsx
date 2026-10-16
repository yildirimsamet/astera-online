import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { HonorBattleSummary } from '../src/ui/HonorBattleSummary.js';
import { HonorSoloNotice } from '../src/ui/HonorSoloNotice.js';
import i18n from '../src/i18n/index.js';

describe('shared Honor policy decision support', () => {
  const show = (enabled: boolean) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['season'], { honorSoloCredit: enabled });
    const api = new Api({ fetch: vi.fn<typeof globalThis.fetch>() });
    const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
    return render(<Wrapper><HonorSoloNotice /></Wrapper>);
  };
  it('states the shared policy and surviving attack penalties before dispatch', async () => {
    await i18n.changeLanguage('en'); show(true);
    expect(screen.getByText(/Shared sides cannot earn positive Honor/)).toBeVisible();
    expect(screen.getByText(/Attack losses and weaker-target penalties still apply/)).toBeVisible();
    expect(screen.getByText(/A solo opponent can still earn Honor/)).toBeVisible();
  });
  it('does not advertise the new policy for legacy, disabled or invisible seasons', () => {
    expect(show(false).container).toBeEmptyDOMElement();
  });
  it.each(['en', 'tr', 'de', 'fr', 'es', 'ja'])('explains a shared zero in %s', async language => {
    await i18n.changeLanguage(language);
    const { container } = render(<HonorBattleSummary receipt={{ delta: 0, reason: 'SHARED_SIDE', breakdown: {
      teamDelta: 0, rawTeamDelta: 0, participants: 2, contributionPpm: 500_000,
      militaryDamage: 1000, permanentLoss: 0, sharedPositiveBlocked: true,
    } }} dominion={100} />);
    expect(container.textContent).not.toMatch(/leaderboard\./);
    expect(container.querySelector('[data-honor-shared-policy]')).toBeInTheDocument();
  });
  it('explains both the shared policy and the actual attack debit', async () => {
    await i18n.changeLanguage('en');
    render(<HonorBattleSummary receipt={{ delta: -100_000, reason: 'ATTACK_LOSS', breakdown: {
      teamDelta: -100_000, rawTeamDelta: -100_000, participants: 2, contributionPpm: 500_000,
      militaryDamage: 1000, permanentLoss: 1000, sharedPositiveBlocked: true,
    } }} />);
    expect(screen.getByText(/Shared sides cannot earn positive Honor/)).toBeVisible();
    expect(document.querySelector('[data-honor-score]')).toHaveTextContent('-0.1');
  });
});
