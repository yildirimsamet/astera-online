import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { HULLS } from '@astera/rules';
import { hpRadiationSourceSchema } from '../src/api/schemas.js';
import { radiationAtTarget } from '../src/lib/targetRadiation.js';
import { RadiationIndicator } from '../src/ui/RadiationIndicator.js';
import { render } from '@testing-library/react';

const MIN = 60000;
const target = { kind: 'PLANET' as const, id: 'target' };
const source = (id: string, rate: number, end: number | null, origin: 'ENVIRONMENT' | 'BOMB' = 'BOMB') =>
  hpRadiationSourceSchema.parse({ id, center: { x: 0, y: 0, z: 0 }, radius: 1000, mode: 'EMIT',
    origin, target, intensityHpPerMinute: rate, activeFrom: new Date(0), activeUntil: end === null ? null : new Date(end * MIN),
    totalCapFrom: new Date(0) });

it('keeps radiation visible when Aegis absorbs it and applies ship research only to the remaining damage', () => {
  const first = radiationAtTarget(target, [source('a', 9, 30)], 0, { RADIATION_SHIELDING: 2 }, 10);
  expect(first).toMatchObject({ rate: 9, protectedRate: 0, planetProtection: 10 });
  expect(first?.sources).toHaveLength(1);
  const stacked = radiationAtTarget(target, [source('a', 9, 30), source('b', 9, 40)], 0, { RADIATION_SHIELDING: 2 }, 10);
  expect(stacked).toMatchObject({ rate: 18, protectedRate: 5.44, planetProtection: 10 });
  const monument = { kind: 'MONUMENT' as const, id: target.id };
  expect(radiationAtTarget(monument, [{ ...source('a', 9, 30), target: monument }], 0, {}, 10)?.protectedRate).toBe(9);
});

it('shows the same capped instantaneous HP rate as gameplay, without merging independent expiries', () => {
  const state = radiationAtTarget(target, [source('l1', 9, 60), source('l2', 12.5, 80)], 30 * MIN, {});
  expect(state).toMatchObject({ rate: 21.5, protectedRate: 21.5, nextChangeAt: 60 * MIN, nextRate: 12.5 });
  expect(state!.sources).toHaveLength(2);
  expect(radiationAtTarget(target, [source('l1', 9, 60)], 60 * MIN, {})).toBeNull();
});

it('skips expiries hidden by the cap and returns to permanent environmental radiation after the last bomb', () => {
  const state = radiationAtTarget(target, [source('base', 12.5, null, 'ENVIRONMENT'),
    source('a', 18, 20), source('b', 18, 30), source('c', 18, 40), source('d', 18, 50)], 0, {});
  expect(state).toMatchObject({ rate: 50, nextChangeAt: 30 * MIN, nextRate: 48.5 });
  expect(radiationAtTarget(target, [source('base', 12.5, null, 'ENVIRONMENT'), source('a', 18, 20)], 20 * MIN, {}))
    .toMatchObject({ rate: 12.5, nextChangeAt: null, nextRate: null });
});

it('applies the commander shielding after the shared cap and never divides exposure by fleet size', () => {
  const clouds = [source('a', 40, 60), source('b', 40, 60)];
  const state = radiationAtTarget(target, clouds, 0, { RADIATION_SHIELDING: 4 });
  expect(state).toMatchObject({ rate: 50, protectedRate: 21 });
  expect(HULLS.CITADEL.hp).toBeGreaterThan(state!.protectedRate);
});

it('never borrows a neighbouring target’s radiation and retains per-source origin for the details', () => {
  const a = source('a', 9, 60, 'ENVIRONMENT');
  const b = { ...source('b', 18, 60), target: { ...target, id: 'neighbour' } };
  expect(radiationAtTarget(target, [a, b], 0, {})!.rate).toBe(9);
  expect(radiationAtTarget(target, [a], 0, {})!.sources[0]!.origin).toBe('ENVIRONMENT');
});

it('renders a compact meter with numeric HP/min and an accessible scale instead of relying on colour', () => {
  const state = radiationAtTarget(target, [source('a', 18, 60)], 0, {})!;
  const html = renderToStaticMarkup(<RadiationIndicator state={state} variant="bar" now={0} />);
  expect(html).toContain('role="meter"');
  expect(html).toContain('aria-valuenow="18"');
  expect(html).toContain('aria-valuemax="50"');
  expect(html).toContain('HP/min');
});

it('renders the selected-target dial with a real decrease timer and per-ship protection explanation', () => {
  const state = radiationAtTarget(target, [source('a', 18, 60)], 0, { RADIATION_SHIELDING: 4 })!;
  const html = renderToStaticMarkup(<RadiationIndicator state={state} variant="dial" now={0} />);
  expect(html).toContain('data-radiation-dial');
  expect(html).toContain('7.56');
  expect(html).toContain('1h 00m');
  expect(html).toContain('per ship');
});

