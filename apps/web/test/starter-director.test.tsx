import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VESSEL_BAYS, VESSEL_NOSE_TURN, bayWorldPosition, starterShipYaw } from '../src/galaxy/mainSky.js';
import { VESSEL_LENGTH } from '../src/galaxy/scene.js';
import { hullSweepAt, nextLook } from '../src/galaxy/hullShift.js';
import { SCENE_WAIT_MS, SHOT_MAX_MS, playScene, resetDirector, skipBeat, useDirector, type Scene } from '../src/starter/director/director.js';
import { DirectorStage, SKIP_HOLD_MS } from '../src/starter/director/DirectorStage.js';
import { bayView, homeward, returnPose, shotPose } from '../src/starter/director/shotPose.js';
import i18n from '../src/i18n/index.js';
import { ToastProvider, useToast } from '../src/ui/Toast.js';

const sound = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/sound.js', async (importActual) => ({ ...await importActual<Record<string, unknown>>(), playSound: sound }));
const haptic = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/haptics.js', () => ({ haptic }));

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); resetDirector(); sound.mockClear(); haptic.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); resetDirector(); });

/**
 * THE DIRECTOR (plan 2026-11-18 §4 İ3, Faz 5.1). A first-time moment is shown, not pointed at: a few
 * short shots, letterboxed, the screen held for at most three seconds a shot, a tap ending the shot.
 * Each scene plays once for a ship; while one plays, the next waits its turn.
 */
const report: Scene = {
  id: 'shipReport',
  once: true,
  beats: [
    { id: 'orbit', shot: { kind: 'ship', turn: 2 }, ms: 2600, line: 'starter.director.shipReport.orbit' },
    { id: 'goal', shot: { kind: 'bay', system: 'DRIVE' }, ms: 9000, line: 'starter.director.shipReport.goal' },
  ],
};
const repair: Scene = { id: 'repair:REFINERY', once: true, beats: [{ id: 'work', shot: { kind: 'bay', system: 'REFINERY' }, ms: 2000 }] };

function Probe() {
  const now = useDirector();
  return <span data-testid="now">{now ? `${now.scene.id}/${now.beat.id}` : 'none'}</span>;
}

describe('the director\'s queue', () => {
  // Owner 2026-11-18: the report's round of the hull went by too fast; a shot may hold eight seconds.
  it('plays a scene beat by beat and holds no shot past eight seconds', () => {
    render(<Probe />);
    act(() => { playScene(report, 'ship-1'); });
    expect(screen.getByTestId('now')).toHaveTextContent('shipReport/orbit');
    act(() => { skipBeat(); });
    expect(screen.getByTestId('now')).toHaveTextContent('shipReport/goal');
    expect(SHOT_MAX_MS).toBe(8000);
    act(() => { skipBeat(); });
    expect(screen.getByTestId('now')).toHaveTextContent('none');
  });

  it('plays a scene once for a ship, on any visit, and again for another ship', () => {
    render(<Probe />);
    act(() => { playScene(report, 'ship-1'); skipBeat(); skipBeat(); });
    act(() => { playScene(report, 'ship-1'); });
    expect(screen.getByTestId('now')).toHaveTextContent('none');
    resetDirector({ keepMemory: true });
    act(() => { playScene(report, 'ship-1'); });
    expect(screen.getByTestId('now')).toHaveTextContent('none');
    act(() => { playScene(report, 'ship-2'); });
    expect(screen.getByTestId('now')).toHaveTextContent('shipReport/orbit');
  });

  it('lets the next scene wait while one plays, and never queues the same scene twice', () => {
    render(<Probe />);
    act(() => { playScene(report, 'ship-1'); playScene(repair, 'ship-1'); playScene(repair, 'ship-1'); });
    act(() => { skipBeat(); skipBeat(); });
    expect(screen.getByTestId('now')).toHaveTextContent('repair:REFINERY/work');
    act(() => { skipBeat(); });
    expect(screen.getByTestId('now')).toHaveTextContent('none');
  });
});

