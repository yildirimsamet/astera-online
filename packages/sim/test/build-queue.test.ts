import { describe, expect, it } from 'vitest';
import {
  advanceBuildQueues,
  buildWorld,
  enqueueSimBuild,
  projectedBuildState,
  totalWealth,
} from '../src/index.js';

const cost = (alloy = 10, crystal = 0, deuterium = 0) => ({ alloy, crystal, deuterium });

describe('the simulator build queue mirror', () => {
  it('runs commander Research independently from Construction and Yard', () => {
    const world = buildWorld({ players: 1, days: 1, seed: 40 });
    const player = world.players[0]!;
    player.alloy = 10_000;
    player.crystal = 10_000;

    expect(enqueueSimBuild(player, 0, world, {
      queue: 'CONSTRUCTION', kind: 'BUILDING', subject: 'CORE', count: 1,
      cost: cost(), minutes: 10,
    })).toBe(true);
    expect(enqueueSimBuild(player, 0, world, {
      queue: 'RESEARCH', kind: 'RESEARCH', subject: 'ISOTOPE_SPECTROMETRY', count: 1,
      cost: cost(), minutes: 4,
    })).toBe(true);

    expect(player.queues.CONSTRUCTION[0]?.readyAt).toBe(10);
    expect(player.queues.RESEARCH[0]?.readyAt).toBe(4);
    expect(projectedBuildState(player, world, 'CONSTRUCTION').research.ISOTOPE_SPECTROMETRY ?? 0)
      .toBe(0);
    expect(projectedBuildState(player, world, 'RESEARCH').research.ISOTOPE_SPECTROMETRY)
      .toBe(1);

    advanceBuildQueues(world, 4);
    expect(player.isotopeSpectrometry).toBe(true);
    expect(player.buildings.CORE).toBe(1);
  });

  it('runs Construction and Yard independently while preserving same-queue projection', () => {
    const world = buildWorld({ players: 1, days: 1, seed: 41 });
    const player = world.players[0]!;
    player.alloy = 10_000;
    player.crystal = 10_000;
    player.disruptedUntil = 30;

    expect(enqueueSimBuild(player, 0, world, {
      queue: 'CONSTRUCTION', kind: 'BUILDING', subject: 'CORE', count: 1,
      cost: cost(), minutes: 10,
    })).toBe(true);
    expect(enqueueSimBuild(player, 0, world, {
      queue: 'CONSTRUCTION', kind: 'BUILDING', subject: 'REFINERY', count: 1,
      cost: cost(), minutes: 5,
    })).toBe(true);
    expect(enqueueSimBuild(player, 0, world, {
      queue: 'YARD', kind: 'HULL', subject: 'DART', count: 2,
      cost: cost(20), minutes: 7,
    })).toBe(true);

    expect(player.queues.CONSTRUCTION.map((order) => order.readyAt)).toEqual([10, 15]);
    expect(player.queues.YARD.map((order) => order.readyAt)).toEqual([7]);
    expect(projectedBuildState(player, world, 'CONSTRUCTION').buildings).toMatchObject({
      CORE: 2,
      REFINERY: 2,
    });
    // The independent Yard does not borrow Construction's future Core state.
    expect(projectedBuildState(player, world, 'YARD').buildings.CORE).toBe(1);

    advanceBuildQueues(world, 6);
    expect(player.fleet.DART).toBeUndefined();
    expect(player.buildings.CORE).toBe(1);

    advanceBuildQueues(world, 7);
    expect(player.fleet.DART).toBe(2);
    expect(player.buildings.CORE).toBe(1);

    advanceBuildQueues(world, 10);
    expect(player.buildings.CORE).toBe(2);
    expect(player.buildings.REFINERY).toBe(1);

    advanceBuildQueues(world, 15);
    expect(player.buildings.REFINERY).toBe(2);
    expect(player.queues.CONSTRUCTION).toEqual([]);
    // Disruption stopped the Works, not either queue.
    expect(player.disruptedUntil).toBe(30);
  });

  it('enforces depth, queue ownership and the season boundary before spending', () => {
    const world = buildWorld({ players: 1, days: 1, seed: 42 });
    const player = world.players[0]!;
    player.alloy = 100;

    expect(enqueueSimBuild(player, 0, world, {
      queue: 'YARD', kind: 'BUILDING', subject: 'CORE', count: 1,
      cost: cost(), minutes: 1,
    })).toBe(false);
    for (const subject of ['CORE', 'REFINERY', 'EXTRACTOR']) {
      expect(enqueueSimBuild(player, 0, world, {
        queue: 'CONSTRUCTION', kind: 'BUILDING', subject, count: 1,
        cost: cost(), minutes: 1,
      })).toBe(true);
    }
    expect(enqueueSimBuild(player, 0, world, {
      queue: 'CONSTRUCTION', kind: 'BUILDING', subject: 'VAULT', count: 1,
      cost: cost(), minutes: 1,
    })).toBe(false);
    expect(player.alloy).toBe(70);

    const late = buildWorld({ players: 1, days: 1, seed: 43 });
    late.players[0]!.alloy = 100;
    expect(enqueueSimBuild(late.players[0]!, 1439, late, {
      queue: 'CONSTRUCTION', kind: 'BUILDING', subject: 'CORE', count: 1,
      cost: cost(), minutes: 2,
    })).toBe(false);
    expect(late.players[0]!.alloy).toBe(100);
  });

  it('keeps committed cost in Wealth until the result exists', () => {
    const world = buildWorld({ players: 1, days: 1, seed: 44 });
    const player = world.players[0]!;
    player.alloy = 1_000;
    player.crystal = 500;
    const before = totalWealth(player, world);

    expect(enqueueSimBuild(player, 0, world, {
      queue: 'CONSTRUCTION', kind: 'INSTRUMENT', subject: 'AEGIS', count: 1,
      cost: cost(100, 25), minutes: 5,
    })).toBe(true);
    expect(player.instruments.AEGIS).toBeUndefined();
    expect(totalWealth(player, world)).toBe(before);
  });

  it('applies hardware and research only at their named completion instants', () => {
    const world = buildWorld({ players: 1, days: 1, seed: 45 });
    const player = world.players[0]!;
    player.alloy = 1_000;
    player.crystal = 1_000;

    expect(enqueueSimBuild(player, 0, world, {
      queue: 'CONSTRUCTION', kind: 'SATELLITE', subject: 'FOUNDRY', count: 1,
      cost: cost(), minutes: 1,
    })).toBe(true);
    expect(enqueueSimBuild(player, 0, world, {
      queue: 'CONSTRUCTION', kind: 'INSTRUMENT', subject: 'AEGIS', count: 1,
      cost: cost(), minutes: 1,
    })).toBe(true);
    expect(enqueueSimBuild(player, 0, world, {
      queue: 'RESEARCH', kind: 'RESEARCH', subject: 'ISOTOPE_SPECTROMETRY', count: 1,
      cost: cost(), minutes: 1,
    })).toBe(true);

    advanceBuildQueues(world, 0.99);
    expect(player.orbit).not.toContain('FOUNDRY');
    expect(player.instruments.AEGIS).toBeUndefined();
    expect(player.isotopeSpectrometry).toBe(false);

    advanceBuildQueues(world, 1);
    expect(player.orbit).toContain('FOUNDRY');
    expect(player.isotopeSpectrometry).toBe(true);
    expect(player.instruments.AEGIS).toBeUndefined();

    advanceBuildQueues(world, 2);
    expect(player.instruments.AEGIS).toBe(1);
  });
});
