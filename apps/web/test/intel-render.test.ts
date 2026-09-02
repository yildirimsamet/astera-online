import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { galaxySchema } from '../src/api/schemas.js';
import { isRivalNode, planetNodes, stanceOf } from '../src/galaxy/scene.js';
import { recordAgeMinutes } from '../src/lib/dossier.js';
import { resolvedOnly } from '../src/galaxy/Satellites.js';
import { shellLook } from '../src/galaxy/DysonShells.js';

/**
 * WHAT EACH INTEL STATE IS ALLOWED TO DRAW. D127.
 *
 * The server decides the state; this file holds the rules the renderers apply to
 * it, which are the half a payload test cannot reach. Three of them are worth
 * stating plainly because each was got wrong once during the build:
 *
 *   · A REMEMBERED world is DARK. The first pass treated "not unknown" as "lit",
 *     which put a live-looking world on a record nobody had taken since.
 *   · A REMEMBERED world's hardware does not MOVE. A turning ring is an assertion
 *     about right now that a record cannot make.
 *   · An UNKNOWN world never wears the Rival reticle. The player branch was always
 *     safe; the planet-id branch matched straight through the fog.
 */

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'w1',
  name: 'Quillon-116',
  owner: 'Sable',
  kind: 'CAPITAL',
  position: { x: 0, y: 0, z: 0 },
  coreTier: 4,
  coreLevel: 12,
  satellites: [],
  shielded: false,
  isSelf: false,
  isOwned: false,
  isCapital: true,
  intel: 'RESOLVED',
  state: { kind: 'NORMAL' },
  ...over,
});

const nodeOf = (over: Partial<GalaxyPlanet> = {}) => planetNodes([world(over)])[0]!;

/**
 * EXACTLY WHAT THE SERVER SENDS FOR A WORLD NOBODY HAS LOOKED AT. D127.
 *
 * An id, a position, the state and the two public moments — and parsed, because
 * the defaults that fill every other field live in the schema and this is the one
 * payload that leans on all of them.
 */
const parseUnknown = () =>
  galaxySchema.parse({
    you: { planetId: 'p', playerId: 'pl' },
    planets: [{
      id: 'u1',
      position: { x: 0, y: 0, z: 0 },
      intel: 'UNKNOWN',
      isSelf: false,
      isOwned: false,
      state: { kind: 'NORMAL' },
    }],
    sensors: [],
  });

