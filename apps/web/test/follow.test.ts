import { describe, expect, it } from 'vitest';
import {
  focusIdentity,
  focusTapDecision,
  repeatedFocusTap,
  rigAction,
  rigGestureState,
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
      focusIdentity({ kind: 'asteroid', index: 3 }),
      focusIdentity({ kind: 'thread', key: 'x' }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('distinguishes two of the same kind', () => {
    expect(focusIdentity({ kind: 'planet', id: 'a' })).not.toBe(
      focusIdentity({ kind: 'planet', id: 'b' }),
    );
    expect(focusIdentity({ kind: 'asteroid', index: 0 })).not.toBe(
      focusIdentity({ kind: 'asteroid', index: 1 }),
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
      { kind: 'asteroid', index: 4 },
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
      { kind: 'asteroid', index: 4 },
      { kind: 'asteroid', index: 5 },
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

  it.each(['capital', 'colony'])('opens a controlled %s for management on its first tap', (kind) => {
    const id = `${kind}-world`;
    expect(focusTapDecision(null, { kind: 'planet', id }, id)).toEqual({
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
