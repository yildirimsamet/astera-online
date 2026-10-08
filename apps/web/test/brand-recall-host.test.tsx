import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { RecallHost } from '../src/brand/RecallHost.js';
import { InstallProvider } from '../src/brand/Install.js';
import { saveRecall } from '../src/brand/recallState.js';
import { INSTALLED_PWA_KEY } from '../src/brand/installedPwa.js';
import { keys } from '../src/api/keys.js';
import { planetSchema } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

const status = { eligible: true, completed: false, reward: { alloy: 100, crystal: 50, deuterium: 20 } };
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

function show(paused = false, eligible = true) {
  const api = new Api();
  vi.spyOn(api, 'brandRecallStatus').mockResolvedValue({ ...status, eligible });
  const answer = vi.spyOn(api, 'answerBrandRecall').mockResolvedValue({ correct: true, completed: true, granted: status.reward, planet: planetSchema.parse(planetView()) });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queries.setQueryData(['brandRecall', 'a'], { ...status, eligible });
  const wrap = (blocked: boolean) => <QueryClientProvider client={queries}><ApiProvider api={api}>
    <InstallProvider><RecallHost accountId="a" paused={blocked} /></InstallProvider>
  </ApiProvider></QueryClientProvider>;
  const view = render(wrap(paused));
  return { ...view, api, answer, queries, setPaused: (blocked: boolean) => { view.rerender(wrap(blocked)); } };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('first real-game minutes', () => {
  it('shows the return card after sixty foreground seconds and remembers having shown it', async () => {
    const first = show();
    await advance(59_999);
    expect(screen.queryByTestId('return-card')).toBeNull();
    await advance(1001);
    expect(screen.getByTestId('return-card')).toHaveTextContent('asteraonline.space');
    first.unmount();
    show();
    await advance(61_000);
    expect(screen.queryByTestId('return-card')).toBeNull();
  });

  it.each([
    ['a phone', 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', 'Add the game to your home screen to open it again easily.', 'Add to home screen'],
    ['a computer', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'Bookmark or install the game to open it again easily.', 'Save for quick access'],
  ])('words the return card for %s', async (_device, ua, hint, action) => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);
    show();
    await advance(61_000);
    const card = screen.getByTestId('return-card');
    expect(card).toHaveTextContent(hint);
    expect(within(card).getByRole('button', { name: action })).toBeInTheDocument();
  });

  it('does not offer the return card to an installed player', async () => {
    localStorage.setItem(INSTALLED_PWA_KEY, '1');
    show();
    await advance(61_000);
    expect(screen.queryByTestId('return-card')).toBeNull();
  });

  it('shows the quiz at 180 foreground seconds and credits only the confirmed response', async () => {
    const { answer, queries } = show();
    await advance(179_999);
    expect(screen.queryByTestId('brand-quiz')).toBeNull();
    await advance(1001);
    expect(screen.getByTestId('brand-quiz')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'asteraonline.space' })); await Promise.resolve(); await Promise.resolve(); });
    await advance(1);
    expect(answer).toHaveBeenCalledWith('asteraonline.space');
    expect(screen.getByTestId('brand-quiz')).toHaveTextContent('100');
    expect(queries.getQueryData(keys.planet)).toEqual(planetView());
    expect(queries.getQueryData(keys.planetById('p1'))).toEqual(planetView());
  });

  it('excludes hidden time and loading, and resumes accumulated time after a reload', async () => {
    const view = show();
    await advance(60_000);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await advance(300_000);
    expect(screen.queryByTestId('brand-quiz')).toBeNull();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    const loader = document.createElement('div');
    loader.dataset.loadingScreen = '';
    document.body.append(loader);
    await advance(300_000);
    expect(screen.queryByTestId('brand-quiz')).toBeNull();
    loader.remove();
    view.unmount();
    show();
    await advance(121_000);
    expect(screen.getByTestId('brand-quiz')).toBeInTheDocument();
  });

  it('defers interruption behind another panel and never enrolls an existing account', async () => {
    const view = show(true);
    await advance(181_000);
    expect(screen.queryByTestId('brand-quiz')).toBeNull();
    view.setPaused(false);
    await advance(1000);
    expect(screen.getByTestId('brand-quiz')).toBeInTheDocument();
    view.unmount();
    localStorage.clear();
    show(false, false);
    await advance(181_000);
    expect(screen.queryByTestId('brand-quiz')).toBeNull();
    expect(screen.queryByTestId('return-card')).toBeNull();
  });

  it('reveals a wrong answer, permits retry, and never shows an unconfirmed reward', async () => {
    saveRecall('a', { activeMs: 180_000, returnShown: true, quizDone: false });
    const { answer } = show();
    answer.mockResolvedValueOnce({ correct: false, completed: false, granted: { alloy: 0, crystal: 0, deuterium: 0 } });
    await advance(1000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'asteraonline.com' })); await Promise.resolve(); await Promise.resolve(); });
    await advance(1);
    expect(screen.getByRole('alert')).toHaveTextContent('asteraonline.space');
    expect(screen.queryByText('Reward received')).toBeNull();
    answer.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'asteraonline.space' })); await Promise.resolve(); await Promise.resolve(); });
    await advance(1);
    expect(screen.getByRole('alert')).toHaveTextContent(/try again/i);
    expect(screen.queryByText('Reward received')).toBeNull();
    expect(screen.getByRole('button', { name: 'asteraonline.space' })).toBeEnabled();
  });

  it('skips once and does not show the quiz after another mount', async () => {
    saveRecall('a', { activeMs: 180_000, returnShown: true, quizDone: false });
    const view = show();
    view.answer.mockResolvedValue({ correct: false, completed: true, granted: { alloy: 0, crystal: 0, deuterium: 0 } });
    await advance(1000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Skip' })); await Promise.resolve(); await Promise.resolve(); });
    await advance(1);
    expect(view.answer).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId('brand-quiz')).toBeNull();
    view.unmount();
    show();
    await advance(181_000);
    expect(screen.queryByTestId('brand-quiz')).toBeNull();
  });

  it('keeps keyboard focus in the quiz and moves it to Continue after confirmation', async () => {
    const previous = document.createElement('button');
    document.body.append(previous);
    previous.focus();
    saveRecall('a', { activeMs: 180_000, returnShown: true, quizDone: false });
    show();
    await advance(1000);
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close' });
    const skip = screen.getByRole('button', { name: 'Skip' });
    skip.focus();
    act(() => { fireEvent.keyDown(skip, { key: 'Tab' }); });
    expect(document.activeElement).toBe(close);
    act(() => { fireEvent.keyDown(close, { key: 'Tab', shiftKey: true }); });
    expect(document.activeElement).toBe(skip);
    expect(dialog.contains(document.activeElement)).toBe(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'asteraonline.space' })); await Promise.resolve(); });
    await advance(1);
    expect(screen.getByRole('button', { name: 'Continue playing' })).toHaveFocus();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue playing' })); await Promise.resolve(); });
    await advance(1);
    expect(previous).toHaveFocus();
    previous.remove();
  });

  it('keeps focus inside while the selected answer waits for the server', async () => {
    saveRecall('a', { activeMs: 180_000, returnShown: true, quizDone: false });
    const { answer, queries } = show();
    answer.mockReturnValueOnce(new Promise(() => undefined));
    await advance(1000);
    const choice = screen.getByRole('button', { name: 'asteraonline.space' });
    choice.focus();
    await act(async () => { fireEvent.click(choice); await Promise.resolve(); });
    await advance(1);
    expect(choice).toBeDisabled();
    act(() => { fireEvent.keyDown(choice, { key: 'Tab' }); });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(queries.getQueryData(keys.planet)).toBeUndefined();
    act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
    expect(screen.getByTestId('brand-quiz')).toBeInTheDocument();
  });
});
