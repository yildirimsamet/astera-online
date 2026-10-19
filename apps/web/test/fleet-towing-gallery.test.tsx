import { Children, isValidElement, type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { OwnFleets, Traffic } from '../src/galaxy/Fleets.js';
import { FleetTowingGallery } from '../src/v2/gallery/FleetTowingGallery.js';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  Canvas: ({children}: {children: ReactNode}) => <>{Children.toArray(children).filter(child => isValidElement(child) && typeof child.type === 'function')}</>,
}));
vi.mock('@react-three/drei', () => ({OrbitControls: () => null}));
vi.mock('../src/galaxy/Fleets.js', () => ({OwnFleets: vi.fn(() => null), Traffic: vi.fn(() => null)}));

it('opens a three-prize return and lets the reviewer change count and observer without an API call', () => {
  render(<FleetTowingGallery />);
  expect(screen.getByRole('button', {name: '3 gemi'})).toHaveAttribute('aria-pressed', 'true');
  const own = () => vi.mocked(OwnFleets).mock.calls.at(-1)![0].pending[0]!;
  expect(own()).toMatchObject({leg: 'return', towing: {DART: 2, TALON: 1}});
  fireEvent.click(screen.getByRole('button', {name: '1 gemi'}));
  expect(own().towing).toEqual({TALON: 1});
  fireEvent.click(screen.getByRole('button', {name: '2 gemi'}));
  expect(own().towing).toEqual({DART: 1, TALON: 1});
  const fleet = own().fleet;
  fireEvent.click(screen.getByRole('button', {name: 'Diğer oyuncu'}));
  expect(vi.mocked(Traffic).mock.calls.at(-1)![0].contacts[0]).toMatchObject({kind: 'fleet', fleet, towing: {DART: 1, TALON: 1}});
});
