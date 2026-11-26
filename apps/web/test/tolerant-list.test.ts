import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { onDroppedListItem, strictLists, tolerantList } from '../src/api/tolerantList.js';
import { intelSchema, notificationsSchema, planetSchema, reportsSchema } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/*
  OTA F4 (canlı güncelleme planı §5.3): a server one deploy ahead must not blank a whole screen for one
  row it shaped differently. The row is left out and reported once; a broken page still fails.
*/
const item = z.object({ id: z.string(), n: z.number() });
const garbage = { id: 7, kind: 'FROM_A_NEWER_SERVER' };

afterEach(() => { onDroppedListItem(() => undefined); strictLists(false); });

describe('a list read row by row', () => {
  it('keeps the rows it can read and leaves out the one it cannot', () => {
    const schema = tolerantList(item, 'test.rows');
    expect(schema.parse([{ id: 'a', n: 1 }, garbage, { id: 'b', n: 2 }])).toEqual([{ id: 'a', n: 1 }, { id: 'b', n: 2 }]);
  });

  it('reports a dropped row once per list and field, not once per row', () => {
    const report = vi.fn();
    onDroppedListItem(report);
    const schema = tolerantList(item, 'test.once');
    schema.parse([garbage, garbage]);
    schema.parse([garbage]);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('test.once', 'id');
  });

  it('fails on the row, by its place and field, where the contract tests ask it to be strict', () => {
    strictLists(true);
    const parsed = tolerantList(item, 'test.strict').safeParse([{ id: 'a', n: 1 }, garbage]);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual([1, 'id']);
  });

  it('still names its row schema, as an array does', () => {
    expect(tolerantList(item, 'test.element').element).toBe(item);
  });

  it('still fails a page whose list is missing or is not a list', () => {
    const schema = z.object({ rows: tolerantList(item, 'test.page') });
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ rows: 'nope' }).success).toBe(false);
  });
});

describe('the lists a newer server is most likely to grow', () => {
  it('Intel keeps reading past a probe report and a radar row it does not know', () => {
    const intel = intelSchema.parse({
      watching: [], radarLog: [garbage], probeCost: { alloy: 50, crystal: 30, deuterium: 0 }, probeReports: [garbage],
    });
    expect(intel.probeReports).toEqual([]);
    expect(intel.radarLog).toEqual([]);
  });

  it('battle reports and notifications keep reading past a row they do not know', () => {
    expect(reportsSchema.parse({ reports: [garbage], rivals: [] }).reports).toEqual([]);
    expect(notificationsSchema.parse({ notifications: [garbage] }).notifications).toEqual([]);
  });

  it('the planet keeps reading past an order kind it has never been taught', () => {
    const view = planetSchema.parse({ ...planetView(), queues: { CONSTRUCTION: [garbage], YARD: [garbage], REPAIR: [garbage] } });
    expect(view.queues).toEqual({ CONSTRUCTION: [], YARD: [], REPAIR: [] });
  });
});
