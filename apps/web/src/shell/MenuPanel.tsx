import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnnouncements, useRewards } from '../api/queries.js';
import {
  formatTrackTime,
  MUSIC_TRACKS,
  nextTrack,
  prevTrack,
  setMusicEnabled,
  setMusicVolume,
  useMusicEnabled,
  useMusicPlayback,
  useMusicVolume,
} from '../lib/music.js';
import { rivalColour } from '../galaxy/PlanetField.jsx';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../lib/haptics.js';
import { untilReady } from '../lib/time.js';
import {
  RENDER_QUALITIES,
  setRenderQuality,
  useRenderQuality,
  type RenderQuality,
} from '../lib/quality.js';
import { Button, Note, Section, SectionHead, Segmented, type Segment } from '../ui/kit/index.js';
import {
  ChevronIcon,
  BellIcon,
  CloseIcon,
  GalaxyIcon,
  LeaderboardIcon,
  RewardIcon,
  SendIcon,
  LockIcon,
  SpeakerOffIcon,
  SkipIcon,
  SpeakerOnIcon,
  GuideIcon,
  // HeartIcon,
} from '../ui/icons/index.js';
import { LanguageSwitch } from '../ui/LanguageSwitch.js';
import { publisherUrl } from '../lib/publisherPages.js';
import { openConsentNotice, readConsent, reopenGoogleCmp } from '../lib/consent.js';
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
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT IS A MAP NOW, AND IT USED TO BE A PILE. Owner report:
 *
 *   *"bir gruplama yok, bir hiyeraşi yok, hangi buton nerede nasıl gösterilmeli
 *   gibi bir önem sıralaması yok. Butonlar yatay şekilde uzayıp gereksiz yer
 *   kaplıyor. Yanlış bir buton'a tıklayınca geri dönme yok direk kapatılıyor."*
 *
 * Nine destinations arrived as one undifferentiated column of identical
 * full-width rows — a season shortcut, a bug report and a resolution dial drawn
 * with exactly the same weight, each spending 350 pixels to put a glyph at one end
 * of a line and a chevron at the other. Nothing on the sheet said what mattered,
 * so a reader read all nine every time, and the ninth was below the fold.
 *
 * FOUR RANKS, AND THE SHAPE IS THE RANK. That is the whole design, and it is what
 * lets a ten-year-old and a fifty-year-old read the same sheet without a legend:
 *
 *   1 · A FULL-WIDTH, LIT ROW — something is waiting on YOU. A season that ended,
 *       a placement to apply for. Nothing else is ever allowed this shape, which
 *       is what keeps it meaning something; most sessions show none of them.
 *   2 · A CHIP — a shortcut you made yourself. Rival marks, wearing the same hue
 *       the reticle on the disc wears. Five of them are one wrapped line here and
 *       used to be five full-width rows.
 *   3 · A TILE, TWO TO A ROW, UNDER A NAMED GROUP — a place to go. The name above
 *       the pair is the hierarchy: SEASON is what you came to check, the TEAM
 *       carries the only unread counts, HELP is there for the day you need it.
 *   4 · A LINE IN A PLATE — a preference about the phone in your hand. The least
 *       touched thing in the game, and it used to be the tallest block on the
 *       sheet: three cards with their own glyphs, names and paragraphs, under a
 *       heading that read "Language".
 *
 * And the way out is last, alone, under the account — because the two most
 * destructive controls on a screen should never be adjacent by accident.
 *
 * A WRONG TAP IS RECOVERABLE. Every tile REPLACED this sheet with what it opened,
 * so closing that surface dropped the reader on the galaxy: one mis-tap cost the
 * header control plus finding your place in the list again. `returnsToMenu` in
 * `shell/panelRoute.ts` is the rule, and `Sheet`'s `onBack` is the arrow.
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
  rivals = [],
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
  /**
   * EVERY MARK THIS COMMANDER IS KEEPING, IN SLOT ORDER. D183.
   *
   * `lost` is a mark whose world is no longer on the disc — reclaimed, wiped, or
   * simply out of the payload. It gets a chip that clears THAT mark and nothing
   * else; the old single-mark version cleared the whole set, which with five marks
   * would throw away four bookmarks to tidy one.
   */
  rivals?: readonly {
    planetId: string;
    slot: number;
    owner: string;
    name: string;
    lost: boolean;
  }[];
  onFocusRival?: (planetId: string) => void;
  onClearRival?: (planetId: string) => void;
  onOpen: (panel: Panel) => void;
  onSignOut: () => void;
  onReplayAcademy?: () => void;
  isAdmin?: boolean;
}) {
  const { t, i18n } = useTranslation();
  /**
   * READ AT RENDER, NOT HELD IN STATE. The notice writes the decision straight
   * to storage and the menu is remounted every time it opens, so a read here is
   * always current — a copy in state would be the one that goes stale.
   */
  const consentHint = ((): 'consent.menuGranted' | 'consent.menuDenied' | 'consent.menuUnset' => {
    const stored = readConsent();
    if (stored === null) return 'consent.menuUnset';
    return stored.decision === 'granted' ? 'consent.menuGranted' : 'consent.menuDenied';
  })();
  const hoursLeft = endsAt === null ? null : (endsAt.getTime() - serverNow()) / 3_600_000;
  const waiting = useRewards().data?.claimable ?? 0;
  const announcementData = useAnnouncements().data;
  const announcementWaiting = announcementData?.announcements.filter((row) => !row.seen).length ?? 0;

  const marks = rivals.filter((mark) => (mark.lost ? onClearRival : onFocusRival) !== undefined);

  return (
    <div className="flex flex-col gap-4">
      {/**
       * RANK ONE — WHAT IS WAITING ON YOU, and only ever that.
       *
       * Both of these appear when the game owes the commander a decision rather
       * than when they might like one: a season whose result is readable, a
       * placement in Silent Space that has to be applied for. They are the only
       * things on this sheet drawn at full width and lit, and most sessions show
       * neither — which is exactly what makes the shape readable when one appears.
       */}
      {(inSilentSpace || hasSeasonResult) && (
        <div className="flex flex-col gap-2">
          {inSilentSpace && (
            <MenuRow
              icon={<GalaxyIcon className="size-5" />}
              label={t('silentSpace.menu')}
              hint={t('silentSpace.menuHint')}
              onClick={() => {
                onOpen('return');
              }}
            />
          )}
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
        </div>
      )}

      {/*
        RANK TWO — ONE CHIP PER MARK, WEARING ITS OWN COLOUR. D183.

        The dot is the whole identity of the chip: it is the same hue the reticle on
        the disc is drawn in, so a commander reading the menu and a commander
        reading the map are looking at one thing. A chip rather than a row because
        the entire content of a bookmark is a colour and a name — five of them used
        to be five full-width rows, some 240 pixels of a phone spent on shortcuts.

        A chip for a mark whose world has gone clears THAT mark alone; the old
        single-mark version sent `null`, which with five marks would throw four
        bookmarks away to tidy one.
      */}
      {marks.length > 0 && (
        <section data-menu-group className="flex flex-col gap-2">
          <SectionHead label={t('menu.marksHeading')} />
          <div data-rival-chips className="flex flex-wrap gap-1.5">
            {marks.map((mark) =>
              mark.lost ? (
                <RivalChip
                  key={mark.planetId}
                  slot={mark.slot}
                  face={t('menu.rivalLostShort')}
                  name={`${t('menu.rivalLostLabel')}. ${t('menu.rivalLostHint')}`}
                  lost
                  onClick={() => {
                    onClearRival?.(mark.planetId);
                  }}
                />
              ) : (
                <RivalChip
                  key={mark.planetId}
                  slot={mark.slot}
                  face={mark.owner}
                  name={`${t('menu.rivalLabel', { commander: mark.owner })}. ${t('menu.rivalHint', { planet: mark.name })}`}
                  onClick={() => {
                    onFocusRival?.(mark.planetId);
                  }}
                />
              ),
            )}
          </div>
        </section>
      )}

      {/**
       * RANK THREE — WHERE YOU CAN GO, TWO TO A ROW, UNDER A NAME.
       *
       * WHAT IS LEFT AFTER THE DISC TOOK THE VERBS. Research, the clan and Intel
       * are marks on the canvas (`DiscControls`), because they are things a
       * commander DOES and a menu is where you look things UP. A second door onto
       * any of them would be one door too many: two ways in to one surface is how a
       * player learns that neither is the real one.
       *
       * THE GROUP NAME IS THE HIERARCHY. Three words do the work that nine
       * identical rows could not — a reader can tell WITHOUT reading the tiles that
       * the leaderboard and the sound slider are different kinds of thing, which is
       * the entire complaint this sheet was rebuilt from.
       *
       * The tile's second line is gone from the face and kept on `aria-label`:
       * "Leaderboard" does not need a sentence under it, the glyph has already said
       * the rest, and seven sentences is most of a 350-wide phone. A screen reader
       * still hears the whole thing, and the one reader who genuinely cannot infer
       * a destination from its name is the reader who cannot see the glyph either.
       */}
      <MenuGroup label={t('menu.seasonHeading')}>
        <MenuTile
          icon={<LeaderboardIcon className="size-5" />}
          label={t('menu.leaderboardLabel')}
          hint={t('menu.leaderboardHint')}
          onClick={() => {
            onOpen('leaderboard');
          }}
        />
        <MenuTile
          icon={<RewardIcon className="size-5" />}
          label={t('menu.rewardsLabel')}
          hint={t('menu.rewardsHint')}
          attention={waiting > 0}
          {...(waiting > 0 ? { badge: t('menu.rewardsWaiting', { count: waiting }) } : {})}
          onClick={() => {
            onOpen('rewards');
          }}
        />
      </MenuGroup>

      <MenuGroup label={t('menu.asteraHeading')}>
        <MenuTile
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
        <MenuTile
          icon={<SendIcon className="size-5" />}
          label={t('menu.feedbackLabel')}
          hint={t('menu.feedbackHint')}
          onClick={() => {
            onOpen('feedback');
          }}
        />
        {/* TODO: for now its closed. Ödeme linkleri eklenince açılacak. */}
        {/* <MenuTile
          icon={<HeartIcon className="size-5" />}
          label={t('community.donate.menuLabel')}
          hint={t('community.donate.menuHint')}
          attention
          onClick={() => {
            onOpen('donate');
          }}
        /> */}
        {isAdmin && (
          <MenuTile
            icon={<LockIcon className="size-5" />}
            label={t('community.admin.menuLabel')}
            hint={t('community.admin.menuHint')}
            onClick={() => {
              onOpen('admin');
            }}
          />
        )}
      </MenuGroup>

      {/*
        THE QUICK-START GUIDE AND THE REHEARSAL, TOGETHER AND NAMED AS HELP.

        `public/hizli-baslangic-rehberi.html` is a finished standalone page the
        build already ships and Nginx already serves, so all that was missing was a
        door. It is A LINK, IN THIS TAB: the guide replaces the game and the
        browser's own back restores it — a new tab leaves one behind on every visit
        and costs the page the one control every reader already has.

        It is still not an in-game sheet. The page carries its own stylesheet and
        its own Turkish, and wrapping it would claim it is part of the interface
        while it still reads as a separate site. See `shell/guide.ts`.
      */}
      <MenuGroup label={t('menu.helpHeading')}>
        <MenuTile
          icon={<GuideIcon className="size-5" />}
          label={t('menu.guideLabel')}
          hint={t('menu.guideHint')}
          href={publisherUrl('guide', i18n.resolvedLanguage)}
        />
        {onReplayAcademy && (
          <MenuTile
            icon={<GuideIcon className="size-5" />}
            label={t('academy.replay')}
            hint={t('academy.replayHint')}
            onClick={onReplayAcademy}
          />
        )}
      </MenuGroup>

      {/**
       * RANK FOUR — THE PHONE IN YOUR HAND, one line each.
       *
       * Language, sound and resolution are one category: a preference about the
       * DEVICE rather than about the commander or the season, which is why all
       * three are stored per device and why all three live together. They used to
       * be three stacked cards, each with a glyph socket, a name, a sentence and
       * its own control — the tallest block on the sheet, for the least often
       * touched thing in the game — under a section heading that read "Language",
       * which is the grouping failure in miniature: a group named after one of the
       * three things in it.
       *
       * The resolution keeps its sentence and nothing else does, because it is the
       * one rung whose NAME does not say what it buys (`docs/interface.md` I1:
       * "Balanced" alone does not say what it balances). Language and sound show
       * their state in the control itself.
       */}
      <Section label={t('menu.deviceHeading')}>
        <div data-device-settings className="plate divide-y divide-line-soft">
          <SettingRow label={t('settings.sectionLabel')} title={t('settings.hint')}>
            <LanguageSwitch compact />
          </SettingRow>
          <SoundSetting />
          <NowPlaying />
          <QualitySetting />
          {/*
            THE WAY BACK TO A CHOICE ALREADY MADE, and it belongs in this group.

            A consent answer is stored per DEVICE, exactly like the language, the
            sound and the resolution above it — so it is a fourth line here
            rather than a fifth section heading on a sheet that is already long.

            IT SHOWS THE ANSWER RATHER THAN ONLY THE DOOR. A row that reads
            "Privacy settings ›" makes the player open a dialog to find out where
            they stand; this one says it on the line. The rule behind it — what
            is stored either way — is one tap deeper, in the notice itself.

            `reopenGoogleCmp()` first: in the EEA, the UK and Switzerland the
            answer lives inside Google's certified message and only Google can
            reopen it. Everywhere else that call reports failure and the game's
            own notice comes up.
          */}
          <SettingRow label={t('consent.menuRowLabel')}>
            <button
              type="button"
              data-consent-settings
              aria-label={t('consent.menuLabel')}
              className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline-2 focus-visible:outline-crystal"
              onClick={() => {
                if (!reopenGoogleCmp()) openConsentNotice();
              }}
            >
              <span className="min-w-0 truncate text-label text-bone">{t(consentHint)}</span>
              <ChevronIcon className="size-4 shrink-0 text-faint" />
            </button>
          </SettingRow>
        </div>
      </Section>

      <nav aria-label={t('landing.publicLinksLabel')} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft pt-3">
        {(
          [
            ['privacy', 'landing.privacyLink'],
            ['terms', 'landing.termsLink'],
            ['contact', 'landing.contactLink'],
          ] as const
        ).map(([page, label]) => (
          <a
            key={page}
            className="text-caption text-faint underline-offset-4 hover:text-bone hover:underline focus-visible:outline-2 focus-visible:outline-crystal"
            href={publisherUrl(page, i18n.resolvedLanguage)}
          >
            {t(label)}
          </a>
        ))}
      </nav>

      {/*
        NO CUT CORNERS HERE. `Plate`'s own rule: the shear is an ACCENT for the
        directive, the commit surface, the active dock plate — never the default
        card. These two were the only cut plates on the sheet and they are the
        two least actionable things on it, a galaxy name and a clock, while the
        pressable rows above them were plain. The accent was spent exactly
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

        {/*
          THE WAY OUT IS LAST AND IT IS ALONE. It sits under the account it ends
          rather than beside the language pair, because the two most destructive
          controls on a screen should never be adjacent by accident.
        */}
        <Button variant="ghost" size="md" full onClick={onSignOut}>
          {t('galaxy.commander.signOut')}
        </Button>
      </Section>
    </div>
  );
}

