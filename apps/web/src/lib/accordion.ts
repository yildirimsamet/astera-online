import { useCallback, useState } from 'react';

/**
 * WHICH SECTIONS THIS COMMANDER LEFT OPEN, REMEMBERED PER DEVICE.
 *
 * Owner instruction: *"akordionların state'i storage'da falan saklanmalı."*
 *
 * Folding is what bought the screen back — nineteen hull rows, four research
 * bands, three route steps — but a fold the player has to undo on every visit
 * turns that saving into a tax. Somebody who lives in the Cargo band should find
 * the Cargo band open, and somebody who never opens Strategic should never see it
 * again after the first time.
 *
 * IT IS A DEVICE PREFERENCE, NOT COMMANDER STATE. The same category `MenuPanel`
 * already keeps the sound switch and the interface language in: it describes the
 * phone in their hand rather than the world, so `localStorage` is the store and
 * the server never hears about it. Losing it costs one tap.
 *
 * EVERY ACCESS IS GUARDED, and that is not defensive padding. A private window, a
 * browser set to block site data, or cleared storage throws on the ACCESS itself
 * rather than returning null — and an exception thrown while remembering a chevron
 * would take out the panel around it.
 *
 * AN EMPTY REMEMBERED SET IS AN ANSWER. "I closed all of them" has to survive the
 * next visit, so absence of the key and a stored empty array are different states;
 * only the first falls back to `initiallyOpen`.
 */

const keyFor = (surface: string): string => `astera.accordion.${surface}`;

function load(surface: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(keyFor(surface));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    // Anything but an array of strings is a foreign or corrupt value, which is an
    // ABSENT preference rather than an error to show anybody.
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return null;
  }
}

function save(surface: string, open: readonly string[]): void {
  try {
    window.localStorage.setItem(keyFor(surface), JSON.stringify(open));
  } catch {
    // A device that will not store a preference still gets the preference for as
    // long as the screen is open. Nothing about this is worth an error.
  }
}

export interface Accordion {
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
}

/**
 * @param surface a stable name for the list, so two screens never share a memory.
 * @param initiallyOpen what to open when this device has no answer yet.
 */
export function useAccordion(surface: string, initiallyOpen: readonly string[]): Accordion {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    // Lazy: storage is read once per mount rather than on every render, and the
    // seed is only consulted when the device genuinely has nothing stored.
    () => new Set(load(surface) ?? initiallyOpen),
  );

  const toggle = useCallback((id: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(surface, [...next]);
      return next;
    });
  }, [surface]);

  const isOpen = useCallback((id: string) => open.has(id), [open]);

  return { isOpen, toggle };
}
