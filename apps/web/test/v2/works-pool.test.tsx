import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CollectState } from '../../src/lib/collect.js';
import { WorksPool, type WorksPoolProps } from '../../src/v2/hud/WorksPool.js';

/**
 * THE WORKS, AS A POOL THAT FILLS. Owner, 2026-09-24: on the Base the works were a pill
 * beside the store figures — it would not fit once the figures reach 10k and 100k, and
 * nothing said the works FILL, so nobody knew they had to come back and move the pool
 * into the store. The old "WORKS FULL · Collect" panel was the picture.
 *
 * Its own row: three vessels filling, when they will be full (the reason to return), what
 * is in them, and Collect. Full is warn — production has stopped, a gap you can close.
 */

const state = (over: Partial<CollectState> = {}): CollectState => ({
  waiting: 3_200,
  ripe: true,
  full: false,
  movable: 3_200,
  blocked: false,
  each: { alloy: 2_000, crystal: 1_200, deuterium: 0 },
  noRoom: [],
  ...over,
});

const pool = (over: Partial<WorksPoolProps> = {}) => {
  const props: WorksPoolProps = {
    state: state(),
    fill: { alloy: 0.5, crystal: 0.25, deuterium: 0 },
    fullInMinutes: 80,
    pending: false,
    onCollect: vi.fn(),
    onOpenBase: vi.fn(),
    ...over,
  };
  const view = render(<WorksPool {...props} />);
  return { ...view, props };
};

describe('the works pool', () => {
  it('is one named surface: the works', () => {
    pool();
    expect(screen.getByRole('region', { name: 'Works' })).toBeInTheDocument();
  });

  it('draws a vessel per resource, filled to its share', () => {
    const { container } = pool();
    const level = (resource: string) => container.querySelector(`[data-vessel="${resource}"] [data-level]`);
    expect(level('alloy')).toHaveStyle({ height: '50%' });
    expect(level('crystal')).toHaveStyle({ height: '25%' });
    expect(level('deuterium')).toHaveStyle({ height: '0%' });
  });

  it('says when it will be full — the reason to come back', () => {
    pool();
    expect(screen.getByRole('region', { name: 'Works' })).toHaveTextContent('full in 1h 20m');
  });

  it('says what is waiting, resource by resource, and the one the store cannot take in yellow', () => {
    const { container } = pool({ state: state({ noRoom: ['crystal'] }) });
    expect(container.querySelector('[data-works-resource="alloy"]')).toHaveTextContent('2.0k');
    expect(container.querySelector('[data-works-resource="crystal"]')).toHaveClass('text-v2-warn');
    expect(container.querySelector('[data-works-resource="deuterium"]')).toBeNull();
  });

  it('collects on its button', async () => {
    const { props } = pool();
    await userEvent.click(screen.getByRole('button', { name: /^Collect/ }));
    expect(props.onCollect).toHaveBeenCalledTimes(1);
  });

  it('holds while a collect is in flight', () => {
    pool({ pending: true });
    expect(screen.getByRole('button', { name: /^Collect/ })).toBeDisabled();
  });

  it('says a full pool has stopped production, in the colour of a gap, and beats its button', () => {
    pool({ state: state({ full: true }), fill: { alloy: 1, crystal: 0.6, deuterium: 0 } });
    const region = screen.getByRole('region', { name: 'Works' });
    expect(region).toHaveAttribute('data-full');
    expect(within(region).getByText('Full — production stopped')).toHaveClass('text-v2-warn');
    expect(screen.getByRole('button', { name: /collect now/i })).toHaveClass('animate-pulse');
    expect(region.innerHTML).not.toMatch(/hostile/);
  });

  it('explains itself while empty, and offers nothing to collect', () => {
    pool({ state: state({ waiting: 0, movable: 0, ripe: false, each: { alloy: 0, crystal: 0, deuterium: 0 } }), fill: { alloy: 0, crystal: 0, deuterium: 0 } });
    expect(screen.getByText('Production gathers here until you collect it')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Collect/ })).toBeDisabled();
  });

  it('says nothing about a time when nothing flows in', () => {
    pool({ fullInMinutes: null });
    expect(screen.getByRole('region', { name: 'Works' })).not.toHaveTextContent(/full in/);
  });

  it('says a full store before the tap, and opens the base to raise it', async () => {
    const { props } = pool({ state: state({ blocked: true, movable: 0, noRoom: ['alloy', 'crystal'] }) });
    expect(screen.queryByRole('button', { name: /^Collect/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Store full' }));
    expect(props.onOpenBase).toHaveBeenCalledTimes(1);
  });
});
