/**
 * THE YARIK THROUGH A FRESH PAGE (S22, 2026-10-26). That phone's Chrome is a 32-bit build: with the
 * galaxy torn down in the same page the Yarık's load still died (termination status OOM), because
 * what the galaxy took is not given back to that renderer in time; a page loaded afresh is. Without
 * room (`roomyRenderer`) the way in and the way back are a reload, with a note in session storage
 * saying where the fresh page goes. With room, or with no storage to hold the note, the page stays.
 */
const KEY = 'astera.arena.door';
export type ArenaDoor = 'enter' | 'leave';

export function arenaDoor(door: ArenaDoor, { roomy, storage, reload }: { roomy: boolean; storage: Storage; reload: () => void }): 'page' | 'reload' {
  if (roomy) return 'page';
  try { storage.setItem(KEY, door); } catch { return 'page'; }
  reload();
  return 'reload';
}

/** Where a fresh page was sent, once. */
export function takeArenaDoor(storage: Storage): ArenaDoor | null {
  try {
    const door = storage.getItem(KEY);
    storage.removeItem(KEY);
    return door === 'enter' || door === 'leave' ? door : null;
  } catch { return null; }
}

/** The page's session storage, or a stand-in that holds nothing where the browser refuses it. */
export function pageStorage(): Storage {
  try { return sessionStorage; } catch { return { getItem: () => null, setItem: () => { throw new Error('no storage'); }, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 }; }
}
