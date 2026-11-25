import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { Standings, standingLine } from '../../src/arena/Sandbox.js';

/* Owner 2026-11-25: the room's table stays, with kills and deaths; the points column and the points line go. */
const board = [
  { id: 5, name: 'Bora', kills: 3, deaths: 1, self: false },
  { id: 4, name: 'Ada', kills: 1, deaths: 0, self: true },
  { id: 6, name: 'Cem', kills: 0, deaths: 2, self: false },
];

describe('the room standings without points', () => {
  afterEach(async () => { await i18n.changeLanguage('en'); });

  it('says where you stand by kills, and that you are alone when you are', async () => {
    await i18n.changeLanguage('tr');
    const c = arenaCopy();
    expect(standingLine(board, c)).toBe('Sıra 2/3 · 1 yok etme');
    expect(standingLine(board.slice(1, 2), c)).toBe(c.alone);
  });

  it('draws kills and deaths, and no points column', async () => {
    await i18n.changeLanguage('tr');
    const c = arenaCopy();
    render(<Standings board={board} c={c} />);
    const heads = within(screen.getByRole('table')).getAllByRole('columnheader').map(cell => cell.textContent);
    expect(heads).toEqual(['#', '', c.killsCol, c.deathsCol]);
    expect(screen.getByText(c.standingsRule)).toBeTruthy();
  });
});
