import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NotificationCenterSheet } from '../screens/NotificationCenterSheet.js';
import { useNotificationCenter } from '../api/notificationCenter.js';
import { useTranslation } from 'react-i18next';
import { playSound, setEffectsEnabled, setEffectsVolume, useEffectsEnabled, useEffectsVolume } from '../lib/sound.js';
import { useAnnouncements, useLeaderboard, useRewards } from '../api/queries.js';
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
import { haptic } from '../lib/haptics.js';
import { useNow, untilReady } from '../lib/time.js';
import {
  RENDER_QUALITIES,
  setRenderQuality,
  useRenderQuality,
} from '../lib/quality.js';
import { Segmented } from '../v2/kit/Segmented.js';
import { Section, SectionHead } from '../v2/kit/Surface.js';
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
  HeartIcon,
  HonorIcon,
  AttackIcon,
  BroadcastIcon,
} from '../ui/icons/index.js';
import { LanguageSwitch } from '../ui/LanguageSwitch.js';
import { openConsentNotice, readConsent, reopenGoogleCmp } from '../lib/consent.js';
import type { Panel } from '../screens/GalaxyView.jsx';
import { setFpsMeterEnabled, useFpsMeterEnabled } from '../lib/fpsMeter.js';
import type { CountryCode } from '@astera/rules';
import { InstallButton } from '../brand/Install.js';
import { Flag } from '../v2/identity/Flag.js';
import { ShopShowcase } from './ShopShowcase.js';
import { ATMOSPHERE, type AtmosphereArt } from '../ui/atmosphere.js';
import { AtmosphereImage } from '../ui/AtmosphereArt.js';
import { capabilities } from '../platform/runtime.js';
import { SimulatorHost } from '../battle-simulator/SimulatorHost.js';

import { Icon } from '../v2/icons.js';
import { openProfile } from './profileRoute.js';

