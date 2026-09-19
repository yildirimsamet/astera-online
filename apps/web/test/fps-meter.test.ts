import { describe, expect, it } from 'vitest';
import { createFpsMeter, fpsMeterEnabled, setFpsMeterEnabled } from '../src/lib/fpsMeter.js';

/**
 * A SMALL FPS READOUT. Owner request, 2026-09-19. It counts the frames the galaxy
 * actually DRAWS — the disc renders on demand, so a still scene reads 24–30 by
 * design and a battle reads higher. Off unless the player turns it on.
 */
describe('the fps meter', () => {
  it('counts the frames drawn in the last second', () => {
    const meter = createFpsMeter();
    for (let i = 0; i <= 30; i += 1) meter.frame(i * (1000 / 30));
    expect(meter.read(1000)).toBe(30);
  });

  it('forgets frames older than a second', () => {
    const meter = createFpsMeter();
    for (let i = 0; i < 60; i += 1) meter.frame(i * (1000 / 60));
    // Two seconds later with nothing drawn: a still scene reads zero, not sixty.
    expect(meter.read(3000)).toBe(0);
  });

  it('is zero before anything is drawn', () => {
    expect(createFpsMeter().read(500)).toBe(0);
  });
});

describe('the fps meter setting', () => {
  it('is off until the player turns it on, and remembers the choice', () => {
    expect(fpsMeterEnabled()).toBe(false);
    setFpsMeterEnabled(true);
    expect(fpsMeterEnabled()).toBe(true);
    expect(globalThis.localStorage.getItem('astera.fps')).toBe('on');
    setFpsMeterEnabled(false);
    expect(fpsMeterEnabled()).toBe(false);
  });
});
