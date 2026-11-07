import { RESEARCH_PROJECTS, STARTER } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { planetSchema } from '../src/api/schemas.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { wireVessel } from './starterVesselFixture.js';

const order = (queue: string, subject: string, stage = 1, count = 1) => ({
  id: `${queue}-1`, queue, subject, stage, count, startedAt: '2026-11-01T00:00:00.000Z', readyAt: '2026-11-01T01:00:00.000Z', cost: { alloy: 1, crystal: 1, deuterium: 0 },
});
const view = (over: Parameters<typeof wireVessel>[0]) => vesselToPlanetView(vesselSchema.parse(wireVessel(over)));
const lab = { modules: { REFINERY: 1, HANGAR: 2 }, facts: [], parts: 0, fuel: 0 };

/** Every queue aboard, in the planet's shape, or the screens would show the wrong things in them. */
describe('the deck, as the planet screens read it', () => {
  it('puts each order in its own queue', () => {
    const world = view({ queue: [order('CONSTRUCTION', 'SURVEY'), order('YARD', 'DART', 1, 3), order('DOCK', 'DOCK')] });
    expect(world.queues!.CONSTRUCTION.map(row => row.subject)).toEqual(['SURVEY']);
    expect(world.queues!.YARD.map(row => [row.queue, row.subject, row.count])).toEqual([['YARD', 'DART', 3]]);
    expect(world.queues!.REPAIR!.map(row => row.subject)).toEqual(['DOCK']);
  });

  it('shows the wing at home, its hurts, and its room', () => {
    const world = view({ fleet: { DART: 6 }, damage: [{ hull: 'DART', count: 2, damageBp: 4000 }], progress: lab });
    expect(world.fleet).toEqual({ DART: 6 });
    expect(world.capacity).toMatchObject({ hangar: STARTER.hangarRoom[1], hangarUsed: 18 });
    expect(world.flight.total).toBe(STARTER.attackBays[1]);
    expect(world.fleetDamage).toMatchObject([{ hull: 'DART', count: 2, damageBp: 4000 }]);
  });

  it('offers the four projects of this galaxy and no others', () => {
    const world = view({ progress: lab, research: { SHIP_POWER: 1 } });
    expect(world.research.map(project => project.id).sort()).toEqual([...STARTER.research.projects].sort());
    const power = world.research.find(project => project.id === 'SHIP_POWER')!;
    expect(power).toMatchObject({ level: 1, maxLevel: STARTER.research.maxLevel, available: true });
    expect(power.cost).toEqual(RESEARCH_PROJECTS.SHIP_POWER.costAt(2));
  });

  it('offers none before the lab is open', () => {
    expect(view({}).research).toEqual([]);
  });

  it('still parses as a planet, whatever is under way', () => {
    const world = view({ queue: [order('YARD', 'DART'), order('RESEARCH', 'SHIP_POWER', 1)], progress: lab });
    expect(world.researchQueue).toMatchObject([{ projectId: 'SHIP_POWER', level: 1 }]);
    expect(planetSchema.safeParse(JSON.parse(JSON.stringify(world))).success).toBe(true);
  });
});