/** Main navigation stays short; details mount only in their selected category. */
export type MenuPage = 'home' | 'season' | 'academy' | 'community' | 'settings';

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
  onReplayAcademy,
  isAdmin = false,
  country = 'TR',
  commander,
  page: controlledPage,
  onPageChange,
  onResume,
}: {
  commander?: string;
  page?: MenuPage;
  onPageChange?: (page: MenuPage) => void;
  onResume?: () => void;
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
  country?: CountryCode;
  onCountryChange?: (country: CountryCode) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const platform = capabilities();
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
  const now = useNow(60_000);
  const hoursLeft = endsAt === null ? null : (endsAt.getTime() - now) / 3_600_000;
  const waiting = useRewards().data?.claimable ?? 0;
  const board = useLeaderboard().data;
  const honorEnabled = board?.honorEnabled ?? false;
  const name = commander ?? board?.you?.username ?? t('menu.eyebrow');
  const clan = board?.you?.clan;
  const announcementData = useAnnouncements().data;
  const announcementWaiting = announcementData?.announcements.filter((row) => !row.seen).length ?? 0;
  const [centerOpen, setCenterOpen] = useState(false);
  const center = useNotificationCenter(platform.notificationCenter).data;
  // Built, and the next attack alert at the commander's timing would not go out.
  const centerEmpty = center?.built === true && center.wallet < center.prices.incoming_attack[center.timing];
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  // Focus returns to the tile that opened the simulator.
  const simulatorOpener = useRef<HTMLElement | null>(null);

  const marks = rivals.filter((mark) => (mark.lost ? onClearRival : onFocusRival) !== undefined);

  const [localPage, setLocalPage] = useState<MenuPage>('home');
  const page = controlledPage ?? localPage;
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousPage = useRef<MenuPage | null>(null);
  const navigate = (next: MenuPage): void => {
    haptic('tap');
    setLocalPage(next);
    onPageChange?.(next);
  };
  useLayoutEffect(() => {
    const previous = previousPage.current;
    previousPage.current = page;
    if (previous === page) return;
    if (page === 'home') {
      root.current?.querySelector<HTMLElement>(previous === null ? '[data-menu-identity]' : `[data-menu-category="${previous}"]`)?.focus();
    } else {
      heading.current?.focus();
    }
    const scroller = root.current?.parentElement;
    if (scroller) scroller.scrollTop = 0;
  }, [page]);
  const seasonTime = ended ? t('seasonRecap.ended') : hoursLeft === null ? t('galaxy.commander.endsUnknown') : untilReady(hoursLeft * 60);

  return (
    <div ref={root} data-v2-commander-menu data-menu-page={page} className="commander-menu flex flex-col gap-4 font-v2-ui text-v2-ink">
      {page === 'home' ? (
        <>
          <div className="menu-identity-block">
            <a href="/profile" data-menu-identity aria-label={`${t('menu.navigation.account')}. ${name}`}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                openProfile();
              }}
              className="group flex min-h-14 items-center gap-3 px-1 text-left">
              {/* px-1 owner decision */}
              <span aria-hidden="true" className="menu-avatar grid size-11 shrink-0 place-items-center rounded-control border border-v2-line-hi font-semibold text-v2-ink">{Array.from(name).slice(0, 2).join('').toLocaleUpperCase(i18n.resolvedLanguage)}</span>
              {/* rounded-8 owner decision */}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5"><Flag code={country} language={i18n.resolvedLanguage ?? 'en'} /><span className="min-w-0 break-words text-body font-semibold">{clan ? `[${clan.tag}] ` : ''}{name}</span></span>
                <span className="mt-1 block break-words text-label text-v2-ink-2">{clan?.name ?? t('menu.profile.noClan')}</span>
              </span>
              <ChevronIcon className="size-4 shrink-0 text-v2-ink-3 group-hover:text-v2-ink" />
            </a>
            <div data-menu-context className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-micro text-v2-ink-2">
              <span className="flex min-w-0 items-center gap-1.5"><GalaxyIcon className="size-3.5 shrink-0" /><span className="break-words">{galaxy ?? t('galaxy.commander.galaxyUnknown')}{shard && shard !== galaxy ? ` · ${shard}` : ''}</span></span>
              <span>{t(ended ? 'seasonRecap.seasonLabel' : 'galaxy.commander.endsLabel')} <strong className="font-v2-mono font-medium text-v2-ink">{seasonTime}</strong></span>
            </div>
          </div>
          {(inSilentSpace || hasSeasonResult || waiting > 0) && <div className="flex flex-col gap-2">
            {inSilentSpace && <MenuRow icon={<GalaxyIcon className="size-5" />} label={t('silentSpace.menu')} hint={t('silentSpace.menuHint')} onClick={() => { onOpen('return'); }} />}
            {hasSeasonResult && <MenuRow icon={<GalaxyIcon className="size-5" />} label={t('seasonRecap.menuLabel')} hint={t('seasonRecap.menuHint')} onClick={() => { onOpen('recap'); }} />}
            {waiting > 0 && <MenuRow icon={<RewardIcon className="size-5" />} label={t('menu.navigation.rewardsReady', { count: waiting })} hint={t('menu.rewardsHint')} onClick={() => { onOpen('rewards'); }} />}
          </div>}
          <ShopShowcase compact onShop={() => { onOpen('skin-shop'); }} onInventory={() => { onOpen('skin-inventory'); }} />
          <nav aria-label={t('menu.navigation.title')} className="divide-y divide-v2-line">
            <MenuCategory id="season" icon={<LeaderboardIcon className="size-5" />} label={t('menu.navigation.season')} hint={t('menu.navigation.seasonHint')} onClick={() => { navigate('season'); }} />
            <MenuCategory id="academy" icon={<GuideIcon className="size-5" />} label={t('menu.navigation.academy')} hint={t('menu.navigation.academyHint')} onClick={() => { navigate('academy'); }} />
            <MenuCategory id="community" icon={<Icon id="i-chat" className="size-5" />} label={t('menu.navigation.community')} hint={t('menu.navigation.communityHint')} badge={announcementWaiting > 0 ? t('menu.announcementsWaiting', { count: announcementWaiting }) : undefined} onClick={() => { navigate('community'); }} />
            {platform.webCheckout && <MenuCategory id="donate" primary icon={<HeartIcon className="size-5" />} label={t('community.donate.menuLabel')} hint={t('community.donate.menuHint')} onClick={() => { haptic('tap'); onOpen('donate'); }} />}
            <MenuCategory id="settings" icon={<Icon id="i-settings" className="size-5" />} label={t('menu.navigation.settings')} hint={t('menu.navigation.settingsHint')} badge={centerEmpty ? t('notificationCenter.menuEmpty') : undefined} onClick={() => { navigate('settings'); }} />
          </nav>
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

          <div className="flex items-center justify-between gap-3 border-t border-v2-line pt-2">
            <InstallButton compact variant="ghost" />
            {onResume && <button type="button" onClick={onResume} className="ml-auto flex min-h-11 items-center gap-2 text-caption font-medium text-v2-ink-2 hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-v2-self">{t('menu.navigation.resume')}<Icon id="i-chev" className="size-3.5" /></button>}
          </div>
        </>
      ) : (
        <>
          <div className={controlledPage === undefined ? 'flex items-center gap-3 border-b border-v2-line pb-3' : 'sr-only'}>
            {controlledPage === undefined && <button type="button" onClick={() => { navigate('home'); }} aria-label={t('menu.navigation.back')} className="grid size-11 shrink-0 place-items-center rounded-control border border-v2-line bg-v2-panel text-v2-ink-2 hover:bg-v2-raise focus-visible:outline-2 focus-visible:outline-v2-self"><ChevronIcon className="size-4 rotate-180" /></button>}
            <h2 ref={heading} tabIndex={-1} className="text-body font-semibold outline-none">{t(`menu.navigation.${page}`)}</h2>
          </div>
          {page === 'season' && (
            <MenuGroup label={t('menu.seasonHeading')}>
              <MenuTile
                art={ATMOSPHERE.commander}
                icon={honorEnabled ? <HonorIcon className="size-5 text-v2-self" /> : <LeaderboardIcon className="size-5" />}
                label={t(honorEnabled ? 'leaderboard.honorTitle' : 'menu.leaderboardLabel')}
                hint={t(honorEnabled ? 'leaderboard.honorPrimary' : 'menu.leaderboardHint')}
                onClick={() => {
                  onOpen('leaderboard');
                }}
              />
              <MenuTile
                icon={<RewardIcon className="size-5" />}
                label={t('menu.rewardsLabel')}
                art={ATMOSPHERE.rewards}
                hint={t('menu.rewardsHint')}
                attention={waiting > 0}
                {...(waiting > 0 ? { badge: t('menu.rewardsWaiting', { count: waiting }) } : {})}
                onClick={() => {
                  onOpen('rewards');
                }}
              />

            </MenuGroup>

          )}
          {page === 'community' && (
            <MenuGroup label={t('menu.asteraHeading')}>
              <MenuTile
                icon={<BellIcon className="size-5" />}
                label={t('menu.announcementsLabel')}
                art={ATMOSPHERE.announcements}
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
                art={ATMOSPHERE.feedback}
                hint={t('menu.feedbackHint')}
                onClick={() => {
                  onOpen('feedback');
                }}
              />
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

          )}
          {page === 'academy' && (
            <MenuGroup label={t('menu.helpHeading')}>
              <MenuTile
                icon={<GuideIcon className="size-5" />}
                label={t('menu.guideLabel')}
                art={ATMOSPHERE.intel}
                hint={t('menu.guideHint')}
                onClick={() => { onOpen('wiki'); }}
              />
              {/* Over the menu, not instead of it: closing the simulator lands back here. */}
              <MenuTile
                icon={<AttackIcon className="size-5" />}
                label={t('simulator.title')}
                art={ATMOSPHERE.simulator}
                hint={t('menu.simulatorHint')}
                onClick={() => {
                  simulatorOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                  setSimulatorOpen(true);
                }}
              />
              {simulatorOpen && <SimulatorHost onClose={() => { setSimulatorOpen(false); simulatorOpener.current?.focus(); }} />}
              {onReplayAcademy && (
                <MenuTile
                  icon={<GuideIcon className="size-5" />}
                  label={t('academy.replay')}
                art={ATMOSPHERE.academy}
                  hint={t('academy.replayHint')}
                  onClick={onReplayAcademy}
                />
              )}
            </MenuGroup>

          )}
          {page === 'settings' && <>
              {platform.notificationCenter && <MenuTile
                icon={<BroadcastIcon className="size-5" />}
                label={t('notificationCenter.title')}
                art={ATMOSPHERE.notificationCenter}
                hint={t('notificationCenter.menuHint')}
                attention={centerEmpty}
                {...(centerEmpty ? { badge: t('notificationCenter.menuEmpty') } : {})}
                onClick={() => { setCenterOpen(true); }}
              />}
            <Section label={t('menu.deviceHeading')}>
              <div data-device-settings className="divide-y divide-v2-line overflow-hidden rounded-control border border-v2-line bg-v2-panel">
                <SettingRow label={t('settings.sectionLabel')} title={t('settings.hint')}>
                  <LanguageSwitch compact />
                </SettingRow>
                <SoundSetting />
                <EffectsSetting />
                <NowPlaying />
                <QualitySetting />
                <FpsSetting />
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
                {(platform.webAds || platform.webAnalytics) && <SettingRow label={t('consent.menuRowLabel')}>
                  <button
                    type="button"
                    data-consent-settings
                    aria-label={t('consent.menuLabel')}
                    className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline-2 focus-visible:outline-v2-self"
                    onClick={() => {
                      if (!reopenGoogleCmp()) openConsentNotice();
                    }}
                  >
                    <span className="min-w-0 truncate text-label text-v2-ink">{t(consentHint)}</span>
                    <ChevronIcon className="size-4 shrink-0 text-v2-ink-3" />
                  </button>
                </SettingRow>}
              </div>
            </Section>

          </>}
        </>
      )}
      {centerOpen && <NotificationCenterSheet onClose={() => { setCenterOpen(false); }} />}
    </div>
  );
}

