import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GameKitGallery } from '../../src/v2/gallery/GameKitGallery.js';
import { readLook } from '../../src/v2/gallery/LookSwitcher.js';

/**
 * THE LOOK, TRIED ON THE SAME SCREENS (owner 2026-11-12: the bluish panels, and "a little
 * too casual for a space game"). The gallery redraws every kit screen in another panel
 * colour (skin) and another design language (tone), so the owner compares them by
 * looking. Today's look stays the default and carries no mark.
 */

const root = document.documentElement;
const at = (search: string): void => { window.history.replaceState(null, '', `/v2-gallery.html${search}`); };

afterEach(() => {
  at('');
  root.removeAttribute('data-gk-tone');
  root.removeAttribute('data-gk-skin');
});

describe('reading the look from the address', () => {
  it('reads a tone and a skin', () => {
    expect(readLook('?view=ui-kit&tone=command&skin=graphite')).toEqual({ tone: 'command', skin: 'graphite' });
  });

  it("falls back to today's look for anything it does not know", () => {
    expect(readLook('?tone=loud&skin=pink')).toEqual({ tone: 'game', skin: 'navy' });
    expect(readLook('')).toEqual({ tone: 'game', skin: 'navy' });
  });
});

describe('the look switcher', () => {
  it('dresses the whole page in the look the address names, sheets included', () => {
    at('?view=ui-kit-launch&tone=command&skin=carbon');
    render(<GameKitGallery view="ui-kit-launch" />);
    expect(root).toHaveAttribute('data-gk-tone', 'command');
    expect(root).toHaveAttribute('data-gk-skin', 'carbon');
  });

  it("leaves today's look unmarked", () => {
    at('?view=ui-kit-launch');
    render(<GameKitGallery view="ui-kit-launch" />);
    expect(root).not.toHaveAttribute('data-gk-tone');
    expect(root).not.toHaveAttribute('data-gk-skin');
  });

  it('switches the look and keeps it in the address, so a shared link shows the same', () => {
    at('?view=ui-kit-launch');
    render(<GameKitGallery view="ui-kit-launch" />);
    fireEvent.click(screen.getByRole('button', { name: /Görünüm/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Grafit/ }));
    expect(root).toHaveAttribute('data-gk-skin', 'graphite');
    expect(window.location.search).toContain('skin=graphite');
    fireEvent.click(screen.getByRole('radio', { name: /Komuta/ }));
    expect(root).toHaveAttribute('data-gk-tone', 'command');
    expect(window.location.search).toContain('view=ui-kit-launch');
    fireEvent.click(screen.getByRole('radio', { name: /Lacivert/ }));
    expect(root).not.toHaveAttribute('data-gk-skin');
    expect(window.location.search).not.toContain('skin=');
  });

  it('takes its marks off the page when the gallery leaves', () => {
    at('?view=ui-kit-list&tone=command&skin=graphite');
    const { unmount } = render(<GameKitGallery view="ui-kit-list" />);
    unmount();
    expect(root).not.toHaveAttribute('data-gk-tone');
    expect(root).not.toHaveAttribute('data-gk-skin');
  });
});
