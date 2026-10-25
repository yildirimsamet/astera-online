import { describe, expect, it, vi } from 'vitest';
import { createFrameDriver } from '../../src/arena/driver.js';

describe('the arena owns its simulation clock', () => {
  it('steps at 30 Hz regardless of display refresh rate', () => {
    for (const hz of [60, 90, 120, 144]) {
      const step = vi.fn();
      const draw = vi.fn();
      const driver = createFrameDriver(step, draw);
      driver.advance(0);
      for (let frame = 1; frame <= hz * 2; frame++) driver.advance(frame * 1000 / hz);
      expect(step.mock.calls.length).toBe(60);
      const expected = hz === 120 ? 120 : hz === 144 ? 144 : hz * 2;
      expect(Math.abs(draw.mock.calls.length - expected)).toBeLessThanOrEqual(3);
    }
  });

  it('caps recovery after a stall and never runs backwards', () => {
    const step = vi.fn();
    const driver = createFrameDriver(step, vi.fn());
    driver.advance(100);
    driver.advance(5100);
    expect(step).toHaveBeenCalledTimes(5);
    driver.advance(5000);
    expect(step).toHaveBeenCalledTimes(5);
    driver.advance(5134);
    expect(step).toHaveBeenCalledTimes(6);
  });

  it('keeps simulation alive during GPU loss and skips rendering', () => {
    const step = vi.fn();
    const draw = vi.fn();
    const driver = createFrameDriver(step, draw);
    driver.advance(0, false);
    driver.advance(100, false);
    expect(step).toHaveBeenCalledTimes(3);
    expect(draw).not.toHaveBeenCalled();
    driver.advance(134, true);
    expect(step).toHaveBeenCalledTimes(4);
    expect(draw).toHaveBeenCalledTimes(1);
  });
});
