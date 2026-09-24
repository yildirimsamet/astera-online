import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { compact } from '../../lib/format.js';

type Part = 'home' | 'away' | 'queued' | 'incoming';

/**
 * YOUR COLOUR IN THREE STRENGTHS AND A PATTERN. Owner, round 2: no white or grey bars.
 * Home is the full colour, away is lighter (it is yours, just not here), queued is
 * hatched (paid, not built), and this order is striped and outlined — the one part the
 * player is deciding.
 */
const FILL: Record<Part, { className: string; style?: CSSProperties }> = {
  home: { className: 'bg-v2-self' },
  away: { className: '', style: { backgroundColor: 'color-mix(in srgb, var(--color-v2-self) 42%, transparent)' } },
  queued: {
    className: '',
    style: {
      backgroundImage:
        'repeating-linear-gradient(135deg, var(--color-v2-self) 0 2px, color-mix(in srgb, var(--color-v2-self) 22%, transparent) 2px 5px)',
    },
  },
  incoming: {
    className: 'ring-1 ring-inset ring-v2-self',
    style: {
      backgroundImage:
        'repeating-linear-gradient(90deg, var(--color-v2-self) 0 3px, color-mix(in srgb, var(--color-v2-self) 55%, transparent) 3px 6px)',
    },
  },
};

const ORDER: readonly Part[] = ['home', 'away', 'queued', 'incoming'];

const Swatch = ({ part }: { part: Part }) => (
  <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-cell ${FILL[part].className}`} style={FILL[part].style} />
);

/**
 * A WORLD'S ROOM, AND WHAT THIS ORDER TAKES OF IT. D1 (the build sheet) and D2 (the
 * Hangar and ground sections).
 *
 * The figure reads "taken +this order / total"; the bar draws each part at its share;
 * the legend names every part it draws, with the swatch it wears, and what is still
 * free. A part with nothing in it is not drawn and not named.
 */
export function RoomBar({
  label,
  total,
  home,
  away,
  queued,
  incoming = 0,
}: {
  label: string;
  total: number;
  home: number;
  away: number;
  queued: number;
  /** The order on the sheet; zero where nothing is being ordered. */
  incoming?: number;
}) {
  const { t } = useTranslation();
  const taken = home + away + queued;
  // Scaled against whichever is bigger, so an order past the end still fits the bar.
  const scale = Math.max(total, taken + incoming);
  const amounts: Record<Part, number> = { home, away, queued, incoming };
  const free = Math.max(0, total - taken - incoming);
  const share = (value: number): string => `${String(Math.round((value / scale) * 1000) / 10)}%`;

  return (
    <section data-room-bar="" className="flex flex-col gap-1.5 rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2.5">
      <p className="flex items-center justify-between gap-2">
        <span className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{label}</span>
        <span data-room-figure="" className="font-v2-mono text-caption tabular-nums text-v2-ink">
          {compact(taken)}
          {incoming > 0 && <span className="text-v2-self"> +{compact(incoming)}</span>}
          <span className="text-v2-ink-3"> / {compact(total)}</span>
        </span>
      </p>
      <span
        role="img"
        aria-label={t('roomBar.reading', { label, used: compact(taken + incoming), total: compact(total) })}
        className="flex h-2 w-full overflow-hidden rounded-full bg-v2-line"
      >
        {scale > 0 && ORDER.filter((part) => amounts[part] > 0).map((part) => (
          <span
            key={part}
            data-part={part}
            className={`h-full transition-[width] duration-200 ${FILL[part].className}`}
            style={{ ...FILL[part].style, width: share(amounts[part]) }}
          />
        ))}
      </span>
      <p data-room-legend="" className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-micro text-v2-ink-3">
        {ORDER.filter((part) => amounts[part] > 0).map((part) => (
          <span key={part} className={`flex items-center gap-1 ${part === 'incoming' ? 'text-v2-self' : ''}`}>
            <Swatch part={part} />
            {t(`roomBar.${part}`, { value: compact(amounts[part]) })}
          </span>
        ))}
        <span>{t('roomBar.free', { value: compact(free) })}</span>
      </p>
    </section>
  );
}
