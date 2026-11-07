import { expect, it } from 'vitest';
import { returnMessage } from '../src/services/returnCopy.js';
it.each(['en', 'tr', 'de', 'fr', 'es', 'ja'] as const)('names real news and repair counts in %s', locale => {
  const departure = returnMessage('while_away', locale, 'test', 1, { events: [{ kind: 'departure', name: 'Vela' }] });
  expect(departure.body).toContain('Vela');
  expect(returnMessage('repair_done', locale, 'test', 1, { module: 'SHIPYARD' }).body).not.toContain('1');
  expect(returnMessage('repair_done', locale, 'test', 2).body).toContain('2');
});
it('puts battle and probes before departure and uses singular for one remaining event', () => {
  const note = returnMessage('while_away', 'en', 'test', 3, { events: [{ kind: 'departure', name: 'Vela' }, { kind: 'battle' }, { kind: 'probe' }] });
  expect(note.body).toBe('A battle report arrived. A probe scanned your ship. +1 more event.');
});

it('keeps the works noun grammatical where its name changed', () => {
  const bodies = (['fr', 'es'] as const).flatMap(locale => (['miner_home', 'repair_funded'] as const).map(kind => returnMessage(kind, locale, 'ref').body));
  for (const body of bodies) expect(body).not.toMatch(/\bla (stock de production|depósito de producción)/i);
});
