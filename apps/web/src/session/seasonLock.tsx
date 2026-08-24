import { createContext, useContext, type ReactNode } from 'react';

/**
 * WHETHER THE SEASON IS OVER, AND THEREFORE WHETHER THE GAME STILL TAKES INPUT.
 *
 * A frozen season refuses every mutation server-side already — `lockSeason` sees
 * `frozen` and throws before a planet row is touched. So this is not a safety
 * mechanism; it is an honesty one. Without it the final galaxy looks playable:
 * every button is lit, and pressing one produces an error toast for a decision the
 * player was invited to make.
 */
const SeasonLocked = createContext(false);

export function SeasonLockProvider({
  locked,
  children,
}: {
  locked: boolean;
  children: ReactNode;
}) {
  return <SeasonLocked.Provider value={locked}>{children}</SeasonLocked.Provider>;
}

export const useSeasonLocked = (): boolean => useContext(SeasonLocked);

/**
 * Everything inside this stops taking input once the season is frozen.
 *
 * ONE `fieldset`, AND THAT IS THE WHOLE MECHANISM. The browser disables every form
 * control in the subtree by itself, so no button anywhere needs to know the season
 * ended and no new prop is threaded through forty rows. `display: contents` keeps
 * the element out of the layout entirely, so wrapping a surface changes nothing
 * about how it looks — and disabling propagates through it regardless, because
 * that inheritance is a DOM rule rather than a visual one.
 *
 * WHAT IT DELIBERATELY DOES NOT REACH. Taps on the 3D disc are not form controls,
 * so looking around the final galaxy still works — which is the one thing a player
 * IS invited to do after the wipe. Menu, language and sign-out live outside any
 * wrapper for the same reason.
 */
export function GameActions({ children }: { children: ReactNode }) {
  const locked = useSeasonLocked();
  return (
    <fieldset disabled={locked} className="contents">
      {children}
    </fieldset>
  );
}
