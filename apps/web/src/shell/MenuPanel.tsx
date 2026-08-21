import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRewards } from '../api/queries.js';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../lib/haptics.js';
import { duration } from '../lib/time.js';
import { Button } from '../ui/kit/index.js';
import { ChevronIcon, IntelIcon, RewardIcon } from '../ui/icons/index.js';
import { LanguageSwitch } from '../ui/LanguageSwitch.js';
import type { Panel } from '../screens/GalaxyView.jsx';

/**
 * THE MENU — everything the game has that is not the galaxy.
 *
 * It used to be `CommanderPanel`, it used to live inside `GalaxyView`, and it used
 * to hold only the account. It moved out here when the header's right-hand end ran
 * out of room (see `StatusBar`): what was three controls and a beacon is now a
 * beacon and one way in, and this is what that way in opens.
 *
 * IT IS CHROME, NOT A SCREEN, which is why it sits beside `StatusBar` and
 * `Signals` rather than in `screens/`. `GalaxyView` renders a 3D disc; nothing in
 * this file knows the disc exists, and keeping it here is what lets it be rendered
 * on its own in a test without standing up a WebGL context.
 */

/**
 * WHO YOU ARE, WHERE YOU ARE, AND HOW LONG YOU HAVE. D21.
 *
 * The only place sign-out lives, and the sheet is titled with the player's own
 * name — which is what makes the header control that opens it a way OUT and not
 * just a way in. D54's finding was that a control naming something other than what
 * it opens is not a way in at all; the pairing here is what keeps that true now
 * that the name is on the sheet rather than on the button.
 *
 * It states the galaxy by name. With ten of them, "which one am I in" stopped
 * being a question with one possible answer, and a player who cannot name their own
 * galaxy cannot tell a friend where to find them.
 *
 * The season clock came here from the header with the rest of the account. It was
 * always a readout, it was never pressable, and it is one tap away.
 */
export function MenuPanel({
  galaxy,
  shard,
  endsAt,
  onOpen,
  onSignOut,
}: {
  galaxy: string | null;
  shard: string | null;
  endsAt: Date | null;
  onOpen: (panel: Panel) => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const hoursLeft = endsAt === null ? null : (endsAt.getTime() - serverNow()) / 3_600_000;
  const waiting = useRewards().data?.claimable ?? 0;

  return (
    <div className="flex flex-col gap-5 mt-4">
      {/**
       * THE TWO WAYS IN THAT USED TO BE HEADER BUTTONS.
       *
       * They are rows rather than icons because a menu is read rather than
       * recognised: the header had room for a glyph and a tooltip nobody sees on a
       * phone, and this has room for the sentence that says what the surface is
       * for. `docs/interface.md` I5 — a permanent way in, labelled as the thing it
       * opens.
       *
       * ABOVE the account block, not below it. The two of them are what a player
       * came here to do; the galaxy name, the clock and the way out are what they
       * came here to check.
       */}
      <div className="flex flex-col gap-2">
        <MenuRow
          icon={<IntelIcon className="size-5" />}
          label={t('menu.intelLabel')}
          hint={t('menu.intelHint')}
          onClick={() => {
            onOpen('intel');
          }}
        />
        <MenuRow
          icon={<RewardIcon className="size-5" />}
          label={t('menu.rewardsLabel')}
          hint={t('menu.rewardsHint')}
          {...(waiting > 0 ? { badge: t('menu.rewardsWaiting', { count: waiting }) } : {})}
          onClick={() => {
            onOpen('rewards');
          }}
        />
      </div>

      <div>
        <p className="legend mb-2">{t('menu.accountHeading')}</p>
        <div className="grid grid-cols-2 gap-3">
        <div className="plate plate-cut plate-cut-sm p-3">
          <p className="legend">{t('galaxy.commander.galaxyLabel')}</p>
          <p className="mt-1 truncate text-[15px] text-bone">
            {galaxy ?? t('galaxy.commander.galaxyUnknown')}
          </p>
          {shard !== null && shard !== galaxy && (
            <p className="mt-0.5 text-[11px] text-faint">{shard}</p>
          )}
        </div>
        <div className="plate plate-cut plate-cut-sm p-3">
          <p className="legend">{t('galaxy.commander.endsLabel')}</p>
          <p className="readout mt-1 text-[15px] text-bone">
            {hoursLeft === null
              ? t('galaxy.commander.endsUnknown')
              : duration(Math.max(0, hoursLeft) * 60)}
          </p>
        </div>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-dim">{t('galaxy.commander.body')}</p>

      {/*
        THE LANGUAGE LIVES HERE, beside the galaxy and the way out.

        This is the one surface in the game that is about the ACCOUNT rather than
        the world (D21, D54), and which language you read the world in is an
        account fact — it is not a season, not a planet, and it has no business on
        a tab of the planet sheet. It also sits above sign-out rather than below,
        because the two most destructive controls on a screen should not be
        adjacent by accident.
      */}
      <div>
        <p className="legend mb-2">{t('settings.sectionLabel')}</p>
        <LanguageSwitch />
        <p className="mt-2 text-[11px] leading-snug text-faint">{t('settings.hint')}</p>
      </div>

      <Button variant="ghost" size="lg" full onClick={onSignOut}>
        {t('galaxy.commander.signOut')}
      </Button>
    </div>
  );
}

/**
 * ONE WAY IN, STATED RATHER THAN DRAWN.
 *
 * A chevron on the right and the label on the left: the shape a phone user reads
 * as "this goes somewhere" without being taught. The badge is a count and not a
 * dot, because there is room here for the number and the header's dot has already
 * done the job of saying THAT something is waiting.
 */
function MenuRow({
  icon,
  label,
  hint,
  badge,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className="plate flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:border-line active:bg-raised/60"
    >
      <span className="socket grid size-9 shrink-0 place-items-center rounded-md text-dim">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[13px] font-semibold uppercase tracking-[0.04em] text-bone">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-snug text-faint">{hint}</span>
      </span>
      {badge === undefined ? null : (
        <span className="num shrink-0 rounded-full bg-opportunity/15 px-2 py-0.5 text-micro text-opportunity">
          {badge}
        </span>
      )}
      <ChevronIcon className="size-4 shrink-0 text-faint" />
    </button>
  );
}
