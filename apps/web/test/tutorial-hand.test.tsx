import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TutorialHand } from '../src/onboarding/TutorialHand.jsx';
import * as Gate from '../src/onboarding/Gate.jsx';
import { LoadingScreen } from '../src/shell/LoadingScreen.jsx';

describe('the supplied tutorial hand', () => {
  it('waits for the actual opening zoom to finish before revealing the hand', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    const target = document.createElement('span');
    target.setAttribute('data-academy-home-ready', 'false');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(187, 406, 1, 1));
    const view = render(<TutorialHand targets={() => [target]} />);
    const hand = view.container.querySelector('img')!.parentElement!;
    frames.shift()!(0);
    expect(hand.style.visibility).toBe('hidden');
    target.setAttribute('data-academy-home-ready', 'true');
    frames.shift()!(16);
    expect(hand.style.visibility).toBe('visible');
  });
  it('places the reward coach above the whole reward card, not above its Claim button', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    const reward = document.createElement('li');
    reward.className = 'plate';
    const target = document.createElement('button'); target.setAttribute('data-reward-claim', 'CORE:2'); reward.append(target);
    const bubble = document.createElement('section');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 280, 54, 40));
    vi.spyOn(reward, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, 190, 350, 145));
    vi.spyOn(bubble, 'getBoundingClientRect').mockReturnValue(new DOMRect(8, 8, 359, 80));
    render(<TutorialHand targets={() => [target]} bubble={{ current: bubble }} />);
    frames.shift()!(0);
    expect(Number.parseFloat(bubble.style.top) + 80).toBeLessThan(190);
  });
  it('hides the hand and ripples until the loading cover is gone', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    const target = document.createElement('button');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 200, 80, 40));
    const view = render(<><LoadingScreen caption="Claim your planet" /><TutorialHand targets={() => [target]} /></>);
    expect(view.container.querySelector('[data-loading-screen]')).toHaveClass('z-[70]');
    const hand = view.container.querySelector('img[src$="tutorial-hand-icon.png"]')!.parentElement!;
    frames.shift()!(0);
    expect(hand.style.visibility).toBe('hidden');
    view.rerender(<TutorialHand targets={() => [target]} />);
    frames.at(-1)!(16);
    expect(view.container.querySelector('img')!.parentElement!.style.visibility).toBe('visible');
  });
  it('leaves extra breathing room above the opening planet and reads layout before writing it', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    const target = document.createElement('span');
    target.setAttribute('data-academy-home', '');
    const bubble = document.createElement('section');
    const reads: string[] = [];
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() => { reads.push('target'); return new DOMRect(187, 406, 1, 1); });
    vi.spyOn(bubble, 'getBoundingClientRect').mockImplementation(() => { reads.push('bubble'); return new DOMRect(8, 8, 359, 140); });
    const view = render(<TutorialHand targets={() => [target]} bubble={{ current: bubble }} />);
    const hand = view.container.querySelector('img')!.parentElement!;
    vi.spyOn(hand.style, 'transform', 'set').mockImplementation(() => { reads.push('write'); });
    frames.shift()!(0);
    expect(Number.parseFloat(bubble.style.top)).toBe(218);
    expect(reads.indexOf('bubble')).toBeLessThan(reads.indexOf('write'));
  });
  it('does not chase its own bubble when pointing at an action inside it', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    const target = document.createElement('button');
    const bubble = document.createElement('section');
    bubble.append(target);
    bubble.style.top = '8px';
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 90, 90, 30));
    vi.spyOn(bubble, 'getBoundingClientRect').mockReturnValue(new DOMRect(8, 8, 359, 120));
    render(<TutorialHand targets={() => [target]} bubble={{ current: bubble }} />);
    frames.shift()!(0);
    expect(bubble.style.top).toBe('8px');
  });
  it('retires the dark spotlight while preserving the scroll-friendly click gate', () => {
    expect('Spotlight' in Gate).toBe(false);
    expect(Gate.useGate).toBeTypeOf('function');
    expect(Gate.useScrollIntoView).toBeTypeOf('function');
  });
  it('uses a border, not a hand or tap ripples, for an introduction', () => {
    const view = render(<TutorialHand kind="intro" targets={() => []} />);
    expect(view.container.querySelector('img')).toBeNull();
    expect(view.container.querySelector('[data-tap-ripple]')).toBeNull();
    expect(view.container.querySelector('[data-tutorial-intro]')).toHaveClass('border-crystal');
  });
  afterEach(() => vi.restoreAllMocks());
  it('places the bubble above its target without covering it', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    const target = document.createElement('button');
    const bubble = document.createElement('section');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 400, 80, 40));
    vi.spyOn(bubble, 'getBoundingClientRect').mockReturnValue(new DOMRect(8, 8, 359, 100));
    render(<TutorialHand targets={() => [target]} bubble={{ current: bubble }} />);
    frames.shift()!(0);
    expect(Number.parseFloat(bubble.style.top) + 100).toBeLessThan(400);
    expect(Number.parseFloat(bubble.style.top)).toBeGreaterThanOrEqual(8);
  });
  it('uses the owner asset, follows its target and never blocks a press', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const target = document.createElement('button');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 200, 80, 40));
    const view = render(<TutorialHand targets={() => [target]} />);
    const hand = view.container.querySelector('img')!;
    expect(hand).toHaveAttribute('src', '/assets/images/general/tutorial-hand-icon.png');
    expect(hand).toHaveAttribute('aria-hidden', 'true');
    expect(hand.className).toContain('pointer-events-none');
    expect(view.container.querySelector('svg')).toBeNull();
    expect(view.container.querySelectorAll('[data-tap-ripple]')).toHaveLength(2);
    expect(hand.className).toContain('animate-[academy-tap_1600ms_ease-in-out_infinite]');
    expect(hand.className).not.toContain('motion-reduce:');
    frames.shift()!(0);
    expect(hand.parentElement?.style.visibility).toBe('visible');
    expect(hand.parentElement?.style.transform).toContain('translate3d(');
    view.unmount();
    expect(cancel).toHaveBeenCalled();
  });
  it('hides while the target is missing or off screen', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    const target = document.createElement('button');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(-200, 200, 80, 40));
    const targets: Element[] = [];
    const view = render(<TutorialHand targets={() => targets} />);
    const hand = view.container.querySelector('img')!;
    frames.shift()!(0);
    expect(hand.parentElement?.style.visibility).toBe('hidden');
    targets.push(target);
    frames.shift()!(16);
    expect(hand.parentElement?.style.visibility).toBe('hidden');
  });
});

