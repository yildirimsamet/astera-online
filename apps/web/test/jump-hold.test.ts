import { afterEach, describe, expect, it } from 'vitest';
import { CAMERA_SETTLED, REVEAL_SECOND, SCENE_SECONDS, currentJump, mayReveal, endJump, markGameDrawn, stillFade, stillScale, fromTheLanding, gameCovered, jumpHoldsSession, pressJump, releaseJump, revealJump, revealSecond, sceneOwnsSession, sceneSeconds, startJump, takeCues, type Jump } from '../src/starter/jump.js';

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

/**
 * THE JUMP IN THE GAME ITSELF (owner, 2026-11-09): "farklı bir animasyon filmi oynuyor gibi". The press
 * flies the ship out of the player's own galaxy view, so that view stays drawn through the flight; it is
 * covered only once the ship has reached its world and the session moves under a still of that frame.
 */
describe('the jump flown in the game', () => {
  const flying = { ...scene({ inGame: true }), stage: 'flight' as const, origin: 0 };
  const revealed = { ...flying, stage: 'reveal' as const };

  it('keeps the galaxy view drawn while the ship flies, and covers it once the session moves', () => {
    expect(gameCovered(flying, true)).toBe(false);
    expect(gameCovered(revealed, true)).toBe(true);
    expect(gameCovered(revealed, false)).toBe(false);
  });

  it('still covers the game for the scene played over it', () => {
    expect(gameCovered({ ...flying, inGame: false }, true)).toBe(true);
    expect(gameCovered(null, true)).toBe(false);
  });

  it('moves the session only after the camera stands where the main game opens, and ends after', () => {
    expect(revealSecond(flying)).toBeGreaterThan(CAMERA_SETTLED);
    expect(revealSecond(flying)).toBeLessThan(CAMERA_SETTLED + 0.5);
    expect(sceneSeconds(flying)).toBeGreaterThan(revealSecond(flying) + 2);
    expect(revealSecond({ ...flying, inGame: false })).toBe(REVEAL_SECOND);
    expect(sceneSeconds({ ...flying, inGame: false })).toBe(SCENE_SECONDS);
  });
});

/**
 * THE LAST FRAME HOLDS UNTIL THE GAME IS THERE (walk 2026-11-09): faded on a timer, it showed the main
 * game's loading cover. It waits for the main view's first full frame, then gives way.
 */
describe('the still over the moving session', () => {
  const reveal = revealSecond({ ...scene({ inGame: true }), stage: 'flight', origin: 0 });

  it('holds while the main view is still preparing', () => {
    expect(stillFade(reveal + 3, reveal, null)).toEqual({ opacity: 1, done: false });
  });

  it('gives way over a second once the main view has drawn', () => {
    expect(stillFade(reveal + 2, reveal, reveal + 2).opacity).toBe(1);
    expect(stillFade(reveal + 2.5, reveal, reveal + 2).opacity).toBeCloseTo(0.5, 1);
    expect(stillFade(reveal + 3, reveal, reveal + 2)).toEqual({ opacity: 0, done: true });
  });

  // Owner 2026-11-09: while the game prepares, the camera seems to keep closing on the world; it is
  // back at the main game's own framing by the time the still has faded, so nothing jumps.
  it('closes slowly on the world while it waits, and is back to the game\'s framing as it fades', () => {
    expect(stillScale(reveal, reveal, 1)).toBe(1);
    expect(stillScale(reveal + 3, reveal, 1)).toBeGreaterThan(1.02);
    expect(stillScale(reveal + 60, reveal, 1)).toBeLessThanOrEqual(1.08);
    expect(stillScale(reveal + 3, reveal, 0.5)).toBeLessThan(stillScale(reveal + 3, reveal, 1));
    expect(stillScale(reveal + 3, reveal, 0)).toBe(1);
  });

  it('holds a beat even when the main view was quick', () => {
    expect(stillFade(reveal + 0.5, reveal, reveal + 0.1).opacity).toBe(1);
  });

  // A slow phone takes the still a frame late: moving the session first left nothing on the screen.
  it('moves the session in the game only once the still is taken, or a second late without it', () => {
    const inGame = { ...scene({ inGame: true }), stage: 'flight' as const, origin: 0 };
    expect(mayReveal(inGame, reveal - 0.1, true)).toBe(false);
    expect(mayReveal(inGame, reveal, false)).toBe(false);
    expect(mayReveal(inGame, reveal, true)).toBe(true);
    expect(mayReveal(inGame, reveal + 1, false)).toBe(true);
    expect(mayReveal({ ...inGame, inGame: false }, REVEAL_SECOND, false)).toBe(true);
  });

  it('does not hold for ever', () => {
    expect(stillFade(reveal + 9.5, reveal, null).done).toBe(true);
  });

  it('notes the main view drawn only once the session has moved', () => {
    startJump(scene({ inGame: true }));
    markGameDrawn();
    expect(currentJump()?.drawnAt).toBeUndefined();
    revealJump();
    markGameDrawn();
    const drawn = currentJump()?.drawnAt;
    expect(drawn).toBeTypeOf('number');
    markGameDrawn();
    expect(currentJump()?.drawnAt).toBe(drawn);
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
