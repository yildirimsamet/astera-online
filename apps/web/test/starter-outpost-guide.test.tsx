import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { FLAG_FLOOR, OutpostGuides, OutpostGuideTracker } from '../src/galaxy/OutpostGuide.js';
import { planetNodes } from '../src/galaxy/scene.js';
import i18n from '../src/i18n/index.js';

const frames = vi.hoisted(() => [] as ((state: { camera: THREE.Camera; size: { width: number; height: number } }) => void)[]);
vi.mock('../src/galaxy/visualFrame.js', () => ({
  useVisualFrame: (callback: (state: { camera: THREE.Camera; size: { width: number; height: number } }) => void) => { frames.push(callback); },
}));

/**
 * FINDING THE FIRST HUNT (plan §5.2, F4d). The ship's two first outposts fly a flag with their name over
 * them; when the camera has them off the screen, the flag waits at its edge and points the way. A tap
 * opens the outpost. Nothing marks any other outpost, and nothing says which guard holds which.
 */
const viewport = { width: 350, height: 812 };
const camera = () => {
  const view = new THREE.PerspectiveCamera(50, viewport.width / viewport.height, .1, 1000);
  view.position.set(0, 0, 10);
  view.lookAt(0, 0, 0);
  view.updateMatrixWorld();
  return view;
};
const outpost = (id: string, name: string, x: number, firstHunt: boolean): GalaxyPlanet => ({
  id, name, body: 'OUTPOST', position: { x, y: 0, z: 0 }, coreTier: 1, coreLevel: 1, intel: 'RESOLVED', state: { kind: 'NORMAL' },
  satellites: [], shielded: false, isSelf: false, kind: 'NEUTRAL', owner: '', ...(firstHunt ? { firstHunt: true } : {}),
});

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('the first hunt\'s flags', () => {
  it('carries the mark from the map onto the scene\'s outposts, and onto no other', () => {
    const [tevis, ash] = planetNodes([outpost('tevis', 'Tevis', 0, true), outpost('ash', 'Ash', 0, false)], true);
    expect(tevis?.firstHunt).toBe(true);
    expect(ash?.firstHunt).toBeUndefined();
  });

  it('flies one flag for each of the two, named, and opens the outpost on a tap', () => {
    const onSelect = vi.fn();
    const nodes = planetNodes([outpost('tevis', 'Tevis', 0, true), outpost('ash', 'Ash', 0, false), outpost('eldeth', 'Eldeth', 0, true)], true);
    render(<OutpostGuides nodes={nodes} elements={{ current: new Map() }} locks={{ current: new Map() }} onSelect={onSelect} />);
    const flags = screen.getAllByRole('button');
    expect(flags.map(flag => flag.textContent)).toEqual(['Tevis', 'Eldeth']);
    // Out in the scene: the hand points at it, and no frame is drawn round the world under it.
    expect(flags[0]?.hasAttribute('data-scene-mark')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Eldeth/ }));
    expect(onSelect).toHaveBeenCalledWith('eldeth');
  });

  // Owner play-through 2026-11-18: the hand pointed at the flag over the outpost, and a tap there fell
  // through to empty space, since the flag stands above the world, not on it. Where the hand points opens it.
  it('takes the tap where the hand points while its outpost is in view, as at the edge', () => {
    const css = readFileSync(join(import.meta.dirname, '../src/galaxy/outpostGuide.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map(([, selector = '', body = '']) => ({ selector: selector.trim(), body }));
    const dropped = rules.filter(rule => rule.selector.startsWith('.outpost-guide') && /pointer-events:\s*none/u.test(rule.body)
      && !/-mark|-flag|-bearing|-name/u.test(rule.selector));
    expect(dropped.map(rule => rule.selector)).toEqual([]);
  });

  it('flies over the outpost while it is in view, and waits at the edge pointing to it when it is not', () => {
    const near = document.createElement('button');
    const far = document.createElement('button');
    const nodes = planetNodes([outpost('near', 'Near', 0, true), outpost('far', 'Far', 100_000, true)], true);
    render(<OutpostGuideTracker nodes={nodes} elements={{ current: new Map([['near', near], ['far', far]]) }} locks={{ current: new Map() }} focusedId={null} />);
    frames.at(-1)!({ camera: camera(), size: viewport });
    expect(near.style.visibility).toBe('visible');
    expect(near.dataset.offscreen).toBe('false');
    expect(far.style.visibility).toBe('visible');
    expect(far.dataset.offscreen).toBe('true');
    const [x] = /translate3d\(([\d.]+)px/.exec(far.style.transform)?.slice(1).map(Number) ?? [];
    expect(x).toBeGreaterThan(viewport.width / 2);
  });

  // The objective line and the tab bar hold the bottom of a phone: a flag under them is a flag not seen.
  it('waits above the bottom of the screen, where the objective line and the tabs are', () => {
    const flag = document.createElement('button');
    const [node] = planetNodes([outpost('low', 'Low', 0, true)], true);
    render(<OutpostGuideTracker nodes={[{ ...node!, position: [0, -10_000, 0] }]} elements={{ current: new Map([['low', flag]]) }} locks={{ current: new Map() }} focusedId={null} />);
    frames.at(-1)!({ camera: camera(), size: viewport });
    expect(flag.dataset.offscreen).toBe('true');
    const [, y] = /translate3d\(([\d.]+)px,([\d.]+)px/.exec(flag.style.transform)?.slice(1).map(Number) ?? [];
    expect(y).toBeLessThanOrEqual(viewport.height - FLAG_FLOOR);
  });

  it('steps aside while its outpost is open, where the outpost\'s own label speaks', () => {
    const flag = document.createElement('button');
    const nodes = planetNodes([outpost('tevis', 'Tevis', 0, true)], true);
    render(<OutpostGuideTracker nodes={nodes} elements={{ current: new Map([['tevis', flag]]) }} locks={{ current: new Map() }} focusedId="tevis" />);
    frames.at(-1)!({ camera: camera(), size: viewport });
    expect(flag.style.visibility).toBe('hidden');
  });
});

/*
  Owner, phone playtest 2026-11-18 (item 14): the guide lit the outpost's name, but a tap on the world opens
  it. The world itself is marked: a lock drawn round its disc, which takes no tap, so the press lands on the
  world. The flag rides above the disc, clear of it, and only an outpost off the screen is pointed at by its flag.
*/
describe('the first hunt\'s lock on the world', () => {
  it('draws one lock for each of the two, a scene mark that takes no tap', () => {
    const nodes = planetNodes([outpost('tevis', 'Tevis', 0, true), outpost('ash', 'Ash', 0, false), outpost('eldeth', 'Eldeth', 0, true)], true);
    render(<OutpostGuides nodes={nodes} elements={{ current: new Map() }} locks={{ current: new Map() }} onSelect={vi.fn()} />);
    const locks = [...document.querySelectorAll('[data-outpost-planet]')];
    expect(locks.map(lock => lock.getAttribute('data-outpost-planet'))).toEqual(['tevis', 'eldeth']);
    expect(locks.every(lock => lock.hasAttribute('data-scene-mark') && lock.getAttribute('aria-hidden') === 'true')).toBe(true);
    const css = readFileSync(join(import.meta.dirname, '../src/galaxy/outpostGuide.css'), 'utf8');
    expect(css).toMatch(/\.outpost-lock\s*\{[^}]*pointer-events:\s*none/u);
  });

  it('sits on the world while it is in view, at least a finger wide, and is gone while it is off the screen or open', () => {
    const near = document.createElement('span');
    const far = document.createElement('span');
    const flag = document.createElement('button');
    const nodes = planetNodes([outpost('near', 'Near', 0, true), outpost('far', 'Far', 100_000, true)], true);
    const view = render(<OutpostGuideTracker nodes={nodes} elements={{ current: new Map([['near', flag]]) }} locks={{ current: new Map([['near', near], ['far', far]]) }} focusedId={null} />);
    frames.at(-1)!({ camera: camera(), size: viewport });
    expect(near.style.display).toBe('block');
    expect(near.style.transform).toBe(`translate3d(${String(viewport.width / 2)}px,${String(viewport.height / 2)}px,0) translate(-50%,-50%)`);
    const size = Number.parseFloat(near.style.width);
    expect(size).toBeGreaterThanOrEqual(44);
    expect(near.style.height).toBe(near.style.width);
    expect(far.style.display).toBe('none');
    // The flag stands clear above the lock, so the two never cover each other.
    const [lift] = /translateY\((-?[\d.]+)px\)/u.exec(flag.style.transform)?.slice(1).map(Number) ?? [];
    expect(lift).toBeLessThanOrEqual(-size / 2);
    view.rerender(<OutpostGuideTracker nodes={nodes} elements={{ current: new Map([['near', flag]]) }} locks={{ current: new Map([['near', near], ['far', far]]) }} focusedId="near" />);
    frames.at(-1)!({ camera: camera(), size: viewport });
    expect(near.style.display).toBe('none');
  });
});