describe('the three states, as the disc reads them', () => {
  it('carries the server’s state through untouched', () => {
    expect(nodeOf({ intel: 'UNKNOWN' }).intel).toBe('UNKNOWN');
    expect(nodeOf({ intel: 'REMEMBERED' }).intel).toBe('REMEMBERED');
    expect(nodeOf({ intel: 'RESOLVED' }).intel).toBe('RESOLVED');
  });

  /**
   * A PAYLOAD THAT PREDATES D127 DRAWS THE GALAXY IT ALWAYS DID. A client ahead of
   * its server must not blank every world; absent means resolved.
   */
  it('treats a payload with no state as fully resolved', () => {
    const legacy = { ...world() } as Record<string, unknown>;
    delete legacy.intel;
    // Through the schema, because that is the only way a payload ever reaches
    // `planetNodes` — the defaults that fill D127's gaps live there, and a test
    // that hand-built the object would be measuring a path production never takes.
    const parsed = galaxySchema.parse({
      you: { planetId: 'p', playerId: 'pl' },
      planets: [legacy],
      sensors: [],
    });
    expect(planetNodes(parsed.planets)[0]!.intel).toBe('RESOLVED');
  });

  /**
   * The server omits everything about an unknown world, so the gaps are filled at
   * the schema. What matters downstream is that it comes out as the SMALLEST
   * silhouette with no hardware — one uniform mark, so it reads as "not looked at"
   * rather than as "small and empty".
   */
  it('gives an unknown world the smallest silhouette and no hardware', () => {
    const unknown = planetNodes(parseUnknown().planets)[0]!;

    expect(unknown.coreTier).toBe(1);
    expect(unknown.coreLevel).toBe(0);
    expect(unknown.weight).toBe(1);
    expect(unknown.satellites).toEqual([]);
    expect(unknown.shielded).toBe(false);
    expect(unknown.name).toBe('');
    expect(unknown.owner).toBe('');
  });

  /* ── what each state may draw ──────────────────────────────── */

  it('draws orbital hardware for a resolved and a remembered world, never an unknown one', () => {
    const nodes = [
      nodeOf({ id: 'a', intel: 'RESOLVED' }),
      nodeOf({ id: 'b', intel: 'REMEMBERED' }),
      nodeOf({ id: 'c', intel: 'UNKNOWN' }),
    ];
    expect(resolvedOnly(nodes).map((n) => n.id)).toEqual(['a', 'b']);
  });

  /**
   * STILL AND COLOURLESS, exactly like a struck world's. Both are structures the
   * map cannot currently see, and a lit, turning one would be a claim about this
   * instant that neither state can make.
   */
  it('leaves a remembered world’s rings unpowered and still', () => {
    const live = shellLook(0, false);
    const record = shellLook(0, true);

    expect(live.turning).toBe(true);
    expect(live.seam).toBeGreaterThan(0);
    expect(record.turning).toBe(false);
    expect(record.seam).toBe(0);
  });

  /* ── the rival reticle, which leaked through the fog ───────── */

  it('never marks an unknown world as the rival, even when pinned by world', () => {
    const unknown = nodeOf({ id: 'rival-world', intel: 'UNKNOWN' });
    expect(isRivalNode(unknown, 'rival-world', null)).toBe(false);
  });

  it('still marks a remembered or resolved rival', () => {
    expect(isRivalNode(nodeOf({ id: 'r', intel: 'REMEMBERED' }), 'r', null)).toBe(true);
    expect(isRivalNode(nodeOf({ id: 'r', intel: 'RESOLVED' }), 'r', null)).toBe(true);
  });

  /** And the player branch was always safe: an unknown world names no controller. */
  it('cannot match a rival by player on a world that names none', () => {
    const unknown = planetNodes(parseUnknown().planets)[0]!;
    expect(unknown.controllerPlayerId).toBeUndefined();
    expect(isRivalNode(unknown, null, 'their-player-id')).toBe(false);
  });

  /* ── stance, which the body's brightness reads ─────────────── */

  /**
   * An unknown world has no telescope reading either, so it falls to `dark` — the
   * dimmest stance there is. The extra D127 dimming multiplies that rather than
   * replacing it, so the two cannot fight.
   */
  it('leaves an unknown world at the darkest stance', () => {
    expect(stanceOf(world({ intel: 'UNKNOWN' }))).toBe('dark');
  });
});

/**
 * WHAT A WORLD'S LABEL IS ALLOWED TO SAY. D127.
 *
 * Selection is the one route into the label container that does not test `intel`:
 * `node.id === selectedId` is checked on its own, deliberately, because a player
 * who taps a world has asked for something and a tap that produces nothing reads
 * as a broken control.
 *
 * So a tapped UNSURVEYED world came through, and was printed from the SCHEMA'S
 * DEFAULTS. The consequence is worse than a leak, because a leak at least tells
 * the truth: the kind row falls through both of its branches and reads NEUTRAL,
 * the commander row renders an empty string, and the name row renders another.
 * The map answered a question it had just told the player it could not answer,
 * and answered it wrong. The fog hides and never lies.
 */
