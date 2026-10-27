import { describe, expect, it } from 'vitest';
import { createPilot, createSandboxWorld } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { debriefText, pilotName, readDebrief } from '../../src/arena/debrief.js';

/** "Ne oldu?" (doc 14 §Sonuç, KG-A14): who ended the flight, with what ship and from how far; or why the ship was towed. */
describe('the flight debrief', () => {
  const world = () => {
    const w = createSandboxWorld({ bots: 0 });
    const hunter = createPilot(7, 'akinci');
    hunter.p.x = w.pilot.p.x + 120; hunter.p.y = w.pilot.p.y + 90; hunter.p.z = w.pilot.p.z;
    w.drones.push(hunter);
    return w;
  };

  it('names the ship that fired the last shot and how far it stood', () => {
    const w = world(); w.pilot.phase = 'dead'; w.pilot.lastAttacker = 7;
    expect(readDebrief(w)).toEqual({ kind: 'shot', by: 7, ship: 'akinci', metres: 150 });
  });

  it('keeps the name when the shooter is out of sight, without a guessed distance', () => {
    const w = world(); w.pilot.phase = 'dead'; w.pilot.lastAttacker = 9;
    expect(readDebrief(w)).toEqual({ kind: 'shot', by: 9, ship: null, metres: null });
  });

  it('never names the decoy a pilot left behind as the shooter', () => {
    const w = world(); const copy = createPilot(8, 'kilavuz'); copy.decoyOf = 7; w.drones.unshift({ ...copy, id: 7 });
    w.pilot.phase = 'dead'; w.pilot.lastAttacker = 7;
    expect(readDebrief(w)?.kind === 'shot' && readDebrief(w)).toMatchObject({ ship: 'akinci', metres: 150 });
  });

  it('tells an empty tank from a dropped link', () => {
    const w = world(); w.pilot.phase = 'towed'; w.pilot.fuel = 0;
    expect(readDebrief(w)).toEqual({ kind: 'fuel' });
    w.pilot.fuel = 40;
    expect(readDebrief(w)).toEqual({ kind: 'link' });
  });

  it('has nothing to explain after a delivery', () => {
    const w = world(); w.pilot.phase = 'extracted';
    expect(readDebrief(w)).toBeNull();
  });

  it('names bots by their role and roster pilots by their name', () => {
    const w = world(); const c = arenaCopy();
    const net = { roles: new Map([[3, 'hunter' as const]]), names: new Map([[7, 'Bora']]) };
    expect(pilotName(3, c, w, net)).toBe(c.roles.hunter);
    expect(pilotName(7, c, w, net)).toBe('Bora');
    expect(pilotName(9, c, w, net)).toBe(`${c.rival} 9`);
  });

  it('says it in one sentence, in both languages', async () => {
    const name = (id: number) => id === 7 ? 'Bora' : 'Pilot';
    await i18n.changeLanguage('tr');
    expect(debriefText({ kind: 'shot', by: 7, ship: 'akinci', metres: 150 }, arenaCopy(), name)).toBe('Bora (Akıncı) seni 150 m\'den vurdu.');
    expect(debriefText({ kind: 'shot', by: 9, ship: null, metres: null }, arenaCopy(), name)).toBe('Pilot seni vurdu.');
    expect(debriefText({ kind: 'fuel' }, arenaCopy(), name)).toBe(arenaCopy().debrief.fuel);
    await i18n.changeLanguage('en');
    expect(debriefText({ kind: 'shot', by: 7, ship: 'akinci', metres: 150 }, arenaCopy(), name)).toBe('Bora (Akıncı) shot you down from 150 m.');
  });
});
