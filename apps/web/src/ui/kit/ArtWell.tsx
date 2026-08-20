import type { ReactNode } from 'react';
import { LockIcon } from '../icons/index.js';

/**
 * ART WELL — a recess that holds a render.
 *
 * The single highest-leverage component in the redesign. This project owns 37
 * genuinely expensive 3D renders and the old interface showed them at 40px in text
 * rows, where a 450px lit render of raw alloy reads as a favicon. Here the art is the
 * subject: a lit socket at 64–140px with a contact shadow, so it sits IN the panel
 * rather than on top of it.
 *
 * It also owns interface decision **I1** (`docs/interface.md`), which is a gameplay
 * rule and not a style:
 *
 *   > The artwork carries the state, the words carry the promise.
 *
 * A locked item's ART desaturates and dims behind a lock. Its NAME, its payload line
 * and its requirement stay at full strength somewhere else on the card. That split
 * exists because the previous rule — never grey anything out — produced a screen
 * where a Bulwark you cannot build looked identical to a Wasp you can, and players
 * concluded they already had everything. Dimming the whole row instead deletes the
 * ambition the game runs on. So: art dims, copy never does.
 */

export type WellTone = 'crystal' | 'alloy' | 'threat';

const TONE: Record<WellTone, string> = {
  crystal: '',
  alloy: 'socket-alloy',
  threat: 'socket-threat',
};

export function ArtWell({
  src,
  alt = '',
  locked = false,
  tone = 'crystal',
  size = 'md',
  fallback,
  className = '',
  badge,
}: {
  src?: string | null;
  alt?: string;
  /** Desaturates and dims the ART ONLY, and shows the lock. Never touches copy. */
  locked?: boolean;
  tone?: WellTone;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  /** Drawn when no render exists yet — a mark, never a borrowed render. */
  fallback?: ReactNode;
  className?: string;
  badge?: ReactNode;
}) {
  const box =
    size === 'sm' ? 'size-12' : size === 'md' ? 'size-[74px]' : size === 'lg' ? 'size-[104px]' : 'size-[150px]';

  return (
    <div className={`socket ${TONE[tone]} ${box} shrink-0 ${className}`}>
      {src == null ? (
        <span className={locked ? 'text-faint opacity-45' : 'text-dim'}>{fallback}</span>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`socket-art size-[86%] object-contain transition-[filter,opacity] duration-300 ${
            locked ? 'opacity-40 grayscale' : ''
          }`}
          // Art below the fold on a phone should not compete with the first paint.
          loading="lazy"
          decoding="async"
        />
      )}

      {locked && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="plate-sunk grid size-7 place-items-center rounded-full">
            <LockIcon className="size-4 text-dim" />
          </span>
        </span>
      )}

      {badge === undefined ? null : <span className="absolute bottom-1 right-1">{badge}</span>}
    </div>
  );
}
