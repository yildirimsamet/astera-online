import { readFileSync } from 'node:fs';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOwnPress } from '../src/ui/kit/index.js';

/**
 * THE WHOLE CLASS, NOT THE ONE INSTANCE. D109a.
 *
 * The planet sheet closing itself was found by playing. The question that
 * matters more is the one the owner asked next — *"could this be somewhere else
 * we have not noticed, and what if we ship it like that?"* — because the bug is
 * not a mistake in one component. It is a property of the platform:
 *
 *   A synthesised click is delivered to whatever occupies the point at DISPATCH
 *   time, so ANY control that can MOUNT under a finger will receive the tail of
 *   the gesture that summoned it.
 *
 * In this interface that is every dismiss control and both controls on the focus
 * rail — the rail appears along the bottom edge the instant a world is selected,
 * and a world can be tapped there, so the stray click lands on CLEAR and
 * deselects the world the player just chose.
 *
 * The first block proves the primitive. The second is the audit, and it is the
 * one that has to fail when somebody adds a fifth overlay next year.
 */

function Probe({ onPress }: { onPress: () => void }) {
  const press = useOwnPress(onPress);
  return <button type="button" data-testid="control" {...press}>x</button>;
}

describe('a control answers only a press that began on it', () => {
  const show = (onPress: () => void) => render(<Probe onPress={onPress} />).getByTestId('control');

  /**
   * `detail: 1` is not decoration. jsdom's `fireEvent.click` defaults to
   * `detail: 0`, which is the signature of a KEYBOARD activation — so a test that
   * omits it is not simulating a stray tap-through at all, it is simulating the
   * one case the guard deliberately lets through, and it would pass against a
   * component with no guard whatsoever.
   */
  it('ignores a pointer click with no press of its own — the stray tap-through', () => {
    const onPress = vi.fn();
    fireEvent.click(show(onPress), { detail: 1 });
    expect(onPress).not.toHaveBeenCalled();
  });

  it('answers a press that began on it', () => {
    const onPress = vi.fn();
    const control = show(onPress);
    fireEvent.pointerDown(control);
    fireEvent.click(control, { detail: 1 });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not stay armed for the next stray click', () => {
    const onPress = vi.fn();
    const control = show(onPress);
    fireEvent.pointerDown(control);
    fireEvent.click(control, { detail: 1 });
    fireEvent.click(control, { detail: 1 });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  /**
   * KEYBOARD ACTIVATION IS NOT A POINTER PRESS AND MUST STILL WORK. Enter or
   * Space on a focused button fires a click with no `pointerdown` at all — the
   * exact shape being refused — so `detail === 0` is what tells them apart. Get
   * this wrong and the guard silently makes every one of these keyboard-dead.
   */
  it('still answers a keyboard activation, which carries no pointer press', () => {
    const onPress = vi.fn();
    fireEvent.click(show(onPress), { detail: 0 });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

/**
 * THE AUDIT. Every surface that can appear under a finger, named, with the source
 * checked for the guard.
 *
 * A grep rather than a render, deliberately: rendering each one needs its own
 * fixture and would test four components, while what has to hold is a PROPERTY of
 * the file — that its dismiss control routes through the primitive. A new overlay
 * is added by copying one of these, and copying one of these now copies the fix.
 */
describe('every surface that can mount under a finger is guarded', () => {
  it.each([
    ['the sheet scrim, which every decision surface floats on', 'src/ui/kit/Sheet.tsx'],
    ['the focus rail, which mounts on the bottom edge when a world is tapped', 'src/galaxy/FocusPanel.tsx'],
    ['the front door dialog, the first surface a stranger meets', 'src/screens/LandingScreen.tsx'],
    ['the season recap, which covers the screen when a result lands', 'src/screens/SeasonRecap.tsx'],
  ])('%s', (_name, file) => {
    expect(readFileSync(file, 'utf8')).toContain('useOwnPress');
  });
});
