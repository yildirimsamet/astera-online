import { VIEW, toWorld } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import {
  NAKED_EYE_COLOUR,
  RADAR_BURST_INTERVAL_SECONDS,
  RADAR_BURST_STAGGER_SECONDS,
  RADAR_BURST_WAVES,
  RADAR_BURST_WAVE_SECONDS,
  RADAR_VISIBILITY,
  RADAR_SWEEP_AREA_ALPHA,
  RADAR_SWEEP_HEAD_ALPHA,
  RADAR_SWEEP_SECONDS,
  TELESCOPE_GLASS_OPACITY,
  TELESCOPE_GRID_OPACITY,
  radarWaveState,
  radarSweepAngle,
  sensorShellColour,
  sensorVolumeScale,
} from '../src/galaxy/SensorRings.js';

/**
 * THE PICTURE AND THE SERVER SHARE ONE SENSOR SURFACE.
 *
 * Detection is spherical in authoritative game coordinates, while the galaxy
 * stretches height for readability. The exact rendered image is therefore an
 * ellipsoid; a uniform Three.js sphere silently classified high/low contacts
 * differently from the server.
 */
describe('sensor volume geometry', () => {
  const onRenderedSurface = (
    centre: { x: number; y: number; z: number },
    point: { x: number; y: number; z: number },
    gameRadius: number,
  ): number => {
    const c = toWorld(centre);
    const p = toWorld(point);
    const scale = sensorVolumeScale(gameRadius / VIEW.scale);
    return ((p[0] - c[0]) / scale[0]) ** 2
      + ((p[1] - c[1]) / scale[1]) ** 2
      + ((p[2] - c[2]) / scale[2]) ** 2;
  };

  it('maps a pure vertical server radius onto the ellipsoid surface', () => {
    expect(onRenderedSurface(
      { x: 100, y: -20, z: 40 },
      { x: 100, y: 30, z: 40 },
      50,
    )).toBeCloseTo(1, 12);
  });

  it('maps a diagonal server radius onto the same surface', () => {
    expect(onRenderedSurface(
      { x: -70, y: 10, z: 400 },
      { x: -40, y: 50, z: 400 },
      50,
    )).toBeCloseTo(1, 12);
  });

  it('uses the shared view exaggeration instead of restating it', () => {
    const scale = sensorVolumeScale(10);
    expect(scale).toEqual([10, 10 * VIEW.verticalExaggeration, 10]);
  });
});

describe('sensor surface treatment', () => {
  it('distinguishes free naked-eye reach from an installed Telescope', () => {
    expect(sensorShellColour(false)).toBe(NAKED_EYE_COLOUR);
    expect(sensorShellColour(false)).toBe('#c8ced3');
    expect(sensorShellColour(true)).not.toBe(sensorShellColour(false));
  });

  it('locks the owner-approved quieter glass and construction lines', () => {
    expect(TELESCOPE_GLASS_OPACITY).toBe(0.375);
    expect(TELESCOPE_GRID_OPACITY).toBe(0.15);
  });

  it('broadcasts a three-wave Radar burst inside the requested 10–15 second rhythm', () => {
    expect(RADAR_BURST_INTERVAL_SECONDS).toBeGreaterThanOrEqual(10);
    expect(RADAR_BURST_INTERVAL_SECONDS).toBeLessThanOrEqual(15);
    expect(RADAR_BURST_WAVES).toBe(3);
    expect(
      RADAR_BURST_WAVE_SECONDS + RADAR_BURST_STAGGER_SECONDS * (RADAR_BURST_WAVES - 1),
    ).toBeLessThan(RADAR_BURST_INTERVAL_SECONDS);
  });

  it('starts at the planet, expands from the wide Radar radius and dissolves at its edge', () => {
    const radius = 38;
    expect(radarWaveState(0, 0, radius)).toEqual({ scale: 0.001, opacity: 0 });

    const middle = radarWaveState(RADAR_BURST_WAVE_SECONDS / 2, 0, radius);
    expect(middle.scale).toBeCloseTo(radius / 2, 6);
    expect(middle.opacity).toBeGreaterThan(0);

    const after = radarWaveState(RADAR_BURST_WAVE_SECONDS, 0, radius);
    expect(after).toEqual({ scale: 0.001, opacity: 0 });
  });

  it('turns the military scan through one full circle at a steady rate', () => {
    expect(RADAR_SWEEP_SECONDS).toBeGreaterThanOrEqual(5);
    expect(radarSweepAngle(0)).toBeCloseTo(0, 8);
    expect(radarSweepAngle(RADAR_SWEEP_SECONDS / 2)).toBeCloseTo(Math.PI, 8);
    expect(radarSweepAngle(RADAR_SWEEP_SECONDS)).toBeCloseTo(0, 8);
  });
});

