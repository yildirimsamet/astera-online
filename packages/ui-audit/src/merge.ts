/**
 * THE PARTS OF A SCROLLED SURFACE, ADDED UP INTO ONE.
 *
 * A sheet longer than the screen is measured part by part as it scrolls. Each text and
 * target carries a page-lifetime id, so one that shows in two parts is counted once, from
 * the part where it was visible; colours, spacing and motion are counted by the page only
 * the first time it sees an element, so those simply add.
 */

import type { AuditedTarget, AuditedText, SurfaceAudit } from './audit.js';
import { hueFamilies } from './color.js';
import { atesman, sentences, textStats, words } from './readability.js';

/** Word and sentence counts over shown text; Ateşman over prose only (ten words or two sentences). */
export function readingStats(texts: readonly AuditedText[]): SurfaceAudit['stats'] {
  const shown = texts.filter((t) => t.rendered && !t.placeholder).map((t) => t.text);
  const prose = shown.filter((t) => words(t).length >= 10 || sentences(t).length >= 2).map((t) => (/[.!?…]$/.test(t) ? t : `${t}.`));
  return { ...textStats(shown), atesman: prose.length > 0 ? atesman(prose.join(' ')) : null };
}

/** Painted colours summed by value. */
export function palette(colors: readonly { rgb: [number, number, number]; weight: number }[]): SurfaceAudit['palette'] {
  const sums = new Map<string, { rgb: [number, number, number]; weight: number }>();
  for (const { rgb, weight } of colors) {
    const key = rgb.join(',');
    const known = sums.get(key);
    if (known) known.weight += weight;
    else sums.set(key, { rgb, weight });
  }
  return [...sums.values()];
}

/** First seen wins, unless a later part shows what the earlier one could not. */
function byId<T extends { id: string }>(parts: readonly (readonly T[])[], visible: (item: T) => boolean): T[] {
  const kept = new Map<string, T>();
  for (const items of parts) {
    for (const item of items) {
      const earlier = kept.get(item.id);
      if (!earlier || (!visible(earlier) && visible(item))) kept.set(item.id, item);
    }
  }
  return [...kept.values()];
}

export function mergeParts(parts: readonly SurfaceAudit[], capped: boolean): SurfaceAudit {
  const [first] = parts;
  if (!first) throw new Error('a surface needs at least one part');
  const texts = byId<AuditedText>(parts.map((p) => p.texts), (t) => t.rendered);
  const targets = byId<AuditedTarget>(parts.map((p) => p.targets), (t) => t.region !== null);
  const values: Record<string, number> = {};
  for (const p of parts) for (const [value, n] of Object.entries(p.spacing.values)) values[value] = (values[value] ?? 0) + n;
  const colors = palette(parts.flatMap((p) => p.palette));
  const elements = [...new Set(parts.flatMap((p) => p.overflow.elements))].slice(0, 20);
  return {
    ...first,
    texts,
    targets,
    stats: readingStats(texts),
    palette: colors,
    hues: hueFamilies(colors),
    spacing: { values, offGrid: parts.reduce((n, p) => n + p.spacing.offGrid, 0), total: parts.reduce((n, p) => n + p.spacing.total, 0) },
    overflow: { page: parts.some((p) => p.overflow.page), elements },
    motion: { transitions: parts.flatMap((p) => p.motion.transitions), animations: parts.flatMap((p) => p.motion.animations) },
    parts: parts.length,
    partsCapped: capped,
  };
}
