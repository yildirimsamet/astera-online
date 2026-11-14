import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GLYPH_IDS, Glyph } from '../../src/game-ui/icons.js';
import { GameKitGallery } from '../../src/v2/gallery/GameKitGallery.js';

/**
 * THE KIT'S GLYPHS. Every small mark (32 px and under) is one filled shape on a 24 grid,
 * drawn the way the owner approved on 2026-11-12: a dark outline and a light top over a
 * shaded bottom, so a flat silhouette reads as a game icon on a plate or a lit button.
 */

const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Every end point of a path, absolute; throws on a command with a missing or extra number. */
function endPoints(d: string): [number, number][] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const points: [number, number][] = [];
  let x = 0, y = 0, sx = 0, sy = 0, i = 0;
  if (!d.startsWith('M')) throw new Error('path must open with an absolute M');
  while (i < tokens.length) {
    const cmd = tokens[i++] ?? '';
    if (!/[a-zA-Z]/.test(cmd)) throw new Error(`number without a command at ${String(i)}`);
    const arity = ARITY[cmd.toUpperCase()];
    if (arity === undefined) throw new Error(`unknown command ${cmd}`);
    const nums: number[] = [];
    while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i] ?? '')) nums.push(Number(tokens[i++]));
    if (arity === 0) {
      if (nums.length) throw new Error('numbers after Z');
      x = sx; y = sy; continue;
    }
    if (nums.length === 0 || nums.length % arity !== 0) throw new Error(`${cmd} takes ${String(arity)} numbers, got ${String(nums.length)}`);
    const rel = cmd === cmd.toLowerCase();
    for (let k = 0; k < nums.length; k += arity) {
      const n = nums.slice(k, k + arity);
      const C = cmd.toUpperCase();
      if (C === 'H') x = (rel ? x : 0) + (n[0] ?? 0);
      else if (C === 'V') y = (rel ? y : 0) + (n[0] ?? 0);
      else { x = (rel ? x : 0) + (n[arity - 2] ?? 0); y = (rel ? y : 0) + (n[arity - 1] ?? 0); }
      if (C === 'M' && k === 0) { sx = x; sy = y; }
      points.push([x, y]);
    }
  }
  return points;
}

/** The share of the 24 box a path fills (even-odd), sampled on a 48 grid. A curve counts
 * by its chord, which only ever undercounts. */
function inkShare(d: string): number {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const rings: [number, number][][] = [];
  let ring: [number, number][] = [];
  let x = 0, y = 0, i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++] ?? '';
    const C = cmd.toUpperCase();
    const rel = cmd !== C;
    const arity = ARITY[C] ?? 0;
    const nums: number[] = [];
    while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i] ?? '')) nums.push(Number(tokens[i++]));
    if (C === 'Z') { rings.push(ring); ring = []; continue; }
    for (let k = 0; k < nums.length; k += arity) {
      const n = nums.slice(k, k + arity);
      if (C === 'H') x = (rel ? x : 0) + (n[0] ?? 0);
      else if (C === 'V') y = (rel ? y : 0) + (n[0] ?? 0);
      else { x = (rel ? x : 0) + (n[arity - 2] ?? 0); y = (rel ? y : 0) + (n[arity - 1] ?? 0); }
      if (C === 'M' && k === 0 && ring.length) { rings.push(ring); ring = []; }
      ring.push([x, y]);
    }
  }
  if (ring.length) rings.push(ring);
  let filled = 0;
  for (let row = 0; row < 48; row++) for (let col = 0; col < 48; col++) {
    const px = (col + 0.5) / 2, py = (row + 0.5) / 2;
    let inside = false;
    for (const r of rings) for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
      const [xa, ya] = r[a] ?? [0, 0], [xb, yb] = r[b] ?? [0, 0];
      if ((ya > py) !== (yb > py) && px < (xb - xa) * (py - ya) / (yb - ya) + xa) inside = !inside;
    }
    if (inside) filled++;
  }
  return filled / (48 * 48);
}

