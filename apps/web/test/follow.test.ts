import { describe, expect, it } from 'vitest';
import { focusIdentity, rigAction, type RigFrame } from '../src/galaxy/follow.js';
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
  following: false,
  positioned: false,
  released: false,
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

describe('what the rig does on its own', () => {
  it('follows a subject that has a position', () => {
    const act = rigAction(frame({ following: true, positioned: true }));
    expect(act).toEqual({ track: true, leash: false, release: false });
  });

  it('leashes a free camera that has drifted, with nothing selected', () => {
    expect(rigAction(frame())).toEqual({ track: false, leash: true, release: false });
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
    const act = rigAction(frame({ following: true, positioned: false }));
    expect(act.release).toBe(true);
    expect(act.leash).toBe(false);
    expect(act.track).toBe(false);
  });

  it('stays released on every frame after, and never leashes', () => {
    const act = rigAction(frame({ following: true, positioned: false, released: true }));
    expect(act.leash).toBe(false);
    expect(act.track).toBe(false);
  });

  /**
   * Even if the focus itself is dropped afterwards, a released rig is not leashed:
   * the camera must not be moved by the ABSENCE of an instruction, only by one.
   */
  it('does not leash a released camera once the selection is gone too', () => {
    expect(rigAction(frame({ released: true })).leash).toBe(false);
  });

  it('does not track while released, even if the subject comes back', () => {
    expect(rigAction(frame({ following: true, positioned: true, released: true })).track).toBe(
      false,
    );
  });

  /** An ease owns the camera until it lands; nothing else may touch it. */
  it('does nothing autonomous while an ease is running', () => {
    for (const over of [
      { following: true, positioned: true },
      { following: true, positioned: false },
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
    expect(rigAction(frame({ following: false, positioned: false })).release).toBe(false);
  });
});
