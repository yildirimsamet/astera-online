import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SurvivorBar } from '../src/ui/SurvivorBar.js';
import i18n from '../src/i18n/index.js';

/**
 * DID I GET AWAY WITH IT. Owner instruction.
 *
 * The report answered this with a four-column table — sent, lost, left — once per
 * hull, and the one question a player opens a report holding had to be assembled
 * out of three figures and compared against the row above. The bar is the question
 * already answered: a raid that cost half the fleet looks like half the fleet.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const widthOf = (view: ReturnType<typeof render>, part: string): number => {
  const element = view.container.querySelector<HTMLElement>(`[data-part="${part}"]`);
  expect(element, `no ${part} segment`).not.toBeNull();
  return Number.parseFloat(element!.style.width);
};

describe('the survivor bar', () => {
  it('splits the force into what lived and what died', () => {
    const view = render(<SurvivorBar sent={100} lost={40} />);
    expect(widthOf(view, 'alive')).toBeCloseTo(60, 1);
    expect(widthOf(view, 'lost')).toBeCloseTo(40, 1);
  });

  it('draws an untouched fleet as entirely alive', () => {
    const view = render(<SurvivorBar sent={20} lost={0} />);
    expect(widthOf(view, 'alive')).toBeCloseTo(100, 1);
    expect(widthOf(view, 'lost')).toBeCloseTo(0, 1);
  });

  it('draws an annihilated one as entirely lost', () => {
    const view = render(<SurvivorBar sent={20} lost={20} />);
    expect(widthOf(view, 'alive')).toBeCloseTo(0, 1);
    expect(widthOf(view, 'lost')).toBeCloseTo(100, 1);
  });

  /**
   * D27: ground defence salvages back. A defender told they lost seven Bastions
   * while four are still standing is being told two things by one screen — so
   * rebuilt is its own colour, and it is not folded into "never died".
   */
  it('draws what came back as its own thing', () => {
    const view = render(<SurvivorBar sent={10} lost={7} rebuilt={4} />);
    expect(widthOf(view, 'lost')).toBeCloseTo(70, 1);
    expect(widthOf(view, 'rebuilt')).toBeCloseTo(40, 1);
  });

  it('counts what came back among what is left', () => {
    const view = render(<SurvivorBar sent={10} lost={7} rebuilt={4} />);
    expect(view.container.querySelector('[data-alive]')).toHaveTextContent('7');
  });

  it('states the cost beside the shape, and only when there was one', () => {
    expect(render(<SurvivorBar sent={10} lost={3} />).container.querySelector('[data-lost]'))
      .toHaveTextContent('3');
    expect(render(<SurvivorBar sent={10} lost={0} />).container.querySelector('[data-lost]'))
      .toBeNull();
  });

  it('can hide repeated figures when a summary already prints them', () => {
    const view = render(<SurvivorBar sent={150} lost={35} showFigures={false} />);
    expect(view.container.querySelector('[data-alive]')).toBeNull();
    expect(view.container.querySelector('[data-lost]')).toBeNull();
    expect(view.container.querySelector('[role="img"]')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/150.*35.*115/),
    );
  });

  it('never draws more dead than went in', () => {
    const view = render(<SurvivorBar sent={5} lost={99} />);
    expect(widthOf(view, 'lost')).toBeCloseTo(100, 1);
  });

  it('survives an empty force without dividing by nothing', () => {
    const view = render(<SurvivorBar sent={0} lost={0} />);
    expect(Number.isFinite(widthOf(view, 'alive'))).toBe(true);
  });

  it('reads the whole thing out for a screen reader', () => {
    const view = render(<SurvivorBar sent={100} lost={40} />);
    const label = view.container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/100/);
    expect(label).toMatch(/40/);
    expect(label).toMatch(/60/);
  });
});
