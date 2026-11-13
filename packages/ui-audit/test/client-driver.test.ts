import { describe, expect, it } from 'vitest';
import { clientVisits, fresh, localOnly } from '../src/drivers/client.js';
import { SURFACES } from '../src/inventory.js';

/** The ways in that need a signed-in commander on a real game server. */
const CLIENT = 'client:';
const world = { base: 'http://x', password: 'pw-123456', cadet: 'uiacadet1', starter: false };

describe('the client driver', () => {
  const visits = clientVisits(world, SURFACES);

  it('visits every client way in the inventory, under its own surface', () => {
    const expected = SURFACES.flatMap((s) => s.reach.filter((r) => r.startsWith(CLIENT)).map((r) => `${s.id} ${r}`));
    expect(visits.map((v) => `${v.surface} ${v.reach}`).sort()).toEqual(expected.sort());
  });

  it('opens the outline only on the desktop, the one screen it is drawn on', () => {
    expect(visits.find((v) => v.reach === 'client:outline')?.profiles).toEqual(['desktop']);
    expect(visits.filter((v) => v.profiles).map((v) => v.reach)).toEqual(['client:outline']);
  });

  it('leaves the handbook to a game with the starter galaxy on: without it the menu replays the flight school', () => {
    expect(visits.some((v) => v.reach === 'training:handbook')).toBe(false);
    expect(clientVisits({ ...world, starter: true }, SURFACES).map((v) => v.reach)).toContain('training:handbook');
    expect(clientVisits({ ...world, starter: true }, SURFACES).some((v) => v.reach.startsWith('client:'))).toBe(false);
  });

  it('visits every starter way, and nothing but the starter ways and the handbook, on a game with the starter galaxy on', () => {
    const starter = clientVisits({ ...world, starter: true }, SURFACES);
    const expected = SURFACES.flatMap((s) => s.reach.filter((r) => r.startsWith('starter:')).map((r) => `${s.id} ${r}`));
    expect(starter.filter((v) => v.reach !== 'training:handbook').map((v) => `${v.surface} ${v.reach}`).sort()).toEqual(expected.sort());
    expect(expected.map((e) => e.split(' ')[1]).sort()).toEqual(['starter:arrival', 'starter:crate', 'starter:drive', 'starter:jump', 'starter:repair', 'starter:tutorial', 'starter:vessel']);
    expect(visits.some((v) => v.reach.startsWith('starter:'))).toBe(false);
  });

  it('leaves the ways that wait on the game clock for last', () => {
    expect(visits.slice(-2).map((v) => v.reach).sort()).toEqual(['client:battle-replay', 'client:unknown-signal']);
  });
});

describe('a fresh commander', () => {
  it('has a name the server accepts and no other run repeats', () => {
    const a = fresh();
    const b = fresh();
    expect(a).toMatch(/^uia[a-z0-9]{6,28}$/);
    expect(a).not.toBe(b);
  });
});

/** Review of stage 1 (2026-11-13): the driver registers commanders and posts chat; never on a real server. */
describe('where the client driver may play', () => {
  it('plays only on this machine', () => {
    for (const base of ['http://127.0.0.1:5232', 'http://localhost:5232', 'http://[::1]:5232']) expect(() => { localOnly(base); }).not.toThrow();
    for (const base of ['https://asteraonline.com', 'http://10.0.0.5:5232', 'http://localhost.evil.example']) expect(() => { localOnly(base); }).toThrow(/local/);
  });
});