/**
 * A NAMED GROUP OF DESTINATIONS, TWO TO A ROW.
 *
 * The grid is the answer to *"butonlar yatay şekilde uzayıp gereksiz yer
 * kaplıyor"*: a destination does not need 350 pixels to say LEADERBOARD, and the
 * pair costs one row's height instead of two. An odd count leaves the last cell
 * empty on purpose — a tile stretched across both columns to tidy the row would be
 * the full-width slab this sheet just stopped drawing.
 */
function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section data-menu-group className="flex flex-col gap-2">
      <SectionHead label={label} />
      <div data-menu-grid className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

/**
 * ONE PLACE TO GO: a glyph, a name, and a count when something is waiting in it.
 *
 * THE GLYPH SITS ABOVE THE NAME rather than beside it, which is what buys the name
 * the tile's full width — "Liderlik tablosu" and "Akademiyi tekrar oyna" are the
 * two longest things this menu has to say, and a name is the one piece of copy on
 * a dense surface that must never be the thing that gives (`styles.css`, `.name`).
 * It is also the arrangement every phone in the world already uses for a grid of
 * destinations, so nobody has to be taught it.
 *
 * NO CHEVRON. A row needed one to say "this goes somewhere"; a tile in a grid is
 * already shaped like a thing you press, and eight chevrons is eight pieces of
 * furniture saying what the shape has said.
 */
