import { afterEach, describe, expect, it } from 'vitest';
import { endJump, fromTheLanding, jumpHoldsSession, pressJump, releaseJump, revealJump, sceneOwnsSession, startJump, takeCues, type Jump } from '../src/starter/jump.js';

/**
 * THE JUMP OWNS THE SESSION FROM THE PRESS (playtest 2026-11-09). The server seats the new commander
 * before it answers the press, and says so on the stream: a client that moved on that word unmounted
 * the screen that starts the scene, and the player saw only its last seven seconds.
 */
const scene = (over: Partial<Jump> = {}) => ({ shardName: 'Vantage', hull: 'SPINE' as const, look: 'RENEWED' as const, world: null, landing: null, start: 0, ...over });

afterEach(() => { releaseJump(); endJump(); });

describe('who may move the session while the ship leaves', () => {
  it('holds it from the press until the answer, and lets go of a refused one', () => {
    expect(jumpHoldsSession()).toBe(false);
    pressJump();
    expect(jumpHoldsSession()).toBe(true);
    releaseJump();
    expect(jumpHoldsSession()).toBe(false);
  });

  it('keeps holding through the flight, and hands the move to the reveal', () => {
    pressJump();
    startJump(scene());
    expect(jumpHoldsSession()).toBe(true);
    revealJump();
    expect(jumpHoldsSession()).toBe(false);
  });

  it('covers the ship until the session stands on the new planet, and never covers a replay', () => {
    const flying = { ...scene(), stage: 'flight' as const, origin: 0 };
    const revealed = { ...flying, stage: 'reveal' as const };
    expect(sceneOwnsSession(flying, false, false)).toBe(true);
    expect(sceneOwnsSession(revealed, false, true)).toBe(true);
    expect(sceneOwnsSession(revealed, false, false)).toBe(false);
    expect(sceneOwnsSession({ ...revealed, replay: true }, false, true)).toBe(false);
    expect(sceneOwnsSession(null, false, true)).toBe(false);
  });
});

describe('what the scene sounds like', () => {
  it('lights the drive at the press, leaves, drops into the galaxy, and rings when the world forms', () => {
    startJump(scene());
    const heard = [0, 3, 7, 12, 19.5, 21, 25].flatMap(second => takeCues(second).map(cue => cue.sound));
    expect(heard).toEqual(['ignite', 'launch', 'warp', 'claim']);
  });

  it('gives a scene cut short only its own ending, once', () => {
    startJump(scene({ start: fromTheLanding }));
    expect(takeCues(fromTheLanding + 0.01)).toEqual([]);
    expect(takeCues(25).map(cue => cue.sound)).toEqual(['warp', 'claim']);
    expect(takeCues(25)).toEqual([]);
  });

  it('starts over for the next scene', () => {
    startJump(scene());
    takeCues(25);
    startJump(scene({ replay: true }));
    expect(takeCues(1).map(cue => cue.sound)).toEqual(['ignite']);
  });
});