/**
 * THE SWEEP TURNS ON THE CURRENT MERGED CIRCLE. Owner report: *"radarın
 * tarama animasyonu çalışmıyor, o yeşil tarama çizgisi gezegen etrafında
 * dönmüyor"*.
 *
 * The integrator was always correct. What was wrong was the RADIUS: the disc was
 * drawn at the wide sense reach — most of the galaxy — so the beam's angular
 * travel anywhere near the planet was a few pixels a second and the only part of
 * it visibly moving sat out at a rim that is usually off screen.
 *
 * D126's two products are provisionally merged. The sweep and remaining shell
 * therefore share one radius; this suite holds only the motion treatment.
 */
describe('the sweep angle', () => {
  it('completes exactly one turn per sweep period', () => {
    expect(radarSweepAngle(0)).toBeCloseTo(0, 6);
    expect(radarSweepAngle(RADAR_SWEEP_SECONDS / 4)).toBeCloseTo(Math.PI / 2, 6);
    expect(radarSweepAngle(RADAR_SWEEP_SECONDS / 2)).toBeCloseTo(Math.PI, 6);
  });

  it('wraps rather than growing without bound over a long session', () => {
    expect(radarSweepAngle(RADAR_SWEEP_SECONDS * 1000 + RADAR_SWEEP_SECONDS / 4))
      .toBeCloseTo(Math.PI / 2, 4);
  });

  /**
   * THE INTEGRATOR THE FRAME LOOP USES, replayed. It converts the held angle back
   * to elapsed seconds, adds the frame delta and re-projects — so an accumulated
   * drift here would be a sweep that slowly changes speed.
   */
  it('advances by one frame without drifting', () => {
    const step = (angle: number, delta: number): number =>
      radarSweepAngle((angle / (Math.PI * 2)) * RADAR_SWEEP_SECONDS + delta);
    let angle = 0;
    for (let frame = 0; frame < 60; frame += 1) angle = step(angle, 1 / 60);
    // One second of frames is one second of the period.
    expect(angle).toBeCloseTo((1 / RADAR_SWEEP_SECONDS) * Math.PI * 2, 5);
  });
});

/**
 * THREE BUDGETS, ONE INSTRUMENT, AND EACH SPLIT CAME FROM A REPORT.
 *
 * The graticule dropped to `RADAR_VISIBILITY` on "make the circle and the sphere
 * 70% more transparent" — and dimming the beam with it left nothing to notice, so
 * the moving part was priced separately. Raising the moving part as ONE number
 * then inflated the wedge behind the head into a solid green triangle over a
 * quarter of the galaxy: *"yeşil tarama alanı çok parlak"*. So the head and its
 * trail are priced separately too.
 *
 * The head says where the beam is. The trail only says which way it is going, and
 * it covers most of a quadrant — a hint at that size is plenty.
 */
describe('how the radar spends its brightness', () => {
  /**
   * TWO OWNER-TUNED DIALS, AND WHAT THESE TESTS ARE ACTUALLY FOR.
   *
   * The absolute weights are the owner's. They have been set three times with the
   * disc in front of them — split apart, halved, then taken down together by about
   * an order of magnitude — and every revision broke the previous version of this
   * suite, which asserted a DERIVATION (`0.30 * 0.85 * …`) that stopped being true
   * the moment somebody looked at the screen and turned a knob. A test that fails
   * because a dial moved is a test that has to be edited to say the same thing
   * again, which is how a suite stops being read.
   *
   * So nothing here re-derives a figure. What is held is the SHAPE, because both
   * ways it can be lost have already been reported once each:
   *
   *   · A TRAIL THAT CREEPS BACK UP drowns the worlds it is drawn over. The wedge
   *     is most of a quadrant, so it is the half that costs real estate — reported
   *     twice, with a screenshot.
   *   · A HEAD THAT SINKS INTO ITS OWN TRAIL stops reading as something that turns
   *     — reported as *"hâlâ gerçek bir radar gibi dönmüyor"*.
   *
   * Both bounds are one-sided on purpose. Raising the head relative to the trail
   * is the direction that FIXES the second failure, and lowering the trail is the
   * direction that fixes the first; a test that fought either would be defending a
   * number rather than the design.
   */
  it('keeps the beam clearly brighter than its own trail', () => {
    expect(RADAR_SWEEP_HEAD_ALPHA).toBeGreaterThanOrEqual(RADAR_SWEEP_AREA_ALPHA * 4);
  });

  /**
   * The wedge covers a quadrant of the disc, so it is measured against the STATIC
   * instrument budget rather than in the abstract: whatever the rings and
   * crosshair are allowed to be, the moving smear over the worlds must stay a
   * small fraction of it.
   */
  it('keeps the swept wedge a small fraction of the static graphics', () => {
    expect(RADAR_SWEEP_AREA_ALPHA).toBeLessThanOrEqual(RADAR_VISIBILITY * 0.08);
  });

  /** Both alphas are real ink: a zero here is an instrument that stopped drawing. */
  it('leaves both halves of the sweep visible at all', () => {
    expect(RADAR_SWEEP_AREA_ALPHA).toBeGreaterThan(0);
    expect(RADAR_SWEEP_HEAD_ALPHA).toBeGreaterThan(0);
  });
});
