import { describe, expect, it } from 'vitest';
import { stackPlan } from '../src/stack.js';

describe('the local game stack for the client driver', () => {
  const plan = stackPlan({ run: 'r42', password: 'pw-123456', apiPort: 3231, webPort: 5232, users: 150 });

  it('names a database of its own that the capacity seed accepts as disposable', () => {
    expect(plan.database).toBe('astera_uiaudit_r42_capacity');
    expect(plan.database).toMatch(/(?:^|_)(capacity|staging|loadtest)$/);
  });

  it('seeds through the guarded capacity command, never against another database', () => {
    expect(plan.seed.args).toEqual(['--filter', '@astera/server', 'capacity:seed', '--', '--yes', '--users', '150', '--online', '0', '--seed', '99300']);
    expect(plan.seed.env).toMatchObject({ CAPACITY_SEED_CONFIRM: 'ASTERA_STAGING_ONLY', CAPACITY_PASSWORD: 'pw-123456' });
    expect(plan.seed.env.DATABASE_URL).toMatch(/\/astera_uiaudit_r42_capacity$/);
  });

  it('then stages the colonies the seed cannot make, on the same database', () => {
    expect(plan.stage.args).toEqual(['--filter', '@astera/server', 'exec', 'tsx', 'src/cli/uiAuditStage.ts', '--yes']);
    expect(plan.stage.env).toEqual({ DATABASE_URL: plan.seed.env.DATABASE_URL, CAPACITY_SEED_CONFIRM: 'ASTERA_STAGING_ONLY' });
  });

  it('runs the API on its own port with limits a measuring run will not hit, and points Vite at it', () => {
    expect(plan.api.env).toMatchObject({ PORT: '3231', ROLE: 'both', NODE_ENV: 'development', RATE_LIMIT_SIGNUP_MAX: '10000', RATE_LIMIT_AUTH_MAX: '10000' });
    expect(plan.api.env.DATABASE_URL).toBe(plan.seed.env.DATABASE_URL);
    expect(plan.web.env).toEqual({ ASTERA_API: 'http://localhost:3231' });
    expect(plan.web.args).toContain('5232');
    expect(plan.url).toBe('http://127.0.0.1:5232');
  });

  it('keeps the starter galaxy off unless the run is for it, and turns it on in the API when it is', () => {
    expect(plan.api.env.STARTER_GALAXY_ENABLED).toBe('false');
    const starter = stackPlan({ run: 'r42', password: 'pw-123456', apiPort: 3231, webPort: 5232, users: 150, starter: true });
    expect(starter.api.env.STARTER_GALAXY_ENABLED).toBe('true');
  });

  it('refuses a run id that would change the database name', () => {
    expect(() => stackPlan({ run: 'x; drop', password: 'pw-123456', apiPort: 1, webPort: 2, users: 1 })).toThrow();
  });
});