/**
 * Owner 2026-11-18: near the end of the first session the contact, the probe, the yard's work and its
 * first ships played one after another, moments long past. A scene that waits out of sight keeps for
 * a while only, and none plays once its moment has gone.
 */
describe('a scene that waited out of sight', () => {
  const at = (ms: number) => { vi.setSystemTime(Date.now() + ms); };
  const brief: Scene = { id: 'contact', once: true, beats: [{ id: 'turn', shot: { kind: 'wide' }, ms: 2000 }] };

  it('plays when the sky comes back soon after', () => {
    vi.useFakeTimers();
    act(() => { playScene(brief, 'ship-1'); });
    at(3000);
    render(<><DirectorStage /><Probe /></>);
    expect(screen.getByTestId('now')).toHaveTextContent('contact/turn');
  });

  it('is let go when it waited too long', () => {
    vi.useFakeTimers();
    act(() => { playScene(brief, 'ship-1'); playScene(repair, 'ship-1'); });
    at(SCENE_WAIT_MS + 1000);
    render(<><DirectorStage /><Probe /></>);
    expect(screen.getByTestId('now')).toHaveTextContent('none');
  });

  it('keeps a scene that must be seen however long it waited', () => {
    vi.useFakeTimers();
    act(() => { playScene({ ...report, keep: true }, 'ship-1'); });
    at(SCENE_WAIT_MS * 3);
    render(<><DirectorStage /><Probe /></>);
    expect(screen.getByTestId('now')).toHaveTextContent('shipReport/orbit');
  });

  it('counts the wait from when the sky was lost, for a scene that began in sight', () => {
    vi.useFakeTimers();
    const stage = render(<DirectorStage />);
    render(<Probe />);
    act(() => { playScene(brief, 'ship-1'); });
    at(SCENE_WAIT_MS * 2);
    stage.unmount();
    at(3000);
    act(() => { render(<DirectorStage />); });
    expect(screen.getByTestId('now')).toHaveTextContent('contact/turn');
  });

  it('plays nothing whose moment has passed', () => {
    render(<><DirectorStage /><Probe /></>);
    act(() => { playScene(brief, 'ship-1'); playScene({ ...repair, stale: () => true }, 'ship-1'); });
    act(() => { skipBeat(); });
    expect(screen.getByTestId('now')).toHaveTextContent('none');
  });
});

/** Owner 2026-11-18: the camera stays on a repair until it is done, and the bay comes back without a cut away. */
describe('a shot held on work under way', () => {
  const work = (until: number): Scene => ({ id: 'repair:SHIPYARD:1:work', once: false, beats: [{ id: 'weld', shot: { kind: 'bay', system: 'CARGO' }, ms: 2400, until, yields: true }] });

  it('holds until the work is due, past the longest shot, and says how long is left', () => {
    vi.useFakeTimers();
    render(<><DirectorStage /><Probe /></>);
    act(() => { playScene(work(Date.now() + 30_000), 'ship-1'); });
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByTestId('now')).toHaveTextContent('repair:SHIPYARD:1:work/weld');
    expect(screen.getByTestId('director-left').textContent).toMatch(/10/u);
    act(() => { vi.advanceTimersByTime(11_000); });
    expect(screen.getByTestId('now')).toHaveTextContent('none');
  });

  it('gives way at once to the scene that shows the work done', () => {
    vi.useFakeTimers();
    render(<><DirectorStage /><Probe /></>);
    act(() => { playScene(work(Date.now() + 30_000), 'ship-1'); });
    act(() => { vi.advanceTimersByTime(5_000); });
    act(() => { playScene(repair, 'ship-1'); });
    expect(screen.getByTestId('now')).toHaveTextContent('repair:REFINERY/work');
  });
});