function MenuCategory({ id, icon, label, hint, badge, primary = false, onClick }: {
  id: MenuPage | 'donate'; icon: ReactNode; label: string; hint: string; badge?: string | undefined; primary?: boolean; onClick: () => void;
}) {
  return <button type="button" data-menu-category={id} aria-label={`${label}. ${hint}${badge ? `. ${badge}` : ''}`} onClick={onClick}
    className={`menu-category group flex min-h-14 w-full items-center gap-3 rounded-control px-1 py-2.5 text-left transition-colors hover:bg-v2-panel focus-visible:outline-2 focus-visible:outline-v2-self ${primary ? 'text-v2-self' : ''}`}>
    <span aria-hidden="true" className={`shrink-0 ${primary ? 'text-v2-self' : 'text-v2-ink-2 group-hover:text-v2-ink'}`}>{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-caption font-semibold">{label}</span><span className="mt-1 block text-label leading-snug text-v2-ink-2">{hint}</span></span>
    {badge && <span className="max-w-24 rounded-chip border border-v2-self/25 bg-v2-self/8 px-1.5 py-1 text-micro text-v2-self">{badge}</span>}
    <ChevronIcon className="size-3.5 shrink-0 text-v2-ink-3 group-hover:text-v2-ink" />
  </button>;
}

function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section data-menu-group className="flex flex-col gap-2">
      <SectionHead label={label} />
      <div data-menu-grid className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

function MenuTile({
  art,
  icon,
  label,
  hint,
  badge,
  attention = false,
  onClick,
  href,
}: {
  art?: AtmosphereArt;
  icon: ReactNode;
  label: string;
  hint: string;
  badge?: string;
  attention?: boolean;
  onClick?: () => void;
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
      className={`group relative flex min-h-20 flex-col items-start justify-between gap-2 rounded-control border border-v2-line bg-v2-panel px-3 py-2.5 text-left transition-colors hover:border-v2-line-hi hover:bg-v2-raise focus-visible:outline-2 focus-visible:outline-v2-self active:bg-v2-raise ${art ? 'menu-art-tile' : ''}`}
    >
      {art && <AtmosphereImage art={art} />}
      <span
        data-attention={attention || undefined}
        className={`grid size-8 shrink-0 place-items-center rounded-control border transition-colors ${
          attention
            ? 'border-v2-self/45 bg-v2-self/10 text-v2-self'
            : 'border-v2-line bg-v2-deep text-v2-ink-2 group-hover:text-v2-ink'
        }`}
      >
        {icon}
      </span>
      <span aria-hidden data-fit="condensed" className="w-full font-v2-ui text-caption font-semibold leading-tight text-v2-ink">
        {label}
      </span>
      {/*
        THE COUNT RIDES THE GLYPH'S LINE, opposite it, where the tile has nothing
        else to do with the width. It is a number rather than a dot because there
        is room for it here and the header's dot has already done the job of
        saying THAT something is waiting.
      */}
      {badge === undefined ? null : (
        <span data-menu-badge className="absolute right-2 top-2 rounded-chip bg-v2-self/15 px-1.5 py-0.5 font-v2-mono text-micro leading-none text-v2-self">
          {badge}
        </span>
      )}
    </Element>
  );
}

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
      className="flex w-full items-center gap-2 rounded-control border border-v2-self/40 bg-v2-self/8 px-3 py-2.5 text-left transition-colors hover:bg-v2-self/12 focus-visible:outline-2 focus-visible:outline-v2-self"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-control border border-v2-self/30 bg-v2-self/10 text-v2-self">
        {icon}
      </span>
      <span aria-hidden className="min-w-0 flex-1">
        <span className="block truncate text-caption font-semibold text-v2-ink">{label}</span>
        <span className="mt-0.5 block truncate text-micro leading-tight text-v2-ink-2">{hint}</span>
      </span>
      <ChevronIcon className="size-4 shrink-0 text-v2-self" />
    </button>
  );
}

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
      className={`flex min-w-0 max-w-full items-center gap-1.5 rounded-chip border border-v2-line-hi bg-v2-panel px-2.5 py-1.5 transition-colors hover:bg-v2-raise focus-visible:outline-2 focus-visible:outline-v2-self ${
        lost ? 'opacity-70' : ''
      }`}
    >
      <span
        aria-hidden
        data-rival-dot={slot}
        className="block size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: rivalColour(slot) }}
      />
      <span aria-hidden className="min-w-0 truncate text-label font-semibold text-v2-ink">{face}</span>
      {lost && <CloseIcon className="size-3 shrink-0 text-v2-ink-3" />}
    </button>
  );
}

