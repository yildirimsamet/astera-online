import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SchoolPointer } from '../src/onboarding/flightSchool/SchoolPointer.js';

const hand = vi.hoisted(() => ({ read: (): readonly Element[] => [], frame: (): DOMRect | null => null }));
vi.mock('../src/onboarding/TutorialHand.js', () => ({
  TutorialHand: ({ targets }: { targets: () => readonly Element[] }) => { hand.read = targets; return null; },
}));
vi.mock('../src/onboarding/flightSchool/SchoolHighlight.js', () => ({
  SchoolHighlight: ({ bounds }: { bounds: () => DOMRect | null }) => { hand.frame = bounds; return null; },
}));

/** Owner 2026-11-08: the sheet a tapped fleet opens slid over its mark, and the pointer stayed on top of the sheet. */
const rect = { x: 100, y: 500, left: 100, top: 500, right: 140, bottom: 540, width: 40, height: 40, toJSON: () => ({}) };
const box = rect as DOMRect;
let frame: FrameRequestCallback | null = null;
let now = 0;
const tick = () => { act(() => { now += 200; const run = frame; frame = null; run?.(now); }); };
const hit = (element: Element | null) => { document.elementFromPoint = vi.fn(() => element); };
const mount = () => {
  render(<>
    <div data-focus-rail="" data-testid="sheet" />
    <span data-scene-mark="" data-testid="mark" />
    <SchoolPointer targets={() => [screen.getByTestId('mark')]} />
  </>);
  screen.getByTestId('mark').getBoundingClientRect = () => box;
  tick(); tick(); tick();
};

beforeEach(() => {
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => { frame = run; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('points at a scene mark nothing covers', () => {
  hit(document.createElement('canvas'));
  mount();
  tick();
  expect(hand.read()).toHaveLength(1);
});

it('lets go of a scene mark a sheet has slid over', () => {
  hit(document.createElement('canvas'));
  mount();
  tick();
  expect(hand.read()).toHaveLength(1);
  hit(screen.getByTestId('sheet'));
  tick(); tick();
  expect(hand.read()).toHaveLength(0);
});

/** Owner 2026-11-08: the craft sits under the mark, and a hand that blinked each time the sky drifted was no guide. */
it('keeps pointing at a scene mark while the sky moves it', () => {
  hit(document.createElement('canvas'));
  mount();
  tick();
  const mark = screen.getByTestId('mark');
  for (const x of [103, 108, 112, 119]) {
    mark.getBoundingClientRect = () => ({ ...rect, x, left: x, right: x + 40 });
    tick();
    expect(hand.read()).toHaveLength(1);
  }
});

it('draws no frame round what is out in the scene', () => {
  hit(document.createElement('canvas'));
  mount();
  tick();
  expect(hand.read()).toHaveLength(1);
  expect(hand.frame()).toBeNull();
});

it('still frames a control on the screen', () => {
  render(<>
    <button type="button" data-testid="control" />
    <SchoolPointer targets={() => [screen.getByTestId('control')]} />
  </>);
  screen.getByTestId('control').getBoundingClientRect = () => box;
  tick(); tick(); tick(); tick();
  expect(hand.frame()).not.toBeNull();
});
