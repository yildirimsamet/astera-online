import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeasonRewardReceipt } from '../src/ui/SeasonRewardReceipt.js';

describe('actual delivered season reward', () => {
  it('names the paid Honor achievement and shows actual delivered resources', () => {
    render(<SeasonRewardReceipt receipt={{ ranking: 'HONOR', sourceSeasonId: 'previous', displayRank: 2, rewardPlace: 2,
      alloy: 34, crystal: 24, deuterium: 4, programVersion: 1 }} />);
    expect(screen.getByText('Previous season prize delivered')).toBeVisible();
    expect(screen.getByText('Honor · Rank 2')).toBeVisible();
    expect(screen.getByText('34')).toBeVisible();
    expect(screen.getByText('24')).toBeVisible();
    expect(screen.getByText('4')).toBeVisible();
    expect(screen.queryByText(/full package/i)).not.toBeInTheDocument();
  });
  it('preserves a Dominion award and keeps an absent receipt empty', () => {
    const { rerender, container } = render(<SeasonRewardReceipt receipt={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<SeasonRewardReceipt receipt={{ ranking: 'DOMINION', sourceSeasonId: 'previous', displayRank: 1, rewardPlace: 1,
      alloy: 2000, crystal: 1500, deuterium: 300, programVersion: 1 }} />);
    expect(screen.getByText('Dominion · Rank 1')).toBeVisible();
  });
});
