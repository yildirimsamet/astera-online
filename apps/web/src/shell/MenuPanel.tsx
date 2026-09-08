import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnnouncements, useRewards } from '../api/queries.js';
import {
  setMusicEnabled,
  setMusicVolume,
  useMusicEnabled,
  useMusicVolume,
} from '../lib/music.js';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../lib/haptics.js';
import { untilReady } from '../lib/time.js';
import {
  RENDER_QUALITIES,
  setRenderQuality,
  useRenderQuality,
  type RenderQuality,
} from '../lib/quality.js';
import { Button, Note, Section, Segmented, type Segment } from '../ui/kit/index.js';
import {
  ChevronIcon,
  BellIcon,
  GalaxyIcon,
  LeaderboardIcon,
  RewardIcon,
  SendIcon,
  LockIcon,
  SpeakerOffIcon,
  SpeakerOnIcon,
  GuideIcon,
} from '../ui/icons/index.js';
import { LanguageSwitch } from '../ui/LanguageSwitch.js';
import { GUIDE_URL } from './guide.js';
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
  ended = false,
  hasSeasonResult = false,
  inSilentSpace = false,
  rival = null,
  rivalLost = false,
  onFocusRival,
  onClearRival,
  onOpen,
  onSignOut,
  onReplayAcademy,
  isAdmin = false,
}: {
  galaxy: string | null;
  shard: string | null;
  endsAt: Date | null;
  ended?: boolean;
  hasSeasonResult?: boolean;
  inSilentSpace?: boolean;
  rival?: { owner: string; name: string } | null;
  rivalLost?: boolean;
  onFocusRival?: () => void;
  onClearRival?: () => void;
  onOpen: (panel: Panel) => void;
  onSignOut: () => void;
  onReplayAcademy?: () => void;
  isAdmin?: boolean;
}) {
  const { t } = useTranslation();
  const hoursLeft = endsAt === null ? null : (endsAt.getTime() - serverNow()) / 3_600_000;
  const waiting = useRewards().data?.claimable ?? 0;
  const announcementData = useAnnouncements().data;
  const announcementWaiting = announcementData?.announcements.filter((row) => !row.seen).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/**
       * WHAT IS LEFT AFTER THE DISC TOOK THE TWO VERBS. Owner instruction.
       *
       * Research and the clan are marks on the canvas now (`DiscControls`), because
       * they are things a commander DOES and a menu is where you look things UP. A
       * second door onto either would be one door too many: two ways in to one
       * surface is how a player learns that neither is the real one.
       *
       * The leaderboard and rewards stay here. Intel moved onto the disc beside
       * the three commander actions, forming the requested four-mark grid.
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
        {inSilentSpace && <MenuRow icon={<GalaxyIcon className="size-5" />}
          label={t('silentSpace.menu')} hint={t('silentSpace.menuHint')} onClick={() => { onOpen('return'); }} />}
        {hasSeasonResult && (
          <MenuRow
            icon={<GalaxyIcon className="size-5" />}
            label={t('seasonRecap.menuLabel')}
            hint={t('seasonRecap.menuHint')}
            onClick={() => {
              onOpen('recap');
            }}
          />
        )}
        {rival && onFocusRival && (
          <MenuRow
            icon={<GalaxyIcon className="size-5" />}
            label={t('menu.rivalLabel', { commander: rival.owner })}
            hint={t('menu.rivalHint', { planet: rival.name })}
            onClick={onFocusRival}
          />
        )}
        {rivalLost && onClearRival && (
          <MenuRow
            icon={<GalaxyIcon className="size-5" />}
            label={t('menu.rivalLostLabel')}
            hint={t('menu.rivalLostHint')}
            onClick={onClearRival}
          />
        )}
        <MenuRow
          icon={<BellIcon className="size-5" />}
          label={t('menu.announcementsLabel')}
          hint={t('menu.announcementsHint')}
          attention={announcementWaiting > 0}
          {...(announcementWaiting > 0
            ? { badge: t('menu.announcementsWaiting', { count: announcementWaiting }) }
            : {})}
          onClick={() => {
            onOpen('announcements');
          }}
        />
        <MenuRow
          icon={<SendIcon className="size-5" />}
          label={t('menu.feedbackLabel')}
          hint={t('menu.feedbackHint')}
          onClick={() => {
            onOpen('feedback');
          }}
        />
        <MenuRow
          icon={<LeaderboardIcon className="size-5" />}
          label={t('menu.leaderboardLabel')}
          hint={t('menu.leaderboardHint')}
          onClick={() => {
            onOpen('leaderboard');
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
        {/*
          THE QUICK-START GUIDE, APPENDED. Owner request, and the small version of
          it on purpose: `public/hizli-baslangic-rehberi.html` is a finished
          standalone page the build already ships and Nginx already serves, so all
          that was missing was a door.

          A LINK, IN THIS TAB. It shipped as a new tab and the owner reversed it:
          on a phone that leaves a tab behind on every visit, and it costs the
          page the one control every reader already has — the browser's own back.
          The guide replaces the game here, and stepping back restores it.

          It is still not an in-game sheet. The page carries its own stylesheet
          and its own Turkish, and wrapping it would claim it is part of the
          interface while it still reads as a separate site.

          Appended after the last standing row rather than inserted, so nothing a
          commander already knows the position of moves. See `shell/guide.ts` for
          why this is provisional.
        */}
        <MenuRow
          icon={<GuideIcon className="size-5" />}
          label={t('menu.guideLabel')}
          hint={t('menu.guideHint')}
          href={GUIDE_URL}
        />
        {onReplayAcademy && <MenuRow icon={<GuideIcon className="size-5" />} label={t('academy.replay')}
          hint={t('academy.replayHint')} onClick={onReplayAcademy} />}
        {/* TODO: for now its closed */}
        {/* <MenuRow
          icon={<HeartIcon className="size-5" />}
          label={t('community.donate.menuLabel')}
          hint={t('community.donate.menuHint')}
          onClick={() => {
            onOpen('donate');
          }}
        /> */}
        {isAdmin && (
          <MenuRow
            icon={<LockIcon className="size-5" />}
            label={t('community.admin.menuLabel')}
            hint={t('community.admin.menuHint')}
            onClick={() => {
              onOpen('admin');
            }}
          />
        )}
      </div>

      {/*
        NO CUT CORNERS HERE. `Plate`'s own rule: the shear is an ACCENT for the
        directive, the commit surface, the active dock plate — never the default
        card. These two were the only cut plates on the sheet and they are the
        two least actionable things on it, a galaxy name and a clock, while the
        three pressable rows above them were plain. The accent was spent exactly
        backwards.
      */}
      <Section label={t('menu.accountHeading')}>
        <div className="grid grid-cols-2 gap-2">
          <div className="plate flex flex-col gap-1 p-2">
            <p className="legend">{t('galaxy.commander.galaxyLabel')}</p>
            <p className="name truncate">
              {galaxy ?? t('galaxy.commander.galaxyUnknown')}
            </p>
            {shard !== null && shard !== galaxy && (
              <p className="text-label text-faint">{shard}</p>
            )}
          </div>
          <div className="plate flex flex-col gap-1 p-2">
            <p className="legend">
              {ended ? t('seasonRecap.seasonLabel') : t('galaxy.commander.endsLabel')}
            </p>
            <p className="readout text-figure text-bone">
              {ended
                ? t('seasonRecap.ended')
                : hoursLeft === null
                ? t('galaxy.commander.endsUnknown')
                : untilReady(hoursLeft * 60)}
            </p>
          </div>
        </div>
        {/*
          ONE CLAUSE, UNDER THE CLOCK IT IS ABOUT.

          This was three lines of prose in the middle of a settings sheet, and it
          carried two unrelated facts: that a commander is a name and a password,
          and that the wipe resets every galaxy. The first is reassurance nobody
          reads twice; the second is a real rule, and it belongs beside the
          countdown rather than in a paragraph of its own.
        */}
        <Note>{t('galaxy.commander.wipeNote')}</Note>
      </Section>

      {/*
        THE LANGUAGE LIVES HERE, beside the galaxy and the way out.

        This is the one surface in the game that is about the ACCOUNT rather than
        the world (D21, D54), and which language you read the world in is an
        account fact — it is not a season, not a planet, and it has no business on
        a tab of the planet sheet. It also sits above sign-out rather than below,
        because the two most destructive controls on a screen should not be
        adjacent by accident.
      */}
      <Section label={t('settings.sectionLabel')}>
        <LanguageSwitch />
        <Note>{t('settings.hint')}</Note>

        {/*
          THE SOUND SWITCH, beside the language because they are the same kind of
          thing: a preference about the device you are holding rather than about
          the commander or the season. Both are stored per device for that reason.
        */}
        <SoundSwitch />

        {/*
          AND THE RESOLUTION, for the same reason both of its neighbours are here:
          it is a fact about the device in the player's hand, not about the
          commander or the season, and it is stored per device like they are.
        */}
        <QualitySwitch />
      </Section>

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
  attention = false,
  onClick,
  href,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  badge?: string;
  attention?: boolean;
  onClick?: () => void;
  /**
   * A ROW THAT GOES TO A URL IS A LINK, NOT A BUTTON.
   *
   * Every other row here opens a surface inside the app, which is a button doing
   * something. The guide is a real document at a real address, and saying so in
   * the markup is not pedantry: it is what gives a long-press or a middle-click
   * the choice of a new tab, what puts the destination in the status bar, and
   * what lets the browser's own back button lead home afterwards. Same classes,
   * same shape, same accessible name — only the element changes.
   */
  href?: string;
}) {
  const Element = href === undefined ? 'button' : 'a';
  return (
    <Element
      {...(href === undefined ? { type: 'button' as const } : { href })}
      onClick={() => {
        haptic('tap');
        onClick?.();
      }}
      /*
        THE HINT IS THE ACCESSIBLE NAME, NOT A SECOND LINE. Owner directive:
        *"gereksiz fazla yazı yerine tasarımın kendini anlattığı ... temiz premium."*

        Seven of these at two lines each is most of a 375-wide phone spent on a
        menu, and the second line was explaining destinations that name themselves:
        "Leaderboard" does not need a sentence under it, and the icon and chevron
        have already said the rest.

        MOVED rather than deleted. A screen reader still hears the whole thing, and
        the one reader who genuinely cannot infer a destination from its name is the
        reader who cannot see the icon either.
      */
      aria-label={`${label}. ${hint}`}
      className="plate flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-bone/[0.03] active:bg-raised/60"
    >
      <span
        data-attention={attention || undefined}
        className={`socket grid size-8 shrink-0 place-items-center rounded-control transition-colors ${
          attention
            ? 'border-opportunity/45 bg-opportunity/10 text-opportunity'
            : 'text-dim'
        }`}
      >
        {icon}
      </span>
      <span aria-hidden className="name min-w-0 flex-1 truncate text-bone">{label}</span>
      {badge === undefined ? null : (
        <span className="num shrink-0 rounded-full bg-opportunity/15 px-2 py-0.5 text-micro text-opportunity">
          {badge}
        </span>
      )}
      <ChevronIcon className="size-4 shrink-0 text-faint" />
    </Element>
  );
}

