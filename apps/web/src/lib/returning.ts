/**
 * HAS ANYONE EVER BEEN A COMMANDER ON THIS DEVICE? Owner-reported bug.
 *
 * The report, verbatim: *"siteye land oldum → onboarding bitirdim ve logout oldum
 * → tekrar preview sayfasına yönlendirildim → CLAIM YOUR PLANET butonuna
 * tıklıyorum ve başka bir serverda yeniden gezegen veriyor, yeniden onboard
 * ediyor."*
 *
 * THE SERVER WAS NEVER WRONG, AND THAT IS WHY THIS FILE IS ON THE CLIENT.
 * Reproduced against the real API: a returning player who types the SAME name and
 * password into the claim dialog is recognised, handed back their own planet, and
 * has nothing replayed. One account, one planet, one galaxy held throughout —
 * `settle()` in `player.ts` still throws `ALREADY_PLACED` for a second galaxy, and
 * `joinSeason` still returns the existing placement. Every rule survived.
 *
 * What went wrong is that the FRONT DOOR sent them down that path at all. D56 made
 * the loud control on the landing page "play ninety seconds of the real galaxy",
 * on the correct argument that a stranger should not be asked for a password
 * before they have a reason. A player who has just signed out is not a stranger —
 * and the dialog at the end of the rehearsal asks them to CREATE a commander, so
 * the natural thing to type is a new name. A new name is a new account, and a new
 * account is legitimately entitled to a seat in the frontier galaxy. Every step
 * behaved exactly as designed and the result was a second planet.
 *
 * So the door remembers. One boolean, per device, per origin.
 *
 * IT IS A HINT AND NEVER A GATE. It decides which control is loud; it locks
 * nothing. A device with storage disabled, a fresh private window, or somebody
 * else's phone simply gets the first-time door, which is the correct default and
 * not a degraded one. Nothing here is trusted by the server and nothing here can
 * keep a real new player out.
 */

const KEY = 'astera.commander';

/**
 * Storage throws rather than returning null in more places than it looks.
 *
 * Safari in private browsing, a hardened browser with site data disabled, and any
 * embedded webview with storage blocked all raise on ACCESS — not on write — so
 * even reading has to be guarded. An exception here would come out of a render
 * and take the whole front door down, which is the one screen that must never
 * fail to draw.
 */
const store = (): Storage | null => {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

/** Somebody has held a commander on this device. Called after a real session begins. */
export function rememberCommander(): void {
  try {
    store()?.setItem(KEY, '1');
  } catch {
    // A full or read-only store is not worth a word to the player.
  }
}

/** Whether the front door should lead with signing in rather than with the rehearsal. */
export function commanderKnownHere(): boolean {
  try {
    return store()?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Only for tests, and for a device somebody wants to hand over clean. */
export function forgetCommander(): void {
  try {
    store()?.removeItem(KEY);
  } catch {
    // As above.
  }
}