describe('the coach card while a sheet is open', () => {
  /**
   * THE CARD MAY NOT COVER THE THING IT IS ASKING FOR. Owner report.
   *
   * In the launch lessons the hand points at a control near the FOOT of a tall
   * sheet — Max on the last row, then Commit. The card places itself "above the
   * target" whenever there is room, and above a control at y=600 there is plenty:
   * it landed squarely on the ship picker, so the commander was told to choose a
   * fleet by a card sitting on the fleet.
   *
   * Inside a sheet the card goes to the top of the screen and stays there. The
   * sheet owns the bottom of the phone, the card owns the top, and neither moves
   * while the other is being read.
   */
  it('pins the coach to the top instead of dropping it onto the picker', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    const sheet = document.createElement('div');
    sheet.setAttribute('data-sheet-panel', '');
    const target = document.createElement('button');
    sheet.append(target);
    document.body.append(sheet);
    const bubble = document.createElement('section');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, 600, 340, 40));
    vi.spyOn(bubble, 'getBoundingClientRect').mockReturnValue(new DOMRect(8, 8, 359, 120));

    render(<TutorialHand targets={() => [target]} bubble={{ current: bubble }} />);
    frames.shift()!(0);

    expect(bubble.style.top).toBe('8px');
    sheet.remove();
  });
});

/**
 * A CONTROL BELOW THE FOLD IS A CONTROL NOBODY PRESSES. Owner instruction.
 *
 * The launch picker is taller than a phone, so the Max button the hand is pointing
 * at is regularly off the bottom of the sheet. The hand hides itself when its
 * target is out of view — correct, and useless on its own: the lesson then shows a
 * card telling the commander to press something, with nothing on screen to press.
 *
 * ONCE PER TARGET, WHICH IS THE SAME RULE `useScrollIntoView` ALREADY KEEPS. The
 * hand walks Max to Max to Commit, and each new target earns one scroll. It never
 * re-scrolls the same one, because a player who scrolled away to read the fuel
 * line is looking at something on purpose and the tutorial does not get to drag
 * them back every frame.
 */
describe('reaching a control the sheet is hiding', () => {
  const frameLoop = () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    return frames;
  };

  it('scrolls an off-screen target into view exactly once', () => {
    const frames = frameLoop();
    const target = document.createElement('button');
    const scroll = vi.fn();
    target.scrollIntoView = scroll;
    // Below the fold: jsdom's viewport is 768 tall.
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, 1200, 60, 36));

    render(<TutorialHand targets={() => [target]} />);
    frames.shift()!(0);
    expect(scroll).toHaveBeenCalledTimes(1);

    frames.shift()!(16);
    frames.shift()!(32);
    expect(scroll, 'the hand kept dragging the sheet back').toHaveBeenCalledTimes(1);
  });

  it('leaves a target that is already on screen where it is', () => {
    const frames = frameLoop();
    const target = document.createElement('button');
    const scroll = vi.fn();
    target.scrollIntoView = scroll;
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, 300, 60, 36));

    render(<TutorialHand targets={() => [target]} />);
    frames.shift()!(0);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('scrolls again when the hand moves on to the next control', () => {
    const frames = frameLoop();
    const first = document.createElement('button');
    const second = document.createElement('button');
    const a = vi.fn(); const b = vi.fn();
    first.scrollIntoView = a; second.scrollIntoView = b;
    vi.spyOn(first, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, 1200, 60, 36));
    vi.spyOn(second, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, 1400, 60, 36));

    let current = first;
    render(<TutorialHand targets={() => [current]} />);
    frames.shift()!(0);
    expect(a).toHaveBeenCalledTimes(1);

    current = second;
    frames.shift()!(16);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledTimes(1);
  });
});
