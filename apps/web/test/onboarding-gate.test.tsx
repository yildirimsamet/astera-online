import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { START, START_BUILDINGS } from '@astera/rules';
import type { Preview } from '../src/api/schemas.js';
import { useGate } from '../src/onboarding/Gate.jsx';
import {
  BEATS,
  beatAchieved,
  beatAllowsWorld,
  currentBeat,
  type BeatId,
  type BeatState,
} from '../src/onboarding/script.js';
import { build, openWorld, upgrade } from '../src/onboarding/world.js';

/**
 * THE GUIDED HALF OF THE REHEARSAL. D56.
 *
 * Two claims, and both of them are about what a stranger CANNOT do. The script
 * only ever advances on the thing the beat asked for, and while a beat is running
 * nothing but its own target answers a press. A tutorial that can be finished by
 * pressing the wrong control leaves an instruction on screen describing a world
 * that has moved on, which is worse than no tutorial at all.
 */

const reserved: Preview['reserved'] = {
  id: 'reserved',
  name: 'Kestrel-12',
  slotIndex: 12,
  position: { x: 0, y: 0, z: 0 },
};

const previewOf = (): Preview => ({
  season: {
    seasonId: 's',
    shard: 'EU-1',
    shardName: 'Vantage',
    seed: 1,
    status: 'live',
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 1000),
    playerCap: 50,
    players: 2,
  },
  galaxy: { you: { planetId: 'reserved', playerId: 'reserved' }, planets: [] },
  traffic: { contacts: [] },
  reserved,
  shard: { code: 'EU-1', name: 'Vantage', planets: 2, capacity: 50, online: 1 },
});

const stateOf = (over: Partial<BeatState> = {}): BeatState => ({
  world: openWorld(previewOf()),
  focus: null,
  done: new Set<BeatId>(),
  ...over,
});

const beatNamed = (id: BeatId) => BEATS.find((b) => b.id === id)!;

/* ── the script only moves when the thing happens ───────────── */

