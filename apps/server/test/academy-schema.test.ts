import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { ACADEMY_STEPS } from '@astera/rules';
import { planets } from '../src/db/schema.js';

describe('Academy migration contract', () => {
  it('keeps the authored protocol bound explicit in schema generation', () => {
    expect(ACADEMY_STEPS).toHaveLength(40);
    expect(getTableConfig(planets).checks.map((constraint) => constraint.name))
      .toContain('planets_academy_step_check');
    expect(planets.academyStep.notNull).toBe(false);
  });
});
