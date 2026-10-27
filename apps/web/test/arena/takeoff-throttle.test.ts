import { describe, expect, it } from 'vitest';
import { createControls, LANDING_THROTTLE, TAKEOFF_THROTTLE } from '../../src/arena/input.js';

/** Owner 2026-10-22: holding Kalk lifts off at a third of the throttle, not at half. */
describe('take-off throttle', () => {
  it('lifts off at 33 %, whatever the throttle was before landing', () => {
    expect(TAKEOFF_THROTTLE).toBe(0.33);
    const controls = createControls();
    controls.takeOff();
    expect(controls.throttle).toBe(0.33);
    controls.setThrottle(1); controls.stop(); controls.takeOff();
    expect(controls.throttle).toBe(0.33);
  });

  // Owner 2026-10-23 (80 m/s): the landing stop moved to 0.3, next to 0.33. A ship lifts off only
  // above the throttle it landed with, so Kalk must not snap onto the landing stop.
  it('lifts a ship that landed on the landing stop', () => {
    const controls = createControls();
    controls.setThrottle(LANDING_THROTTLE);
    expect(controls.throttle).toBe(LANDING_THROTTLE);
    controls.takeOff();
    expect(controls.throttle).toBeGreaterThan(LANDING_THROTTLE);
  });
});