describe('the stage', () => {
  it('letterboxes the screen and speaks the shot\'s line while a scene plays, and nothing otherwise', () => {
    render(<DirectorStage />);
    expect(screen.queryByTestId('director-stage')).toBeNull();
    act(() => { playScene(report, 'ship-1'); });
    const stage = screen.getByTestId('director-stage');
    expect(stage.querySelectorAll('[data-letterbox]')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent(/half-dead/u);
  });

  it('moves on by itself when the shot has run, never later than three seconds', () => {
    vi.useFakeTimers();
    render(<><DirectorStage /><Probe /></>);
    act(() => { playScene(report, 'ship-1'); });
    act(() => { vi.advanceTimersByTime(2600); });
    expect(screen.getByTestId('now')).toHaveTextContent('shipReport/goal');
    act(() => { vi.advanceTimersByTime(SHOT_MAX_MS); });
    expect(screen.getByTestId('now')).toHaveTextContent('none');
  });

  // Owner phone playtest 2026-11-18 (item 17): a stray tap ended a shot; a shot ends on a one-second hold.
  it('ends the shot on a one-second hold, never on a tap, and takes the press for itself', () => {
    vi.useFakeTimers();
    const under = vi.fn();
    render(<><button type="button" onClick={under}>under</button><DirectorStage /><Probe /></>);
    act(() => { playScene(report, 'ship-1'); });
    const stage = screen.getByTestId('director-stage');
    expect(SKIP_HOLD_MS).toBe(1000);
    fireEvent.pointerDown(stage);
    act(() => { vi.advanceTimersByTime(SKIP_HOLD_MS - 200); });
    fireEvent.pointerUp(stage);
    expect(stage.hasAttribute('data-holding')).toBe(false);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByTestId('now')).toHaveTextContent('shipReport/orbit');
    fireEvent.pointerDown(stage);
    expect(stage.hasAttribute('data-holding')).toBe(true);
    act(() => { vi.advanceTimersByTime(SKIP_HOLD_MS); });
    expect(screen.getByTestId('now')).toHaveTextContent('shipReport/goal');
    expect(under).not.toHaveBeenCalled();
    expect(screen.getByTestId('director-skip')).toHaveTextContent('Hold to skip');
  });

  it('runs on shot after shot while the hold goes on, and stops when it is let go', () => {
    vi.useFakeTimers();
    render(<><DirectorStage /><Probe /></>);
    act(() => { playScene(report, 'ship-1'); });
    const stage = screen.getByTestId('director-stage');
    fireEvent.pointerDown(stage);
    act(() => { vi.advanceTimersByTime(SKIP_HOLD_MS); });
    expect(screen.getByTestId('now')).toHaveTextContent('shipReport/goal');
    fireEvent.pointerCancel(stage);
    act(() => { vi.advanceTimersByTime(SKIP_HOLD_MS); });
    expect(screen.getByTestId('now')).toHaveTextContent('shipReport/goal');
    fireEvent.pointerDown(stage);
    act(() => { vi.advanceTimersByTime(SKIP_HOLD_MS); });
    expect(screen.getByTestId('now')).toHaveTextContent('none');
  });

  // Live play 2026-11-18: the galaxy's round buttons and the bell showed between the bands.
  it('clears the galaxy\'s own buttons off the screen while a scene plays, and gives them back after', () => {
    vi.useFakeTimers();
    render(<DirectorStage />);
    expect(document.documentElement.dataset.directing).toBeUndefined();
    act(() => { playScene(report, 'ship-1'); });
    expect(document.documentElement.dataset.directing).toBe('');
    act(() => { vi.advanceTimersByTime(SHOT_MAX_MS); });
    act(() => { vi.advanceTimersByTime(SHOT_MAX_MS); });
    expect(document.documentElement.dataset.directing).toBeUndefined();
    const css = readFileSync(join(import.meta.dirname, '../src/starter/director/director.css'), 'utf8');
    expect(css).toMatch(/:root\[data-directing\] \[data-galaxy-top-corners\]/u);
    expect(css).toMatch(/:root\[data-directing\] \[data-corner-buttons\]/u);
    expect(css).toMatch(/:root\[data-directing\] \[data-now-float\]/u);
    expect(css).toMatch(/:root\[data-directing\] \[data-hud-badges\]/u);
  });

  it('shows what a repair took from the stores in the stores\' own art, and nothing that was not spent', () => {
    render(<DirectorStage />);
    act(() => { playScene({ id: 'spend', once: false, beats: [{ id: 'weld', shot: { kind: 'wide' }, ms: 2000, spend: { alloy: 800, crystal: 300, deuterium: 0 } }] }, 'ship-1'); });
    const spent = screen.getByTestId('director-spend');
    expect([...spent.querySelectorAll('[data-spend]')].map(node => `${node.getAttribute('data-spend') ?? ''}:${node.textContent}`)).toEqual(['alloy:−800', 'crystal:−300']);
    expect([...spent.querySelectorAll('img')].map(img => img.getAttribute('alt'))).toEqual(['Alloy', 'Crystal']);
  });

  it('shows no spend on a shot that took nothing', () => {
    render(<DirectorStage />);
    act(() => { playScene(report, 'ship-1'); });
    expect(screen.queryByTestId('director-spend')).toBeNull();
  });

  // Live play 2026-11-18: "Refinery repaired" dropped over the letterbox while the bay came back, saying
  // what the scene was showing. News waits off a scene; a refusal still shows.
  it('keeps news off the screen while a scene plays, and lets a refusal through', () => {
    function News() {
      const say = useToast();
      return <><button type="button" onClick={() => { say('Refinery repaired'); }}>news</button><button type="button" onClick={() => { say('No room', 'error'); }}>refusal</button></>;
    }
    render(<ToastProvider><News /><DirectorStage /></ToastProvider>);
    act(() => { playScene(report, 'ship-1'); });
    fireEvent.click(screen.getByText('news'));
    expect(screen.queryByText('Refinery repaired')).toBeNull();
    fireEvent.click(screen.getByText('refusal'));
    expect(screen.getByText('No room')).toBeInTheDocument();
  });

  it('answers each shot with its sound and a touch', () => {
    render(<DirectorStage />);
    act(() => { playScene({ id: 'cue', once: false, beats: [{ id: 'a', shot: { kind: 'wide' }, ms: 1000, sound: 'charge' }] }, 'ship-1'); });
    expect(sound).toHaveBeenCalledWith('charge');
    expect(haptic).toHaveBeenCalledWith('tap');
  });
});