/**
 * ON OR OFF, AND THE GLYPH SAYS WHICH. Owner instruction.
 *
 * `aria-pressed` rather than a checkbox: this is a control with two states that
 * takes effect immediately, which is exactly what a toggle button is for, and it
 * means a screen reader announces the state rather than the player having to infer
 * it from a label that changed.
 *
 * The label changes with the state as well as the icon. A control whose only
 * signal is a picture is one a player has to test to understand.
 */
function SoundSwitch() {
  const { t } = useTranslation();
  const on = useMusicEnabled();
  const volume = useMusicVolume();
  const percent = Math.round(volume * 100);

  return (
    <div className="plate">
      <button
        type="button"
        aria-pressed={on}
        onClick={() => {
          haptic('tap');
          setMusicEnabled(!on);
        }}
        className={`flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-white/[0.025] ${ on ? 'text-bone' : 'text-faint' }`}
      >
        <span className="socket grid size-8 shrink-0 place-items-center rounded-control">
          {on ? <SpeakerOnIcon className="size-[18px]" /> : <SpeakerOffIcon className="size-[18px]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="name block">
            {t('menu.soundLabel')}
          </span>
          <span className="mt-1 block text-label leading-snug text-faint">
            {on ? t('menu.soundOn') : t('menu.soundOff')}
          </span>
        </span>
      </button>

      <label className="flex items-center gap-2 border-t border-line-soft px-3 py-3">
        <span className="legend shrink-0">{t('menu.volumeLabel')}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          aria-label={t('menu.volumeLabel')}
          style={{ '--slider-fill': `${String(percent)}%` } as CSSProperties}
          onChange={(event) => {
            setMusicVolume(event.currentTarget.valueAsNumber / 100);
          }}
          className="slider slider-crystal min-w-0 flex-1"
        />
        <output className="num w-9 shrink-0 text-right text-label text-crystal">
          {t('menu.volumeValue', { volume: percent })}
        </output>
      </label>
    </div>
  );
}

/**
 * HOW SHARP THE GALAXY IS DRAWN, AND WHAT IT COSTS THE PHONE.
 *
 * Owner instruction, raised by players reporting heat. `lib/quality.ts` carries
 * the reasoning — including why this dial is the resolution and not bloom or a
 * draw distance, both of which would spend more picture for less power.
 *
 * THREE RUNGS, NOT A SLIDER. A slider implies a continuum somebody can tune, and
 * there is nothing here to tune: there are three sensible ceilings on the device
 * pixel ratio and every value between them looks and costs the same as one of
 * them. It is also the compact form — one row of three words against a slider,
 * its track, its handle and a readout, on the phone this game is budgeted for.
 *
 * THE LINE UNDER THE NAME IS THE CURRENT RUNG'S OWN, so choosing states what was
 * chosen. `docs/interface.md` I1: a value the player cannot compare is not yet
 * information, and "Balanced" alone does not say what it balances.
 */
function QualitySwitch() {
  const { t } = useTranslation();
  const quality = useRenderQuality();

  const segments: readonly Segment<RenderQuality>[] = RENDER_QUALITIES.map((id) => ({
    id,
    label: t(`menu.quality.${id}`),
  }));

  return (
    <div className="plate px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="socket grid size-8 shrink-0 place-items-center rounded-control text-dim">
          <GalaxyIcon className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="name block">{t('menu.qualityLabel')}</span>
          <span className="mt-1 block text-label leading-snug text-faint">
            {t(`menu.qualityHint.${quality}`)}
          </span>
        </span>
      </div>

      <Segmented
        className="mt-3"
        size="sm"
        label={t('menu.qualityLabel')}
        segments={segments}
        value={quality}
        onSelect={setRenderQuality}
      />
    </div>
  );
}
