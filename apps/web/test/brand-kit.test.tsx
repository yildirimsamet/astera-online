import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRAND_RECALL } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { BrandQuiz } from '../src/brand/BrandQuiz.js';
import { InstallButton, InstallProvider } from '../src/brand/Install.js';
import { RecallHost } from '../src/brand/RecallHost.js';
import i18n from '../src/i18n/index.js';

/**
 * G13-d (2026-11-16): THE ADDRESS QUIZ AND THE RETURN CARD ON THE GAME KIT. "Remember where we
 * live, and take a reward." A kit sheet; the reward first on the kit's figures; each address a kit
 * plate with its letter key; a wrong pick a warning banner; the reward taken on one lit press. The
 * return card a kit plate with a kit round close.
 */

const OLD = /(^|\s)(text|bg|border|font)-v2-|rounded-control|(^|\s)text-(micro|body|caption|label|title)(\s|$)|(^|\s)brand-(panel|quiz|reward|choice|success|return|small|install|bookmark|address)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => OLD.test(name));

const quiz = (props: Partial<Parameters<typeof BrandQuiz>[0]> = {}) => render(
  <BrandQuiz result={null} message={null} pending={false} reward={BRAND_RECALL.reward} onAnswer={vi.fn()} onClose={vi.fn()} {...props} />,
);

beforeEach(async () => { if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en'); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('the address quiz on the kit', () => {
  it('is a kit sheet that leads with the reward and asks on kit plates', () => {
    const onAnswer = vi.fn();
    quiz({ onAnswer });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('gk-sheet');
    expect(oldPaint(dialog)).toEqual([]);
    expect(dialog.querySelectorAll('.gk-quizreward .gk-num')).toHaveLength(3);
    const right = screen.getByRole('button', { name: BRAND_RECALL.answer });
    expect(right).toHaveClass('gk-quizopt');
    fireEvent.click(right);
    expect(onAnswer).toHaveBeenCalledWith(BRAND_RECALL.answer);
    expect(screen.getByRole('button', { name: i18n.t('brand.skip') })).toHaveClass('gk-btn', 'gk-btn--ghost');
  });

  it('says a wrong pick on a warning banner', () => {
    quiz({ message: 'wrong' });
    expect(screen.getByRole('alert')).toHaveClass('gk-banner', 'gk-banner--warn');
  });

  it('takes the reward on the one lit press', () => {
    const onClose = vi.fn();
    quiz({ result: { correct: true, completed: true, granted: BRAND_RECALL.reward }, onClose });
    const dialog = screen.getByRole('dialog');
    expect(oldPaint(dialog)).toEqual([]);
    const go = within(dialog).getByRole('button', { name: i18n.t('brand.continue') });
    expect(go).toHaveClass('gk-btn', 'gk-btn--action');
  });
});

describe('the return card on the kit', () => {
  it('is a kit plate with a kit round close', async () => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const api = new Api();
    const status = { eligible: true, completed: false, reward: BRAND_RECALL.reward };
    vi.spyOn(api, 'brandRecallStatus').mockResolvedValue(status);
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queries.setQueryData(['brandRecall', 'a'], status);
    render(<QueryClientProvider client={queries}><ApiProvider api={api}><InstallProvider><RecallHost accountId="a" /></InstallProvider></ApiProvider></QueryClientProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    const card = screen.getByTestId('return-card');
    expect(card).toHaveClass('gk-returncard');
    expect(oldPaint(card)).toEqual([]);
    expect(within(card).getByRole('button', { name: i18n.t('brand.close') })).toHaveClass('gk-round');
    expect(within(card).getByRole('button', { name: /home screen|quick access/i })).toHaveClass('gk-btn', 'gk-btn--action');
  });
});

/** The guide to keep Astera one touch away: a kit sheet, its steps numbered on the kit, the address in a kit well. */
describe('the install guide on the kit', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  const openGuide = async (ua: string) => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);
    render(<InstallProvider><InstallButton /></InstallProvider>);
    fireEvent.click(await screen.findByRole('button', { name: /home screen|quick access/i }));
    return screen.getByRole('dialog');
  };

  it('is a kit sheet whose steps and address speak the kit', async () => {
    const dialog = await openGuide(IPHONE);
    expect(dialog).toHaveClass('gk-sheet');
    expect(oldPaint(dialog)).toEqual([]);
    expect(dialog.querySelectorAll('.gk-installsteps .gk-num')).toHaveLength(3);
    expect(dialog.querySelector('.gk-well .gk-installsheet__address')).toHaveTextContent('asteraonline.space');
    expect(within(dialog).getByRole('button', { name: i18n.t('brand.copyAddress') })).toHaveClass('gk-btn');
  });

  it('shows a computer its bookmark key on a kit key', async () => {
    const dialog = await openGuide(WINDOWS);
    expect(oldPaint(dialog)).toEqual([]);
    expect(dialog.querySelector('kbd')).toHaveClass('gk-installsheet__key');
  });
});