describe('the label on a world nobody has surveyed', () => {
  /**
   * The materials of the lie, asserted first, because the branch in the renderer
   * only makes sense next to them. Every one of these is a schema DEFAULT filling
   * a field the server deliberately omitted — not a value anybody measured.
   */
  it('has nothing true to print in any of the label’s rows', () => {
    const unknown = planetNodes(parseUnknown().planets)[0]!;

    expect(unknown.name).toBe('');
    expect(unknown.owner).toBe('');
    /**
     * AND THE KIND IS ABSENT RATHER THAN GUESSED. It used to default to
     * `'CAPITAL'`, which was harmless while the only worlds missing a kind were
     * legacy ones and became a live falsehood the moment D127 stopped publishing
     * it: nine tenths of the disc claimed to be a capital, in capital blue.
     */
    expect(unknown.kind).toBeUndefined();
    expect(unknown.dominionRank).toBeUndefined();
    expect(unknown.clan).toBeUndefined();
  });

  /**
   * AND THE RENDERER BRANCHES BEFORE IT REACHES THEM.
   *
   * A source assertion, and the reason is the one `viewport-zoom` already gives
   * for the same technique: this rule lives inside an R3F/drei subtree that
   * cannot be mounted without a WebGL context, and the alternative to checking it
   * here is not checking it. It is deliberately narrow — that the guard exists
   * and comes first — so it survives any rewording of the label itself.
   */
  it('replaces the whole label with one honest line', () => {
    const source = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');

    const guard = source.indexOf("node.intel === 'UNKNOWN' ?");
    expect(guard, 'the unknown-world guard').toBeGreaterThan(-1);
    expect(source).toContain("t('galaxy.unsurveyed')");

    // Every row that would print a default has to sit AFTER the guard.
    for (const row of ['galaxy.kindNeutral', 'commanderLabel(node.owner', '{node.name}']) {
      expect(source.indexOf(row), row).toBeGreaterThan(guard);
    }
  });
});

/**
 * ONE DEFINITION OF HOW OLD A RECORD IS, FOR EVERY SURFACE THAT PRINTS ONE. D151.
 *
 * Three surfaces show a world's age and they had two and a half answers between
 * them. The dossier stamped it on each fact row it drew from a record. The disc
 * label printed a BARE duration under the world's name, from its own copy of the
 * subtraction — "3h 10m ago", with nothing saying what was three hours old, under
 * a confident kind row and a commander's name. And the launch sheet, the last
 * screen before a fleet stops being recallable, said nothing at all.
 *
 * Two copies of one arithmetic is a map and a panel that can disagree about the
 * same world, so the subtraction lives in one place and each surface asks for it.
 */
describe('the age of a record, wherever it is printed', () => {
  it('is null on a live reading, because a reading has no age', () => {
    const now = Date.UTC(2026, 0, 2);
    expect(recordAgeMinutes({ intel: 'RESOLVED' }, now)).toBeNull();
  });

  /** An unsurveyed world has no record at all — its label says so instead. */
  it('is null on a world nobody has looked at', () => {
    const now = Date.UTC(2026, 0, 2);
    expect(recordAgeMinutes({ intel: 'UNKNOWN' }, now)).toBeNull();
  });

  it('is the minutes since the look on a remembered world', () => {
    const seenAt = new Date(Date.UTC(2026, 0, 2, 9, 0));
    const now = Date.UTC(2026, 0, 2, 12, 30);
    expect(recordAgeMinutes({ intel: 'REMEMBERED', seenAt }, now)).toBe(210);
  });

  /**
   * A CLOCK THAT DISAGREES WITH THE SERVER MAY NOT PRODUCE A NEGATIVE AGE. The
   * map draws on `serverNow()`, but a record written in the same second still
   * reaches this a few milliseconds early on a slow render.
   */
  it('never reads as the future', () => {
    const seenAt = new Date(Date.UTC(2026, 0, 2, 12, 0));
    expect(recordAgeMinutes({ intel: 'REMEMBERED', seenAt }, Date.UTC(2026, 0, 2, 11, 0))).toBe(0);
  });

  /** A remembered world with no `seenAt` states nothing rather than "live". */
  it('is null when the payload carried no instant', () => {
    expect(recordAgeMinutes({ intel: 'REMEMBERED' }, Date.now())).toBeNull();
  });

  /**
   * AND THE MAP LABEL PRINTS IT.
   *
   * A source assertion for the reason this file already gives above: the label
   * lives inside an R3F/drei subtree that cannot be mounted without a WebGL
   * context, and the alternative to checking it here is not checking it. Narrow
   * on purpose — that the age is computed and reaches the label — so it survives
   * any rewording of the label itself.
   */
  it('reaches the world label on the disc', () => {
    const source = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');

    expect(source).toContain('recordAgeMinutes');
    const computed = source.indexOf('recordAgeMinutes(node');
    expect(computed, 'the label computes the age of its own node').toBeGreaterThan(-1);
    expect(source).toContain('galaxy.recordAge');
  });
});
