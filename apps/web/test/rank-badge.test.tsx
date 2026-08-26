import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RankBadge } from '../src/galaxy/RankBadge.js';

describe('Dominion podium badges', () => {
  it.each([
    [1, 'gold'],
    [2, 'silver'],
    [3, 'copper'],
  ] as const)('makes rank %s a distinct, proudly visible metal badge', (rank, metal) => {
    render(<RankBadge rank={rank} />);
    const badge = screen.getByLabelText(`Rank ${String(rank)}`);
    expect(badge).toHaveTextContent(String(rank));
    expect(badge).toHaveClass('rank-badge', `rank-badge-${metal}`);
  });
});