function MenuTile({
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
   * A TILE THAT GOES TO A URL IS A LINK, NOT A BUTTON.
   *
   * Every other tile here opens a surface inside the app, which is a button doing
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

        MOVED rather than deleted, and the tests that name these destinations read
        this exact sentence — `${label}. ${hint}` — so the pairing is load-bearing.
      */
      aria-label={`${label}. ${hint}`}
      data-menu-tile
      className="plate relative flex flex-col items-start gap-1.5 px-2 py-2 text-left transition-colors hover:bg-bone/[0.03] active:bg-raised/60"
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
      <span aria-hidden data-fit="condensed" className="name w-full leading-tight text-bone">
        {label}
      </span>
      {/*
        THE COUNT RIDES THE GLYPH'S LINE, opposite it, where the tile has nothing
        else to do with the width. It is a number rather than a dot because there
        is room for it here and the header's dot has already done the job of
        saying THAT something is waiting.
      */}
      {badge === undefined ? null : (
        <span className="num absolute right-1.5 top-1.5 rounded-full bg-opportunity/15 px-1.5 py-0.5 text-micro leading-none text-opportunity">
          {badge}
        </span>
      )}
    </Element>
  );
}

/**
 * RANK ONE: THE ONE SHAPE THAT MEANS "THIS IS WAITING ON YOU".
 *
 * Full width, lit, and above every group. It is deliberately the only thing on the
 * sheet drawn this way — a shape that means something has to be scarce, and the
 * two callers (a readable season result, a Silent Space placement) are both cases
 * where the game owes the commander a decision rather than offering one.
 */
function MenuRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-menu-row
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      aria-label={`${label}. ${hint}`}
      className="plate plate-opportunity flex w-full items-center gap-2 px-3 py-2 text-left transition-colors active:bg-raised/60"
    >
      <span className="socket grid size-8 shrink-0 place-items-center rounded-control text-opportunity">
        {icon}
      </span>
      <span aria-hidden className="min-w-0 flex-1">
        <span className="name block truncate text-bone">{label}</span>
        <span className="mt-0.5 block truncate text-micro leading-tight text-dim">{hint}</span>
      </span>
      <ChevronIcon className="size-4 shrink-0 text-opportunity" />
    </button>
  );
}

/**
 * A MARK'S COLOUR, AND THE COMMANDER IT BELONGS TO. D183.
 *
 * The dot is the same hue the reticle is drawn in on the disc, so the menu and the
 * map are one thing rather than two lists that happen to agree. The name beside it
 * is the commander's, because a mark is about a PERSON and the world in it is only
 * where the press landed.
 *
 * A LOST MARK WEARS A CROSS AND CLEARS ITSELF. Its face has to be short enough for
 * a chip, so the full sentence stays on the accessible name — which is also what
 * every test that reaches for this chip reads.
 */
function RivalChip({
  slot,
  face,
  name,
  lost = false,
  onClick,
}: {
  slot: number;
  face: string;
  name: string;
  lost?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-rival-chip
      aria-label={name}
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className={`plate flex min-w-0 max-w-full items-center gap-1.5 rounded-chip px-2 py-1.5 transition-colors active:bg-raised/60 ${
        lost ? 'opacity-70' : ''
      }`}
    >
      <span
        aria-hidden
        data-rival-dot={slot}
        className="block size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: rivalColour(slot) }}
      />
      <span aria-hidden className="name min-w-0 truncate text-label text-bone">{face}</span>
      {lost && <CloseIcon className="size-3 shrink-0 text-faint" />}
    </button>
  );
}

