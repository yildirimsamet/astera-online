import { describe, expect, it } from 'vitest';
import {
  easedCameraRange,
  finishedCameraRange,
  focusIdentity,
  focusTapDecision,
  initialHomeCameraPosition,
  planetFocusRailVisible,
  repeatedFocusTap,
  rigAction,
  rigGestureState,
  sphericalLeashCorrection,
  transferOriginForFocus,
  type RigFrame,
} from '../src/galaxy/follow.js';
import type { Focus } from '../src/galaxy/FocusPanel.js';

/**
 * THE CAMERA'S AUTONOMY, WHICH IS THE ONLY PART OF IT A PLAYER COMPLAINS ABOUT.
 *
 * Two owner-reported bugs, one file. Both were the rig moving without being asked,
 * and both were invisible to every existing test because the rules lived inside a
 * `useFrame` callback wrapped in a WebGL canvas.
 */

const frame = (over: Partial<RigFrame> = {}): RigFrame => ({
  easing: false,
  focused: false,
  positioned: false,
  acquired: false,
  mode: 'manual',
  ...over,
});

describe('camera range intent', () => {
  it('pulls back from Home range for a scripted neighbourhood view', () => {
    expect(easedCameraRange(7, 18, 0.5, true)).toBe(12.5);
  });

  it('never pushes out a close view merely because a subject was focused', () => {
    expect(easedCameraRange(7, 18, 0.5, false)).toBe(7);
  });

  it('still pulls a distant camera inward for a small focused subject', () => {
    expect(easedCameraRange(30, 7, 0.5, false)).toBe(18.5);
  });

  it('finishes an inward Home flight at its promised range even when the pivot lands first', () => {
    expect(finishedCameraRange(7.45, 7, false)).toBe(7);
    expect(finishedCameraRange(6, 7, false)).toBe(6);
  });

  it('starts at the same offset from a high world as from every other world', () => {
    const home: [number, number, number] = [-3.05, 33.95, -20.11];
    const camera = initialHomeCameraPosition(...home);

    expect(camera.map((value, index) => value - home[index]!)).toEqual([12, 16, 20]);
  });
});

describe('spherical camera leash', () => {
  const leashRadius = 46;

  it('does not drag the valid EU-1 johnnylesh world away after Home lands', () => {
    const target: [number, number, number] = [
      -152.71 / 50,
      1697.44 / 50,
      -1005.63 / 50,
    ];

    // The world is near the top of the galaxy, but still inside its radius-40 sphere.
    expect(Math.hypot(...target)).toBeLessThan(40);
    expect(sphericalLeashCorrection(...target, leashRadius)).toBeNull();
  });

  it('keeps every valid high or diagonal point inside the spherical boundary', () => {
    expect(sphericalLeashCorrection(0, 40, 0, leashRadius)).toBeNull();
    expect(sphericalLeashCorrection(24, 32, 0, leashRadius)).toBeNull();
  });

  it('pulls a genuinely lost camera back along the same 3D direction', () => {
    const corrected = sphericalLeashCorrection(46, 46, 0, leashRadius);

    expect(corrected).not.toBeNull();
    expect(Math.hypot(...corrected!)).toBeCloseTo(leashRadius, 10);
    expect(corrected![0]).toBeCloseTo(corrected![1], 10);
    expect(corrected![2]).toBe(0);
  });
});