describe('where a shot looks', () => {
  it('finds a bay on the hull exactly where the model draws it', () => {
    const at: [number, number, number] = [40, 2, -30];
    const offset = { x: 900, y: 0, z: 400 };
    const outer = new THREE.Group();
    outer.position.set(...at);
    outer.rotation.set(0, starterShipYaw(at, offset), 0);
    outer.scale.setScalar(VESSEL_LENGTH);
    const inner = new THREE.Group();
    inner.rotation.set(0, VESSEL_NOSE_TURN, 0);
    const bay = new THREE.Object3D();
    bay.position.set(...VESSEL_BAYS.WEDGE.DRIVE);
    outer.add(inner);
    inner.add(bay);
    outer.updateMatrixWorld(true);
    const drawn = bay.getWorldPosition(new THREE.Vector3());
    const found = bayWorldPosition('WEDGE', 'DRIVE', at, offset);
    expect(found[0]).toBeCloseTo(drawn.x, 6);
    expect(found[1]).toBeCloseTo(drawn.y, 6);
    expect(found[2]).toBeCloseTo(drawn.z, 6);
  });

  it('swings the camera round the subject by the shot\'s turn, keeping its height', () => {
    const pose = shotPose({ target: [0, 0, 0], camera: [0, 2, 5] }, { to: [1, 0, 0], range: 3, turn: Math.PI / 2 });
    expect(pose.to).toEqual([1, 0, 0]);
    expect(pose.range).toBe(3);
    const side = pose.towards;
    expect(side[0]).toBeCloseTo(5 / Math.hypot(2, 5), 6);
    expect(side[1]).toBeCloseTo(2 / Math.hypot(2, 5), 6);
    expect(side[2]).toBeCloseTo(0, 6);
  });

  it('keeps the side it looks from when the shot names no turn', () => {
    const pose = shotPose({ target: [0, 0, 0], camera: [0, 0, 4] }, { to: [0, 0, 0], range: 2 });
    expect(pose.towards).toEqual([0, 0, 1]);
  });

  // Live play 2026-11-18: the drive, framed from wherever the last shot left the camera, cut the ship in half.
  it('looks at a bay from outside the hull and a little above, so the hull runs away behind it', () => {
    const side = bayView([12, 1, 3], [10, 1, 3]);
    expect(side).not.toBeNull();
    const [x, y, z] = side ?? [0, 0, 0];
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(x);
    expect(z).toBeCloseTo(0, 6);
    const pose = shotPose({ target: [0, 0, 0], camera: [0, 0, 4] }, { to: [12, 1, 3], range: 3, towards: side ?? undefined });
    expect(pose.towards).toEqual(side);
  });

  it('has no outside for a bay at the hull\'s centre: the shot keeps its own side', () => {
    expect(bayView([10, 3, 3], [10, 1, 3])).toBeNull();
  });

  // Live play 2026-11-18: a scene ended with the camera on a cut-off drive, and left the player there.
  it('ends a scene on the ship at its own range, seen from the side the player looked from before it', () => {
    const view = { target: [4, 0, -2] as const, camera: [4, 3, 2] as const };
    const back = returnPose(view, [10, 0, 0], 7);
    expect(back.to).toEqual([10, 0, 0]);
    expect(back.range).toBe(7);
    expect(back.towards[0]).toBeCloseTo(0, 6);
    expect(back.towards[1]).toBeCloseTo(0.6, 6);
    expect(back.towards[2]).toBeCloseTo(0.8, 6);
  });

  // Live play 2026-11-18: a five-second repair flew the camera to its bay, home, and back to the bay.
  it('waits a moment on the last shot before flying home, so a scene that follows starts where it is', () => {
    const view = { target: [0, 0, 0] as const, camera: [0, 0, 5] as const };
    const flight = homeward(view, false, [1, 0, 0], 7);
    expect(flight?.pose.to).toEqual([1, 0, 0]);
    expect(flight?.hold).toBeGreaterThanOrEqual(1.5);
    expect(homeward(view, true, [1, 0, 0], 7)).toBeNull();
    expect(homeward(null, false, [1, 0, 0], 7)).toBeNull();
  });
});

// Owner 2026-11-18: the hull's new look as a moment — a wave runs nose-ward along the hull, new behind it.
describe('the hull\'s new look', () => {
  it('sweeps from the tail past the nose over its time, slow at both ends', () => {
    expect(hullSweepAt(0, 1.4)).toBeLessThan(-0.5);
    expect(hullSweepAt(1.4, 1.4)).toBeGreaterThan(0.5);
    expect(hullSweepAt(0.7, 1.4)).toBeCloseTo(0, 6);
    expect(hullSweepAt(0.1, 1.4) - hullSweepAt(0, 1.4)).toBeLessThan(hullSweepAt(0.75, 1.4) - hullSweepAt(0.65, 1.4));
    expect(hullSweepAt(9, 1.4)).toBe(hullSweepAt(1.4, 1.4));
  });

  it('loads the next look ahead, so the change never waits for a download', () => {
    expect(nextLook('WRECKED')).toBe('PATCHED');
    expect(nextLook('PATCHED')).toBe('RENEWED');
    expect(nextLook('RENEWED')).toBeNull();
  });
});
