import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HONOR_BENEFIT_THRESHOLDS_V1, HONOR_BENEFIT_THRESHOLDS_V2, honorBenefits } from '@astera/rules';
import { HonorBenefitsSection, HonorEffectQuote } from '../src/ui/HonorBenefits.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';

const value = (score: number) => ({ version: 1 as const, score, thresholds: HONOR_BENEFIT_THRESHOLDS_V1,
  ...honorBenefits(score, HONOR_BENEFIT_THRESHOLDS_V1) });
const valueV2 = (score: number) => ({ version: 2 as const, score, thresholds: HONOR_BENEFIT_THRESHOLDS_V2,
  ...honorBenefits(score, HONOR_BENEFIT_THRESHOLDS_V2) });
afterEach(async () => { await i18n.changeLanguage('en'); });
describe('Honor effects explained where a player decides', () => {
  it('does not advertise privileges when the season has no enabled policy', () => {
    const { container } = render(<HonorBenefitsSection value={null} />);
    expect(container).toBeEmptyDOMElement();
  });
  it.each([75_000_000, 25_000_000, 0, -25_000_000, -100_000_000])('shows the current tier and all five fixed tiers for score %s', (score) => {
    render(<HonorBenefitsSection value={value(score)} />);
    expect(screen.getByText('Honor benefits')).toBeVisible();
    fireEvent.click(screen.getByText('All tiers'));
    expect(document.querySelectorAll('[data-honor-tier]')).toHaveLength(5);
    expect(document.querySelectorAll('[data-current-honor-tier]')).toHaveLength(1);
  });
  it('shows the real lost convoy resources, net total and a red named penalty', () => {
    render(<HonorEffectQuote kind="convoy" value={value(-100_000_000)}
      base={{ alloy: 1000, crystal: 0, deuterium: 0 }} net={{ alloy: 700, crystal: 0, deuterium: 0 }} />);
    expect(screen.getByText('Honor penalty: −30%').closest('[data-tone]')).toHaveAttribute('data-tone', 'hostile');
    expect(screen.getByText('−300')).toBeVisible();
    expect(screen.getByText('700')).toBeVisible();
  });
  it('uses a green commission-free benefit for positive Honor and a neutral statement at zero', () => {
    const { rerender } = render(<HonorEffectQuote kind="trade" value={value(25_000_000)}
      base={{ alloy: 1000, crystal: 0, deuterium: 0 }} net={{ alloy: 1000, crystal: 0, deuterium: 0 }} />);
    expect(screen.getByText('Honor benefit: 0% commission').closest('[data-tone]')).toHaveAttribute('data-tone', 'good');
    rerender(<HonorEffectQuote kind="trade" value={value(0)} base={{ alloy: 1000, crystal: 0, deuterium: 0 }} net={{ alloy: 1000, crystal: 0, deuterium: 0 }} />);
    expect(screen.getByText('0% commission').closest('.gk-honorquote__title')).not.toHaveAttribute('data-tone');
  });
  // E6 (owner 2026-11-17): the quote's fine print is one press away, beside the effect it qualifies.
  it('keeps the trade rule behind the effect’s ⓘ', () => {
    render(<HonorEffectQuote kind="trade" value={value(0)} base={{ alloy: 1000, crystal: 0, deuterium: 0 }} net={{ alloy: 1000, crystal: 0, deuterium: 0 }} />);
    expect(screen.queryByText(/Commission is included in the net haul/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'What is this?' }));
    expect(screen.getByText(/Commission is included in the net haul/)).toBeVisible();
  });
  it.each(LANGUAGES)('names the effect, source and rule in %s without raw translation keys', async language => {
    await i18n.changeLanguage(language);
    const { container } = render(<><HonorBenefitsSection value={value(75_000_000)} />
      <HonorEffectQuote kind="repair" value={value(75_000_000)} base={{ alloy: 1000, crystal: 100, deuterium: 0 }} net={{ alloy: 900, crystal: 90, deuterium: 0 }} /></>);
    expect(container.textContent).toContain('Honor');
    expect(container.textContent).not.toMatch(/honorBenefits\.|undefined|NaN/);
  });
});

/**
 * G9-a (2026-11-16): HONOR'S PRIVILEGES ON THE GAME KIT. "What does my Honor buy me, and how far is
 * the next tier?" The section is a kit well with the tier's own badge, the three effects as kit
 * figures each in the colour of what it does to me (a cheaper repair is good, a commission is harm),
 * how much Honor the next tier still needs, and the whole ladder one press away on the kit's rules
 * row. The quote beside a repair, a trade or a convoy is a kit receipt: a named table, the effect
 * in its colour.
 */
