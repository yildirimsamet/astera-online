import { describe, expect, it } from 'vitest';
import { PUBLIC_ELSEWHERE, publicVisits } from '../src/drivers/public.js';
import { SURFACES } from '../src/inventory.js';

/** The ways in that need no account and no game server: the front door, training, arena, faults, wiki. */
const PUBLIC = /^(landing|training|arena|special|wiki):|^simulator$/;

describe('the public driver', () => {
  const visits = publicVisits('http://x', SURFACES);

  it('visits every public way in the inventory, under its own surface, except those it hands on', () => {
    const expected = SURFACES.flatMap((s) => s.reach.filter((r) => PUBLIC.test(r) && !(r in PUBLIC_ELSEWHERE)).map((r) => `${s.id} ${r}`));
    expect(visits.map((v) => `${v.surface} ${v.reach}`).sort()).toEqual(expected.sort());
  });

  it('says why and where each way it hands on is measured', () => {
    const inventory = new Set(SURFACES.flatMap((s) => s.reach));
    for (const [reach, why] of Object.entries(PUBLIC_ELSEWHERE)) {
      expect(inventory.has(reach as never), reach).toBe(true);
      expect(why?.length ?? 0).toBeGreaterThan(10);
    }
  });

  it('opens the published wiki only in the languages it is published in', () => {
    for (const v of visits.filter((x) => x.reach.startsWith('wiki:'))) expect(v.langs).toEqual(['tr', 'en']);
  });
});
