import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LAUNCH_HAND_SELECTORS, academyGateSelectors, handPick } from '../src/onboarding/Academy.jsx';
import { QuantityStepper } from '../src/ui/QuantityStepper.js';

/**
 * THE HAND FILLS THE PICKER BEFORE IT POINTS AT THE BUTTON THAT SPENDS IT.
 *
 * Owner report: the launch lessons pointed straight at Commit. Commit is disabled
 * with nothing chosen, so the tutorial was pointing at a dead control — and once
 * a fleet WAS chosen by hand it was usually the wrong one, which the Academy's own
 * API refuses silently. Max is the only gesture that produces the fleet the lesson
 * expects, so Max is the only gesture the hand teaches.
 *
 * These tests exist because the mechanism is a CSS selector against a component in
 * another directory. Nothing in the type system connects them: rename a data
 * attribute in `QuantityStepper` and the hand silently points at nothing for the
 * rest of the tutorial. So the selector is run against the real control here.
 */
describe('the tutorial hand inside a launch sheet', () => {
  const picker = (value: number, max: number) => render(
    <div data-academy-launch>
      <QuantityStepper
        value={value} min={0} max={max} onChange={vi.fn()}
        decreaseLabel="fewer" increaseLabel="more" valueLabel="count"
        maxLabel="max" maxText="Max"
      />
    </div>,
  );

  it('matches the real Max control while its row still has room', () => {
    const view = picker(0, 3);
    expect(view.container.querySelectorAll(LAUNCH_HAND_SELECTORS[0])).toHaveLength(1);
  });

  it('drops a filled row, so the hand walks on instead of insisting', () => {
    /*
      `QuantityStepper` disables Max at the ceiling. That disabled flag IS the
      sequencer — there is no counter anywhere — so if the two ever disagree the
      hand either sticks on a full row forever or skips a row that still needs
      filling. Both end the lesson.
    */
    const view = picker(3, 3);
    expect(view.container.querySelectorAll(LAUNCH_HAND_SELECTORS[0])).toHaveLength(0);
  });

  it('reaches the commit button only after the rows, never before', () => {
    const max = LAUNCH_HAND_SELECTORS.indexOf(
      '[data-academy-launch] [data-count-max] button:not(:disabled)',
    );
    const commit = LAUNCH_HAND_SELECTORS.indexOf(
      '[data-academy-launch] [data-sheet-panel] > div:last-child button:last-child',
    );
    expect(max).toBeGreaterThanOrEqual(0);
    expect(commit).toBeGreaterThan(max);
  });
});

/**
 * THE GALAXY IS NEVER TAKEN AWAY, WHICH IS WHAT THE GATE KEPT DOING.
 *
 * Owner report, three lessons, one cause: *"filomuz korsanlara giderken, drill
 * asteroid'e giderken, filomuz gezegen'e savaş'a giderken galaxy ekranı
 * kilitlenmesin."* The gate refuses a press by stopping the event in the CAPTURE
 * phase on `document`, and `pointerdown` is on that list — so `OrbitControls`,
 * which starts its drag on `pointerdown` at the canvas, never heard one.
 *
 * The camera is not an activation. It is how the galaxy is looked at, and looking
 * is the one thing a tutorial should never confiscate — least of all while it is
 * telling the player to wait for a fleet they cannot see move.
 */
