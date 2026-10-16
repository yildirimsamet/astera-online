import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HONOR_BENEFIT_THRESHOLDS_V1, honorBenefits } from '@astera/rules';
import { HonorBenefitsSection, HonorEffectQuote } from '../src/ui/HonorBenefits.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';

const value = (score: number) => ({ version: 1 as const, score, thresholds: HONOR_BENEFIT_THRESHOLDS_V1,
  ...honorBenefits(score, HONOR_BENEFIT_THRESHOLDS_V1) });
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
    expect(screen.getByText('Honor penalty: −30%').closest('p')).toHaveClass('text-threat-ink');
    expect(screen.getByText('−300')).toBeVisible();
    expect(screen.getByText('700')).toBeVisible();
  });
  it('uses a green commission-free benefit for positive Honor and a neutral statement at zero', () => {
    const { rerender } = render(<HonorEffectQuote kind="trade" value={value(25_000_000)}
      base={{ alloy: 1000, crystal: 0, deuterium: 0 }} net={{ alloy: 1000, crystal: 0, deuterium: 0 }} />);
    expect(screen.getByText('Honor benefit: 0% commission').closest('p')).toHaveClass('text-v2-self');
    rerender(<HonorEffectQuote kind="trade" value={value(0)} base={{ alloy: 1000, crystal: 0, deuterium: 0 }} net={{ alloy: 1000, crystal: 0, deuterium: 0 }} />);
    expect(screen.getByText('0% commission').closest('p')).toHaveClass('text-v2-ink-2');
  });
  it.each(LANGUAGES)('names the effect, source and rule in %s without raw translation keys', async language => {
    await i18n.changeLanguage(language);
    const { container } = render(<><HonorBenefitsSection value={value(75_000_000)} />
      <HonorEffectQuote kind="repair" value={value(75_000_000)} base={{ alloy: 1000, crystal: 100, deuterium: 0 }} net={{ alloy: 900, crystal: 90, deuterium: 0 }} /></>);
    expect(container.textContent).toContain('Honor');
    expect(container.textContent).not.toMatch(/honorBenefits\.|undefined|NaN/);
  });
});