describe('the kit glyphs', () => {
  it.each([
    ['eye', 'spy probe, scouting'], ['colony', 'found a colony'], ['recall', 'call a fleet back'],
    ['escape', 'tactical retreat'], ['support', 'clan defence support'], ['debris', 'collect debris'],
    ['mine', 'asteroid mining'], ['asteroid', 'asteroid on the map'], ['radiation', 'radiation'],
    ['damaged', 'damaged hull'], ['repair', 'repair'], ['attack_up', 'attack raised'],
    ['speed_up', 'speed raised'], ['defense_down', 'defence lowered'], ['timed', 'a timed effect'],
    ['critical', 'critical hit'], ['fuel', 'fuel'], ['hull', 'hull strength'], ['target', 'range, target'],
    ['ranking', 'ranking'], ['history', 'history'], ['share', 'share'], ['siren', 'alarm'],
    ['settings', 'settings'], ['mail', 'mail'], ['chat', 'chat'], ['mute', 'mute a player (C2)'], ['block', 'block a player (C2)'], ['unlock', 'unlocked'],
    ['refresh', 'refresh'], ['zoom', 'zoom in'], ['banner', 'a clan with no flag yet'],
    ['class_skirmisher', 'Akıncı: an arrowhead'], ['class_lance', 'Mızrak: a spear'],
    ['class_bulwark', 'Sur: a walled shield'], ['class_support', 'Destek: a cross in a ring'],
  ])('has a %s glyph (%s)', (id) => {
    expect(GLYPH_IDS).toContain(id);
  });

  it('draws every glyph as one well-formed shape inside the 24 grid', () => {
    for (const id of GLYPH_IDS) {
      const { container, unmount } = render(<Glyph id={id} />);
      const d = container.querySelector('path')?.getAttribute('d') ?? '';
      const points = endPoints(d);
      expect(points.length, id).toBeGreaterThan(2);
      for (const [px, py] of points) {
        expect(px, `${id} x`).toBeGreaterThanOrEqual(0);
        expect(px, `${id} x`).toBeLessThanOrEqual(24);
        expect(py, `${id} y`).toBeGreaterThanOrEqual(0);
        expect(py, `${id} y`).toBeLessThanOrEqual(24);
      }
      unmount();
    }
  });

  it('keeps every glyph solid enough to read at 16 px: a fifth of its box in ink, not a hairline (owner 2026-11-12)', () => {
    // A row of bars reads by its gaps: the bay's three doors, speed_up's three chevrons.
    const rows = new Set(['bay', 'speed_up']);
    const faint = GLYPH_IDS.filter((id) => !rows.has(id)).map((id) => {
      const { container, unmount } = render(<Glyph id={id} />);
      const share = inkShare(container.querySelector('path')?.getAttribute('d') ?? '');
      unmount();
      return [id, share.toFixed(2)] as const;
    }).filter(([, share]) => Number(share) < 0.2);
    expect(faint).toEqual([]);
  });

  it('fills each glyph from its own two-tone paint: a light top over a shaded bottom', () => {
    const { container } = render(<><Glyph id="eye" /><Glyph id="eye" /></>);
    const svgs = [...container.querySelectorAll('svg')];
    const ids = svgs.map((svg) => {
      const gradient = svg.querySelector('linearGradient');
      expect(gradient).not.toBeNull();
      expect(gradient?.querySelector('.gk-glyph__hi')).not.toBeNull();
      expect(gradient?.querySelector('.gk-glyph__lo')).not.toBeNull();
      const id = gradient?.getAttribute('id') ?? '';
      expect(svg.querySelector('path')?.getAttribute('fill')).toBe(`url(#${id})`);
      return id;
    });
    expect(new Set(ids).size).toBe(2);
  });

  it('shows every glyph in the catalogue', () => {
    render(<GameKitGallery view="ui-kit" />);
    const sheet = screen.getByRole('group', { name: 'Glifler' });
    expect(within(sheet).getAllByTitle(/./)).toHaveLength(GLYPH_IDS.length);
  });
});