const V2_LOOK = /(^|\s)(text|bg|border|font|from|via|to|divide|decoration)-v2-|rounded-control|text-threat-ink|(^|\s)text-(micro|body|caption|label|title)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

describe('Honor’s privileges on the kit', () => {
  it('is a kit well led by the tier’s badge, with the three effects as figures in their own colour', () => {
    const { container } = render(<HonorBenefitsSection value={value(30_000_000)} />);
    const section = container.querySelector<HTMLElement>('[data-honor-benefits]')!;
    expect(section).toHaveClass('gk-well');
    expect(oldPaint(section)).toEqual([]);
    expect(screen.getByRole('img', { name: 'Benefit tier 1' })).toBeVisible();
    const figures = [...section.querySelectorAll<HTMLElement>('.gk-honorperk__now .gk-figure__value')];
    expect(figures.map((figure) => figure.textContent)).toEqual(['−5%', '+15%', '0%']);
    expect(figures.map((figure) => figure.dataset.tone ?? null)).toEqual(['good', 'good', null]);
  });

  it('paints a penalty as harm, value by value', () => {
    const { container } = render(<HonorBenefitsSection value={value(-30_000_000)} />);
    const tones = [...container.querySelectorAll<HTMLElement>('.gk-honorperk__now .gk-figure__value')].map((figure) => figure.dataset.tone);
    expect(tones).toEqual(['hostile', 'hostile', 'hostile']);
  });

  it.each([
    [0, '25 more Honor to Benefit tier 1'],
    [30_000_000, '45 more Honor to Benefit tier 1'.replace('tier 1', 'tier 2')],
  ])('says how much Honor the next tier needs at %s', (score, line) => {
    render(<HonorBenefitsSection value={value(score)} />);
    expect(screen.getByText(line)).toBeVisible();
  });

  it('names the score that lifts a penalty, and says nothing above the top tier', () => {
    const { rerender } = render(<HonorBenefitsSection value={value(-30_000_000)} />);
    expect(screen.getByText('Climb above Honor -25 for Neutral')).toBeVisible();
    rerender(<HonorBenefitsSection value={value(80_000_000)} />);
    expect(document.querySelector('[data-honor-next]')).toBeNull();
  });

  it('keeps the ladder on the kit’s rules row, one press away', () => {
    const { container } = render(<HonorBenefitsSection value={value(30_000_000)} />);
    const fold = container.querySelector('details')!;
    expect(fold).toHaveClass('gk-rules');
    expect(fold.open).toBe(false);
    fireEvent.click(screen.getByText('All tiers'));
    expect(fold.open).toBe(true);
    expect(container.querySelector('[data-current-honor-tier]')).toHaveAttribute('data-honor-tier', '1');
  });

  it('quotes a repair as a kit receipt: a named table, the effect in its colour', () => {
    const { container } = render(<HonorEffectQuote kind="repair" value={value(30_000_000)}
      base={{ alloy: 1000, crystal: 200, deuterium: 0 }} net={{ alloy: 950, crystal: 190, deuterium: 0 }} />);
    const quote = container.querySelector<HTMLElement>('[data-honor-effect]')!;
    expect(quote).toHaveClass('gk-honorquote');
    expect(oldPaint(quote)).toEqual([]);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['', 'Base', 'Honor', 'You pay']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('Honor benefit: −5%').closest('[data-tone]')).toHaveAttribute('data-tone', 'good');
  });

  it('draws no empty table before anything is chosen, and keeps the rule', () => {
    const none = { alloy: 0, crystal: 0, deuterium: 0 };
    render(<HonorEffectQuote kind="trade" value={value(-30_000_000)} base={none} net={none} />);
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'What is this?' }));
    expect(screen.getByText(/Commission is included in the net haul/)).toBeVisible();
  });

  it('shows all seven V2 tiers including -3 (+25% fuel) and -4 (-25% production) with exact climb thresholds', () => {
    const { container, rerender } = render(<HonorBenefitsSection value={valueV2(-160_000_000)} />);
    expect(screen.getByText('Climb above Honor -150 for Penalty tier 2')).toBeVisible();
    fireEvent.click(screen.getByText('All tiers'));
    expect(container.querySelectorAll('[data-honor-tier]')).toHaveLength(7);
    expect(container.querySelector('[data-current-honor-tier]')).toHaveAttribute('data-honor-tier', '-3');

    rerender(<HonorBenefitsSection value={valueV2(-220_000_000)} />);
    expect(screen.getByText('Climb above Honor -200 for Penalty tier 3')).toBeVisible();
    const values = [...container.querySelectorAll<HTMLElement>('.gk-honorperk__now .gk-figure__value')].map(el => el.textContent);
    expect(values).toContain('+25%');
    expect(values).toContain('−25%');
  });
});
