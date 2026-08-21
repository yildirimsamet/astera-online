import type { Focus } from './FocusPanel.js';

/**
 * WHAT THE CAMERA IS FOLLOWING, AND WHEN IT IS ALLOWED TO MOVE ON ITS OWN.
 *
 * Two owner-reported bugs came out of the same place, and both were about the rig
 * moving without being asked:
 *
 *   1. *"öylece bekliyorum, hiç bir şey yapmadan izliyorum, kafasına göre birden
 *      açı değişiyor, zoom out falan oluyor."* The rig's "ease onto a new subject"
 *      effect was keyed on a MEMOISED FUNCTION whose dependencies were the six
 *      query results behind it — `nodes`, `asteroids`, `pending`, `runs`,
 *      `contacts`, `wrecks`. Every one is a fresh array on every refetch, and in a
 *      live galaxy those refetch on each shard broadcast as well as on the
 *      sixty-second net. So the effect fired several times a minute with nobody
 *      touching anything: the pivot re-eased, and `pullTo` dollied the camera back
 *      in to the craft distance, wiping out whatever framing the player had
 *      chosen.
 *   2. *"araç hedefine vardığında focus kaybolduğu için ekran sapıtıyor ve birden
 *      rastgele uzaklaşıyor."* A followed craft stops existing the moment it lands
 *      or gets home. The rig read the missing position as "nothing is focused",
 *      which handed the frame to the LEASH — and a camera that had followed a
 *      squadron out toward the rim was dragged back toward the middle of the disc
 *      at a new angle.
 *
 * This file is the two answers, as pure functions, because both are decisions
 * about state rather than anything to do with three.js — and because a rule that
 * lives inside a `useFrame` callback is a rule no test can reach.
 */

/**
 * A STABLE NAME FOR WHAT THE PLAYER PICKED.
 *
 * The fix for the first bug. It changes when somebody selects something else and
 * at no other time — unlike the subject getter, whose identity churns with every
 * refetch of the data behind it. Everything that may RE-FRAME the camera is keyed
 * on this; everything that merely reads a live position goes through a ref.
 */
export function focusIdentity(focus: Focus | null): string | null {
  if (!focus) return null;
  if (focus.kind === 'asteroid') return `asteroid:${String(focus.index)}`;
  if (focus.kind === 'thread') return `thread:${focus.key}`;
  return `${focus.kind}:${focus.id}`;
}

export interface RigFrame {
  /** An ease is already in progress; it owns the camera until it lands. */
  easing: boolean;
  /** There is a focused thing with a getter for its position. */
  following: boolean;
  /** And that getter currently returns one. False means it has ended. */
  positioned: boolean;
  /** The rig has already been released by a subject that ended. */
  released: boolean;
}

export interface RigAction {
  /** Move the pivot with the subject, keeping the player's angle. */
  track: boolean;
  /** Walk the pivot back inside the disc. */
  leash: boolean;
  /** Latch free-look: the subject just ended. */
  release: boolean;
}

/**
 * WHAT THE RIG DOES THIS FRAME. The whole of the camera's autonomy, in one place.
 *
 * THE RULE THAT MATTERS IS THE THIRD ONE. A subject that HAD a position and no
 * longer has one has ended — landed, turned for home, or come back — and the
 * camera's answer to that is to stop driving and leave the view exactly where it
 * is. Not to re-frame, not to seek, and above all not to leash: the leash is a
 * comfort rule about a player panning into the void, and applying it to somebody
 * whose fleet just arrived is the jump this function exists to stop.
 *
 * The release is sticky, and it is cleared by the player rather than by the world:
 * touching the controls, picking something new, or pressing home. That asymmetry
 * is the point — the camera may always be moved by an instruction and never by the
 * absence of one.
 */
export function rigAction(frame: RigFrame): RigAction {
  const ended = frame.following && !frame.positioned;

  return {
    // Nothing autonomous happens while an ease is running: it owns the camera.
    track: !frame.easing && frame.positioned && !frame.released,
    /**
     * The leash runs for a genuinely free camera only — never for one that has
     * just lost what it was watching, and never once released.
     */
    leash: !frame.easing && !frame.positioned && !frame.released && !ended,
    release: ended,
  };
}
