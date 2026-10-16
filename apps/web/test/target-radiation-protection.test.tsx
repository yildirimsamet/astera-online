import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { hpRadiationSourceSchema } from '../src/api/schemas.js';
import { TargetRadiationInstrument } from '../src/ui/TargetRadiationInstrument.js';
import { planetView } from './fixtures.js';

const owned = planetView({}, { radiationProtectionHpPerMinute: 10, radiationProtectionLevel: 10, shield: 500 });
const clouds = [hpRadiationSourceSchema.parse({ id: 'bomb', center: { x: 0, y: 0, z: 0 }, radius: 1,
  mode: 'EMIT', origin: 'BOMB', target: { kind: 'PLANET', id: owned.planet.id }, intensityHpPerMinute: 9,
  activeFrom: new Date(0), activeUntil: null, totalCapFrom: new Date(0) })];
vi.mock('../src/api/queries.js', () => ({ useGalaxy: () => ({ data: { hpRadiation: clouds } }) }));
vi.mock('../src/api/world.js', () => ({ useWorld: () => ({ worlds: [owned] }) }));

it('uses the selected owned world’s Aegis in its map dossier, keeping raw radiation visible', () => {
  const view = render(<TargetRadiationInstrument target={{ kind: 'PLANET', id: owned.planet.id }} tech={{ RADIATION_SHIELDING: 2 }} />);
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '9');
  expect(view.container).toHaveTextContent('0.00 HP/min per ship');
  expect(view.container).toHaveTextContent('Aegis absorbs 10 HP/min');
});