/**
 * ONE PREFERENCE, ONE LINE: its name on the left, the control that sets it filling
 * the rest.
 *
 * `below` is for the one setting whose chosen value does not explain itself. Every
 * other sentence that used to sit under one of these was describing a control that
 * already shows its own state — a speaker glyph that is lit or not, a language pair
 * where one half is raised — and three of those is a paragraph of a phone screen
 * spent restating what is on it.
 */
function SettingRow({
  label,
  children,
  below,
  title,
}: {
  label: string;
  children: ReactNode;
  below?: string;
  title?: string;
}) {
  return (
    <div data-setting-row className="px-2 py-2" {...(title === undefined ? {} : { title })}>
      <div className="flex items-center gap-2">
        <span className="legend w-16 shrink-0 leading-tight">{label}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {below === undefined ? null : (
        <p className="mt-1.5 text-micro leading-snug text-faint">{below}</p>
      )}
    </div>
  );
}

/**
 * ON OR OFF AND HOW LOUD, ON ONE LINE.
 *
 * `aria-pressed` rather than a checkbox: this is a control with two states that
 * takes effect immediately, which is exactly what a toggle button is for, and it
 * means a screen reader announces the state rather than the player having to infer
 * it from a label that changed. The sentence that used to sit under it — "the score
 * is playing" — is the toggle's accessible name now, so nothing is lost to anyone
 * who needs it read and the row costs one line instead of three.
 */
