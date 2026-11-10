import { fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import EscortShip from '../src/galaxy/EscortShip.js';

vi.mock('../src/arena/hangar/shipModels.js', () => ({ useGalaxyShipModels: () => null, radial: vi.fn(), shipDecoders: vi.fn() }));
vi.mock('@react-three/drei', () => ({ Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

it('selects the parent fleet when its commander ship is tapped, including during model loading', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const select = vi.fn();
  const view = render(<EscortShip escort={{ ship: 'akinci', level: 4 }} at={[0, 0, -1]} length={1} onPointerUp={select} />);
  const ship = view.container.querySelector('[name="flight-escort"]');
  expect(ship).not.toBeNull();
  fireEvent.pointerUp(ship!);
  expect(select).toHaveBeenCalledOnce();
});
