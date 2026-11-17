/** The lab's still frame: when set, every prototype draws this age instead of the running clock. */
export const labClock: { frozen: number | null } = { frozen: null };
export const labAge = (start: number): number => labClock.frozen ?? (Date.now() - start) / 1000;
