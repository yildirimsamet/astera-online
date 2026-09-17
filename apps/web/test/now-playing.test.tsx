import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { MenuPanel } from '../src/shell/MenuPanel.js';
import {
  MUSIC_TRACKS,
  musicTrack,
  selectTrack,
  setMusicEnabled,
} from '../src/lib/music.js';
import i18n from '../src/i18n/index.js';

/**
 * WHAT IS PLAYING, HOW LONG IT IS, AND WHERE IN IT WE ARE.
 *
 * Owner instruction, and the reason it is a section rather than a line is the
 * first of the four questions every surface answers: a volume slider says how
 * loud, and says nothing at all about WHICH of nine pieces is making the sound.
 * A player who wants the piano one and keeps getting the documentary one has no
 * move to make — the control they need is "not this one, the next one", and it
 * does not exist until this block does.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: no track list, no shuffle switch, no
 * favourites. Nine numbered pieces of background score do not deserve a media
 * library on a 350-wide phone; two arrows reach every one of them.
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
  setMusicEnabled(true);
  selectTrack(0);
});

describe('the now-playing section', () => {
  it('names the piece that is sounding, and how many there are to reach', () => {
    selectTrack(2);
    show();

    expect(
      screen.getByText(
        i18n.t('menu.trackLabel', { index: 3, total: MUSIC_TRACKS.length }),
      ),
    ).toBeInTheDocument();
  });

  /**
   * THE CLOCK BEFORE THE FILE HAS LOADED. jsdom never decodes anything, so this is
   * also the real first paint on a phone: a position of zero and a length nobody
   * knows yet. Printing `0:00 / 0:00` there would state a length, and a wrong one.
   */
  it('shows a position and refuses to invent a length it has not read', () => {
    show();

    const clock = screen.getByTestId('now-playing-clock');
    expect(clock).toHaveTextContent('0:00');
    expect(clock).toHaveTextContent('–:––');
  });

  it('moves forward and back through the list, wrapping at both ends', () => {
    selectTrack(0);
    show();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('menu.trackPrev') }));
    expect(musicTrack()).toBe(MUSIC_TRACKS.length - 1);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('menu.trackNext') }));
    expect(musicTrack()).toBe(0);
  });

  it('keeps the skip working while the score is silenced', () => {
    setMusicEnabled(false);
    show();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('menu.trackNext') }));
    expect(musicTrack()).toBe(1);
  });

  /**
   * The bar is a picture of the clock beside it, so it must not be read out twice.
   */
  it('draws the progress without repeating it to a screen reader', () => {
    show();
    expect(screen.getByTestId('now-playing-bar')).toHaveAttribute('aria-hidden', 'true');
  });
});
