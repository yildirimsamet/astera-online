import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { ChronicleLauncher } from '../src/screens/ChronicleLauncher.js';

function show(withEvent: boolean, onOpen = vi.fn()) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.chronicle, {
    pages: [{
      events: withEvent ? [{
        id: 'raid', kind: 'bombardment', subjectPlanetId: 'target',
        payload: { planetName: 'Kestrel-4', commanderName: 'İzci' },
        occurredAt: new Date('2026-08-23T12:00:00Z'),
      }] : [],
      nextBefore: null,
    }],
    pageParams: [null],
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  render(<Wrapper><ChronicleLauncher onOpen={onOpen} /></Wrapper>);
  return onOpen;
}

describe('Galaxy Chronicle launcher', () => {
  it('shows the latest public moment in one line and opens the shared feed', async () => {
    const onOpen = show(true);
    const launcher = screen.getByRole('button', { name: 'Open the Galaxy Chronicle' });
    expect(launcher).toHaveTextContent('Kestrel-4 under fire');
    /*
      THE SAME ROW AS CHAT (`bottom-2` — see that test), and clear of it: Chat owns
      `right-1` at 36px wide, so this sits at `right-11` and the two never overlap.
      Both halves are asserted because either alone can drift into a stack of one
      button on top of another, which is the failure a screenshot catches late.
    */
    expect(launcher).toHaveClass('bottom-2', 'right-11');
    await userEvent.setup().click(launcher);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('stays calm and carries no unread pressure when no event exists', () => {
    const launcher = show(false);
    expect(screen.getByRole('button', { name: 'Open the Galaxy Chronicle' })).toHaveTextContent('Galaxy quiet');
    expect(launcher).not.toHaveBeenCalled();
    expect(document.querySelector('.bg-threat')).toBeNull();
  });
});
