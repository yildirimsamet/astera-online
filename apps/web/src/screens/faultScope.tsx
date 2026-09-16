import { createContext, useContext, type ReactNode } from 'react';
import type { FaultView } from '../api/schemas.js';

/**
 * WHICH ROWS ON THIS SCREEN ARE BROKEN. Koloni arızaları.
 *
 * A CONTEXT RATHER THAN A PROP, and the reason is the shape of `PlanetScreen`: the rows
 * are built by six different helpers — a building, an instrument, a satellite, a hull, a
 * gun, the forge — nested two and three deep under four group components. Threading a
 * map through all of them would have put a parameter on every one of those signatures to
 * answer a question only the leaf asks.
 *
 * IT CARRIES THE FAULT, NOT A BOOLEAN. The row needs the mark; the door needs the id to
 * open the right sheet with. One lookup answers both, and a boolean would have needed a
 * second one beside it that could disagree.
 */
const FaultScope = createContext<ReadonlyMap<string, FaultView>>(new Map());

export function FaultProvider({
  faults,
  children,
}: {
  faults: ReadonlyMap<string, FaultView>;
  children: ReactNode;
}) {
  return <FaultScope.Provider value={faults}>{children}</FaultScope.Provider>;
}

/**
 * The whole map, read ONCE per component.
 *
 * Not `useFault(id)`. Several of these rows are built inside a `.map()` — the hull list
 * is nineteen of them — and a hook called per iteration is a rules-of-hooks violation
 * that happens to work until the list length changes between renders. One read at the
 * top, plain `.get()` at the leaf.
 */
export const useFaults = (): ReadonlyMap<string, FaultView> => useContext(FaultScope);