describe('what a lesson leaves pressable', () => {
  const state = (over: Partial<Parameters<typeof academyGateSelectors>[0]> = {}) => ({
    claiming: false, intro: false, telescope: false,
    id: 'pirate' as const, busy: false, isMenu: false, row: undefined,
    ...over,
  });

  it('keeps the camera live while a fleet is in the air, in all three missions', () => {
    for (const id of ['pirate', 'mine', 'raid'] as const) {
      const allowed = academyGateSelectors(state({ id, busy: true }));
      expect(allowed, `${id} froze the disc mid-flight`).toContain('canvas');
    }
  });

  it('shuts the camera again everywhere the lesson needs the screen to hold still', () => {
    /*
      OWNER INSTRUCTION, and the second half of it. The camera is opened when the
      ships leave and closed again immediately — not left open. Aiming is the case
      that proves why: the disc is flown onto the target so the subject sits in the
      middle of the screen, and `data-academy-tap-target` covers that middle. A
      camera the player could turn would slide the target out from under the hand.
    */
    for (const shape of [
      state(),
      state({ isMenu: true, id: 'production' }),
      state({ id: 'telescope' }),
      state({ row: 'CORE', id: 'core' }),
    ]) {
      expect(academyGateSelectors(shape), JSON.stringify(shape)).not.toContain('canvas');
    }
  });

  it('lights the tap target the hand points at while aiming', () => {
    expect(academyGateSelectors(state())).toContain('[data-academy-tap-target]');
  });

  it('still lets the claim dialog and the intro beats own the screen outright', () => {
    // These are the states with nothing to press: the gate refuses everything,
    // and that includes the disc, because the beat is a screen of its own.
    expect(academyGateSelectors(state({ claiming: true }))).toEqual([]);
    expect(academyGateSelectors(state({ intro: true }))).toEqual([]);
    expect(academyGateSelectors(state({ telescope: true }))).toEqual([]);
  });

  it('still lights the lesson target beside the camera', () => {
    expect(academyGateSelectors(state({ row: 'CORE', id: 'core' }))).toContain('#row-CORE');
    expect(academyGateSelectors(state())).toContain('[data-academy-launch]');
  });
});

/**
 * ONE LAUNCH LESSON, TWO TARGETS. Owner instruction: *"bu logic'in aynısı
 * gezegen'e saldıracagımız zaman açılan sheet'te de uygulanmalı."*
 *
 * It already is, and this is the test that keeps it that way. `AcademyLaunch`
 * wraps BOTH the pirate raid and the world raid in the same `data-academy-launch`,
 * and nothing about the hand or the gate looks at which lesson is running — so
 * filling the picker with Max, walking the rows, and scrolling a control back into
 * view are one behaviour rather than two copies that can drift apart.
 */
describe('the two launch lessons are the same lesson', () => {
  it('points the hand with selectors that name no lesson', () => {
    for (const selector of LAUNCH_HAND_SELECTORS) {
      expect(selector).not.toMatch(/pirate|raid|mine/);
    }
  });

  it('lights the same things at a pirate and at a world', () => {
    const shape = (id: 'pirate' | 'raid') => ({
      claiming: false, intro: false, telescope: false,
      id, busy: false, isMenu: false, row: undefined,
    });
    expect(academyGateSelectors(shape('pirate'))).toEqual(academyGateSelectors(shape('raid')));
  });
});

/**
 * THE HAND MUST BE WILLING TO POINT AT SOMETHING IT CANNOT SEE YET.
 *
 * Owner report, twice: the world-raid sheet never scrolled down to its Max
 * buttons. The scroll was there and correct — it just never ran, because the hand
 * would not select an off-screen control in the first place. It required a match
 * to be BOTH drawn and within the viewport, which is a contradiction on a picker
 * taller than the phone: the control that needs scrolling to is by definition the
 * one that fails the second test.
 */
describe('choosing which match the hand points at', () => {
  const node = (box: DOMRect) => {
    const el = document.createElement('button');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(box);
    return el;
  };

  it('prefers a match that is already on screen', () => {
    const below = node(new DOMRect(0, 1200, 60, 30));
    const visible = node(new DOMRect(0, 300, 60, 30));
    expect(handPick([below, visible], 768)).toBe(visible);
  });

  it('still points at one that is below the fold rather than giving up', () => {
    const below = node(new DOMRect(0, 1200, 60, 30));
    expect(handPick([below], 768), 'the hand refused the control it had to reach').toBe(below);
  });

  it('never points at something with no box at all', () => {
    const hidden = node(new DOMRect(0, 0, 0, 0));
    expect(handPick([hidden], 768)).toBeNull();
  });
});