function SoundSetting() {
  const { t } = useTranslation();
  const on = useMusicEnabled();
  const volume = useMusicVolume();
  const percent = Math.round(volume * 100);

  return (
    <SettingRow label={t('menu.soundLabel')}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={on}
          aria-label={`${t('menu.soundLabel')}. ${on ? t('menu.soundOn') : t('menu.soundOff')}`}
          onClick={() => {
            haptic('tap');
            setMusicEnabled(!on);
          }}
          className={`socket grid size-9 shrink-0 place-items-center rounded-control transition-colors ${
            on ? 'text-crystal' : 'text-faint'
          }`}
        >
          {on ? <SpeakerOnIcon className="size-[18px]" /> : <SpeakerOffIcon className="size-[18px]" />}
        </button>
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
        <output className="num w-8 shrink-0 text-right text-micro text-crystal">
          {t('menu.volumeValue', { volume: percent })}
        </output>
      </div>
    </SettingRow>
  );
}

/**
 * WHAT IS PLAYING, HOW LONG IT IS, AND WHERE IN IT WE ARE.
 *
 * Owner instruction, and the first of the four questions is what makes it a
 * section rather than a line: the slider above says how LOUD, and says nothing
 * about WHICH of nine pieces is making the sound. A player who wants the piano one
 * and keeps getting the documentary one has no move to make until two arrows exist.
 *
 * THREE FACTS AND TWO CONTROLS, ON TWO LINES.
 *
 *   · The position in the list — "3 / 9" rather than "3", because a bare ordinal
 *     is a number and a pair is a place: it says how far the arrows reach and that
 *     there is something on the other side of them.
 *   · The clock, elapsed against total, in the tabular face so the digits do not
 *     shuffle sideways once a second.
 *   · The bar, which is the clock again as a shape. It is `aria-hidden` for
 *     exactly that reason — a screen reader that reads both reads the same fact
 *     twice, a second apart.
 *
 * NO TRACK LIST, NO SHUFFLE, NO FAVOURITES. Nine pieces of background score do not
 * earn a media library on a 350-wide phone, and every one of them is two taps away
 * at the worst. The fourth question — what does this cost to use — answers itself
 * when the whole control is 28 pixels of arrow at each end of a row that was
 * already there.
 *
 * IT STAYS LIVE AND USABLE WHILE THE SCORE IS SILENCED, dimmed rather than
 * disabled: choosing the piece you want before you turn the sound back on is a
 * perfectly ordinary thing to do, and a control that vanishes when it is muted
 * makes the player unmute to find out what they would be unmuting into.
 */
