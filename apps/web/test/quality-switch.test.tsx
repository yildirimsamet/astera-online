import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { MenuPanel } from '../src/shell/MenuPanel.js';
import { renderQuality, setRenderQuality } from '../src/lib/quality.js';
import i18n from '../src/i18n/index.js';

/**
 * THE CONTROL THE HEAT COMPLAINT PRODUCED.
 *
 * A player whose phone gets hot needs to be able to do something about it in the
 * game, on the device, without a support thread — so the resolution ceiling is a
 * control rather than a build-time constant. It lives beside the language and the
 * sound switch because all three are facts about the device in their hand.
 */

function harness() {
  const fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ servers: [], placement: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { wrapper };
}

const show = () => {
  const { wrapper: Wrapper } = harness();
  return render(
    <Wrapper>
      <MenuPanel galaxy="Vantage" shard="EU-1" endsAt={null} onOpen={vi.fn()} onSignOut={vi.fn()} />
    </Wrapper>,
  );
};

beforeEach(async () => {
  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en');
  setRenderQuality('balanced');
});

describe('the image quality control', () => {
  it('offers all three rungs under one name', () => {
    show();

    expect(screen.getByRole('group', { name: i18n.t('menu.qualityLabel') })).toBeInTheDocument();
    for (const rung of ['high', 'balanced', 'low'] as const) {
      expect(screen.getByRole('button', { name: i18n.t(`menu.quality.${rung}`) }))
        .toBeInTheDocument();
    }
  });

  it('takes effect on the tap, with no confirm step', () => {
    show();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('menu.quality.low') }));
    expect(renderQuality()).toBe('low');
  });

  /**
   * THE STATE IS ANNOUNCED, NOT INFERRED FROM A COLOUR. `Segmented` in `group`
   * role carries `aria-pressed`, so a screen reader says which rung is on rather
   * than leaving it to a lit face nobody can hear.
   */
  it('says which rung is currently in force', () => {
    show();

    expect(screen.getByRole('button', { name: i18n.t('menu.quality.balanced') }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: i18n.t('menu.quality.high') }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  /**
   * A RUNG'S NAME DOES NOT SAY WHAT IT BUYS. `docs/interface.md` I1: a value the
   * player cannot compare is not information yet, and "Balanced" alone says
   * nothing about what is being balanced against what. The line under the control
   * is the current rung's own, so choosing states the consequence of the choice.
   */
  it('explains the rung that is chosen, and follows the choice', () => {
    show();

    expect(screen.getByText(i18n.t('menu.qualityHint.balanced'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('menu.quality.low') }));
    expect(screen.getByText(i18n.t('menu.qualityHint.low'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('menu.qualityHint.balanced'))).not.toBeInTheDocument();
  });
});