function SettingRow({
  label,
  children,
  below,
  title,
  stack = false,
}: {
  label: string;
  children: ReactNode;
  below?: string;
  title?: string;
    stack?: boolean;
}) {
  return (
    <div data-setting-row className="px-2 py-2" {...(title === undefined ? {} : { title })}>
      {/*
        THE LABEL KEEPS ITS WORD, THE CONTROL ITS ROOM (M5, seen at 350 in German): a
        64px label column cut "BILDQUALITÄT" and laid "Noch nicht ausgewählt" over
        "DATENSCHUTZ". The label takes its own width; a control that no longer fits
        beside it goes under it rather than over it.
      */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="v2-legend min-w-16 shrink-0 leading-tight">{label}</span>
        <div className={stack ? 'basis-full' : 'min-w-48 flex-1'}>{children}</div>
      </div>
      {below === undefined ? null : (
        <p className="mt-1.5 text-micro leading-snug text-v2-ink-3">{below}</p>
      )}
    </div>
  );
}

function EffectsSetting() {
  const { t } = useTranslation();
  const on = useEffectsEnabled();
  const volume = useEffectsVolume();
  const percent = Math.round(volume * 100);
  return (
    <SettingRow label={t('menu.effectsLabel')}>
      <div className="flex items-center gap-2">
        <button type="button" aria-pressed={on}
          aria-label={`${t('menu.effectsLabel')}. ${t(on ? 'menu.effectsOn' : 'menu.effectsOff')}`}
          onClick={() => { setEffectsEnabled(!on); if (!on) playSound('confirm'); }}
          className={`grid size-9 shrink-0 place-items-center rounded-control border border-v2-line bg-v2-deep transition-colors ${on ? 'text-v2-self' : 'text-v2-ink-3'}`}>
          {on ? <SpeakerOnIcon className="size-[18px]" /> : <SpeakerOffIcon className="size-[18px]" />}
        </button>
        <input type="range" min={0} max={100} step={1} value={percent}
          aria-label={t('menu.effectsVolumeLabel')}
          style={{ '--slider-fill': `${String(percent)}%`, '--slider-tone': 'var(--color-v2-self)' } as CSSProperties}
          onChange={(event) => { setEffectsVolume(event.currentTarget.valueAsNumber / 100); }}
          onPointerUp={() => { playSound('confirm'); }} className="slider min-w-0 flex-1" />
        <output className="w-8 shrink-0 text-right font-v2-mono text-micro text-v2-self">
          {t('menu.volumeValue', { volume: percent })}
        </output>
      </div>
    </SettingRow>
  );
}

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
          className={`grid size-9 shrink-0 place-items-center rounded-control border border-v2-line bg-v2-deep transition-colors ${
            on ? 'text-v2-self' : 'text-v2-ink-3'
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
          style={{ '--slider-fill': `${String(percent)}%`, '--slider-tone': 'var(--color-v2-self)' } as CSSProperties}
          onChange={(event) => {
            setMusicVolume(event.currentTarget.valueAsNumber / 100);
          }}
          className="slider min-w-0 flex-1"
        />
        <output className="w-8 shrink-0 text-right font-v2-mono text-micro text-v2-self">
          {t('menu.volumeValue', { volume: percent })}
        </output>
      </div>
    </SettingRow>
  );
}

function NowPlaying() {
  const { t } = useTranslation();
  const on = useMusicEnabled();
  const { track, position, duration } = useMusicPlayback();

  const elapsed = formatTrackTime(position);
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
          className="grid size-7 shrink-0 place-items-center rounded-control border border-v2-line bg-v2-deep text-v2-ink-3 transition-colors hover:text-v2-ink"
        >
          <SkipIcon className="size-3.5 -scale-x-100" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-micro ${on ? 'text-v2-ink' : 'text-v2-ink-3'}`}>
              {t('menu.trackLabel', { index: track + 1, total: MUSIC_TRACKS.length })}
            </span>
            <span data-testid="now-playing-clock" className="shrink-0 font-v2-mono text-micro text-v2-ink-3">
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
            className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-v2-deep"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                on ? 'bg-v2-self' : 'bg-v2-line-hi'
              }`}
              style={{ width: `${String(share)}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          aria-label={t('menu.trackNext')}
          onClick={skip(nextTrack)}
          className="grid size-7 shrink-0 place-items-center rounded-control border border-v2-line bg-v2-deep text-v2-ink-3 transition-colors hover:text-v2-ink"
        >
          <SkipIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function QualitySetting() {
  const { t } = useTranslation();
  const quality = useRenderQuality();

  const segments = RENDER_QUALITIES.map((id) => ({
    id,
    label: t(`menu.quality.${id}`),
  }));

  return (
    <SettingRow stack label={t('menu.qualityLabel')} below={t(`menu.qualityHint.${quality}`)}>
      <Segmented
        label={t('menu.qualityLabel')}
        options={segments}
        value={quality}
        onChange={setRenderQuality}
      />
    </SettingRow>
  );
}

function FpsSetting() {
  const { t } = useTranslation();
  const on = useFpsMeterEnabled();
  return (
    <SettingRow label={t('menu.fpsLabel')} {...(on ? { below: t('menu.fpsHint') } : {})}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${t('menu.fpsLabel')}. ${on ? t('menu.fpsOn') : t('menu.fpsOff')}`}
        onClick={() => {
          haptic('tap');
          setFpsMeterEnabled(!on);
        }}
        className={`rounded-control border border-v2-line bg-v2-deep px-3 py-1.5 text-micro transition-colors ${
          on ? 'text-v2-self' : 'text-v2-ink-3'
        }`}
      >
        {on ? t('menu.fpsOn') : t('menu.fpsOff')}
      </button>
    </SettingRow>
  );
}
