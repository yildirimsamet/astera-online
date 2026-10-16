import { describe, expect, it } from 'vitest';
import type { Contact, PendingThread } from '../src/api/schemas.js';
import {
  DEATH_STAR_IMPACT_MS,
  deathStarImpactCandidates,
  isDeathStarImpactVisible,
  mergeRetainedDeathStarImpacts,
} from '../src/galaxy/DeathStarImpact.js';
import { toWorld, type PlanetNode } from '../src/galaxy/scene.js';

/** Where the strike lands, in GAME units. Everything world-unit is derived from it. */
const TARGET = { x: 100, y: 100, z: 300 };


const nodes: PlanetNode[] = [{
  id: 'target',
  name: 'Target',
  owner: 'Commander',
  position: toWorld(TARGET),
  radius: 1.4,
  weight: 3,
  coreTier: 4,
  coreLevel: 12,
  intel: 'RESOLVED' as const,
  satellites: [],
  shielded: false,
  stance: 'dark',
  state: { kind: 'NORMAL' },
  kind: 'COLONY',
  isOwned: false,
  isClanmate: false,
  isCapital: false,
}];

const path = {
  from: { x: 0, y: 0, z: 0 },
  // The expected position is DERIVED with `toWorld` rather than written out: the
  // game-unit-to-world-unit divisor is `SCALE`, and it moves whenever the design
  // distances do. A hand-computed triple silently becomes wrong on that day.
  to: TARGET,
  departAt: new Date(1_000),
  arriveAt: new Date(10_000),
};