describe('naming what the player picked', () => {
  /**
   * THE WHOLE OF THE SECOND BUG IN ONE ASSERTION.
   *
   * The rig used to key its re-frame on a memoised getter whose dependencies were
   * six query results. Those are fresh arrays on every refetch — several times a
   * minute in a live galaxy — so a new function meant a re-frame, and the player
   * sitting still watched the camera dolly in and change angle on its own.
   *
   * The identity of the SELECTION does not move when the data behind it does.
   */
  it('is the same string for the same selection, however the object was built', () => {
    const a: Focus = { kind: 'thread', key: 'mission-7:out' };
    const b: Focus = { kind: 'thread', key: 'mission-7:out' };
    expect(a).not.toBe(b);
    expect(focusIdentity(a)).toBe(focusIdentity(b));
  });

  it('separates every kind, so two things can never share a name', () => {
    const keys = [
      focusIdentity({ kind: 'planet', id: 'x' }),
      focusIdentity({ kind: 'debris', id: 'x' }),
      focusIdentity({ kind: 'run', id: 'x' }),
      focusIdentity({ kind: 'contact', id: 'x' }),
      focusIdentity({ kind: 'asteroid', id: 'mJt7YvxMZEC5S7yYQ32SYw' }),
      focusIdentity({ kind: 'thread', key: 'x' }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('distinguishes two of the same kind', () => {
    expect(focusIdentity({ kind: 'planet', id: 'a' })).not.toBe(
      focusIdentity({ kind: 'planet', id: 'b' }),
    );
    expect(focusIdentity({ kind: 'asteroid', id: 'AAAAAAAAAAAAAAAAAAAAAA' })).not.toBe(
      focusIdentity({ kind: 'asteroid', id: 'BBBBBBBBBBBBBBBBBBBBBB' }),
    );
  });

  it('has no name for nothing selected', () => {
    expect(focusIdentity(null)).toBeNull();
  });
});

describe('first tap focuses, second tap opens detail', () => {
  it('keeps a newly selected object collapsed', () => {
    expect(repeatedFocusTap(null, { kind: 'planet', id: 'world-1' })).toBe(false);
    expect(repeatedFocusTap(
      { kind: 'planet', id: 'world-1' },
      { kind: 'planet', id: 'world-2' },
    )).toBe(false);
  });

  it('recognises a second tap by semantic identity, not object reference', () => {
    const first: Focus = { kind: 'contact', id: 'fleet-1' };
    const second: Focus = { kind: 'contact', id: 'fleet-1' };
    expect(first).not.toBe(second);
    expect(repeatedFocusTap(first, second)).toBe(true);
  });

  it('works for every selectable moving and static object kind', () => {
    const subjects: Focus[] = [
      { kind: 'planet', id: 'p' },
      { kind: 'asteroid', id: 'AAAAAAAAAAAAAAAAAAAAAA' },
      { kind: 'run', id: 'r' },
      { kind: 'thread', key: 't' },
      { kind: 'contact', id: 'c' },
      { kind: 'debris', id: 'd' },
    ];
    for (const subject of subjects) expect(repeatedFocusTap(subject, { ...subject })).toBe(true);
  });

  it('does not confuse equal ids belonging to different object kinds', () => {
    expect(repeatedFocusTap(
      { kind: 'planet', id: 'shared' },
      { kind: 'contact', id: 'shared' },
    )).toBe(false);
  });

  it('distinguishes neighbouring asteroid indices', () => {
    expect(repeatedFocusTap(
      { kind: 'asteroid', id: 'AAAAAAAAAAAAAAAAAAAAAA' },
      { kind: 'asteroid', id: 'BBBBBBBBBBBBBBBBBBBBBB' },
    )).toBe(false);
  });

  it('clears focus and detail together on an empty-space tap', () => {
    expect(focusTapDecision({ kind: 'planet', id: 'p' }, null, null)).toEqual({
      kind: 'focus',
      focus: null,
      detail: false,
    });
  });

  it('keeps detail open on a third tap instead of toggling it shut', () => {
    expect(focusTapDecision(
      { kind: 'thread', key: 'flight' },
      { kind: 'thread', key: 'flight' },
      null,
    )).toEqual({
      kind: 'focus',
      focus: { kind: 'thread', key: 'flight' },
      detail: true,
    });
  });

  it.each(['capital', 'colony'])('focuses a controlled %s on its first tap', (kind) => {
    const id = `${kind}-world`;
    expect(focusTapDecision(null, { kind: 'planet', id }, id)).toEqual({
      kind: 'focus',
      focus: { kind: 'planet', id },
      detail: false,
    });
  });

  it.each(['capital', 'colony'])('opens a focused controlled %s for management on its second tap', (kind) => {
    const id = `${kind}-world`;
    expect(focusTapDecision(
      { kind: 'planet', id },
      { kind: 'planet', id },
      id,
    )).toEqual({
      kind: 'manage',
      planetId: id,
    });
  });

  it('never treats a non-planet as management even if a caller supplies an owned id', () => {
    expect(focusTapDecision(null, { kind: 'contact', id: 'mine' }, 'mine')).toEqual({
      kind: 'focus',
      focus: { kind: 'contact', id: 'mine' },
      detail: false,
    });
  });

  it('keeps the previous active world as a transfer source for another controlled target', () => {
    expect(transferOriginForFocus('capital', 'colony')).toBe('capital');
    expect(transferOriginForFocus('colony', 'capital')).toBe('colony');
  });

  it('offers no self-transfer when the focused world was already active', () => {
    expect(transferOriginForFocus('capital', 'capital')).toBeNull();
    expect(transferOriginForFocus('capital', null)).toBeNull();
  });

  it('hides the focus rail when the controlled world was already active', () => {
    expect(planetFocusRailVisible(true, null)).toBe(false);
  });

  it('shows the focus rail for another controlled world and every foreign world', () => {
    expect(planetFocusRailVisible(true, 'capital')).toBe(true);
    expect(planetFocusRailVisible(false, null)).toBe(true);
  });
});

describe('what the rig does on its own', () => {
  it('follows a subject that has a position', () => {
    const act = rigAction(
      frame({ focused: true, positioned: true, acquired: true, mode: 'follow' }),
    );
    expect(act).toEqual({
      track: true,
      leash: false,
      release: false,
      acquire: false,
      cancelEase: false,
    });
  });

  it('leashes a free camera that has drifted, with nothing selected', () => {
    expect(rigAction(frame())).toEqual({
      track: false,
      leash: true,
      release: false,
      acquire: false,
      cancelEase: false,
    });
  });

  /**
   * THE FIRST BUG. A followed craft stops existing the moment it lands, turns for
   * home, or gets back — and the rig read that as "nothing is focused", which
   * handed the frame to the leash and dragged a camera that was out at the rim
   * back toward the middle of the disc at a new angle.
   *
   * *"focus nerede nasıl kaldıysa öylece kalsın, free looking mode'una geçsin."*
   */
  it('releases instead of leashing on the frame a followed craft ends', () => {
    const act = rigAction(
      frame({ focused: true, acquired: true, positioned: false, mode: 'follow' }),
    );
    expect(act.release).toBe(true);
    expect(act.leash).toBe(false);
    expect(act.track).toBe(false);
  });

  it('stays released on every frame after, and never leashes', () => {
    const act = rigAction(
      frame({ focused: true, acquired: true, positioned: false, mode: 'released' }),
    );
    expect(act.leash).toBe(false);
    expect(act.track).toBe(false);
  });

  /**
   * Even if the focus itself is dropped afterwards, a released rig is not leashed:
   * the camera must not be moved by the ABSENCE of an instruction, only by one.
   */
  it('does not leash a released camera once the selection is gone too', () => {
    expect(rigAction(frame({ mode: 'released' })).leash).toBe(false);
  });

  it('does not track while released, even if the subject comes back', () => {
    expect(
      rigAction(
        frame({ focused: true, acquired: true, positioned: true, mode: 'released' }),
      ).track,
    ).toBe(false);
  });

  /** An ease owns the camera until it lands; nothing else may touch it. */
  it('does nothing autonomous while an ease is running', () => {
    for (const over of [
      { focused: true, acquired: true, positioned: true, mode: 'follow' as const },
      { focused: true, acquired: false, positioned: false, mode: 'follow' as const },
      {},
    ]) {
      const act = rigAction(frame({ easing: true, ...over }));
      expect(act.track).toBe(false);
      expect(act.leash).toBe(false);
    }
  });

  /**
   * A subject that never had a position is not the same as one that lost it — a
   * selection whose data has not arrived yet must not release the rig, or the
   * first frame after picking something would put the camera into free-look.
   */
  it('releases only on a subject that ENDED, never on one still arriving', () => {
    const awaiting = rigAction(
      frame({ focused: true, acquired: false, positioned: false, mode: 'follow' }),
    );
    expect(awaiting.release).toBe(false);
    expect(awaiting.leash).toBe(false);
  });

  it('acquires a subject that mounts after the selection without moving beforehand', () => {
    const act = rigAction(
      frame({ focused: true, acquired: false, positioned: true, mode: 'follow' }),
    );
    expect(act.acquire).toBe(true);
    expect(act.track).toBe(false);
    expect(act.leash).toBe(false);
  });

  it('cancels an unfinished zoom on the exact frame its subject disappears', () => {
    const act = rigAction(
      frame({
        easing: true,
        focused: true,
        acquired: true,
        positioned: false,
        mode: 'follow',
      }),
    );
    expect(act.cancelEase).toBe(true);
    expect(act.release).toBe(true);
    expect(act.track).toBe(false);
    expect(act.leash).toBe(false);
  });

  it('only restores the boundary leash after a real user gesture', () => {
    expect(rigAction(frame({ mode: 'released' })).leash).toBe(false);
    expect(rigAction(frame({ mode: 'manual' })).leash).toBe(true);
  });
});

describe('touching the camera while something is focused', () => {
  it('keeps a positioned moving subject in follow mode', () => {
    expect(rigGestureState(true, true)).toEqual({ mode: 'follow', acquired: true });
  });

  it('enters free-look when no live subject remains', () => {
    expect(rigGestureState(true, false)).toEqual({ mode: 'manual', acquired: false });
    expect(rigGestureState(false, false)).toEqual({ mode: 'manual', acquired: false });
  });
});
