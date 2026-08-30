import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { haptic } from '../lib/haptics.js';
import { HomeworldIcon, IntelIcon, MicroscopeIcon, WarBannerIcon } from '../ui/icons/index.js';

/**
 * THE FOUR WAYS OFF THE DISC, AS MARKS RATHER THAN AS A MENU. Owner instruction.
 *
 * Research and the clan used to be rows inside the commander sheet, behind the
 * hamburger. A menu is where you go when you already know the thing exists — and
 * these are three of the four things a commander actually DOES, so a player who never
 * opened that sheet never found out the game had research in it at all.
 *
 * ON THE CANVAS, AS GLYPHS, AND WITH NO WORDS. `docs/visual-design.md`: a labelled
 * button in the corner of a map reads as browser chrome, which is the note that put
 * the worlds glyph here in the first place. The same argument covers all four, so
 * they are one cluster and they look alike — four marks of the same size and
 * weight, in a two-by-two grid, at the same low opacity until the eye wants them.
 *
 * THE ORDER IS THE POINT OF THE GRID. Research · worlds over intel · clan, with
 * the two most-used controls on the top row. It is a stable shelf: a control
 * never moves between sessions, so the hand learns where each one is and stops
 * reading them — which is why the order lives in a test as well as in this
 * paragraph, and why the two had drifted apart.
 *
 * TEXT IS FOR THE SCREEN READER. Every label here is an `aria-label` and nothing
 * is painted, because the whole reason these are pictures is that a picture is read
 * at a glance and a word is read at a stop.
 */
export function DiscControls({
  onOpenResearch,
  onOpenClan,
  onOpenIntel,
  onOpenWorlds,
  clanAvailable,
  clanWaiting,
}: {
  onOpenResearch: () => void;
  onOpenClan: () => void;
  onOpenIntel: () => void;
  onOpenWorlds: () => void;
  /** Whether the season has a clan layer at all. No layer, no dead glyph. */
  clanAvailable: boolean;
  /** How much is waiting on the clan: an invitation, a request, unread aid. */
  clanWaiting: number;
}) {
  const { t } = useTranslation();

  return (
    <div data-disc-controls className="pointer-events-none grid grid-cols-2 gap-2">
      <Mark
        id="research"
        label={t('galaxy.openResearch')}
        onPress={onOpenResearch}
      >
        <MicroscopeIcon className="size-5" />
      </Mark>

      <Mark id="worlds" label={t('galaxy.openWorlds')} onPress={onOpenWorlds}>
        <HomeworldIcon className="size-5" />
      </Mark>


      <Mark id="intel" label={t('galaxy.openIntel')} onPress={onOpenIntel}>
        <IntelIcon className="size-5" />
      </Mark>

      <Mark
        id="clan"
        label={t('galaxy.openClan')}
        onPress={onOpenClan}
        disabled={!clanAvailable}
        {...(clanWaiting > 0 ? { waiting: true } : {})}
      >
        <WarBannerIcon className="size-5" />
      </Mark>

    </div>
  );
}

/**
 * ONE MARK, AND EVERY MARK ON THE DISC IS THIS SHAPE.
 *
 * A 40px chip is the smallest square a thumb hits reliably on a phone, and it is
 * the size the worlds glyph already was — so nothing on this screen changed size to
 * make room for the two new ones.
 *
 * THE DOT IS THE WHOLE NOTIFICATION. Not a count: a number on a map is something to
 * read, and the only question this answers is "is there something there". The count
 * lives inside the surface it opens, where there is room for it to mean something.
 */
function Mark({
  id,
  label,
  onPress,
  disabled = false,
  waiting = false,
  children,
}: {
  id: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  waiting?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-disc-control={id}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic('tap');
        onPress();
      }}
      className="pointer-events-auto relative flex size-10 items-center justify-center rounded-chip border border-line-soft/60 bg-void/35 text-dim transition-colors hover:border-line hover:text-bone active:scale-95 disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
      {waiting && (
        <span
          data-waiting
          aria-hidden
          className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-opportunity ring-2 ring-void"
        />
      )}
    </button>
  );
}