describe('the public Death Star impact', () => {
  it('uses an owned mission exact arrival and the target world scale', () => {
    const pending: PendingThread[] = [{
      id: 'mission-1',
      kind: 'death_star',
      targetName: 'Target',
      minutesRemaining: 1,
      arriveAt: path.arriveAt,
      leg: 'outbound',
      path,
    }];
    expect(deathStarImpactCandidates(pending, [], nodes)).toEqual([{
      id: 'mission-1',
      at: 10_000,
      position: toWorld(path.to),
      radius: 1.4,
      intensity: 1,
    }]);
  });

  /**
   * A STRANGER'S EXPLOSION COMES OFF THE PUBLISHED MOMENT. D106.
   *
   * It used to be inferred from the shape of a bearing window — a `landing` flag
   * and wherever that window happened to stop — which meant only a client holding
   * the final window could reconstruct it at all, and it drew the blast at the
   * orbit the craft held rather than at the world. The server states the instant
   * and the place now, exactly as it states a bombardment, so every screen fires
   * the same effect at the same second whatever window it happens to hold.
   */
  it('takes a stranger’s explosion from the published moment, not from the window', () => {
    const base: Contact = {
      id: 'foreign',
      kind: 'death_star',
      from: { x: 0, y: 0, z: 0 },
      // Where the craft STOPS, which is in orbit and is not where the blast is.
      to: { x: 90, y: 90, z: 270 },
      startAt: new Date(9_000),
      endAt: path.arriveAt,
      landing: true,
    };
    expect(deathStarImpactCandidates([], [base], nodes)).toEqual([]);
    expect(
      deathStarImpactCandidates(
        [],
        [{ ...base, impact: { at: path.arriveAt, target: TARGET } }],
        nodes,
      ),
    ).toEqual([{
      id: 'foreign',
      at: 10_000,
      position: toWorld(TARGET),
      radius: 1.4,
      intensity: 1,
    }]);
  });

  /**
   * OUT OF SIGHT IS NOT OUT OF MIND. Owner, 2026-10-16: *"telescope dışında bile olsa patlama
   * animasyonları gözükmeli"*. The contact stays effect-only — no bearing, no hull — but the
   * detonation itself is drawn at full strength.
   */
  it('draws an out-of-sight strike at full strength, effect only', () => {
    const contact: Contact = {
      id: 'distant-impact',
      kind: 'unknown',
      from: TARGET,
      to: TARGET,
      startAt: new Date(10_000),
      endAt: new Date(18_000),
      landing: true,
      effectOnly: true,
      impact: { at: path.arriveAt, target: TARGET },
    };

    expect(deathStarImpactCandidates([], [contact], nodes)).toEqual([{
      id: 'distant-impact',
      at: 10_000,
      position: toWorld(TARGET),
      radius: 1.4,
      intensity: 1,
    }]);
  });

  it('deduplicates the same mission and orders same-millisecond impacts by id', () => {
    const contacts: Contact[] = ['z-impact', 'a-impact'].map((id) => ({
      id,
      kind: 'death_star' as const,
      from: path.from,
      to: path.to,
      startAt: new Date(9_000),
      endAt: path.arriveAt,
      landing: true,
      impact: { at: path.arriveAt, target: TARGET },
    }));
    expect(deathStarImpactCandidates([], contacts, nodes).map((event) => event.id)).toEqual([
      'a-impact',
      'z-impact',
    ]);
  });

  it('starts at the named millisecond and has a strict end edge', () => {
    expect(isDeathStarImpactVisible(10_000, 9_999)).toBe(false);
    expect(isDeathStarImpactVisible(10_000, 10_000)).toBe(true);
    expect(isDeathStarImpactVisible(10_000, 10_000 + DEATH_STAR_IMPACT_MS - 1)).toBe(true);
    expect(isDeathStarImpactVisible(10_000, 10_000 + DEATH_STAR_IMPACT_MS)).toBe(false);
  });

  it.each([200, 300, 1000])('keeps all five same-target impacts independent with %i ms spacing', spacing => {
    const pending: PendingThread[] = Array.from({ length: 5 }, (_, index) => ({
      id: `burst-${index}`, kind: 'death_star', leg: 'outbound', targetName: 'Target', minutesRemaining: 1,
      arriveAt: new Date(path.arriveAt.getTime() + index * spacing),
      path: { ...path, arriveAt: new Date(path.arriveAt.getTime() + index * spacing) },
    }));
    const candidates = deathStarImpactCandidates(pending, [], nodes);
    expect(candidates).toHaveLength(5);
    expect(new Set(candidates.map(event => event.id)).size).toBe(5);
    const now = path.arriveAt.getTime() + 4 * spacing + 1;
    expect(candidates.every(event => isDeathStarImpactVisible(event.at, now))).toBe(true);
    const retained = mergeRetainedDeathStarImpacts(candidates, [], now);
    expect(retained.map(event => event.id)).toEqual(pending.map(mission => mission.id));
    // The first effect expiring must leave the other four on screen.
    expect(mergeRetainedDeathStarImpacts(retained, [], path.arriveAt.getTime() + DEATH_STAR_IMPACT_MS))
      .toHaveLength(4);
    expect(mergeRetainedDeathStarImpacts(retained, [], path.arriveAt.getTime() + 4 * spacing + DEATH_STAR_IMPACT_MS))
      .toEqual([]);
  });

  it('retains a known impact when a resolving traffic refetch removes its mission', () => {
    const event = {
      id: 'mission-1',
      at: 10_000,
      position: toWorld(TARGET),
      radius: 1.4,
      intensity: 1,
    };
    expect(mergeRetainedDeathStarImpacts([], [event], 9_000)).toEqual([event]);
    // An interception removes the mission BEFORE its original arrival. A future
    // candidate that disappears must disappear with it or it detonates as a ghost.
    expect(mergeRetainedDeathStarImpacts([event], [], 9_999)).toEqual([]);
    expect(mergeRetainedDeathStarImpacts([event], [], 10_001)).toEqual([event]);
    expect(mergeRetainedDeathStarImpacts(
      [event],
      [],
      event.at + DEATH_STAR_IMPACT_MS,
    )).toEqual([]);
  });

  /**
   * A WEAPON SHOT DOWN NEVER LANDS ON ANY SCREEN. Owner, 2026-10-16: *"Patlayan füzeler zamanı
   * gelince patlamamış gibi hedef gezegende yanlış animasyon oynatıyor mu?"* A battery that
   * fires in the weapon's last seconds (a charge finishing late, a worker catching up) puts
   * the collision at the original arrival: a bystander's landing contact had already started
   * the surface blast, and the refetch that removed the contact kept it as a live strike.
   * The interception names its weapon, and that weapon's surface blast is cancelled.
   */
  describe('a strike the battery shot down', () => {
    const contact: Contact = {
      id: 'shot-down', kind: 'death_star', from: path.from, to: TARGET,
      startAt: new Date(4_000), endAt: path.arriveAt, landing: true,
      impact: { at: path.arriveAt, target: TARGET },
    };
    const event = { id: 'shot-down', at: 10_000, position: toWorld(TARGET), radius: 1.4, intensity: 1 };

    it('is never scheduled as a surface blast', () => {
      expect(deathStarImpactCandidates([], [contact], nodes, new Set(['shot-down']))).toEqual([]);
      expect(deathStarImpactCandidates([], [contact], nodes, new Set(['another']))).toHaveLength(1);
    });

    it('stops a blast that had already begun when the interception becomes known', () => {
      expect(mergeRetainedDeathStarImpacts([event], [], 10_400, new Set(['shot-down']))).toEqual([]);
      expect(mergeRetainedDeathStarImpacts([event], [], 10_400, new Set())).toEqual([event]);
    });
  });

  /**
   * A BYSTANDER LEARNS OF A STRIKE ONLY WHEN IT HAS LANDED, AND MUST STILL SEE IT LAND.
   *
   * Outside every sensor the impact reaches this client with the refetch the hit itself
   * triggers, a second or so late — past the flash and most of the fire. A moment
   * discovered that late plays from its first frame at discovery; one found much later
   * (a tab reopened mid-smoke) keeps its real clock.
   */
  describe('a strike discovered after it landed', () => {
    const late = (at: number) => ({ id: 'seen-late', at, position: toWorld(TARGET), radius: 1.4, intensity: 1 });

    it('plays from its first frame at the moment it is discovered', () => {
      expect(mergeRetainedDeathStarImpacts([], [late(10_000)], 11_200)).toEqual([{ ...late(10_000), at: 11_200 }]);
    });

    it('keeps its replayed start when the same impact is read again', () => {
      const replayed = mergeRetainedDeathStarImpacts([], [late(10_000)], 11_200);
      expect(mergeRetainedDeathStarImpacts(replayed, [late(10_000)], 12_000)).toEqual(replayed);
    });

    it('keeps a burst discovered in one read spaced as it landed', () => {
      const second = { ...late(10_500), id: 'seen-late-2' };
      expect(mergeRetainedDeathStarImpacts([], [late(10_000), second], 11_200).map(event => event.at))
        .toEqual([11_200, 11_700]);
    });

    it('keeps the real clock for a moment seen on time or found long afterwards', () => {
      expect(mergeRetainedDeathStarImpacts([], [late(10_000)], 10_100)).toEqual([late(10_000)]);
      expect(mergeRetainedDeathStarImpacts([], [late(10_000)], 15_000)).toEqual([late(10_000)]);
    });
  });
});