describe('the beat script', () => {
  it('starts on the wide view and ends on the claim', () => {
    expect(currentBeat(stateOf()).id).toBe('wide');
    expect(BEATS[BEATS.length - 1]?.id).toBe('claim');
  });

  it('runs its beats in one fixed order, with no branch to skip past one', () => {
    expect(BEATS.map((b) => b.id)).toEqual([
      'wide',
      'yours',
      'briefing',
      'core',
      'refinery',
      'extractor',
      'fleet',
      'fog',
      'claim',
    ]);
  });

  it('advances only when the beat before it is finished', () => {
    const done = new Set<BeatId>(['wide']);
    expect(currentBeat(stateOf({ done })).id).toBe('yours');
    done.add('yours');
    expect(currentBeat(stateOf({ done })).id).toBe('briefing');
    done.add('briefing');
    expect(currentBeat(stateOf({ done })).id).toBe('core');
  });

  /**
   * SELECTING YOUR OWN WORLD OPENS THE PLANET SURFACE AND CLEARS THE SELECTION.
   *
   * So the beat that follows `yours` must be one that WANTS that surface open — a
   * beat wanting the disc would close it in the same tick the player opened it,
   * which is exactly what happened and read as a menu that would not stay up.
   */
  it('follows the world-tapping beat with one that keeps the panel open', () => {
    const after = BEATS[BEATS.findIndex((b) => b.id === 'yours') + 1];
    expect(after?.panel).toBe('planet');
  });

  /**
   * The opening grant is arithmetic, and so is the script: the Core has to move
   * before the Refinery may, so each of the three beats reads the staged order it
   * is about rather than pretending the durable level already changed.
   */
  it('finishes each upgrade beat on its staged order, and not before', () => {
    let world = openWorld(previewOf());
    expect(beatAchieved(beatNamed('core'), stateOf({ world }))).toBe(false);

    world = upgrade(world, 'CORE');
    expect(beatAchieved(beatNamed('core'), stateOf({ world }))).toBe(true);
    expect(beatAchieved(beatNamed('refinery'), stateOf({ world }))).toBe(false);

    world = upgrade(world, 'REFINERY');
    expect(beatAchieved(beatNamed('refinery'), stateOf({ world }))).toBe(true);
  });

  it('finishes the fleet beat on two committed ships, never on one', () => {
    let world = openWorld(previewOf());
    world = upgrade(world, 'CORE');
    world = upgrade(world, 'REFINERY');
    world = upgrade(world, 'EXTRACTOR');

    world = build(world, 'WASP', 1);
    expect(beatAchieved(beatNamed('fleet'), stateOf({ world }))).toBe(false);

    world = build(world, 'WASP', 1);
    expect(beatAchieved(beatNamed('fleet'), stateOf({ world }))).toBe(true);
  });

  /**
   * A world tapped is not a world FOUND. The `yours` beat is about the visitor's
   * own planet and nothing else can finish it.
   */
  it('will not finish the yours beat on somebody else’s world', () => {
    const other = stateOf({ focus: { kind: 'planet', id: 'somebody' } });
    expect(beatAchieved(beatNamed('yours'), other)).toBe(false);

    const own = stateOf({ focus: { kind: 'planet', id: 'reserved' } });
    expect(beatAchieved(beatNamed('yours'), own)).toBe(true);
  });

  it('will not finish the fog beat on the visitor’s own world', () => {
    const own = stateOf({ focus: { kind: 'planet', id: 'reserved' } });
    expect(beatAchieved(beatNamed('fog'), own)).toBe(false);

    const other = stateOf({ focus: { kind: 'planet', id: 'somebody' } });
    expect(beatAchieved(beatNamed('fog'), other)).toBe(true);
  });

  it('is not finished by focusing something that is not a world at all', () => {
    const rock = stateOf({ focus: { kind: 'asteroid', index: 3 } });
    expect(beatAchieved(beatNamed('yours'), rock)).toBe(false);
    expect(beatAchieved(beatNamed('fog'), rock)).toBe(false);
  });

  it('opens the surface each beat is about, and lands the panel on the right group', () => {
    expect(beatNamed('wide').panel).toBeNull();
    expect(beatNamed('core').panel).toBe('planet');
    expect(beatNamed('core').group).toBe('grow');
    expect(beatNamed('fleet').group).toBe('reach');
    expect(beatNamed('fog').panel).toBeNull();
  });

  /**
   * The buildings are exactly what the server writes, and the grant is the
   * arithmetic the beats teach — `START`, not the `PLANET_START` the real planet
   * is created with. D58 puts a cushion on top of the latter deliberately; see
   * `openWorld`. If either half drifts, a beat starts describing a planet the
   * player is not looking at.
   */
  it('rehearses the opening the beats teach', () => {
    const world = openWorld(previewOf());
    expect(world.buildings).toEqual(START_BUILDINGS);
    expect(world.alloy).toBe(START.alloy);
  });
});

/* ── which worlds a beat will accept a tap on ───────────────── */

describe('the worlds a beat leaves live', () => {
  it('leaves none live while the galaxy is only being looked at', () => {
    const allow = beatAllowsWorld(beatNamed('wide'), stateOf());
    expect(allow('reserved')).toBe(false);
    expect(allow('somebody')).toBe(false);
  });

  it('leaves only the visitor’s own world live while it is being looked for', () => {
    const allow = beatAllowsWorld(beatNamed('yours'), stateOf());
    expect(allow('reserved')).toBe(true);
    expect(allow('somebody')).toBe(false);
  });

  it('leaves everybody else live while the fog is being explained', () => {
    const allow = beatAllowsWorld(beatNamed('fog'), stateOf());
    expect(allow('reserved')).toBe(false);
    expect(allow('somebody')).toBe(true);
  });

  it('leaves none live while a panel is open over the disc', () => {
    for (const id of ['core', 'refinery', 'extractor', 'fleet'] as const) {
      const allow = beatAllowsWorld(beatNamed(id), stateOf());
      expect(allow('reserved')).toBe(false);
      expect(allow('somebody')).toBe(false);
    }
  });
});

