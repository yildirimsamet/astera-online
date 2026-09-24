import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StoreBar } from '../../src/v2/kit/StoreBar.js';

/**
 * THE STORE, IN CELLS, WITH THE SAFE PART BRACKETED. Owner, 2026-09-24: the segmented
 * bar had gone, and the safe part on the smooth bar that replaced it read as a square.
 * The cells are back (a fuel gauge is read by counting, not estimating), and the part a
 * raid cannot take is a bracket around its own cells with the Vault's shield over it.
 * No grey anywhere: an empty cell is the resource's own hue, faint.
 */

const bar = (props: Partial<Parameters<typeof StoreBar>[0]> = {}) => render(
  <StoreBar value={620} cap={1000} safe={350} tone="alloy" {...props} />,
).container;

const cells = (root: HTMLElement) => [...root.querySelectorAll('[data-cell]')];

describe('the store bar', () => {
  it('draws twelve cells and lights the share that is held', () => {
    const root = bar();
    expect(cells(root)).toHaveLength(12);
    expect(cells(root).filter((cell) => cell.hasAttribute('data-lit'))).toHaveLength(7);
  });

  it('paints held cells in the resource’s hue and empty ones in a faint shade of it, never grey', () => {
    const root = bar();
    expect(cells(root)[0]).toHaveClass('bg-v2-alloy');
    expect(cells(root)[11]).toHaveClass('bg-v2-alloy/15');
    expect(root.innerHTML).not.toMatch(/bg-v2-line/);
  });

  it('brackets the cells a raid cannot take, with the shield over them', () => {
    const root = bar();
    const bracket = root.querySelector('[data-safe]');
    expect(bracket).toHaveAttribute('data-safe-cells', '4');
    expect(root.querySelector('[data-safe-shield] svg')).not.toBeNull();
  });

  it('brackets at least one cell whenever anything is safe', () => {
    expect(bar({ safe: 10 }).querySelector('[data-safe]')).toHaveAttribute('data-safe-cells', '1');
  });

  it('draws no bracket where the Vault keeps nothing', () => {
    expect(bar({ safe: 0 }).querySelector('[data-safe]')).toBeNull();
  });

  it('closes a full store with a cap in the colour of a gap you can close (K2), never red', () => {
    const root = bar({ value: 1200, cap: 1000 });
    expect(cells(root).every((cell) => cell.hasAttribute('data-lit'))).toBe(true);
    expect(root.querySelector('[data-full-cap]')).toHaveClass('bg-v2-warn');
    expect(root.innerHTML).not.toMatch(/hostile/);
  });

  it('lights one cell for any stock at all — a little is not nothing', () => {
    const root = bar({ value: 169, cap: 4_500 });
    expect(cells(root).filter((cell) => cell.hasAttribute('data-lit'))).toHaveLength(1);
  });

  it('reads an empty or capless store as empty', () => {
    expect(cells(bar({ value: 0 })).some((cell) => cell.hasAttribute('data-lit'))).toBe(false);
    expect(cells(bar({ cap: 0 })).some((cell) => cell.hasAttribute('data-lit'))).toBe(false);
  });

  it('wears each resource’s own hue', () => {
    expect(cells(bar({ tone: 'crystal' }))[0]).toHaveClass('bg-v2-crystal');
    expect(cells(bar({ tone: 'deuterium' }))[0]).toHaveClass('bg-v2-deut');
  });
});
