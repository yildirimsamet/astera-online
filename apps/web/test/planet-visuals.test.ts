import { GALAXY } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import {
  CLANMATE_COLOUR,
  LIMB_SCALE,
  LIMB_TINT,
  MIN_MARKER_PX,
  SELECTION_RING,
  HIDDEN_PLANET_BRIGHTNESS,
  VISIBLE_PLANET_BRIGHTNESS,
  bodyLight,
  eyeMarkerScale,
  eyeNodes,
  limbLight,
  markerScale,
} from '../src/galaxy/PlanetField.js';
import {
  STANCE_LIGHT,
  SCALE,
  activeWorldPosition,
  controlledWorldId,
  isRivalNode,
  planetNodes,
  toWorld,
} from '../src/galaxy/scene.js';
import { focusTapDecision } from '../src/galaxy/follow.js';
import { planetsWithClanPresence } from '../src/galaxy/clanPresence.js';
import { galaxySchema } from '../src/api/schemas.js';

/**
 * THE AIR AROUND A WORLD, AND WHAT IT IS NOT ALLOWED TO BECOME. D53a.
 *
 * The planet renders end at a hard alpha cut, so every world sat on black as a
 * cut-out — and they were the only objects in a scene where a hull sheds a wake, a
 * shield breathes and a rock tumbles with nothing happening at all. The limb is the
 * light a planet scatters at its own edge, and it is one instanced quad.
 *
 * It is also the easiest thing here to get wrong, and it was got wrong twice before
 * the photographs came back right: too wide and it is a grey cloud, too even and it
 * is a gasket, too far out and it drowns the one marker that says which world the
 * player selected. Those are proportions, so they are asserted rather than judged
 * from a screenshot that nobody will take again.
 */
describe('the atmosphere limb', () => {
  /**
   * IT STANDS OFF THE WORLD, AND STOPS WELL SHORT OF THE MARKER.
   *
   * Every world in the galaxy has a limb; exactly one has a selection ring. A limb
   * that reached as far as the ring would make the marker read against a bright
   * band instead of against space, and "which of these did I tap" is the question
   * the ring exists to answer.
   */
  it('sits outside the world and inside the selection ring', () => {
    expect(LIMB_SCALE).toBeGreaterThan(1);
    expect(LIMB_SCALE).toBeLessThan(SELECTION_RING);
    // And not by a hair: the ring needs clear space to read in.
    expect(SELECTION_RING - LIMB_SCALE).toBeGreaterThan(0.1);
  });

  /**
   * A BAND, NOT A CLOUD.
   *
   * Photographed first at 1.34, which put half a radius of grey haze around every
   * world — the same failure `BLAST_SIZE` records, and the same fix. Anything past
   * a fifth of the radius stops reading as an edge effect and starts reading as
   * weather.
   */
  it('is a fifth of a radius at most', () => {
    expect(LIMB_SCALE - 1).toBeLessThanOrEqual(0.2);
  });

  /**
   * SCATTERED LIGHT IS WARM, and neutral grey is what the second attempt looked
   * like. The key light in this scene is warm and the sixteen planet renders are
   * lit to match, so a limb that is not warmer than it is blue belongs to a
   * different scene from the art it is drawn around.
   */
  it('is warm, in the same direction as the key light', () => {
    expect(LIMB_TINT.r).toBeGreaterThan(LIMB_TINT.g);
    expect(LIMB_TINT.g).toBeGreaterThan(LIMB_TINT.b);
  });

  /**
   * AND THE FOG STILL HOLDS OVER IT.
   *
   * The bodies are dimmed per instance by `STANCE_LIGHT`, so an unwatched world is
   * literally darker. The limb is multiplied by the same figure — if it were not,
   * the brightest pixel on the silhouette would be at full strength on exactly the
   * worlds the fog is hiding, which is the most eye-catching way available to undo
   * it.
   */
  it('is dimmed by the same stance light as the world it belongs to', () => {
    const brightest = Math.max(...Object.values(STANCE_LIGHT));
    const darkest = Math.min(...Object.values(STANCE_LIGHT));
    expect(darkest).toBeLessThan(brightest);
    // The value the component multiplies by, asserted as the relationship it has
    // to hold rather than as a repeat of the arithmetic.
    expect(LIMB_TINT.r * darkest).toBeLessThan(LIMB_TINT.r * brightest);
  });
});

