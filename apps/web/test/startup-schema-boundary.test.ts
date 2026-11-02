import { expect, it, vi } from 'vitest';

vi.mock('../../../packages/rules/src/arena/structures.generated.js', () => {
  throw new Error('Front-door schemas must not initialize arena geometry');
});
vi.mock('../../../packages/rules/src/arena/catalog.generated.js', () => {
  throw new Error('Front-door schemas must not initialize arena mesh catalogue');
});

it('loads the normal API contracts without loading the arena world catalogue', async () => {
  const { commanderShipSchema } = await import('../src/api/commanderShipSchemas.js');
  expect(commanderShipSchema.safeParse({ capitalPlanetId: crypto.randomUUID(), rulesetVersion: 16, ship: null }).success).toBe(true);
  const { meSchema } = await import('../src/api/schemas.js');
  expect(meSchema).toBeDefined();
  const { describeNotification } = await import('../src/lib/notifications.js');
  expect(describeNotification).toBeTypeOf('function');
  expect((await import('../src/screens/BattleReports.js')).BattleReportDoor).toBeTypeOf('function');
  expect((await import('../src/ui/EscortRow.js')).EscortRow).toBeTypeOf('function');
});
