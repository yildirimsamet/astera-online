import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuTile, TileGrid } from '../../src/game-ui/index.js';

/**
 * THE MENU'S ONE KIND OF THING (G1-f2, 2026-11-14). Every place the commander's menu opens is
 * one tile: a cut plate with the place's own picture, its mark on a coin and its name. News
 * behind it is a red count; a word of warning is a chip; a wide tile says its state in a line.
 * The reader hears the name and what is behind it.
 */

const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

describe('a menu tile', () => {
  it('is named by the place and what is behind it, and opens it on a press', () => {
    const onPress = vi.fn();
    render(<MenuTile tile="leaderboard" glyph="ranking" label="Sıralama" hint="Dominion ve Onur" art="/a.webp" onPress={onPress} />);
    const tile = screen.getByRole('button', { name: 'Sıralama. Dominion ve Onur' });
    expect(tile).toHaveAttribute('data-tile', 'leaderboard');
    expect(tile.querySelector('img')).toHaveAttribute('src', '/a.webp');
    expect(tile).toHaveTextContent('Sıralama');
    press(tile);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('counts news behind it in red, and says the news after its name', () => {
    render(<MenuTile tile="rewards" glyph="crate" label="Ödüller" hint="Topla" news={{ count: 3, said: '3 ödül hazır' }} onPress={vi.fn()} />);
    const tile = screen.getByRole('button', { name: 'Ödüller. Topla. 3 ödül hazır' });
    expect(tile.querySelector('.gk-dot')).toHaveTextContent('3');
    expect(tile).toHaveTextContent('3 ödül hazır');
  });

  it('draws no count when nothing is new', () => {
    render(<MenuTile tile="rewards" glyph="crate" label="Ödüller" hint="Topla" news={{ count: 0, said: '0 ödül hazır' }} onPress={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Ödüller. Topla' }).querySelector('.gk-dot')).toBeNull();
  });

  it('wears a word of warning as a chip, and says it', () => {
    render(<MenuTile tile="center" glyph="bell" label="Bildirim Merkezi" hint="Uyarı al" status="Saldırı uyarısı gitmez" badge="Kasa boş" tone="warn" wide onPress={vi.fn()} />);
    const tile = screen.getByRole('button', { name: 'Bildirim Merkezi. Saldırı uyarısı gitmez. Kasa boş' });
    expect(tile).toHaveAttribute('data-tone', 'warn');
    expect(tile).toHaveAttribute('data-wide');
    expect(tile).toHaveTextContent('Saldırı uyarısı gitmez');
    expect(tile.querySelector('.gk-mtile__chip')).toHaveTextContent('Kasa boş');
  });
});

describe('a grid of tiles', () => {
  it('lays them two by two, an odd last one across the row', () => {
    const { container } = render(
      <TileGrid label="Yardım">
        <MenuTile tile="a" glyph="help" label="A" hint="a" onPress={vi.fn()} />
        <MenuTile tile="b" glyph="help" label="B" hint="b" onPress={vi.fn()} />
        <MenuTile tile="c" glyph="help" label="C" hint="c" onPress={vi.fn()} />
      </TileGrid>,
    );
    expect(container.querySelector('.gk-tiles')).toHaveAttribute('aria-label', 'Yardım');
    expect(container.querySelectorAll('.gk-mtile')).toHaveLength(3);
  });
});