function NowPlaying() {
  const { t } = useTranslation();
  const on = useMusicEnabled();
  const { track, position, duration } = useMusicPlayback();

  const elapsed = formatTrackTime(position);
  /** `blankAtZero`: nothing has decoded yet, and `0:00` would state a length. */
  const total = formatTrackTime(duration, { blankAtZero: true });
  const share = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const skip = (move: () => void) => () => {
    haptic('tap');
    move();
  };

  return (
    <div data-now-playing className="px-2 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t('menu.trackPrev')}
          onClick={skip(prevTrack)}
          className="socket grid size-7 shrink-0 place-items-center rounded-control text-faint transition-colors hover:text-bone"
        >
          <SkipIcon className="size-3.5 -scale-x-100" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-micro ${on ? 'text-bone' : 'text-faint'}`}>
              {t('menu.trackLabel', { index: track + 1, total: MUSIC_TRACKS.length })}
            </span>
            <span data-testid="now-playing-clock" className="num shrink-0 text-micro text-faint">
              {t('menu.trackClock', { position: elapsed, duration: total })}
            </span>
          </div>
          {/*
            ONE SECOND OF LINEAR EASE, MATCHING THE TICK THAT FEEDS IT. The store
            reports whole seconds, so an un-eased bar would jump nine pixels at a
            time; a transition exactly as long as the interval turns the same data
            into a hand that sweeps.
          */}
          <div
            data-testid="now-playing-bar"
            aria-hidden
            className="socket mt-1.5 h-[3px] w-full overflow-hidden rounded-full"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                on ? 'bg-crystal' : 'bg-line-soft'
              }`}
              style={{ width: `${String(share)}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          aria-label={t('menu.trackNext')}
          onClick={skip(nextTrack)}
          className="socket grid size-7 shrink-0 place-items-center rounded-control text-faint transition-colors hover:text-bone"
        >
          <SkipIcon className="size-3.5" />
        </button>
      </div>
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
 * pixel ratio and every value between them looks and costs the same as one of them.
 *
 * THE LINE UNDER THE ROW IS THE CURRENT RUNG'S OWN, and it is the only sentence
 * left in this block. `docs/interface.md` I1: a value the player cannot compare is
 * not yet information, and "Balanced" alone does not say what it balances.
 */
function QualitySetting() {
  const { t } = useTranslation();
  const quality = useRenderQuality();

  const segments: readonly Segment<RenderQuality>[] = RENDER_QUALITIES.map((id) => ({
    id,
    label: t(`menu.quality.${id}`),
  }));

  return (
    <SettingRow label={t('menu.qualityLabel')} below={t(`menu.qualityHint.${quality}`)}>
      <Segmented
        size="sm"
        label={t('menu.qualityLabel')}
        segments={segments}
        value={quality}
        onSelect={setRenderQuality}
      />
    </SettingRow>
  );
}
