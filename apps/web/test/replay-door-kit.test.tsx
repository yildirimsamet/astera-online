import type { Api } from '../src/api/client.js';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBattleReplayView } from '../src/battle-simulator/replayView.js';
import { BattleReplayAction } from '../src/battle-simulator/BattleReplayAction.js';
import { simulateScenario, DEFAULT_SCENARIO } from '../src/battle-simulator/scenario.js';

/**
 * C16b (2026-11-15): the door to the recorded fight and the shell around it, on the game kit.
 * The 3D stage inside the shell is the simulator's (G11) and is not drawn here.
 */
const fetchReplay = vi.fn<Api['battleReplay']>();
vi.mock('../src/battle-simulator/replayView.js', () => ({ loadBattleReplayView: vi.fn(), loadSimulatorView: vi.fn(), reloadReplayPage: vi.fn() }));
vi.mock('../src/api/context.js', () => ({ useApi: () => ({ battleReplay: fetchReplay }) }));
vi.mock('../src/battle-simulator/BattleReplay.js', () => ({ BattleReplay: ({ initialViewer }: { initialViewer: string }) => <div>Recorded fight · {initialViewer}</div> }));
beforeEach(() => {
  fetchReplay.mockReset();
  vi.mocked(loadBattleReplayView).mockReset().mockImplementation(async () => (await import('../src/battle-simulator/BattleReplayDialog.js')).default);
});
const show = (status: 'AVAILABLE' | 'NOT_RECORDED' = 'AVAILABLE') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><BattleReplayAction kind="BATTLE" id="report-id" status={status} /></QueryClientProvider>);
};
/** No page utility or v2 colour is left on the part: it is drawn by the kit alone. */
const noLegacy = (node: Element) => {
  for (const el of [node, ...node.querySelectorAll('*')]) expect(el.getAttribute('class') ?? '').not.toMatch(/rounded-control|text-v2-|border-v2-|bg-v2-|\bsim-/);
};

describe('the replay door on the kit (C16b)', () => {
  it('draws watch as a steel plate and try as the quiet move beside it, neither the sheet’s primary', () => {
    show();
    const watch = screen.getByRole('button', { name: 'Watch battle' });
    const tryIt = screen.getByRole('button', { name: 'Try in simulator' });
    expect(watch).toHaveClass('gk-btn', 'gk-btn--sm');
    expect(watch).not.toHaveClass('gk-btn--action');
    expect(watch.querySelector('.gk-glyph')).not.toBeNull();
    expect(tryIt).toHaveClass('gk-btn', 'gk-btn--ghost', 'gk-btn--sm');
    const door = watch.closest('[data-replay-door]');
    expect(door).not.toBeNull();
    noLegacy(door!);
  });

  it('says why a battle cannot be watched as a quiet kit note', () => {
    show('NOT_RECORDED');
    const note = screen.getByTestId('replay-unavailable');
    expect(note).toHaveClass('gk-report__note');
    expect(note).toHaveAttribute('data-tone', 'plain');
    noLegacy(note);
  });

  it('turns the watch button busy while the 3D view downloads, and gives focus back on cancel', async () => {
    vi.mocked(loadBattleReplayView).mockImplementation(() => new Promise(() => undefined));
    show();
    const watch = screen.getByRole('button', { name: 'Watch battle' });
    fireEvent.click(watch);
    const wait = await screen.findByRole('status');
    expect(watch).toHaveAttribute('aria-busy', 'true');
    expect(wait).toHaveClass('gk-well');
    expect(wait.querySelector('.gk-spin')).not.toBeNull();
    noLegacy(wait);
    const back = within(wait).getByRole('button', { name: 'Return to report' });
    expect(back).toHaveClass('gk-btn');
    fireEvent.click(back);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(watch).not.toHaveAttribute('aria-busy');
    expect(watch).toHaveFocus();
  });

  it('offers a kit reload when the 3D view cannot download', async () => {
    vi.mocked(loadBattleReplayView).mockRejectedValueOnce(new Error('chunk offline'));
    show(); fireEvent.click(screen.getByRole('button', { name: 'Watch battle' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveClass('gk-well');
    expect(within(alert).getByRole('button', { name: 'Reload game' })).toHaveClass('gk-btn');
    expect(screen.getByRole('button', { name: 'Watch battle' })).not.toHaveAttribute('aria-busy');
    noLegacy(alert);
  });
});

describe('the replay shell on the kit (C16b)', () => {
  it('heads the full-screen layer with the kit bar and its back button, focused on arrival', async () => {
    fetchReplay.mockImplementation(() => new Promise(() => undefined));
    show(); fireEvent.click(screen.getByRole('button', { name: 'Watch battle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Battle replay' });
    expect(dialog).toHaveClass('gk-replay');
    expect(dialog.querySelector('.sim-header')).toBeNull();
    const head = dialog.querySelector('.gk-replay__head');
    expect(head).not.toBeNull();
    expect(within(head as HTMLElement).getByRole('heading', { name: 'Battle replay' })).toBeInTheDocument();
    const back = within(head as HTMLElement).getByRole('button', { name: 'Return to report' });
    expect(back).toHaveClass('gk-round');
    await waitFor(() => { expect(back).toHaveFocus(); });
    const wait = within(dialog).getByRole('status');
    expect(wait).toHaveClass('gk-replay__wait');
    expect(wait.querySelector('.gk-spin')).not.toBeNull();
    noLegacy(head!); noLegacy(wait);
  });

  it('retries a failed recording with a kit button and only then builds the 3D stage', async () => {
    fetchReplay.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ viewer: 'DEFENCE', replay: simulateScenario(DEFAULT_SCENARIO) });
    show(); fireEvent.click(screen.getByRole('button', { name: 'Watch battle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Battle replay' });
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveClass('gk-replay__wait');
    expect(dialog.querySelector('.simulator')).toBeNull();
    noLegacy(alert);
    const retry = within(alert).getByRole('button', { name: 'Try again' });
    expect(retry).toHaveClass('gk-btn');
    fireEvent.click(retry);
    await within(dialog).findByText('Recorded fight · DEFENCE');
    expect(dialog.querySelector(':scope > .simulator')).toHaveTextContent('Recorded fight · DEFENCE');
  });
});
