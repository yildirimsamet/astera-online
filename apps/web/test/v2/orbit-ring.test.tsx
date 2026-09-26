import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { satelliteSlots } from '@astera/rules';
import { PlanetHero } from '../../src/ui/PlanetHero.js';
import { satelliteLabel } from '../../src/i18n/names.js';
import i18n from '../../src/i18n/index.js';
import { planetView } from '../fixtures.js';

/**
 * THE ORBIT IS ON THE WORLD. Spec E5 (the mock's Base): "yörüngede uydu yuvaları
 * (dolu, boş, kilitli + açılacağı Çekirdek)".
 *
 * The four satellites share one scarce set of sockets, and D108 kept that rack above
 * every category so the trade is seen before any tab is opened. The hero is above
 * every tab, so the sockets move onto its ring: a satellite where one is fitted, an
 * empty ring where one could be, a lock with the Core level that opens it where the
 * Core is still too low — and one line under the world that says it in words.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const slots = (): Element[] => [...document.querySelectorAll('[data-orbit-slot]')];

describe('the orbit on the world', () => {
  it('draws every socket the Core can ever open', () => {
    render(<PlanetHero planet={planetView({ buildings: { CORE: 9 }, orbit: ['DERRICK'] })} />);
    expect(slots()).toHaveLength(satelliteSlots(Number.MAX_SAFE_INTEGER));
    expect(slots().map((slot) => slot.getAttribute('data-orbit-slot'))).toEqual(['held', 'open', 'locked', 'locked']);
  });

  it('names the satellite a socket holds', () => {
    render(<PlanetHero planet={planetView({ buildings: { CORE: 9 }, orbit: ['DERRICK'] })} />);
    expect(slots()[0]).toHaveAccessibleName(new RegExp(satelliteLabel('DERRICK')));
  });

  it('puts the Core level that opens it on a locked socket, read off the rule', () => {
    render(<PlanetHero planet={planetView({ buildings: { CORE: 9 }, orbit: [] })} />);
    const [, , third, fourth] = slots();
    const opensAt = (index: number) => {
      let level = 0;
      while (satelliteSlots(level) <= index) level += 1;
      return level;
    };
    expect(third).toHaveTextContent(String(opensAt(2)));
    expect(fourth).toHaveTextContent(String(opensAt(3)));
  });

  it('states the sockets used and where the next one opens', () => {
    render(<PlanetHero planet={planetView({ buildings: { CORE: 9 }, orbit: ['DERRICK'] })} />);
    const line = screen.getByTestId('orbit-line');
    expect(line).toHaveTextContent('1/2');
    expect(line).toHaveTextContent('+1 at Core L15');
  });

  /** A full orbit is a ceiling the Core raises: a gap in yellow, never a threat's red (K2). */
  it('says a full orbit is full, in the colour of a gap', () => {
    render(<PlanetHero planet={planetView({ buildings: { CORE: 6 }, orbit: ['DERRICK'] })} />);
    const full = screen.getByText('orbit is full');
    expect(full).toHaveClass('text-v2-warn');
  });

  it('counts a Core level already in the queue, as the rack did', () => {
    render(<PlanetHero planet={planetView({
      buildings: { CORE: 8 },
      orbit: [],
      queues: {
        CONSTRUCTION: [{
          id: 'core-9',
          queue: 'CONSTRUCTION',
          slot: 0,
          kind: 'BUILDING',
          subject: 'CORE',
          count: 1,
          cost: { alloy: 1, crystal: 0, deuterium: 0 },
          startedAt: new Date(Date.now() - 60_000),
          finishesAt: new Date(Date.now() + 60_000),
        }],
        YARD: [],
      },
    })} />);
    expect(slots().filter((slot) => slot.getAttribute('data-orbit-slot') === 'open')).toHaveLength(2);
  });

  it('draws the first socket open at Core 1 and names Core 9 for the next', () => {
    render(<PlanetHero planet={planetView({ buildings: { CORE: 1 }, orbit: [] })} />);
    expect(slots().map((slot) => slot.getAttribute('data-orbit-slot'))).toEqual(['open', 'locked', 'locked', 'locked']);
    expect(screen.getByTestId('orbit-line')).toHaveTextContent('+1 at Core L9');
  });

  it('shows the gifted Core 2 Uplink occupying the ordinary first socket', () => {
    render(<PlanetHero planet={planetView({ buildings: { CORE: 2 }, orbit: ['UPLINK'], orbitSlots: 1 })} />);
    expect(slots().map((slot) => slot.getAttribute('data-orbit-slot'))).toEqual(['held', 'locked', 'locked', 'locked']);
    expect(screen.getByTestId('orbit-line')).toHaveTextContent('1/1');
    expect(screen.getByTestId('orbit-line')).toHaveTextContent('+1 at Core L9');
  });

  it.each([
    [8, 9],
    [14, 15],
    [17, 18],
  ])('names Core %i’s next orbit slot at Core %i', (core, next) => {
    render(<PlanetHero planet={planetView({ buildings: { CORE: core }, orbit: [] })} />);
    expect(screen.getByTestId('orbit-line')).toHaveTextContent(`+1 at Core L${String(next)}`);
  });

  it('shows a stored fourth satellite as inactive until Core 18', () => {
    render(<PlanetHero planet={planetView({
      buildings: { CORE: 17 },
      orbit: ['UPLINK', 'FOUNDRY', 'DERRICK', 'BEACON'],
      effectiveOrbit: ['UPLINK', 'FOUNDRY', 'DERRICK'],
      orbitSlots: 3,
    })} />);
    expect(slots().map((slot) => slot.getAttribute('data-orbit-slot')))
      .toEqual(['held', 'held', 'held', 'inactive']);
    expect(slots()[3]).toHaveAccessibleName(/Beacon.*Core L18/i);
    expect(screen.getByTestId('orbit-line')).toHaveTextContent('3/3');
  });

  it('shows that fourth satellite active when Core 18 is queued', () => {
    const now = new Date();
    render(<PlanetHero planet={planetView({
      buildings: { CORE: 17 },
      orbit: ['UPLINK', 'FOUNDRY', 'DERRICK', 'BEACON'],
      effectiveOrbit: ['UPLINK', 'FOUNDRY', 'DERRICK'],
      orbitSlots: 3,
      queues: {
        CONSTRUCTION: [{
          id: 'core-18', queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject: 'CORE', count: 1,
          cost: { alloy: 1, crystal: 0, deuterium: 0 }, startedAt: now,
          finishesAt: new Date(now.getTime() + 60_000),
        }],
        YARD: [],
      },
    })} />);
    expect(slots().map((slot) => slot.getAttribute('data-orbit-slot')))
      .toEqual(['held', 'held', 'held', 'held']);
    expect(screen.getByTestId('orbit-line')).toHaveTextContent('4/4');
  });
});
