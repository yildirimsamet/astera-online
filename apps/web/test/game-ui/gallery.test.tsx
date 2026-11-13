import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameKitGallery, KIT_VIEWS } from '../../src/v2/gallery/GameKitGallery.js';

/**
 * THE KIT, COMPOSED. The gallery's screens are built only from kit parts; these
 * checks hold the parts together the way a player meets them: a ship added moves
 * the count on the launch button and the fuel it spends, and every screen draws.
 */

const tap = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

describe('the kit gallery', () => {
  it('draws every kit screen', () => {
    for (const view of KIT_VIEWS) {
      const { unmount, container } = render(<GameKitGallery view={view} />);
      expect(container.querySelector('.gk')).not.toBeNull();
      unmount();
    }
  });

  it('carries a ship added on a card to the launch button and the fuel line', () => {
    render(<GameKitGallery view="ui-kit-launch" />);
    const launch = screen.getByRole('button', { name: /SALDIR/ });
    expect(launch).toHaveTextContent('39 gemi');
    const fuel = screen.getByRole('group', { name: /Yakıt/ });
    const before = fuel.textContent;
    tap(screen.getByRole('button', { name: 'More Ok' }));
    expect(launch).toHaveTextContent('40 gemi');
    expect(fuel.textContent).not.toBe(before);
  });

  it('drives the picked bay with the slider in the bay layout', () => {
    render(<GameKitGallery view="ui-kit-launch" layout="bay" />);
    tap(screen.getByRole('button', { name: /Sur/, pressed: false }));
    const slider = screen.getByRole('slider', { name: 'Sur' });
    expect(slider).toHaveAttribute('aria-valuenow', '4');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(screen.getByRole('button', { name: /SALDIR/ })).toHaveTextContent('35 gemi');
  });

  it('shows the catalogue in the one chosen display face, with no font switch', () => {
    const { container } = render(<GameKitGallery view="ui-kit" />);
    expect(screen.queryByRole('group', { name: 'Başlık yazısı' })).toBeNull();
    expect(container.querySelector('[data-gk-font]')).toBeNull();
  });

  it('lets the rank-up moment be played and closed from the catalogue', () => {
    render(<GameKitGallery view="ui-kit" />);
    tap(screen.getByRole('button', { name: /Kademe atla/ }));
    const dialog = screen.getByRole('dialog', { name: /KADEME ATLADIN/ });
    expect(dialog).toHaveTextContent('Şeref +1');
    tap(screen.getByRole('button', { name: /TAMAM/ }));
    expect(screen.queryByRole('dialog', { name: /KADEME ATLADIN/ })).toBeNull();
  });
});
