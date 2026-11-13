import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GalaxyReadout } from '../src/v2/hud/GalaxyCorners.js';

afterEach(cleanup);

describe('the map list aboard', () => {
  const counts = { worlds: 0, ships: 4, outposts: 2, fleetsAway: 0, rocks: 0, pirates: 0, wrecks: 0 };
  const targets = [{ kind: 'planet' as const, id: 'post-1', label: 'OP-3A1F', detail: 'Guarded' }];

  it('counts ships, not worlds, and names the outposts', () => {
    render(<GalaxyReadout counts={counts} targets={targets} onFocusTarget={vi.fn()} />);
    const caption = screen.getByTestId('view-caption').textContent;
    expect(caption).toMatch(/4 ships/);
    expect(caption).toMatch(/2 outposts/);
    expect(caption).not.toMatch(/world/);
  });

  it('flies to an outpost from the list', () => {
    const onFocus = vi.fn();
    render(<GalaxyReadout counts={counts} targets={targets} onFocusTarget={onFocus} />);
    fireEvent.click(screen.getByRole('button', { name: /2 outposts/ }));
    fireEvent.click(screen.getByRole('button', { name: /OP-3A1F/ }));
    expect(onFocus).toHaveBeenCalledWith({ kind: 'planet', id: 'post-1' });
  });

  it('leaves the main game\'s readout as it was', () => {
    render(<GalaxyReadout counts={{ worlds: 3, fleetsAway: 0, rocks: 0, pirates: 0, wrecks: 0 }} />);
    expect(screen.getByTestId('view-caption').textContent).toMatch(/3 worlds/);
  });
});
