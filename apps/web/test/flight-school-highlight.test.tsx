import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SchoolHighlight } from '../src/onboarding/flightSchool/SchoolHighlight.js';
describe('moving lesson highlight', () => {
  it('tracks the real control without taking its pointer input', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => { frames.push(fn); return frames.length; });
    const target = document.createElement('button'); document.body.append(target);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(30, 120, 140, 44));
    const view = render(<SchoolHighlight targets={() => [target]} />);
    act(() => { frames[0]?.(0); });
    const frame = document.querySelector('[data-school-highlight]');
    expect(frame).toHaveStyle({ pointerEvents: 'none', width: '148px', height: '52px', visibility: 'visible' });
    view.unmount(); target.remove();
  });
});