/* ── the gate itself ────────────────────────────────────────── */

function Harness({
  selector,
  onRefused,
  active = true,
}: {
  selector: string;
  onRefused: () => void;
  active?: boolean;
}) {
  const target = useRef(() => document.querySelector(selector));
  return (
    <div>
      <Gated target={target.current} active={active} onRefused={onRefused} />
      <button type="button" id="allowed" onClick={() => { pressed.push('allowed'); }}>
        allowed
      </button>
      <button type="button" id="forbidden" onClick={() => { pressed.push('forbidden'); }}>
        forbidden
      </button>
      <div data-beat-card>
        <button type="button" onClick={() => { pressed.push('card'); }}>
          skip
        </button>
      </div>
    </div>
  );
}

function Gated({
  target,
  active,
  onRefused,
}: {
  target: () => Element | null;
  active: boolean;
  onRefused: () => void;
}) {
  const targets = useRef(() => {
    const el = target();
    return el ? [el] : [];
  });
  useGate(targets.current, active, onRefused);
  return null;
}

let pressed: string[] = [];

describe('the gate', () => {
  const setup = (over: { active?: boolean } = {}) => {
    pressed = [];
    const onRefused = vi.fn();
    render(<Harness selector="#allowed" onRefused={onRefused} {...over} />);
    return { onRefused, user: userEvent.setup() };
  };

  it('lets the beat’s own target through', async () => {
    const { user, onRefused } = setup();
    await user.click(screen.getByRole('button', { name: 'allowed' }));
    expect(pressed).toEqual(['allowed']);
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('refuses everything else, and says so once per press', async () => {
    const { user, onRefused } = setup();
    await user.click(screen.getByRole('button', { name: 'forbidden' }));
    expect(pressed).toEqual([]);
    expect(onRefused).toHaveBeenCalledTimes(1);
  });

  /**
   * THE WAY OUT IS NEVER GATED. A player who cannot find what the beat is asking
   * for has to be able to leave, or a guided opening becomes a locked door.
   */
  it('always lets the beat card through, whatever else is locked', async () => {
    const { user, onRefused } = setup();
    await user.click(screen.getByRole('button', { name: 'skip' }));
    expect(pressed).toEqual(['card']);
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('locks nothing at all when it is not active', async () => {
    const { user } = setup({ active: false });
    await user.click(screen.getByRole('button', { name: 'forbidden' }));
    expect(pressed).toEqual(['forbidden']);
  });

  /**
   * A gate that outlived its beat would lock the real game. The listener is torn
   * down with the component, and this is the assertion that it actually is.
   */
  it('stops locking the moment it is unmounted', async () => {
    const onRefused = vi.fn();
    pressed = [];
    const view = render(<Harness selector="#allowed" onRefused={onRefused} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'forbidden' }));
    expect(pressed).toEqual([]);

    view.unmount();
    render(
      <button type="button" onClick={() => { pressed.push('after'); }}>
        after
      </button>,
    );
    await user.click(screen.getByRole('button', { name: 'after' }));
    expect(pressed).toEqual(['after']);
  });

  /**
   * A selector that matches nothing must not silently open the gate. It happens —
   * a row that has not rendered yet, a sheet mid-animation — and failing open
   * would let a press land on something the beat never meant to offer.
   */
  it('fails closed when its target is not on screen', async () => {
    pressed = [];
    const onRefused = vi.fn();
    render(<Harness selector="#nothing-like-this" onRefused={onRefused} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'allowed' }));
    expect(pressed).toEqual([]);
    // And the way out still works, so nobody is trapped by the failure.
    await user.click(screen.getByRole('button', { name: 'skip' }));
    expect(pressed).toEqual(['card']);
  });
});
