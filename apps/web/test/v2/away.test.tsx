import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../../src/api/client.js';
import { ApiProvider } from '../../src/api/context.js';
import type { ReturnPayload } from '../../src/api/schemas.js';
import i18n from '../../src/i18n/index.js';
import { duration } from '../../src/lib/time.js';
import { AwaySheet } from '../../src/v2/hud/AwaySheet.js';
import { AwayHost } from '../../src/v2/shell/AwayHost.js';

/**
 * WHILE YOU WERE AWAY. E10 · K5 · S3.
 *
 * The story comes back on terms: after the galaxy is up (never before it), only after
 * a real absence with something to tell, at most three lines each with its one door,
 * worded here in the reader's language, and the window closes when the player
 * dismisses it — not when it is read.
 */
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);
const story = (over: Partial<ReturnPayload> = {}): ReturnPayload => ({
  awayMinutes: 432,
  asOf: new Date('2026-09-24T12:00:00Z'),
  entries: [
    { kind: 'raided', params: { grade: 'DECISIVE', loot: 1_200, lost: 3 }, at: at(40) },
    { kind: 'scan_detected', params: { count: 2 }, at: at(30) },
    { kind: 'raid_result', params: { grade: 'PARTIAL', loot: 3_100, lost: 2 }, at: at(90) },
    { kind: 'accrued', params: { alloy: 900, crystal: 300 }, at: at(0) },
    { kind: 'unlock', params: { unlock: 'RADAR' }, at: at(0) },
  ],
  pending: [],
  newUnlocks: ['RADAR'],
  ...over,
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('the away sheet', () => {
  const show = (over: Partial<ReturnPayload> = {}, extra: Partial<Parameters<typeof AwaySheet>[0]> = {}) => {
    const handlers = { onDoor: vi.fn(), onAll: vi.fn(), onDismiss: vi.fn() };
    render(<AwaySheet story={story(over)} {...handlers} {...extra} />);
    return handlers;
  };

  /** The mock's card: in the middle of the screen, over the galaxy, nothing to pull. */
  it('stands as a card in the middle', () => {
    show();
    expect(screen.getByRole('dialog', { name: 'While you were away' })).toHaveAttribute('data-placement', 'card');
  });

  it('writes each door as a link under its line', () => {
    show();
    const first = document.querySelectorAll<HTMLElement>('[data-away-row]')[0]!;
    expect(within(first).getByRole('button', { name: 'Open the radar →' })).toBeInTheDocument();
  });

  it('tells a live Telescope sighting as the opportunity, and opens its dossier', async () => {
    const { onDoor } = show({}, { sightings: [{ planetId: 'p-orin', planetName: 'Orin', owner: 'NOVA', etaMinutes: 70 }] });
    const rows = document.querySelectorAll<HTMLElement>('[data-away-row]');
    const sighting = rows[rows.length - 1]!;
    expect(sighting).toHaveTextContent('NOVA');
    expect(sighting).toHaveTextContent(/Orin’s fleet is out/);
    expect(sighting).toHaveTextContent(/seen by your Telescope/);
    await userEvent.click(within(sighting).getByRole('button', { name: 'Open the dossier →' }));
    expect(onDoor).toHaveBeenCalledWith('dossier', 'p-orin');
  });

  it('warns of the world that needs repairs, with the door to them', async () => {
    const { onDoor } = show({}, { care: { planetId: 'p-88', name: 'Thistle-88', faults: 2, loyalty: 50 } });
    const care = document.querySelector<HTMLElement>('[data-away-care]')!;
    expect(care).toHaveTextContent('Thistle-88 loyalty 50%');
    expect(care).toHaveTextContent('2 faults standing');
    await userEvent.click(within(care).getByRole('button', { name: 'repair' }));
    expect(onDoor).toHaveBeenCalledWith('repair', 'p-88');
  });

  it('says how long the player was away and tells at most three things', () => {
    show();
    expect(screen.getByRole('dialog', { name: 'While you were away' })).toHaveTextContent(duration(432));
    expect(document.querySelectorAll('[data-away-row]')).toHaveLength(3);
  });

  it('leads with the threat, worded from its kind and parameters', () => {
    show();
    const first = document.querySelectorAll<HTMLElement>('[data-away-row]')[0]!;
    expect(first).toHaveAttribute('data-tone', 'alarm');
    expect(first).toHaveTextContent(/2 scans found you/i);
  });

  it('words a raid on you in the reader’s language', async () => {
    await i18n.changeLanguage('tr');
    show({ entries: [{ kind: 'raided', params: { grade: 'DECISIVE', loot: 1_200, lost: 3 }, at: at(40) }] });
    const row = document.querySelector<HTMLElement>('[data-away-row]')!;
    expect(row).toHaveTextContent(/Savunman/);
    expect(row).toHaveTextContent('1.200');
    expect(row).not.toHaveTextContent(/raid|taken/i);
  });

  it('gives each line the one door that answers it', async () => {
    const { onDoor } = show();
    const first = document.querySelectorAll<HTMLElement>('[data-away-row]')[0]!;
    await userEvent.click(within(first).getByRole('button'));
    expect(onDoor).toHaveBeenCalledWith('intel', undefined);
  });

  it('offers the whole list, and goes back to the galaxy', async () => {
    const { onAll, onDismiss } = show();
    await userEvent.click(screen.getByRole('button', { name: 'All (5)' }));
    expect(onAll).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to the galaxy' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('the away host', () => {
  const host = (payload: ReturnPayload) => {
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    const read = vi.spyOn(api, 'returnPayload').mockResolvedValue(payload);
    const acknowledge = vi.spyOn(api, 'acknowledgeReturn').mockResolvedValue({ ok: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
    );
    const onDoor = vi.fn();
    const onAll = vi.fn();
    render(<Wrapper><AwayHost delayMs={0} keepAliveMs={40} onDoor={onDoor} onAll={onAll} /></Wrapper>);
    return { read, acknowledge, onDoor, onAll };
  };

  it('tells the story after a real absence and closes it at what was read', async () => {
    const { acknowledge } = host(story());
    const sheet = await screen.findByRole('dialog', { name: 'While you were away' });
    expect(acknowledge).not.toHaveBeenCalled();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Back to the galaxy' }));
    expect(acknowledge).toHaveBeenCalledWith(new Date('2026-09-24T12:00:00Z'));
    expect(screen.queryByRole('dialog', { name: 'While you were away' })).toBeNull();
  });

  it('says nothing after a short absence, and closes the window at once', async () => {
    const { read, acknowledge } = host(story({ awayMinutes: 5 }));
    await waitFor(() => { expect(read).toHaveBeenCalledOnce(); });
    await waitFor(() => { expect(acknowledge).toHaveBeenCalledWith(new Date('2026-09-24T12:00:00Z')); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a line’s door and closes the story on the way', async () => {
    const { acknowledge, onDoor } = host(story());
    const sheet = await screen.findByRole('dialog', { name: 'While you were away' });
    const first = sheet.querySelectorAll<HTMLElement>('[data-away-row]')[0]!;
    await userEvent.click(within(first).getByRole('button'));
    expect(onDoor).toHaveBeenCalledWith('intel', undefined);
    expect(acknowledge).toHaveBeenCalled();
  });

  /**
   * THE OLD OVERLAY'S FIRST BUG: a reload an hour into play is not an absence. While the
   * player is here, the window is kept at the present.
   */
  it('keeps the window at the present while the player is here', async () => {
    const { acknowledge } = host(story({ awayMinutes: 5 }));
    await waitFor(() => { expect(acknowledge.mock.calls.length).toBeGreaterThanOrEqual(3); }, { timeout: 2_000 });
  });

  /**
   * A HIDDEN PAGE IS NOT A PLAYER WHO IS HERE (review, 2026-09-25). A tab put away for four
   * hours and shown again without a reload — the usual case on a desktop, common on a phone —
   * had its first keep-alive move the window to the present, and the four hours' story was
   * never told. Coming back from a real absence is a return, whether or not the page reloaded.
   */
  describe('a page hidden and shown again', () => {
    const show = (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    afterEach(() => {
      vi.restoreAllMocks();
      Reflect.deleteProperty(document, 'visibilityState');
    });

    it('tells the story of a real absence instead of closing the window past it', async () => {
      const { read, acknowledge } = host(story({ awayMinutes: 5 }));
      await waitFor(() => { expect(acknowledge).toHaveBeenCalled(); });
      read.mockResolvedValue(story({ asOf: new Date('2026-09-24T16:00:00Z') }));
      const start = Date.now();
      show('hidden');
      vi.spyOn(Date, 'now').mockReturnValue(start + 4 * 3_600_000);
      acknowledge.mockClear();
      show('visible');
      const sheet = await screen.findByRole('dialog', { name: 'While you were away' });
      expect(read).toHaveBeenCalledTimes(2);
      // Several keep-alive periods pass with the story up: nothing closes the window but the player.
      await new Promise((resolve) => { setTimeout(resolve, 200); });
      expect(acknowledge).not.toHaveBeenCalled();
      await userEvent.click(within(sheet).getByRole('button', { name: 'Back to the galaxy' }));
      expect(acknowledge).toHaveBeenCalledWith(new Date('2026-09-24T16:00:00Z'));
    });

    it('treats a short look away as presence', async () => {
      const { read, acknowledge } = host(story({ awayMinutes: 5 }));
      await waitFor(() => { expect(acknowledge).toHaveBeenCalled(); });
      const start = Date.now();
      show('hidden');
      vi.spyOn(Date, 'now').mockReturnValue(start + 5 * 60_000);
      show('visible');
      acknowledge.mockClear();
      await waitFor(() => { expect(acknowledge).toHaveBeenCalled(); }, { timeout: 2_000 });
      expect(read).toHaveBeenCalledOnce();
    });
  });
});
