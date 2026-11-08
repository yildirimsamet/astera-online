import { describe, expect, it } from 'vitest';
import { analyticsCommand, analyticsAuth, analyticsDurableCommand } from '../src/api/analyticsCommands.js';
describe('bounded command classification', () => {
  it('identifies manual commands without sending URLs or bodies', () => {
    expect(analyticsCommand('/api/planet/upgrade')).toBe('upgrade');
    expect(analyticsCommand('/api/planets/06b7c072-bd77-435f-a31b-9458883c033f/build')).toBe('build');
    expect(analyticsCommand('/api/mining/launch')).toBe('mining');
    expect(analyticsCommand('/api/chat/send')).toBeNull();
    expect(analyticsCommand('/api/analytics/events')).toBeNull();
    expect(analyticsCommand('/api/admin/players')).toBeNull();
    expect(analyticsCommand('/api/planet/upgrade?secret=value')).toBeNull();
  });
  it('separates auth intent from a successful account creation', () => {
    expect(analyticsAuth('/api/onboarding/claim')).toBe('claim');
    expect(analyticsAuth('/api/auth/login')).toBe('login');
    expect(analyticsAuth('/api/auth/refresh')).toBeNull();
  });
});

it('matches the deployed fleet, pirate and monument command paths', () => {
  expect(analyticsCommand('/api/fleet/launch')).toBe('attack');
  expect(analyticsCommand('/api/pirates/raid')).toBe('pirates');
  expect(analyticsCommand('/api/monuments/0bb258b3-c801-4675-a7a4-a30793c1a8ab/send')).toBe('monument');
  expect(analyticsCommand('/api/monuments/:monumentId/send')).toBe('monument');
  expect(analyticsCommand('/api/monuments/:monumentId/quote')).toBeNull();
});
it('classifies social and non-durable actions while excluding quote and read acknowledgements', () => {
  expect(analyticsCommand('/api/chat/messages')).toBe('chat');
  expect(analyticsCommand('/api/clan/chat/messages')).toBe('clan_chat');
  expect(analyticsCommand('/api/clans/:clanId/apply')).toBe('clan_apply');
  expect(analyticsCommand('/api/planets/:planetId/repairs')).toBe('repair');
  expect(analyticsCommand('/api/planet/build-orders/:orderId/cancel')).toBe('cancel_build');
  expect(analyticsCommand('/api/clan/support/quote')).toBeNull();
  expect(analyticsCommand('/api/chat/read')).toBeNull();
});

it('covers deployed strategic production and launch, per-world cancellation and manual recalls', () => {
  expect(analyticsCommand('/api/death-star/launch')).toBe('death_star');
  expect(analyticsDurableCommand('/api/death-star/launch')).toBe(true);
  expect(analyticsCommand('/api/radiation-bombs/launch')).toBe('radiation_bomb');
  expect(analyticsDurableCommand('/api/radiation-bombs/launch')).toBe(false);
  expect(analyticsCommand('/api/planets/:planetId/death-star/build')).toBe('build');
  expect(analyticsCommand('/api/planets/:planetId/radiation-bombs/build')).toBe('build');
  expect(analyticsCommand('/api/planets/:planetId/interceptor/build')).toBe('build');
  expect(analyticsCommand('/api/planets/:planetId/build-orders/:orderId/cancel')).toBe('cancel_build');
  expect(analyticsCommand('/api/planets/:planetId/research-orders/:orderId/cancel')).toBe('cancel_research');
  expect(analyticsCommand('/api/fleet/:missionId/recall')).toBe('recall');
  expect(analyticsDurableCommand('/api/fleet/:missionId/recall')).toBe(false);
  expect(analyticsCommand('/api/trade/runs/:runId/recall')).toBe('recall');
  expect(analyticsCommand('/api/mining/runs/:runId/recall')).toBe('recall');
  expect(analyticsCommand('/api/pirates/raids/:raidId/recall')).toBe('recall');
});

describe('the colony ship commands', () => {
  it('names the orders the ship records, so the server can project them once from their rows', () => {
    const durable = { '/api/starter/repair': 'module_repair', '/api/starter/build': 'build', '/api/starter/research': 'research',
      '/api/starter/dock': 'dock', '/api/starter/probe': 'probe', '/api/starter/fleet/launch': 'attack',
      '/api/starter/mining/launch': 'mining', '/api/starter/mining/harvest': 'harvest' };
    for (const [path, code] of Object.entries(durable)) {
      expect(analyticsCommand(path)).toBe(code);
      expect(analyticsDurableCommand(path)).toBe(true);
    }
  });
  it('names the rest, which only the answer can confirm', () => {
    const answered = { '/api/starter/collect': 'collect', '/api/starter/fuel': 'fuel', '/api/starter/watch': 'watch',
      '/api/starter/fleet/:id/recall': 'recall', '/api/starter/mining/runs/:id/recall': 'recall',
      '/api/starter/mining/runs/0bb258b3-c801-4675-a7a4-a30793c1a8ab/recall': 'recall', '/api/starter/orders/:id/cancel': 'cancel_build' };
    for (const [path, code] of Object.entries(answered)) {
      expect(analyticsCommand(path)).toBe(code);
      expect(analyticsDurableCommand(path)).toBe(false);
    }
  });
  it('leaves out what is not a decision', () => {
    for (const path of ['/api/starter/enlist', '/api/starter/unlocks/seen', '/api/starter/crates/open', '/api/starter/notifications/seen',
      '/api/starter/return/seen', '/api/starter/chat/read', '/api/starter/migrate']) expect(analyticsCommand(path)).toBeNull();
  });
});