describe('the camera home world', () => {
  it('uses the active colony position instead of the immutable capital marker', () => {
    const capital = {
      id: 'capital',
      name: 'Origin',
      owner: 'Commander',
      position: { x: 100, y: 0, z: 200 },
      coreTier: 1,
      coreLevel: 3,
      intel: 'RESOLVED' as const,
      state: { kind: 'NORMAL' as const },
      satellites: [],
      shielded: false,
      isSelf: true,
    };
    const colonyPosition = { x: -450, y: 20, z: 350 };
    const colony = { ...capital, id: 'colony', position: colonyPosition, isSelf: false, isOwned: true };
    expect(activeWorldPosition([capital, colony], colony.id, capital.position)).toEqual(toWorld(colonyPosition));
    expect(activeWorldPosition([capital, colony], colony.id, capital.position)).not.toEqual(toWorld(capital.position));
  });

  it('uses the rendered world record even when a stale private payload has another position', () => {
    const capital = {
      id: 'capital',
      name: 'Origin',
      owner: 'Commander',
      position: { x: 100, y: 0, z: 200 },
      coreTier: 1,
      coreLevel: 3,
      intel: 'RESOLVED' as const,
      state: { kind: 'NORMAL' as const },
      satellites: [],
      shielded: false,
      isSelf: true,
    };
    const colony = {
      ...capital,
      id: 'colony',
      position: { x: -450, y: 20, z: 350 },
      isSelf: false,
      isOwned: true,
    };
    expect(activeWorldPosition([capital, colony], colony.id, capital.position))
      .toEqual(toWorld(colony.position));
  });

  it('focuses every owned world before making it manageable', () => {
    const colony = {
      id: 'colony',
      name: 'Haven',
      owner: 'Commander',
      position: { x: -200, y: 0, z: 100 },
      coreTier: 1,
      coreLevel: 3,
      intel: 'RESOLVED' as const,
      state: { kind: 'NORMAL' as const },
      satellites: [],
      shielded: false,
      isSelf: false,
      isOwned: true,
    };
    const colonyId = controlledWorldId([colony], colony.id);
    expect(colonyId).toBe(colony.id);
    expect(focusTapDecision(null, { kind: 'planet', id: colony.id }, colonyId)).toEqual({
      kind: 'focus',
      focus: { kind: 'planet', id: colony.id },
      detail: false,
    });
    expect(focusTapDecision(
      { kind: 'planet', id: colony.id },
      { kind: 'planet', id: colony.id },
      colonyId,
    )).toEqual({
      kind: 'manage',
      planetId: colony.id,
    });
    const capital = {
      id: 'preview-capital',
      name: 'Origin',
      owner: 'Commander',
      position: { x: 0, y: 0, z: 0 },
      coreTier: 1,
      coreLevel: 3,
      intel: 'RESOLVED' as const,
      state: { kind: 'NORMAL' as const },
      satellites: [],
      shielded: false,
      isSelf: true,
    };
    const capitalId = controlledWorldId([capital], capital.id);
    expect(capitalId).toBe(capital.id);
    expect(focusTapDecision(null, { kind: 'planet', id: capital.id }, capitalId)).toEqual({
      kind: 'focus',
      focus: { kind: 'planet', id: capital.id },
      detail: false,
    });
    expect(focusTapDecision(
      { kind: 'planet', id: capital.id },
      { kind: 'planet', id: capital.id },
      capitalId,
    )).toEqual({
      kind: 'manage',
      planetId: capital.id,
    });
  });
});

