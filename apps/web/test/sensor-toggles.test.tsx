import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SensorToggles } from '../src/galaxy/SensorToggles.js';
import { RADAR_VISIBILITY, radarPosts, type ReachRing } from '../src/galaxy/SensorRings.js';
import i18n from '../src/i18n/index.js';

/**
 * TURNING THE BOUNDARIES OFF, AND ON. Owner instruction.
 *
 * The Telescope shell and the Radar volumes are the only things drawn BETWEEN the
 * camera and the worlds, and they are also where D124's principle lives — a rule
 * the player cannot see is not a rule. Both are true at once, and a switch is what
 * lets them both be true.
 *
 * HIDING IS AN ABSENCE OF DRAWING, NOT AN ABSENCE OF RULE: nothing here touches
 * what the server knows or what the fog permits.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const toggles = (over: Partial<Parameters<typeof SensorToggles>[0]> = {}) => {
  const props = {
    telescope: true,
    radar: true,
    onToggleTelescope: vi.fn(),
    onToggleRadar: vi.fn(),
    ...over,
  };
  render(<SensorToggles {...props} />);
  return props;
};

/** A commander who has never installed a Radar: the switch is not offered. */
const withoutRadar = () => {
  const props = { telescope: true, onToggleTelescope: vi.fn() };
  render(<SensorToggles {...props} />);
  return props;
};

describe('the sensor switches', () => {
  it('offers one switch per instrument', () => {
    toggles();
    expect(document.querySelector('[data-sensor-toggle="telescope"]')).toBeInTheDocument();
    expect(document.querySelector('[data-sensor-toggle="radar"]')).toBeInTheDocument();
  });

  /** `aria-pressed` carries the state, so a reader is never told to guess. */
  it('announces which instruments are being drawn', () => {
    toggles({ telescope: true, radar: false });
    expect(document.querySelector('[data-sensor-toggle="telescope"]'))
      .toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-sensor-toggle="radar"]'))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('reports each press to its own instrument', async () => {
    const props = toggles();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /telescope/i }));
    expect(props.onToggleTelescope).toHaveBeenCalledTimes(1);
    expect(props.onToggleRadar).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /radar/i }));
    expect(props.onToggleRadar).toHaveBeenCalledTimes(1);
  });

  /** The label says what the press will DO, not what the state currently is. */
  it('names the act rather than the state', () => {
    toggles({ radar: true });
    expect(screen.getByRole('button', { name: /hide radar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show radar/i })).toBeNull();
  });
});

/**
 * EVERY GREEN THING AT THE SAME FRACTION. Owner instruction: *"tarama çemberindeki
 * ve küredeki görselin hepsini oranlı bir şekilde → %70 daha saydam yap"*.
 *
 * One constant rather than eight hand-edited alphas, because the RELATIONSHIPS
 * between those alphas are what make the instrument read as one object — the wide
 * volume is deliberately fainter than the beam, and eight separate edits would
 * quietly lose that.
 */
describe('how loud the radar is allowed to be', () => {
  it('draws everything at three tenths of its tuned strength', () => {
    expect(RADAR_VISIBILITY).toBeCloseTo(0.3, 5);
  });
});

/**
 * THE RADAR SWITCH IS HARDWARE; THE TELESCOPE SWITCH IS NOT. Owner instruction.
 *
 * Every commander has a naked-eye neighbourhood whether or not they ever bought a
 * Telescope, so that boundary always exists and its switch always means something.
 * A Radar circle does not exist until the instrument does, and a control that
 * draws nothing when pressed teaches that the pair is decorative — which costs the
 * Telescope switch beside it as much as its own.
 */
describe('what the row offers', () => {
  it('always offers the Telescope switch', () => {
    withoutRadar();
    expect(document.querySelector('[data-sensor-toggle="telescope"]')).toBeInTheDocument();
  });

  it('offers no Radar switch to a commander who has no Radar', () => {
    withoutRadar();
    expect(document.querySelector('[data-sensor-toggle="radar"]')).toBeNull();
  });

  /** Absent rather than disabled: a greyed control is still a thing to reason about. */
  it('does not leave a dead Radar control behind', () => {
    withoutRadar();
    expect(screen.queryByRole('button', { name: /radar/i })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('offers both once a Radar is running', () => {
    toggles();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

/**
 * BOTH SWITCHES COVER EVERY WORLD. Owner instruction, and the third version of it.
 *
 * The first was one flag for the galaxy while only the ACTIVE world's radar was
 * drawn, so the two adjacent switches had two different reaches. The second keyed
 * visibility by world, which was consistent and still wrong: a player who takes
 * the glass off does not mean "off here". The switch is global again, and the half
 * that made version one wrong is fixed at the other end — every world that owns a
 * radar draws one.
 */
describe('whose circles a switch covers', () => {
  const post = (planetId: string, detect: number): ReachRing => ({
    planetId,
    at: { x: 0, y: 0, z: 0 },
    telescope: true,
    identify: 900,
    detect,
  });

  it('draws a radar for every world that has one', () => {
    const drawn = radarPosts([post('capital', 1300), post('colony', 700)]);
    expect(drawn.map((entry) => entry.key)).toEqual(['capital', 'colony']);
  });

  /** A naked-eye world owns no green circle and must not be given one. */
  it('draws none for a world with no radar', () => {
    expect(radarPosts([post('capital', 1300), post('bare', 0)]).map((e) => e.key))
      .toEqual(['capital']);
    expect(radarPosts([post('bare', 0)])).toEqual([]);
  });

  /** The sweep and the shell are one instrument stating one reach. */
  it('gives the circle the radar’s own detection radius', () => {
    const [drawn] = radarPosts([post('capital', 2200)]);
    expect(drawn!.radius).toBeGreaterThan(0);
    expect(radarPosts([post('near', 700)])[0]!.radius).toBeLessThan(drawn!.radius);
  });
});
