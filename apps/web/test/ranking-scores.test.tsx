import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import i18n from '../src/i18n/index.js';
import { RankingScores } from '../src/ui/RankingScores.js';

afterEach(cleanup);

describe('one score vocabulary across ranking and battle surfaces', () => {
  it('shows zero Honor before the independent Dominion score', async () => {
    await i18n.changeLanguage('en');
    const { container } = render(<RankingScores honor={0} dominion={420} />);
    expect(screen.getByText('Honor')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('+420')).toBeInTheDocument();
    const labels = container.textContent;
    expect(labels.indexOf('Honor')).toBeLessThan(labels.indexOf('Dominion'));
  });

  it('preserves signed micro precision for a battle change', async () => {
    await i18n.changeLanguage('en');
    render(<RankingScores honor={-1} dominion={-100} change />);
    expect(screen.getByText('-0.000001')).toBeInTheDocument();
    expect(screen.getByText('−100')).toBeInTheDocument();
  });

  it('does not invent Honor on legacy reports and can display only Honor', async () => {
    await i18n.changeLanguage('en');
    const { rerender } = render(<RankingScores honor={null} dominion={10} />);
    expect(screen.queryByText('Honor')).not.toBeInTheDocument();
    rerender(<RankingScores honor={1_000_001} change />);
    expect(screen.getByText('+1.000001')).toBeInTheDocument();
    expect(screen.queryByText('Dominion')).not.toBeInTheDocument();
  });
});