describe('world identity on the disc', () => {
  it('adds live clan identity to an unknown world without resolving its intel', () => {
    const galaxy = galaxySchema.parse({
      you: { planetId: 'mine', playerId: 'me', planetIds: ['mine'] },
      clanPresence: {
        clan: { id: 'crew', name: 'Far Watch', tag: 'FAR' },
        members: [
          {
            playerId: 'me', username: 'Vantage',
            worlds: [{ planetId: 'mine', name: 'Origin', position: { x: 0, y: 0, z: 0 } }],
          },
          {
            playerId: 'ally', username: 'Ada',
            worlds: [{ planetId: 'hidden', name: 'Lantern', position: { x: 1800, y: 0, z: 0 } }],
          },
        ],
      },
      planets: [
        {
          id: 'mine', name: 'Origin', owner: 'Vantage', position: { x: 0, y: 0, z: 0 },
          intel: 'RESOLVED', isSelf: true, isOwned: true,
        },
        {
          id: 'hidden', position: { x: 1800, y: 0, z: 0 },
          intel: 'UNKNOWN', isSelf: false, isOwned: false,
        },
      ],
    });

    const hidden = planetsWithClanPresence(galaxy).find((planet) => planet.id === 'hidden');
    expect(hidden).toMatchObject({
      intel: 'UNKNOWN',
      name: 'Lantern',
      owner: 'Ada',
      clanmate: true,
      controller: { kind: 'PLAYER', playerId: 'ally' },
      coreLevel: 0,
      satellites: [],
    });
  });

  it('renders the expanded 300-player galaxy as expanded space', () => {
    const [largest] = planetNodes([{
      id: 'heavy-world',
      name: 'Heavy World',
      owner: 'Commander',
      position: { x: 0, y: 0, z: 0 },
      coreTier: 4,
      coreLevel: 12,
      intel: 'RESOLVED' as const,
      state: { kind: 'NORMAL' as const },
      satellites: [],
      shielded: false,
      isSelf: false,
    }]);

    // The placement floor must leave daylight between even the largest public
    // silhouettes. Scaling the 2000-unit radius back into the old 20-unit picture
    // made this ratio fail and piled 351 readable markers over one another.
    expect(GALAXY.minSeparation / SCALE)
      .toBeGreaterThan(largest!.radius * 2 * LIMB_SCALE);
  });

  it('gives strategic markers a screen-space floor without enlarging close worlds', () => {
    expect(MIN_MARKER_PX).toBeGreaterThanOrEqual(16);
    expect(markerScale(10, 1, 844, 50)).toBe(1);
    expect(markerScale(1200, 0.5, 844, 50)).toBeGreaterThan(1);
    expect(markerScale(100_000, 0.01, 844, 50)).toBeLessThanOrEqual(4);
  });

  it('keeps eye marks fifty percent larger than the existing zoom scale', () => {
    const current = markerScale(1200, 0.5, 844, 50);
    expect(eyeMarkerScale(1200, 0.5, 844, 50)).toBeCloseTo(current * 1.5);
  });

  it('never puts an open or closed eye over a world the commander owns', () => {
    const nodes = planetNodes([
      {
        id: 'mine', name: 'Origin', owner: 'Commander', kind: 'CAPITAL',
        position: { x: 0, y: 0, z: 0 }, coreTier: 2, coreLevel: 6,
        satellites: [], shielded: false, isSelf: true, isOwned: true,
        state: { kind: 'NORMAL' }, intel: 'RESOLVED',
      },
      {
        id: 'seen', name: 'Seen', owner: 'Rival', kind: 'COLONY',
        position: { x: 100, y: 0, z: 0 }, coreTier: 1, coreLevel: 3,
        satellites: [], shielded: false, isSelf: false, intel: 'RESOLVED',
        state: { kind: 'NORMAL' },
      },
      {
        id: 'hidden', name: '', owner: '',
        position: { x: 200, y: 0, z: 0 }, coreTier: 1, coreLevel: 0,
        satellites: [], shielded: false, isSelf: false, intel: 'UNKNOWN',
        state: { kind: 'NORMAL' },
      },
    ]);

    expect(eyeNodes(nodes, true).map((node) => node.id)).toEqual(['seen']);
    expect(eyeNodes(nodes, false).map((node) => node.id)).toEqual(['hidden']);
  });

  it('raises visible worlds by 25% and lowers hidden worlds by 15%', () => {
    expect(VISIBLE_PLANET_BRIGHTNESS).toBe(1.25);
    expect(HIDDEN_PLANET_BRIGHTNESS).toBe(0.85);
    expect(bodyLight('watched', 'RESOLVED')).toBeCloseTo(STANCE_LIGHT.watched * 1.25);
    expect(bodyLight('dark', 'UNKNOWN')).toBeCloseTo(STANCE_LIGHT.dark * 0.22 * 0.85);
    expect(limbLight('watched', 'RESOLVED')).toBeCloseTo(STANCE_LIGHT.watched * 1.25);
    expect(limbLight('dark', 'UNKNOWN')).toBeCloseTo(STANCE_LIGHT.dark * 0.85);
  });

  it('marks every owned colony as self and preserves capital/colony identity', () => {
    const [capital, colony] = planetNodes([
      {
        id: 'capital', name: 'Origin', owner: 'Commander', kind: 'CAPITAL',
        controller: { kind: 'PLAYER', playerId: 'p1', displayName: 'Commander' },
        clan: { id: 'clan-war', name: 'War Fleet', tag: 'WAR' },
        dominionRank: 1,
        position: { x: 0, y: 0, z: 0 }, coreTier: 2, coreLevel: 6, satellites: [], shielded: false,
        isSelf: true, isOwned: true, isCapital: true, state: { kind: 'NORMAL' }, intel: 'RESOLVED',
      },
      {
        id: 'colony', name: 'Haven', owner: 'Commander', kind: 'COLONY',
        controller: { kind: 'PLAYER', playerId: 'p1', displayName: 'Commander' },
        position: { x: 100, y: 0, z: 0 }, coreTier: 1, coreLevel: 3, satellites: [], shielded: false,
        isSelf: false, isOwned: true, isCapital: false, state: { kind: 'NORMAL' }, intel: 'RESOLVED',
      },
    ]);
    expect(capital).toMatchObject({
      stance: 'self', kind: 'CAPITAL', isCapital: true,
      clan: { id: 'clan-war', name: 'War Fleet', tag: 'WAR' },
      dominionRank: 1,
    });
    expect(colony).toMatchObject({ stance: 'self', kind: 'COLONY', isCapital: false });
  });

  it('marks clanmate worlds from the bulk galaxy payload and reserves a green identity ring', () => {
    const [mine, ally, hiddenAlly, rememberedAlly, stranger] = planetNodes([
      {
        id: 'mine', name: 'Origin', owner: 'Commander', kind: 'CAPITAL',
        controller: { kind: 'PLAYER', playerId: 'me', displayName: 'Commander' },
        clan: { id: 'clan-war', name: 'War Fleet', tag: 'WAR' },
        position: { x: 0, y: 0, z: 0 }, coreTier: 2, coreLevel: 6, satellites: [], shielded: false,
        isSelf: true, isOwned: true, state: { kind: 'NORMAL' }, intel: 'RESOLVED',
      },
      {
        id: 'ally', name: 'Haven', owner: 'Ada', kind: 'CAPITAL',
        controller: { kind: 'PLAYER', playerId: 'ally-player', displayName: 'Ada' },
        clan: { id: 'clan-war', name: 'War Fleet', tag: 'WAR' },
        position: { x: 100, y: 0, z: 0 }, coreTier: 1, coreLevel: 3, satellites: [], shielded: false,
        isSelf: false, state: { kind: 'NORMAL' }, intel: 'RESOLVED',
      },
      {
        id: 'hidden-ally', name: 'Far Haven', owner: 'Iris',
        controller: { kind: 'PLAYER', playerId: 'hidden-ally-player', displayName: 'Iris' },
        clan: { id: 'clan-war', name: 'War Fleet', tag: 'WAR' },
        position: { x: 125, y: 0, z: 0 }, coreTier: 1, coreLevel: 0, satellites: [], shielded: false,
        isSelf: false, state: { kind: 'NORMAL' }, intel: 'UNKNOWN', clanmate: true,
      },
      {
        id: 'remembered-ally', name: 'Old Haven', owner: 'Mira', kind: 'CAPITAL',
        controller: { kind: 'PLAYER', playerId: 'former-ally', displayName: 'Mira' },
        clan: { id: 'clan-war', name: 'War Fleet', tag: 'WAR' },
        position: { x: 150, y: 0, z: 0 }, coreTier: 1, coreLevel: 3, satellites: [], shielded: false,
        isSelf: false, state: { kind: 'NORMAL' }, intel: 'REMEMBERED', seenAt: new Date(0),
      },
      {
        id: 'stranger', name: 'Far Reach', owner: 'Nova', kind: 'CAPITAL',
        controller: { kind: 'PLAYER', playerId: 'other-player', displayName: 'Nova' },
        clan: { id: 'clan-other', name: 'Other Fleet', tag: 'OTH' },
        position: { x: 200, y: 0, z: 0 }, coreTier: 1, coreLevel: 3, satellites: [], shielded: false,
        isSelf: false, state: { kind: 'NORMAL' }, intel: 'RESOLVED',
      },
    ]);
    expect(mine?.isClanmate).toBe(false);
    expect(ally?.isClanmate).toBe(true);
    expect(hiddenAlly).toMatchObject({
      intel: 'UNKNOWN',
      name: 'Far Haven',
      owner: 'Iris',
      isClanmate: true,
    });
    // A remembered clan tag is historical intel, never a live friendly-fire cue.
    expect(rememberedAlly?.isClanmate).toBe(false);
    expect(stranger?.isClanmate).toBe(false);
    expect(CLANMATE_COLOUR).toBe('#5ad39b');
  });

  it('marks every world controlled by the rival commander, not only the chosen anchor', () => {
    const [capital, colony, stranger] = planetNodes([
      {
        id: 'rival-capital', name: 'Origin', owner: 'Sable', kind: 'CAPITAL',
        controller: { kind: 'PLAYER', playerId: 'rival-player', displayName: 'Sable' },
        position: { x: 0, y: 0, z: 0 }, coreTier: 2, coreLevel: 6, satellites: [], shielded: false,
        isSelf: false, state: { kind: 'NORMAL' }, intel: 'RESOLVED',
      },
      {
        id: 'rival-colony', name: 'Reach', owner: 'Sable', kind: 'COLONY',
        controller: { kind: 'PLAYER', playerId: 'rival-player', displayName: 'Sable' },
        position: { x: 100, y: 0, z: 0 }, coreTier: 1, coreLevel: 3, satellites: [], shielded: false,
        isSelf: false, state: { kind: 'NORMAL' }, intel: 'RESOLVED',
      },
      {
        id: 'other', name: 'Other', owner: 'Nova', kind: 'CAPITAL',
        controller: { kind: 'PLAYER', playerId: 'other-player', displayName: 'Nova' },
        position: { x: 200, y: 0, z: 0 }, coreTier: 1, coreLevel: 3, satellites: [], shielded: false,
        isSelf: false, state: { kind: 'NORMAL' }, intel: 'RESOLVED',
      },
    ]);
    expect(isRivalNode(capital!, 'rival-capital', 'rival-player')).toBe(true);
    expect(isRivalNode(colony!, 'rival-capital', 'rival-player')).toBe(true);
    expect(isRivalNode(stranger!, 'rival-capital', 'rival-player')).toBe(false);
  });
});
