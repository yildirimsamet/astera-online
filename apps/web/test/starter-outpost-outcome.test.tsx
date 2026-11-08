import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { NotificationView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { OutpostOutcome, useOutpostOutcome } from '../src/starter/OutpostOutcome.js';

const sound = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/sound.js', () => ({ playSound: sound }));
const buzz = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/haptics.js', () => ({ haptic: buzz }));

/**
 * THE RESULT, WHEN IT LANDS (plan §5.6, F4f). A raid on an outpost that ends while the player is in the
 * galaxy is told there and then, with a sound and a buzz that fit the grade, and one tap to the next
 * step: the crate after the first win, the report otherwise. What ended while they were away is the
 * away card's to tell, so it is not told twice.
 */
const later = () => new Date(Date.now() + 1_000);
const note = (payload: object, at = later(), id = 'n1'): NotificationView => ({
  id, kind: 'BATTLE_REPORT', seen: false, at, refId: `report-${id}`,
  payload: { grade: 'DECISIVE', attacking: true, opponent: 'Tevis', opponentKind: 'OUTPOST', loot: { alloy: 60, crystal: 0, deuterium: 0 }, lost: 0, ...payload },
});

/** The galaxy holds the result; the card is only where it is drawn, and may come and go. */
function Galaxy({ shown = true, onOpenShip, onOpenReport }: { shown?: boolean; onOpenShip: () => void; onOpenReport: (reportId: string | null) => void }) {
  const outcome = useOutpostOutcome();
  return shown && outcome.current ? <OutpostOutcome outcome={outcome.current} onDone={outcome.dismiss} onOpenShip={onOpenShip} onOpenReport={onOpenReport} /> : null;
}

const host = (notes: NotificationView[]) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['notifications'], { notifications: notes });
  const markSeen = vi.fn(() => Promise.resolve({ marked: notes.length }));
  const api = { notifications: () => Promise.resolve({ notifications: notes }), markSeen } as unknown as Api;
  const onOpenShip = vi.fn();
  const onOpenReport = vi.fn();
  const tree = (shown: boolean) => <QueryClientProvider client={client}><ApiProvider api={api}><Galaxy shown={shown} onOpenShip={onOpenShip} onOpenReport={onOpenReport} /></ApiProvider></QueryClientProvider>;
  const view = render(tree(true));
  return { markSeen, onOpenShip, onOpenReport, client, show: (shown: boolean) => { view.rerender(tree(shown)); } };
};

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); sound.mockClear(); buzz.mockClear(); });

describe('the result of a raid on an outpost', () => {
  it('consoles a first fight not won with its courage crate, and opens the ship on a tap', async () => {
    const { onOpenShip } = host([note({ grade: 'REPELLED', firstDefeat: true }, later(), 'courage')]);
    const card = await screen.findByTestId('outpost-outcome');
    expect(card.getAttribute('data-grade')).toBe('REPELLED');
    expect(card.textContent).toMatch(/courage crate/i);
    fireEvent.click(screen.getByRole('button', { name: /open the crate/i }));
    expect(onOpenShip).toHaveBeenCalledOnce();
  });

  it('tells a first win with its crate, and opens the ship on a tap', async () => {
    const { markSeen, onOpenShip } = host([note({ firstVictory: true })]);
    const card = await screen.findByTestId('outpost-outcome');
    expect(card.getAttribute('data-grade')).toBe('DECISIVE');
    expect(card.textContent).toMatch(/Tevis/);
    expect(card.textContent).toMatch(/victory crate/i);
    expect(sound).toHaveBeenCalledWith('claim');
    expect(buzz).toHaveBeenCalledWith('commit');
    fireEvent.click(screen.getByRole('button', { name: /open the crate/i }));
    expect(onOpenShip).toHaveBeenCalledOnce();
    await waitFor(() => { expect(markSeen).toHaveBeenCalledWith(['n1']); });
  });

  it('tells a loss with what it cost, and the report is one tap away', async () => {
    const { onOpenReport } = host([note({ grade: 'REPELLED', lost: 2, loot: { alloy: 0, crystal: 0, deuterium: 0 } }, later(), 'loss')]);
    const card = await screen.findByTestId('outpost-outcome');
    expect(card.getAttribute('data-grade')).toBe('REPELLED');
    expect(card.textContent).toMatch(/2 ships lost/);
    expect(sound).toHaveBeenCalledWith('impact');
    fireEvent.click(screen.getByRole('button', { name: /read the report/i }));
    expect(onOpenReport).toHaveBeenCalledWith('report-loss');
  });

  it('says the loot lands when the fleet is home', async () => {
    host([note({})]);
    expect((await screen.findByTestId('outpost-outcome')).textContent).toMatch(/lands in the store when the fleet is home/);
  });

  it('names who got there first', async () => {
    host([note({ beatenBy: 'Early' })]);
    const card = await screen.findByTestId('outpost-outcome');
    expect(card.getAttribute('data-grade')).toBe('BEATEN');
    expect(card.textContent).toMatch(/Early got there first/);
  });

  it('closes on "OK" and is read', async () => {
    const { markSeen, onOpenShip, onOpenReport } = host([note({})]);
    fireEvent.click(await screen.findByRole('button', { name: /^ok$/i }));
    await waitFor(() => { expect(screen.queryByTestId('outpost-outcome')).toBeNull(); });
    expect(markSeen).toHaveBeenCalledWith(['n1']);
    expect(onOpenShip).not.toHaveBeenCalled();
    expect(onOpenReport).not.toHaveBeenCalled();
  });

  // Following a fleet or reading a sheet takes the bottom of the screen: a result that lands then waits.
  it('keeps a result that landed while the card was not drawn, and rings when it is', async () => {
    const { client, show } = host([]);
    show(false);
    client.setQueryData(['notifications'], { notifications: [note({}, later(), 'waited')] });
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(sound).not.toHaveBeenCalled();
    show(true);
    expect((await screen.findByTestId('outpost-outcome')).textContent).toMatch(/Tevis/);
    expect(sound).toHaveBeenCalledWith('claim');
  });

  it('leaves what ended while the player was away to the away card', async () => {
    host([note({}, new Date(Date.now() - 60_000))]);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(screen.queryByTestId('outpost-outcome')).toBeNull();
  });

  it('is told only to the side that came, and only for an outpost', async () => {
    host([note({ attacking: false }, later(), 'a'), note({ opponentKind: 'SHIP' }, later(), 'b'), { ...note({}), id: 'c', seen: true }]);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(screen.queryByTestId('outpost-outcome')).toBeNull();
  });
});
