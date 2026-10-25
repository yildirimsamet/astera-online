import type { Api } from '../src/api/client.js';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBattleReplayView, reloadReplayPage } from '../src/battle-simulator/replayView.js';
import { BattleReplayAction } from '../src/battle-simulator/BattleReplayAction.js';
import { simulateScenario, DEFAULT_SCENARIO } from '../src/battle-simulator/scenario.js';

const fetchReplay = vi.fn<Api['battleReplay']>();
vi.mock('../src/battle-simulator/replayView.js', () => ({ loadBattleReplayView: vi.fn(), reloadReplayPage: vi.fn() }));
vi.mock('../src/api/context.js', () => ({ useApi: () => ({ battleReplay: fetchReplay }) }));
vi.mock('../src/battle-simulator/BattleReplay.js', () => ({ BattleReplay: ({ initialViewer }: { initialViewer: string }) => <div>Recorded fight · {initialViewer}<button>Inspect recorded ship</button></div> }));
beforeEach(() => { fetchReplay.mockReset(); vi.mocked(reloadReplayPage).mockReset(); vi.mocked(loadBattleReplayView).mockReset().mockImplementation(async () => (await import('../src/battle-simulator/BattleReplayDialog.js')).default); });
const show = (status: 'AVAILABLE' | 'NOT_RECORDED' | 'INSUFFICIENT_FORCE' | 'TOO_LARGE' = 'AVAILABLE') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><BattleReplayAction kind="BATTLE" id="report-id" status={status} /></QueryClientProvider>);
};
describe('real report replay door', () => {
  it.each(['NOT_RECORDED', 'INSUFFICIENT_FORCE', 'TOO_LARGE'] as const)('explains %s without fetching protected telemetry', status => {
    show(status); expect(fetchReplay).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Watch battle' })).not.toBeInTheDocument();
    expect(screen.getByTestId('replay-unavailable')).not.toHaveTextContent(/^$/);
  });
  it('loads only when opened, aborts on close, restores focus and leaves the report open', async () => {
    fetchReplay.mockImplementation(() => new Promise(() => undefined));
    show(); expect(fetchReplay).not.toHaveBeenCalled();
    const opener = screen.getByRole('button', { name: 'Watch battle' }); opener.focus(); fireEvent.click(opener);
    await screen.findByRole('dialog', { name: 'Battle replay' });
    await waitFor(() => { expect(fetchReplay).toHaveBeenCalledTimes(1); });
    const signal = fetchReplay.mock.calls[0]![2]?.signal;
    if (!signal) throw new Error('Replay request is missing its abort signal');
    expect(signal.aborted).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(signal.aborted).toBe(true);
    expect(opener).toHaveFocus();
  });
  it('keeps the reader focus inside the replay when the parent report refreshes', async () => {
    fetchReplay.mockResolvedValue({ viewer: 'DEFENCE', replay: simulateScenario(DEFAULT_SCENARIO) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = (tick: number) => <QueryClientProvider client={client}><span>{tick}</span><BattleReplayAction kind="BATTLE" id="report-id" status="AVAILABLE" /></QueryClientProvider>;
    const view = render(tree(0)); fireEvent.click(screen.getByRole('button', { name: 'Watch battle' }));
    const inspect = await screen.findByRole('button', { name: 'Inspect recorded ship' }); inspect.focus();
    view.rerender(tree(1)); expect(inspect).toHaveFocus();
  });

  it('can cancel downloading the viewer before it opens or requests telemetry', async () => {
    vi.mocked(loadBattleReplayView).mockImplementation(() => new Promise(() => undefined));
    show(); fireEvent.click(screen.getByRole('button', { name: 'Watch battle' }));
    await screen.findByRole('status');
    fireEvent.click(screen.getByRole('button', { name: 'Return to report' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument(); expect(fetchReplay).not.toHaveBeenCalled();
  });
  it('contains a failed viewer download and requests a page reload to clear the browser module failure', async () => {
    vi.mocked(loadBattleReplayView).mockRejectedValueOnce(new Error('chunk offline'));
    fetchReplay.mockResolvedValue({ viewer: 'DEFENCE', replay: simulateScenario(DEFAULT_SCENARIO) });
    show(); fireEvent.click(screen.getByRole('button', { name: 'Watch battle' }));
    await screen.findByRole('alert'); expect(fetchReplay).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload game' }));
    expect(reloadReplayPage).toHaveBeenCalledTimes(1);
  });

  it('retries a failed request and renders the authoritative viewer without running the simulator', async () => {
    const run = simulateScenario(DEFAULT_SCENARIO);
    fetchReplay.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ viewer: 'DEFENCE', replay: run });
    show(); fireEvent.click(screen.getByRole('button', { name: 'Watch battle' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Recorded fight · DEFENCE');
    fireEvent.click(screen.getByRole('button', { name: 'Return to report' }));
    expect(screen.queryByText('Recorded fight · DEFENCE')).not.toBeInTheDocument();
  });
});
