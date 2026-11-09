import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RankBadge } from '../src/galaxy/RankBadge.js';

describe('Dominion podium badges', () => {
  it('names the Honor podium explicitly while preserving the place', () => {
    render(<RankBadge rank={1} honor />);
    expect(screen.getByLabelText('Honor · Rank 1')).toHaveTextContent('1');
  });
  it.each([
    [1, 'gold'],
    [2, 'silver'],
    [3, 'copper'],
  ] as const)('makes rank %s a distinct, proudly visible metal badge', (rank, metal) => {
    render(<RankBadge rank={rank} />);
    const badge = screen.getByLabelText(`Dominion · Rank ${String(rank)}`);
    expect(badge).toHaveTextContent(String(rank));
    expect(badge.querySelector('.rank-badge')).toHaveClass(`rank-badge-${metal}`, 'rank-badge-dominion');
    expect(badge.querySelector('svg')).toBeInTheDocument();
  });
  it('uses different insignia and badge shapes for the two ladders', () => {
    const view = render(<><RankBadge rank={1} honor /><RankBadge rank={1} /></>);
    const honor = screen.getByLabelText('Honor · Rank 1');
    const dominion = screen.getByLabelText('Dominion · Rank 1');
    expect(honor.querySelector('.rank-badge')).not.toHaveClass('rank-badge-dominion');
    expect(honor.querySelector('svg')?.innerHTML).not.toBe(dominion.querySelector('svg')?.innerHTML);
    expect(view.container.querySelectorAll('.rank-badge')).toHaveLength(2);
  });
});
