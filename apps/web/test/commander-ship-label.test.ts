import { Group, PerspectiveCamera } from 'three';
import { expect, it } from 'vitest';
import { commanderShipLabelStyle } from '../src/galaxy/CommanderShipLabel.js';

it.each([0, 6, 12, 16, 23, 24, 100, 270])('hides all commander labels past the nearby range, at distance %s', distance => {
  const ship = new Group(); const camera = new PerspectiveCamera();
  camera.position.z = distance;
  const style = commanderShipLabelStyle(ship, camera);
  expect(style.display).toBe(distance < 24 ? '' : 'none');
  if (distance <= 12) expect(style.scale).toBe('1');
  else if (distance < 24) {
    expect(Number(style.scale)).toBeCloseTo(12 / distance);
    expect(Number(style.opacity)).toBeCloseTo((24 - distance) / 12);
  }
});

it('measures flying escorts in world coordinates through translated, rotated and scaled formations', () => {
  const fleet = new Group(); const ship = new Group(); const camera = new PerspectiveCamera();
  fleet.position.x = 60; fleet.rotation.y = Math.PI / 2; fleet.scale.setScalar(2);
  ship.position.z = -2; fleet.add(ship);
  camera.position.set(56, 0, 6);
  expect(commanderShipLabelStyle(ship, camera).display).toBe('');
  camera.position.set(0, 0, 0);
  expect(commanderShipLabelStyle(ship, camera).display).toBe('none');
  fleet.position.x = 4;
  expect(commanderShipLabelStyle(ship, camera).display).toBe('');
});

it('hides labels with their fleet and in universe mode, restoring them when visible again', () => {
  const fleet = new Group(); const ship = new Group(); const camera = new PerspectiveCamera();
  fleet.add(ship); camera.position.z = 6;
  fleet.visible = false;
  expect(commanderShipLabelStyle(ship, camera).display).toBe('none');
  fleet.visible = true;
  expect(commanderShipLabelStyle(ship, camera, false).display).toBe('none');
  expect(commanderShipLabelStyle(ship, camera).display).toBe('');
});
