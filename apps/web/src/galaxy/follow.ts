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
  if (focus.kind === 'asteroid') return `asteroid:${focus.id}`;
  if (focus.kind === 'thread') return `thread:${focus.key}`;
  return `${focus.kind}:${focus.id}`;
}

/**
 * THE SECOND TAP ASKS FOR DETAIL; THE FIRST ASKS TO LOOK.
 *
 * Object identity, not object reference, is the rule: every raycast creates a new
 * focus object. A different subject must always restart collapsed, while tapping
 * the same moving craft, rock or world expands the rail without dropping focus.
 */
export function repeatedFocusTap(current: Focus | null, next: Focus | null): boolean {
  const nextIdentity = focusIdentity(next);
  return nextIdentity !== null && nextIdentity === focusIdentity(current);
}

export type FocusTapDecision =
  | { kind: 'manage'; planetId: string }
  | { kind: 'focus'; focus: Focus | null; detail: boolean };

/**
 * ONE TAP STATE MACHINE FOR THE WHOLE DISC.
 *
 * Every subject starts with LOOK. A repeated tap on a controlled world means
 * "manage"; a repeated tap anywhere else means "inspect". Clearing or changing
 * the subject always collapses detail. Keeping this pure prevents one canvas
 * callback from quietly inventing a third interaction rule.
 */
export function focusTapDecision(
  current: Focus | null,
  next: Focus | null,
  controlledPlanetId: string | null,
): FocusTapDecision {
  if (
    next?.kind === 'planet'
    && controlledPlanetId !== null
    && repeatedFocusTap(current, next)
  ) {
    return { kind: 'manage', planetId: controlledPlanetId };
  }
  return { kind: 'focus', focus: next, detail: repeatedFocusTap(current, next) };
}

/** The transfer source that survives making a focused controlled target active. */
export function transferOriginForFocus(
  activePlanetId: string | null,
  controlledPlanetId: string | null,
): string | null {
  return controlledPlanetId !== null && activePlanetId !== controlledPlanetId
    ? activePlanetId
    : null;
}

/** An already-active controlled world focuses silently: there is nowhere to transfer to. */
export function planetFocusRailVisible(
  isOwned: boolean,
  transferOriginId: string | null,
): boolean {
  return !isOwned || transferOriginId !== null;
}

export interface RigFrame {
  /** An ease is already in progress; it owns the camera until it lands. */
  easing: boolean;
  /** The player still has a semantic selection, even if its render row vanished. */
  focused: boolean;
  /** The selected subject currently has a position in the scene. */
  positioned: boolean;
  /** This selection produced a position at least once. */
  acquired: boolean;
  /** Who currently owns the camera. */
  mode: 'follow' | 'released' | 'manual';
}

export interface RigAction {
  /** Move the pivot with the subject, keeping the player's angle. */
  track: boolean;
  /** Walk the pivot back inside the disc. */
  leash: boolean;
  /** Latch free-look: the subject just ended. */
  release: boolean;
  /** A late-mounted subject can now be framed exactly once. */
  acquire: boolean;
  /** A disappearing subject must stop an unfinished re-frame immediately. */
  cancelEase: boolean;
}

export interface RigGestureState {
  mode: 'follow' | 'manual';
  acquired: boolean;
}

/**
 * WHAT A CAMERA GESTURE DOES TO AN EXISTING FOCUS.
 *
 * Orbiting or zooming changes the framing; it does not deselect the thing being
 * watched. A moving subject therefore remains followed after the gesture, with
 * its per-frame delta applied to both pivot and camera. Turning every gesture
 * into `manual` mode made a fleet, rock or probe drift away while its focus rail
 * still claimed it was selected.
 *
 * A missing subject is different: touching the controls after it lands is an
 * explicit request for free-look, so manual mode is correct there.
 */
export function rigGestureState(focused: boolean, positioned: boolean): RigGestureState {
  return focused && positioned
    ? { mode: 'follow', acquired: true }
    : { mode: 'manual', acquired: false };
}

/**
 * ONE RANGE STEP, with the distinction between focus and scripted framing made
 * explicit.
 *
 * A focus may pull IN to reveal a tiny craft but must never push out a view the
 * player chose. A scripted overview is different: its promised composition only
 * exists at the requested range, so it may move in either direction.
 */
export function easedCameraRange(
  current: number,
  target: number,
  step: number,
  exact: boolean,
): number {
  if (!exact && current <= target) return current;
  const next = current + (target - current) * step;
  return exact ? next : Math.max(target, next);
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
  const ended = frame.mode === 'follow' && frame.acquired && !frame.positioned;

  return {
    track:
      frame.mode === 'follow' &&
      frame.acquired &&
      frame.positioned &&
      !frame.easing,
    /**
     * The leash runs for a genuinely free camera only — never for one that has
     * just lost what it was watching, and never once released.
     */
    leash: frame.mode === 'manual' && !frame.easing,
    release: ended,
    acquire:
      frame.mode === 'follow' &&
      frame.focused &&
      frame.positioned &&
      !frame.acquired,
    cancelEase: ended && frame.easing,
  };
}
