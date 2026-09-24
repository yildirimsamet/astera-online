import type { ReactNode, SVGProps } from 'react';

/**
 * THE GÖZLEMEVİ ICON SET. Spec: docs/ui-v2/gozlemevi.md, "Şekil anlatır, renk sınıflandırır".
 *
 * The drawings are the sprite in `docs/ui-v2/icons.svg`, one for one; the test in
 * `test/v2/icons.test.tsx` compares every shape, so change both or neither.
 *
 * Three families, told apart by the id's prefix, and none carries a colour of its
 * own — hue means category everywhere in this interface, so the colour arrives from
 * the context the icon sits in:
 *   · `i-` interface glyphs: 24 grid, 1.75 stroke, round caps. Never the only label
 *     in navigation — a glyph there always has its word under it (spec K1).
 *   · `c-` class emblems, filled: ▲ Akıncı, ⬢ Sur, ◆ Mızrak, ● Destek. The same four
 *     shapes wherever a class appears, so the counter cycle is learned once.
 *   · `m-` map markers at 1.6: the shape says what a thing is, the colour whose it is.
 */
const SHAPES = {
  'i-galaxy': <><circle cx="12" cy="12" r="1.6" /><path d="M12 5.5c4 0 6.5 2.8 6.5 6s-2.6 5-5 5-4-1.7-4-3.6" /><path d="M12 18.5c-4 0-6.5-2.8-6.5-6s2.6-5 5-5 4 1.7 4 3.6" /></>,
  'i-base': <><circle cx="12" cy="12" r="5.5" /><path d="M5.2 15.2c-1.9 1.7-2.6 3.2-1.9 3.9 1.3 1.3 6.4-1.2 11-5.8s7.1-9.7 5.8-11c-.7-.7-2.2 0-3.9 1.9" /></>,
  'i-fleet': <><path d="M12 3l6.5 17L12 16.2 5.5 20z" /><path d="M12 3v13.2" /></>,
  'i-intel': <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  'i-clan': <><path d="M6 21V3.5" /><path d="M6 4h12l-3 4 3 4H6" /></>,
  'i-bell': <><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  'i-probe': <><circle cx="12" cy="14" r="3.2" /><path d="M12 10.8V4" /><path d="M9 4h6" /><path d="M4.5 18.5l4.6-2.7" /><path d="M19.5 18.5l-4.6-2.7" /></>,
  'i-attack': <><circle cx="12" cy="12" r="6.5" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" /><circle cx="12" cy="12" r="1.1" /></>,
  'i-transfer': <><path d="M4 8h15l-3.5-3.5" /><path d="M20 16H5l3.5 3.5" /></>,
  'i-radar': <><path d="M12 12l7-7" /><path d="M20.5 12A8.5 8.5 0 1 1 12 3.5" /><path d="M16.5 12A4.5 4.5 0 1 1 12 7.5" /></>,
  'i-telescope': <><path d="M3.5 13.5l12-6 2.2 4.2-12 6z" /><path d="M10 16.2l-2.5 5M11.2 15.6l3.3 5.6" /><path d="M17.6 7.3l2.6-1.3 1.2 2.4-2.6 1.3" /></>,
  'i-shield': <><path d="M3 18.5h18" /><path d="M4.5 18.5a7.5 7.5 0 0 1 15 0" /><path d="M8.5 18.5a3.5 3.5 0 0 1 7 0" /></>,
  'i-mine': <><path d="M12 3l5.5 6.5L12 21 6.5 9.5z" /><path d="M6.5 9.5h11" /><path d="M12 3v6.5" /></>,
  'i-trade': <><path d="M17 3.5l3 3-3 3" /><path d="M20 6.5H9.5A5.5 5.5 0 0 0 4 12" /><path d="M7 20.5l-3-3 3-3" /><path d="M4 17.5h10.5A5.5 5.5 0 0 0 20 12" /></>,
  'i-chat': <><path d="M4 5h16v11H9.5L4 20z" /></>,
  'i-settings': <><path d="M4 7h9M18 7h2M4 17h3.5M12 17h8" /><circle cx="15.5" cy="7" r="2.2" /><circle cx="9.5" cy="17" r="2.2" /></>,
  'i-clock': <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  'i-hourglass': <><path d="M6.5 3.5h11M6.5 20.5h11" /><path d="M8 3.5c0 4.2 4 5.8 4 8.5s-4 4.3-4 8.5" /><path d="M16 3.5c0 4.2-4 5.8-4 8.5s4 4.3 4 8.5" /><path d="M9.5 19.2l2.5-1.9 2.5 1.9" /></>,
  'i-lock': <><rect x="5" y="10.5" width="14" height="10" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  'i-warn': <><path d="M12 4l9 16H3z" /><path d="M12 10v4.5" /><path d="M12 17.4v.1" /></>,
  'i-play': <><path d="M8 5.5v13l10.5-6.5z" /></>,
  'i-close': <><path d="M6 6l12 12M18 6L6 18" /></>,
  'i-chev': <><path d="M9 6l6 6-6 6" /></>,
  'i-mark': <><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><circle cx="12" cy="12" r="1.6" /></>,
  'i-collect': <><path d="M12 4v10" /><path d="M8 10l4 4 4-4" /><path d="M5 19h14" /></>,
  'i-share': <><circle cx="6" cy="12" r="2.3" /><circle cx="18" cy="6" r="2.3" /><circle cx="18" cy="18" r="2.3" /><path d="M8.1 11l7.8-3.9M8.1 13l7.8 3.9" /></>,
  'i-spark': <><path d="M12 3v5M12 16v5M3 12h5M16 12h5" /><path d="M12 9.5l2.5 2.5-2.5 2.5-2.5-2.5z" /></>,
  'c-sk': <><path d="M12 3l9.5 17.5h-19z" /></>,
  'c-bw': <><path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" /></>,
  'c-ln': <><path d="M12 1.5l6.5 10.5L12 22.5 5.5 12z" /></>,
  'c-sp': <><circle cx="12" cy="12" r="8" /></>,
  'm-capital': <><path d="M12 2.5l6 9.5-6 9.5-6-9.5z" /><path d="M12 8.5l2.2 3.5-2.2 3.5-2.2-3.5z" fill="currentColor" /></>,
  'm-colony': <><path d="M12 4l8.5 15.5h-17z" /></>,
  'm-neutral': <><circle cx="12" cy="13" r="7" /><path d="M10 2.5v2.5M14 2.5v2.5" /></>,
  'm-ally': <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.2" /></>,
  'm-rival': <><circle cx="12" cy="12" r="7.5" strokeDasharray="3.2 2.6" /><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" /></>,
  'm-pirate': <><path d="M12 3l2 5 5-2-2 5 5 1-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-1-2-5 5 2z" /></>,
  'm-rock': <><path d="M8 4l7.5 1 5 6.5-3 8-8.5 1-5-7z" /></>,
  'm-debris': <><path d="M4.5 6h3.5v3.5H4.5zM14 4h2.5v2.5H14zM17 12h3.5v3.5H17zM7.5 15.5H10V18H7.5zM12 10h2.5v2.5H12z" /></>,
  'm-recover': <><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" /><path d="M19.3 16.5A8.5 8.5 0 0 1 7 19" /><path d="M4.3 15a8.5 8.5 0 0 1 3-9.5" /><path d="M13 8.5l-2 3.2 2 .9-2 3.4" /></>,
  'sel': <><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" /></>,
} satisfies Record<string, ReactNode>;

export type IconId = keyof typeof SHAPES;

export const isIconId = (id: string): id is IconId => Object.hasOwn(SHAPES, id);

type Family = Pick<SVGProps<SVGSVGElement>, 'fill' | 'stroke' | 'strokeWidth' | 'strokeLinecap' | 'strokeLinejoin'>;

const GLYPH: Family = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
const EMBLEM: Family = { fill: 'currentColor', stroke: 'none' };
const MARKER: Family = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

const familyOf = (id: IconId): Family =>
  id.startsWith('i-') ? GLYPH : id.startsWith('c-') ? EMBLEM : MARKER;

export interface IconProps {
  id: IconId;
  /** Size and colour both arrive here. Defaults to 20px, the list size. */
  className?: string;
  /** Supply only when the icon is the sole label; otherwise it stays decorative. */
  title?: string;
}

export function Icon({ id, className = 'size-5', title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      {...familyOf(id)}
      {...(title === undefined ? { 'aria-hidden': true } : { role: 'img' })}
    >
      {title === undefined ? null : <title>{title}</title>}
      {SHAPES[id]}
    </svg>
  );
}
