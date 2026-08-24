import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Meter } from '../src/ui/Meter.js';
import { Sheet } from '../src/ui/Sheet.js';
import { PlanetHero } from '../src/ui/PlanetHero.js';
import { planetView } from './fixtures.js';

describe('semantic state without colour collisions', () => {
  it('keeps a full resource in its own hue and closes it with a physical cap', () => {
    const view = render(<Meter value={100} cap={100} tone="alloy" />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('data-full', 'true');
    expect(view.container.querySelector('[data-meter-cap]')).not.toBeNull();
    for (const cell of [...meter.querySelectorAll(':scope > span:not([data-meter-cap])')]) {
      expect(cell).toHaveClass('bg-alloy');
      expect(cell).not.toHaveClass('bg-threat');
    }
  });

  it('keeps crystal full distinct from a hostile warning too', () => {
    const view = render(<Meter value={100} cap={100} tone="crystal" />);
    expect(view.container.querySelector('.bg-crystal')).not.toBeNull();
    expect(view.container.querySelector('.bg-threat')).toBeNull();
  });

  it('gives Deuterium the same storage meter language', () => {
    const view = render(<Meter value={75} cap={100} tone="deuterium" cells={8} />);
    expect(view.container.querySelectorAll('.bg-deuterium')).toHaveLength(6);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '75');
  });
});

describe('the strategic plate stays restrained', () => {
  it('does not restore the former full-card alarm reds', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    expect(css).not.toContain('#a6172e');
    expect(css).not.toContain('#5f0d1d');
    expect(css).not.toContain('rgb(31 5 12 / 96%)');
  });
});

describe('mobile access', () => {
  it('leaves browser zoom available', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toContain('maximum-scale=1');
    expect(html).not.toContain('user-scalable=no');
  });

  it('exposes one dismiss control for a sheet, not its backdrop as a second Close', () => {
    const onClose = vi.fn();
    const view = render(<Sheet title="Intel" onClose={onClose}>Body</Sheet>);
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1);
    const backdrop = view.container.querySelector('button[aria-hidden="true"]');
    expect(backdrop).toHaveAttribute('tabindex', '-1');
  });
});

describe('the planet remains the visual subject', () => {
  it('keeps the locked commander-first title rule while restoring planet art in the embedded sheet', () => {
    const view = render(<PlanetHero planet={planetView()} compact />);
    expect(view.container.querySelector('[data-planet-subject]')).not.toBeNull();
    expect(screen.getByText('Kestrel-12')).toBeVisible();
    expect(view.container.querySelector('[data-planet-subject] img')).not.toBeNull();
  });
});
