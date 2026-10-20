import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HULLS, hullTech, shipShieldHp } from '@astera/rules';
import { HullStats } from '../src/screens/PlanetScreen.js';
import { compact } from '../src/lib/format.js';

it('shows the commander’s actual shield and hull separately, with radiation bypass explained', () => {
  const tech = { SHIP_ARMOR: 2, SHIP_SHIELDS: 3 };
  const view = render(<HullStats hull="DART" tech={tech} />);
  expect(view.container.querySelector('[data-stat="ship-shield"]')).toHaveTextContent(compact(shipShieldHp(tech, 'DART')));
  expect(view.container.querySelector('[data-stat="hull"]')).toHaveTextContent(compact(HULLS.DART.hp * hullTech(tech, 'DART').hp));
  expect(view.getByText(/Radiation damages hull directly/)).toBeInTheDocument();
});

it('does not give ground defences a personal shield', () => {
  const view = render(<HullStats hull="BASTION" tech={{ SHIP_SHIELDS: 4 }} />);
  expect(view.container.querySelector('[data-stat="ship-shield"]')).toBeNull();
});
