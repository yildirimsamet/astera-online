import { useCallback, useSyncExternalStore } from 'react';
import { z } from 'zod';

/** What the player picked from the advisor, and whether the advisor has spoken since the last pick ended. */
export interface AdviceMemory { pick: string | null; shown: boolean }

const FRESH: AdviceMemory = { pick: null, shown: false };
const schema = z.object({ pick: z.string().max(64).nullable(), shown: z.boolean() });
const changed = 'astera-starter-advice';
const keyOf = (vesselId: string): string => `astera.starter.advice.${vesselId}`;
/** A device that refuses storage still keeps the choice for this visit. */
const refused = new Map<string, AdviceMemory>();
/** One object per stored text, so a reader sees the same value until it changes. */
const parsed = new Map<string, AdviceMemory>();

function read(vesselId: string): AdviceMemory {
  const kept = refused.get(vesselId);
  if (kept) return kept;
  let raw: string | null;
  try { raw = localStorage.getItem(keyOf(vesselId)); } catch { return FRESH; }
  if (raw === null) return FRESH;
  let value = parsed.get(raw);
  if (!value) {
    let json: unknown = null;
    try { json = JSON.parse(raw); } catch { /* Unreadable: nothing chosen. */ }
    const result = schema.safeParse(json);
    value = result.success ? result.data : FRESH;
    parsed.set(raw, value);
  }
  return value;
}

const subscribe = (notify: () => void): (() => void) => {
  window.addEventListener(changed, notify);
  return () => { window.removeEventListener(changed, notify); };
};

/** Per ship and on this device only: a pick is a moment's intent, not a record the ship keeps. */
export function useAdviceMemory(vesselId: string | null): readonly [AdviceMemory, (next: AdviceMemory) => void] {
  const memory = useSyncExternalStore(subscribe, () => (vesselId === null ? FRESH : read(vesselId)));
  const remember = useCallback((next: AdviceMemory): void => {
    if (vesselId === null) return;
    try {
      localStorage.setItem(keyOf(vesselId), JSON.stringify(next));
      refused.delete(vesselId);
    } catch { refused.set(vesselId, next); }
    window.dispatchEvent(new Event(changed));
  }, [vesselId]);
  return [memory, remember] as const;
}
