import { describe, expect, it } from 'vitest';
import { fitDistance } from '../src/onboarding/prologue/shipFit.js';

const rad = (degrees: number): number => degrees * (Math.PI / 180);
const halfWide = (fov: number, aspect: number): number => Math.atan(Math.tan(rad(fov / 2)) * aspect);

// Play-test 2026-11-13: on the claim screen at 350 px the turning hull ran off the left edge.
describe('the distance the claim camera rests at', () => {
  it('keeps the whole turning hull inside a narrow phone, whichever way it faces', () => {
    const distance = fitDistance({ wide: 0.6, tall: 0.6, fov: 38, aspect: 350 / 760 });
    expect(0.6 / distance).toBeLessThanOrEqual(Math.sin(halfWide(38, 350 / 760)));
  });

  it('keeps it inside the height on a wide screen', () => {
    const distance = fitDistance({ wide: 0.6, tall: 0.6, fov: 38, aspect: 1440 / 800 });
    expect(0.6 / distance).toBeLessThanOrEqual(Math.sin(rad(19)) + 1e-9);
    expect(distance).toBeLessThan(fitDistance({ wide: 0.6, tall: 0.6, fov: 38, aspect: 350 / 760 }));
  });

  it('does not shrink a phone picture for room a phone has upward', () => {
    // The hull stands above the point the camera turns about; a tall phone has that room to spare.
    expect(fitDistance({ wide: 0.6, tall: 0.8, fov: 38, aspect: 350 / 760 })).toBe(fitDistance({ wide: 0.6, tall: 0.6, fov: 38, aspect: 350 / 760 }));
  });

  it('comes no closer than the camera may', () => {
    expect(fitDistance({ wide: 0.01, tall: 0.01, fov: 38, aspect: 1 })).toBe(1.4);
  });

  it('grows with the hull', () => {
    expect(fitDistance({ wide: 1, tall: 1, fov: 38, aspect: 0.5 })).toBeGreaterThan(fitDistance({ wide: 0.5, tall: 0.5, fov: 38, aspect: 0.5 }));
  });
});
