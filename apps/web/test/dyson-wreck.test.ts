import { describe, expect, it } from 'vitest';
import { shellGroups, shellLook } from '../src/galaxy/DysonShells.js';
import { isWrecked, planetNodes } from '../src/galaxy/scene.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';

/**
 * A WORLD THAT HAS TAKEN A DEATH STAR WEARS A DEAD STRUCTURE. D121a, owner call.
 *
 * The strike lowers the Core (D113), so the ladder usually takes a ring — or the
 * whole shell — away on its own. This is the case it does not: a commander deep
 * enough into the game that their Core is still above `FIRST_LEVEL` after a rocket
 * lands. Their rings survive the thing that wrecked the world under them, and a
 * megastructure turning serenely in full colour over a crater is the disc saying
 * nothing happened.
 *
 * WHAT IS ASSERTED HERE is `shellLook` and `shellGroups`, which between them hold
 * the whole decision: what a wreck looks like, and the fact that it cannot be
 * drawn with its healthy neighbours. Everything else in that component is
 * instanced-mesh plumbing only a GPU can confirm, and `tools/visual.mjs` is where
 * that is checked.
 */

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'w1',
  name: 'Quillon-116',
  owner: 'johnnylesh',
  position: { x: 0, y: 0, z: 0 },
  coreTier: 5,
  coreLevel: 12,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
  satellites: [],
  shielded: false,
  isSelf: false,
  ...over,
});

const nodesOf = (...planets: GalaxyPlanet[]) => planetNodes(planets);

describe('a dyson shell over a world in recovery', () => {
  /**
   * Recovery is set in exactly one place on the server — `applyDeathStarStrike` —
   * so this state means a rocket landed and nothing else. Neither of the other two
   * public states is damage: PROTECTED is the opposite of it.
   */
  it('reads a struck world, and only a struck world, as wrecked', () => {
    const [struck] = nodesOf(world({ state: { kind: 'RECOVERY', until: new Date() } }));
    const [safe] = nodesOf(world({ state: { kind: 'NORMAL' } }));
    const [held] = nodesOf(world({ state: { kind: 'PROTECTED', until: new Date() } }));

    expect(isWrecked(struck!)).toBe(true);
    expect(isWrecked(safe!)).toBe(false);
    expect(isWrecked(held!)).toBe(false);
  });

  /**
   * A server that predates the field reads as a world in one piece. That is the
   * safe way round: a live structure drawn on a wreck is a cosmetic miss, while a
   * dead one on a healthy world would tell the galaxy a commander had been hit
   * when they had not.
   */
  it('treats a payload with no state at all as intact', () => {
    const [unknown] = nodesOf(world({}));
    expect(isWrecked(unknown!)).toBe(false);
  });

  /* ── what it looks like ───────────────────────────────────── */

  it('stops the structure turning', () => {
    expect(shellLook(3, true).turning).toBe(false);
    expect(shellLook(3, false).turning).toBe(true);
  });

  /**
   * THE NEON IS THE SEAM AND THE RIM, and both have to go together. A colour
   * switched off while the ring kept turning — or a ring stopped while it still
   * glowed — would read as a rendering fault rather than as a wreck, which is why
   * one function answers all three questions.
   */
  it('takes the power out of the seams entirely', () => {
    expect(shellLook(3, true).seam).toBe(0);
    expect(shellLook(3, false).seam).toBeGreaterThan(0);
  });

  it('leaves the silhouette colourless rather than tinted', () => {
    const dead = shellLook(3, true);
    const live = shellLook(3, false);
    // Grey: the three channels are equal to within a rounding, so no hue survives.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(dead.rim.slice(i, i + 2), 16));
    expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThan(20);
    // And the live rim really is tinted, or the assertion above proves nothing.
    const [lr, lg, lb] = [1, 3, 5].map((i) => parseInt(live.rim.slice(i, i + 2), 16));
    expect(Math.max(lr!, lg!, lb!) - Math.min(lr!, lg!, lb!)).toBeGreaterThan(20);
  });

  /**
   * The rim is not decoration — it is the only thing separating a few thousand
   * dark triangles from the nebula behind them. A wreck recedes; it does not
   * vanish, which would be worse than leaving it lit.
   */
  it('dims the silhouette without deleting it', () => {
    expect(shellLook(3, true).rimAlpha).toBeGreaterThan(0);
    expect(shellLook(3, true).rimAlpha).toBeLessThan(shellLook(3, false).rimAlpha);
  });

  /** Every rung looks dead the same way. The ladder is not readable off a wreck. */
  it('says nothing about the rung a wrecked world had reached', () => {
    const rungs = [0, 3, 6, 9];
    const looks = rungs.map((index) => shellLook(index, true));
    expect(new Set(looks.map((look) => look.rim)).size).toBe(1);
    expect(new Set(looks.map((look) => look.seam)).size).toBe(1);
    // While a live shell's colour is exactly what says which rung it is on.
    expect(new Set(rungs.map((i) => shellLook(i, false).rim)).size).toBe(rungs.length);
  });

  /* ── and why it needs its own draw group ──────────────────── */

  /**
   * A stage's colour lives in MATERIAL uniforms, and a material is shared by every
   * instance in its mesh — so a wrecked world sharing a bucket with a healthy one
   * at the same rung would keep glowing in its neighbour's hue. Per-instance
   * colour cannot reach it: `instanceColor` multiplies the diffuse, which is why
   * the fog's dimming can use it and this cannot.
   */
  it('splits a wrecked world out of its own stage', () => {
    const groups = shellGroups(nodesOf(
      world({ id: 'a', coreLevel: 12, state: { kind: 'NORMAL' } }),
      world({ id: 'b', coreLevel: 12, state: { kind: 'RECOVERY', until: new Date() } }),
    ));

    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.index === groups[0]!.index)).toBe(true);
    expect(groups.filter((group) => group.wrecked)).toHaveLength(1);
    expect(groups.find((group) => group.wrecked)!.planets.map((p) => p.id)).toEqual(['b']);
  });

  /** Worlds that are alike still share a bucket — the split is not per world. */
  it('keeps healthy worlds at one rung in a single group', () => {
    const groups = shellGroups(nodesOf(
      world({ id: 'a', coreLevel: 12 }),
      world({ id: 'b', coreLevel: 13 }),
      world({ id: 'c', coreLevel: 12 }),
    ));
    const twelve = groups.find((group) => group.planets.some((p) => p.id === 'a'))!;
    expect(twelve.planets.map((p) => p.id).sort()).toEqual(['a', 'c']);
    expect(groups).toHaveLength(2);
  });

  /**
   * AND A STRIKE OFTEN TAKES THE SHELL WITH IT, which is the ordinary case rather
   * than the one this feature is about: the ladder starts at Core 12 (D153), and a
   * Core knocked under that wears nothing at all. A wrecked world with no rings
   * must not produce an empty draw group.
   */
  it('draws nothing for a world the strike knocked off the ladder', () => {
    const groups = shellGroups(nodesOf(
      world({ id: 'a', coreLevel: 6, state: { kind: 'RECOVERY', until: new Date() } }),
    ));
    expect(groups).toEqual([]);
  });

  /** A galaxy with nothing in recovery pays nothing for any of this. */
  it('adds no group to a galaxy where nobody has been struck', () => {
    const groups = shellGroups(nodesOf(
      world({ id: 'a', coreLevel: 12 }),
      world({ id: 'b', coreLevel: 12 }),
    ));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.wrecked).toBe(false);
  });
});
