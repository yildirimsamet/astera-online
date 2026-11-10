import { Children, isValidElement, forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { Vector3 } from 'three';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ShipBody } from '../src/galaxy/ParkedShip.js';
import { OwnFleets } from '../src/galaxy/Fleets.js';
import HomewardShipModel from '../src/galaxy/HomewardShip.js';
import { CommanderPresenceGallery } from '../src/v2/gallery/CommanderPresenceGallery.js';

vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: { children: ReactNode }) => <>{Children.toArray(children).filter(child => isValidElement(child) && typeof child.type !== 'string')}</> }));
const orbit = vi.hoisted(() => ({ current: null as null | { target: Vector3; object: { position: Vector3 }; update: () => void; reset: () => void } }));
vi.mock('@react-three/drei', () => ({ OrbitControls: forwardRef(function Controls(_, ref) {
  useImperativeHandle(ref, () => {
    const value = { target: new Vector3(), object: { position: new Vector3(3.2, 2.4, -4.8) }, update: vi.fn(), reset: vi.fn() };
    orbit.current = value; return value;
  }, []);
  return null;
}) }));
vi.mock('../src/arena/hangar/shipModels.js', () => ({ useShipModels: () => Object.fromEntries(['akinci', 'muhafiz', 'kilavuz'].map(ship => [ship, { url: ship, engines: [], nozzle: 0.04 }])) }));
vi.mock('../src/galaxy/ParkedShip.js', () => ({ default: vi.fn(() => null), ShipBody: vi.fn(() => null) }));
vi.mock('../src/galaxy/Fleets.js', () => ({ OwnFleets: vi.fn(() => null) }));
vi.mock('../src/galaxy/HomewardShip.js', () => ({ default: vi.fn(() => null) }));
vi.mock('../src/galaxy/PlanetField.js', () => ({ PlanetField: () => null }));
vi.mock('../src/galaxy/SpaceLighting.js', () => ({ SpaceLighting: () => null }));
vi.mock('../src/galaxy/Environment.js', () => ({ Sky: () => null, BrightStars: () => null }));

it('lets the owner inspect every class, turn engines off and compare fleet and homeward renderers', () => {
  render(<CommanderPresenceGallery />);
  expect(screen.getByRole('button', { name: 'Yakınlaştır' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Uzaklaştır' })).toBeEnabled();
  expect(vi.mocked(ShipBody).mock.calls.at(-1)?.[0].model?.url).toBe('muhafiz');
  fireEvent.click(screen.getByRole('button', { name: 'Akıncı' }));
  expect(vi.mocked(ShipBody).mock.calls.at(-1)?.[0].model?.url).toBe('akinci');
  fireEvent.click(screen.getByRole('button', { name: 'Motor açık' }));
  expect(vi.mocked(ShipBody).mock.calls.at(-1)?.[0].lit).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Filo ile' }));
  expect(vi.mocked(OwnFleets).mock.calls.at(-1)?.[0].pending[0]?.admiral?.ship).toBe('akinci');
  fireEvent.click(screen.getByRole('button', { name: 'Eve dönüş' }));
  expect(vi.mocked(HomewardShipModel).mock.calls.at(-1)?.[0].home.ship).toBe('akinci');
});

it('keeps a ready model ready when its selected class or mode is pressed again', () => {
  render(<CommanderPresenceGallery />);
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Muhafız' }));
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Yakın inceleme' }));
  expect(screen.queryByRole('status')).toBeNull();
});

it('resets the camera to the current mode framing after zooming or panning', () => {
  render(<CommanderPresenceGallery />);
  fireEvent.click(screen.getByRole('button', { name: 'Filo ile' }));
  const controls = orbit.current; if (!controls) throw new Error('No controls');
  const fleet = controls.object.position.clone();
  fireEvent.click(screen.getByRole('button', { name: 'Yakınlaştır' }));
  controls.target.set(1, 2, 3);
  fireEvent.click(screen.getByRole('button', { name: 'Kamerayı sıfırla' }));
  expect(controls.object.position.toArray()).toEqual(fleet.toArray());
  expect(controls.target.length()).toBe(0);
});