it.each(['bar', 'dial'] as const)('colours the %s by total HP/min with yellow, orange and red bands', variant => {
  const base = radiationAtTarget(target, [source('a', 18, 60)], 0, {})!;
  const view = render(<RadiationIndicator state={base} variant={variant} now={0} />);
  for (const [rate, colour] of [
    [0, 'rgb(247, 205, 79)'], [9, 'rgb(247, 205, 79)'], [16, 'rgb(247, 205, 79)'],
    [17, 'rgb(255, 151, 66)'], [21.5, 'rgb(255, 151, 66)'], [32, 'rgb(255, 151, 66)'],
    [33, 'rgb(255, 86, 88)'], [39.5, 'rgb(255, 86, 88)'], [50, 'rgb(255, 86, 88)'],
  ] as const) {
    view.rerender(<RadiationIndicator state={{ ...base, rate, protectedRate: rate }} variant={variant} now={0} />);
    expect(view.container.firstElementChild, `${String(rate)} HP/min`).toHaveStyle({ color: colour });
    expect(view.getByRole('meter')).toHaveAttribute('aria-valuenow', String(rate));
  }
});

it.each([
  [16, 17, [247, 205, 79], [255, 151, 66]],
  [32, 33, [255, 151, 66], [255, 86, 88]],
] as const)('blends continuously between %s and %s HP/min without rounding the danger into a band', (from, _to, low, high) => {
  const base = radiationAtTarget(target, [source('a', 18, 60)], 0, {})!;
  const view = render(<RadiationIndicator state={base} variant="bar" now={0} />);
  let previous: readonly number[] = low;
  for (const fraction of [.001, .25, .5, .75, .999]) {
    const rate = from + fraction;
    view.rerender(<RadiationIndicator state={{ ...base, rate, protectedRate: rate }} variant="bar" now={0} />);
    const element = view.container.firstElementChild;
    if (!(element instanceof HTMLElement)) throw new Error('Missing radiation meter');
    const rgb = element.style.color.match(/\d+/g)?.map(Number);
    expect(rgb).toHaveLength(3);
    rgb!.forEach((channel, index) => {
      expect(channel).toBeGreaterThanOrEqual(Math.min(low[index]!, high[index]!));
      expect(channel).toBeLessThanOrEqual(Math.max(low[index]!, high[index]!));
      const direction = Math.sign(high[index]! - low[index]!);
      expect((channel - previous[index]!) * direction).toBeGreaterThanOrEqual(0);
    });
    if (fraction > .001 && fraction < .999) {
      expect(rgb).not.toEqual([...low]); expect(rgb).not.toEqual([...high]);
    }
    previous = rgb!;
  }
});

it('keeps the danger red at the total cap even when shielding reduces the commander’s own exposure to orange', () => {
  const state = radiationAtTarget(target, [source('a', 40, 60), source('b', 40, 60)], 0, { RADIATION_SHIELDING: 4 })!;
  const view = render(<RadiationIndicator state={state} variant="bar" now={0} />);
  expect(state).toMatchObject({ rate: 50, protectedRate: 21 });
  expect(view.container.firstElementChild).toHaveStyle({ color: 'rgb(255, 86, 88)' });
});

it('lists independent bomb timers and permanent base radiation in selected-target details, including stacks hidden by the cap', () => {
  const state = radiationAtTarget(target, [source('base', 12.5, null, 'ENVIRONMENT'),
    { ...source('first', 18, 20), level: 3 }, { ...source('second', 18, 40), level: 3 },
    { ...source('third', 9, 60), level: 1 }], 0, {})!;
  const view = render(<RadiationIndicator state={state} variant="dial" now={0} />);
  const details = view.container.querySelector('details');
  expect(details).not.toBeNull();
  expect(details!.hasAttribute('open')).toBe(false);
  expect(details).toHaveTextContent('Radiation sources');
  expect(details!.querySelectorAll('li')).toHaveLength(4);
  expect(details).toHaveTextContent('Base radiation');
  expect(details).toHaveTextContent('Persistent radiation');
  expect(details).toHaveTextContent('20m 00s remaining');
  expect(details).toHaveTextContent('40m 00s remaining');
  expect(details).toHaveTextContent('1h 00m remaining');
  expect(details).toHaveTextContent('Bomb · L1');
  expect(details!.textContent.match(/Bomb · L3/g)).toHaveLength(2);
  expect(details!.textContent.match(/18\.00 HP\/min/g)).toHaveLength(2);
  view.rerender(<RadiationIndicator state={state} variant="bar" now={0} />);
  expect(view.container.querySelector('details')).toBeNull();
});
