import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { galaxySchema } from '../src/api/schemas.js';
import { GalaxyCommanderName } from '../src/galaxy/GalaxyCanvas.js';
import { planetNodes } from '../src/galaxy/scene.js';
import { installCommanderNameTap, installTapGuard, wasMiss } from '../src/galaxy/tap.js';
import i18n from '../src/i18n/index.js';

beforeEach(async () => { await i18n.changeLanguage('en'); });

const PLAYER = '11111111-1111-4111-8111-111111111111';
const node = () => planetNodes([galaxySchema.shape.planets.element.parse({
  id: 'world', name: 'Kestrel', owner: 'Mira', kind: 'CAPITAL', position: { x: 0, y: 0, z: 0 },
  isSelf: false, intel: 'RESOLVED', state: { kind: 'NORMAL' },
  controller: { kind: 'PLAYER', playerId: PLAYER, displayName: 'Mira' },
})])[0]!;

/** jsdom has no layout: the name sits at x 100..180, y 50..66. */
function placeName(button: HTMLElement): void {
  button.getBoundingClientRect = () => ({
    left: 100, right: 180, top: 50, bottom: 66, width: 80, height: 16, x: 100, y: 50, toJSON: () => ({}),
  });
}

describe('a drag that starts on a commander name', () => {
  it('reaches the canvas: the name takes no pointer events of its own', () => {
    render(<GalaxyCommanderName node={node()} onOpen={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveClass('pointer-events-none');
  });
});

describe('a tap on a commander name', () => {
  const opened = vi.fn();
  let canvas: HTMLCanvasElement;
  let removeGuard: () => void;
  let removeTap: () => void;

  beforeEach(() => {
    opened.mockClear();
    canvas = document.createElement('canvas');
    document.body.append(canvas);
    render(<GalaxyCommanderName node={node()} onOpen={opened} />);
    placeName(screen.getByRole('button'));
    removeGuard = installTapGuard();
    removeTap = installCommanderNameTap();
  });
  afterEach(() => { removeTap(); removeGuard(); canvas.remove(); });

  // jsdom has no PointerEvent, so fireEvent would drop the coordinates; a MouseEvent carries them.
  const send = (type: string, target: Element, point: { x: number; y: number }): void => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: point.x, clientY: point.y }));
  };
  const press = (at: { x: number; y: number }, to = at, target: Element = canvas): void => {
    send('pointerdown', target, at);
    send('pointermove', target, to);
    send('pointerup', target, to);
  };

  it('opens the commander when the finger lifts on the name without having travelled', () => {
    press({ x: 140, y: 58 });
    expect(opened).toHaveBeenCalledOnce();
    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ id: 'world' }));
  });

  it('counts as a hit, so the empty-space handler does not clear the selection', () => {
    press({ x: 140, y: 58 });
    expect(wasMiss()).toBe(false);
  });

  it('does nothing when the finger lifts beside the name', () => {
    press({ x: 400, y: 300 });
    expect(opened).not.toHaveBeenCalled();
    expect(wasMiss()).toBe(true);
  });

  it('does nothing when the finger started on the name and dragged away (the camera turned)', () => {
    press({ x: 140, y: 58 }, { x: 140, y: 120 });
    expect(opened).not.toHaveBeenCalled();
  });

  it('does nothing when the finger dragged across the name and lifted on it', () => {
    press({ x: 20, y: 58 }, { x: 140, y: 58 });
    expect(opened).not.toHaveBeenCalled();
  });

  it('does nothing when a panel over the map took the press', () => {
    const panel = document.createElement('div');
    document.body.append(panel);
    press({ x: 140, y: 58 }, { x: 140, y: 58 }, panel);
    expect(opened).not.toHaveBeenCalled();
    panel.remove();
  });

  it('does nothing for a name whose label is hidden', () => {
    screen.getByRole('button').style.visibility = 'hidden';
    press({ x: 140, y: 58 });
    expect(opened).not.toHaveBeenCalled();
  });

  it('stops listening once removed', () => {
    removeTap();
    press({ x: 140, y: 58 });
    expect(opened).not.toHaveBeenCalled();
  });
});
