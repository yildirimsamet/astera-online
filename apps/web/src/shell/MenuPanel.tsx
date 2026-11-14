import { DepartureBoard } from '../starter/DepartureBoard.js';
import { useLayoutEffect, useRef, useState } from 'react';
import { NotificationCenterSheet } from '../screens/NotificationCenterSheet.js';
import { useNotificationCenter } from '../api/notificationCenter.js';
import { useTranslation } from 'react-i18next';
import { OWN_SOUND, playSound, setEffectsEnabled, setEffectsVolume, useEffectsEnabled, useEffectsVolume } from '../lib/sound.js';
import { useAnnouncements, useLeaderboard, usePlanet, useRewards } from '../api/queries.js';
import { gateOf } from '../starter/gate.js';
import { ShipLog } from '../starter/ShipLog.js';
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
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { useNow, untilReady } from '../lib/time.js';
import {
  RENDER_QUALITIES,
  setRenderQuality,
  useRenderQuality,
} from '../lib/quality.js';
import { artIconSrc, Choices, Glyph, LanguagePicker, MenuTile, Plate, RoundButton, SectionTag, SettingLink, Slider, TileGrid, Toggle } from '../game-ui/index.js';
import { currentLanguage } from '../i18n/index.js';
import { setLanguage } from '../i18n/document.js';
import { analyticsAvailable } from '../lib/playerAnalytics/preference.js';
import { AnalyticsSetting } from '../lib/playerAnalytics/Notice.js';
import { openConsentNotice, readConsent, reopenGoogleCmp } from '../lib/consent.js';
import type { Panel } from '../screens/GalaxyView.jsx';
import { setFpsMeterEnabled, useFpsMeterEnabled } from '../lib/fpsMeter.js';
import type { CountryCode } from '@astera/rules';
import { InstallButton } from '../brand/Install.js';
import { FullscreenButton } from '../brand/FullscreenButton.js';
import { AsteraSigil } from '../brand/Identity.js';
import { Flag } from '../v2/identity/Flag.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';
import { capabilities } from '../platform/runtime.js';
import { SimulatorHost } from '../battle-simulator/SimulatorHost.js';

import { Icon } from '../v2/icons.js';
import { openProfile } from './profileRoute.js';

/** The store's poster: lava with an Inferno ring, and the Red Dragon under a Phoenix standard. */
const SHOP_POSTER = '/assets/images/cosmetics/shop-showcase-static.webp';

/** Main navigation stays short; details mount only in their selected category. */
export type MenuPage = 'home' | 'academy' | 'community' | 'settings';

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
  onGuideOn,
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
  /** The starter guide is off on this account; this turns it back on (plan F3). */
  onGuideOn?: () => void;
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
  // A colony ship has no ranking, rewards or store yet; they arrive with the landing (plan §3.7).
  const vessel = usePlanet().data?.vessel;
  const gate = gateOf(vessel);
  const board = useLeaderboard().data;
  const name = commander ?? board?.you?.username ?? t('menu.eyebrow');
  const clan = board?.you?.clan;
  const announcementData = useAnnouncements().data;
  const announcementWaiting = announcementData?.announcements.filter((row) => !row.seen).length ?? 0;
  const [centerOpen, setCenterOpen] = useState(false);
  const center = useNotificationCenter(platform.notificationCenter).data;
  // Built, and the next attack alert at the commander's timing would not go out.
  const centerCovers = center?.built === true ? Math.floor(center.wallet / center.prices.incoming_attack[center.timing]) : null;
  const centerEmpty = centerCovers === 0;
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  // Focus returns to the tile that opened the simulator.
  const simulatorOpener = useRef<HTMLElement | null>(null);
  const simulatorWasOpen = useRef(false);
  useLayoutEffect(() => {
    // Restore after the dialog is removed: its pending mount focus cannot steal it back.
    if (!simulatorOpen && simulatorWasOpen.current) simulatorOpener.current?.focus();
    simulatorWasOpen.current = simulatorOpen;
  }, [simulatorOpen]);

  const marks = rivals.filter((mark) => (mark.lost ? onClearRival : onFocusRival) !== undefined);

  const [localPage, setLocalPage] = useState<MenuPage>('home');
  const page = controlledPage ?? localPage;
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousPage = useRef<MenuPage | null>(null);
  // Every way in or back is a kit press, which answers with its own sound and buzz.
  const navigate = (next: MenuPage): void => {
    setLocalPage(next);
    onPageChange?.(next);
  };
  useLayoutEffect(() => {
    const previous = previousPage.current;
    previousPage.current = page;
    if (previous === page) return;
    if (page === 'home') {
      root.current?.querySelector<HTMLElement>(previous === null ? '[data-menu-identity]' : `[data-tile="${previous}"]`)?.focus();
    } else {
      heading.current?.focus();
    }
    const scroller = root.current?.parentElement;
    if (scroller) scroller.scrollTop = 0;
  }, [page]);
  const seasonTime = ended ? t('seasonRecap.ended') : hoursLeft === null ? t('galaxy.commander.endsUnknown') : untilReady(hoursLeft * 60);

  return (
    <div ref={root} data-v2-commander-menu data-menu-page={page} className="commander-menu gk flex flex-col gap-3">
      {page === 'home' ? (
        <>
          <div className="menu-identity-block">
            <a href="/profile" data-menu-identity aria-label={`${t('menu.navigation.account')}. ${name}`}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                openProfile();
              }}
              className="gk-idcard">
              {/* The commander's medallion, as on the top bar: the same face opens the same page. */}
              <span className="gk-medal" aria-hidden="true">
                <span className="gk-medal__face gk-display">{Array.from(name).slice(0, 2).join('').toLocaleUpperCase(i18n.resolvedLanguage)}</span>
                <img className="gk-medal__ring" src={artIconSrc('hud-medallion')} alt="" draggable={false} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5"><Flag code={country} language={i18n.resolvedLanguage ?? 'en'} /><span className="gk-idcard__name">{clan ? `[${clan.tag}] ` : ''}{name}</span></span>
                <span className="gk-sub block">{clan?.name ?? (gate.aboard ? t('starter.eyebrow') : t('menu.profile.noClan'))}</span>
              </span>
              <span className="gk-idcard__go" aria-hidden="true"><Glyph id="next" /></span>
            </a>
            <div data-menu-context className="gk-idcard__context">
              <span className="flex min-w-0 items-center gap-1.5"><Glyph id="colony" /><span className="break-words">{galaxy ?? t('galaxy.commander.galaxyUnknown')}{shard && shard !== galaxy ? ` · ${shard}` : ''}</span></span>
              {!gate.aboard && <span className="flex items-center gap-1.5"><Glyph id="clock" />{t(ended ? 'seasonRecap.seasonLabel' : 'galaxy.commander.endsLabel')} <strong className="gk-num">{seasonTime}</strong></span>}
            </div>
          </div>
          {/* Owner 2026-11-06: aboard, the menu tells the story and where the ship stands in it. */}
          {vessel && <ShipLog vessel={vessel} onOpenShip={() => { onOpen('planet'); }} />}
          {/*
            ONE KIND OF THING (G1-f2, 2026-11-14): every place the menu opens is the kit's tile,
            with its own picture, in named groups. A call to act stands first, across the row.
            The "N rewards ready" row that repeated the Rewards tile is gone: its count rides it.
          */}
          {(inSilentSpace || hasSeasonResult) && <TileGrid>
            {inSilentSpace && <MenuTile tile="return" wide tone="self" glyph="recall" art={ATMOSPHERE.galaxyAccount.src} artAt={ATMOSPHERE.galaxyAccount.position}
              label={t('silentSpace.menu')} hint={t('silentSpace.menuHint')} status={t('silentSpace.menuHint')} onPress={() => { onOpen('return'); }} />}
            {hasSeasonResult && <MenuTile tile="recap" wide tone="self" glyph="ranking" art={ATMOSPHERE.season.src} artAt={ATMOSPHERE.season.position}
              label={t('seasonRecap.menuLabel')} hint={t('seasonRecap.menuHint')} status={t('seasonRecap.menuHint')} onPress={() => { onOpen('recap'); }} />}
          </TileGrid>}
          {!gate.aboard && <section className="grid gap-2">
            <SectionTag>{t('menu.seasonHeading')}</SectionTag>
            <TileGrid>
              <MenuTile tile="leaderboard" glyph="ranking" art={ATMOSPHERE.commander.src} artAt={ATMOSPHERE.commander.position}
                label={t('menu.leaderboardLabel')} hint={t('menu.leaderboardHint')} onPress={() => { onOpen('leaderboard'); }} />
              <MenuTile tile="rewards" glyph="crate" art={ATMOSPHERE.rewards.src} artAt={ATMOSPHERE.rewards.position}
                label={t('menu.rewardsLabel')} hint={t('menu.rewardsHint')} news={{ count: waiting, said: t('menu.navigation.rewardsReady', { count: waiting }) }}
                onPress={() => { onOpen('rewards'); }} />
            </TileGrid>
          </section>}
          {(!gate.aboard || platform.notificationCenter) && <section className="grid gap-2">
            <SectionTag>{t('skins.collection')}</SectionTag>
            <TileGrid>
              {!gate.aboard && platform.webCheckout && <MenuTile tile="shop" tone="premium" glyph="star" art={SHOP_POSTER} artAt="60% 45%"
                label={t('menu.skinsShopLabel')} hint={t('menu.skinsShopHint')} onPress={() => { onOpen('skin-shop'); }} />}
              {!gate.aboard && <MenuTile tile="inventory" glyph="bay" art={ATMOSPHERE.inventory.src} artAt={ATMOSPHERE.inventory.position}
                label={t('menu.skinsInventoryLabel')} hint={t('menu.skinsInventoryHint')} onPress={() => { onOpen('skin-inventory'); }} />}
              {platform.notificationCenter && <MenuTile tile="center" wide glyph="bell" art={ATMOSPHERE.notificationCenter.src} artAt={ATMOSPHERE.notificationCenter.position}
                {...(centerEmpty ? { tone: 'warn' as const, badge: t('notificationCenter.menuEmpty') } : {})}
                label={t('notificationCenter.title')} hint={t('notificationCenter.menuHint')}
                status={centerCovers === null ? t('notificationCenter.menuHint') : centerEmpty ? t('notificationCenter.menuEmptyHint') : t('notificationCenter.menuCovers', { count: centerCovers })}
                onPress={() => { setCenterOpen(true); }} />}
            </TileGrid>
          </section>}
          {gate.aboard && <DepartureBoard now={Date.now()} />}
          <nav aria-label={t('menu.navigation.title')} className="grid gap-2">
            <SectionTag>{t('menu.gameHeading')}</SectionTag>
            <TileGrid>
              <MenuTile tile="academy" glyph="help" art={ATMOSPHERE.academy.src} artAt={ATMOSPHERE.academy.position}
                label={t('menu.navigation.academy')} hint={t('menu.navigation.academyHint')} onPress={() => { navigate('academy'); }} />
              <MenuTile tile="community" glyph="chat" art={ATMOSPHERE.clan.src} artAt={ATMOSPHERE.clan.position}
                label={t('menu.navigation.community')} hint={t('menu.navigation.communityHint')}
                news={{ count: announcementWaiting, said: t('menu.announcementsWaiting', { count: announcementWaiting }) }} onPress={() => { navigate('community'); }} />
              {platform.webCheckout && <MenuTile tile="donate" tone="self" glyph="support" art={ATMOSPHERE.donate.src} artAt={ATMOSPHERE.donate.position}
                label={t('community.donate.menuLabel')} hint={t('community.donate.menuHint')} onPress={() => { onOpen('donate'); }} />}
              <MenuTile tile="settings" glyph="settings" art={ATMOSPHERE.commanderRoom.src} artAt={ATMOSPHERE.commanderRoom.position}
                label={t('menu.navigation.settings')} hint={t('menu.navigation.settingsHint')} onPress={() => { navigate('settings'); }} />
            </TileGrid>
          </nav>
          {marks.length > 0 && (
            <section data-menu-group className="grid gap-2">
              <SectionTag>{t('menu.marksHeading')}</SectionTag>
              <div data-rival-chips className="flex flex-wrap gap-x-1">
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

          {/* The app's own controls; full screen came here when the brand strip left the game screen (G1-b, 2026-11-14). */}
          <div data-menu-foot="" className="flex items-center justify-between gap-3 border-t border-v2-line pt-2">
            <span className="flex items-center gap-2">
              <InstallButton compact variant="ghost" />
              <FullscreenButton />
            </span>
            {onResume && <button type="button" onClick={onResume} className="ml-auto flex min-h-11 items-center gap-2 text-caption font-medium text-v2-ink-2 hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-v2-self">{t('menu.navigation.resume')}<Icon id="i-chev" className="size-3.5" /></button>}
          </div>
          {/* Brand recall (2026-10-07): the name and the address that reopens the game, here since the strip left the game screen. */}
          <p data-menu-brand="" className="-mt-2 flex items-center justify-center gap-1.5 text-body text-v2-ink-2">
            <AsteraSigil className="size-4" />
            <span>Astera Online</span>
            <span aria-hidden="true">·</span>
            <span className="font-v2-mono">asteraonline<span className="text-v2-self">.space</span></span>
          </p>
        </>
      ) : (
        <>
          <div className={controlledPage === undefined ? 'flex items-center gap-3 border-b border-v2-line pb-3' : 'sr-only'}>
            {controlledPage === undefined && <RoundButton small glyph="back" label={t('menu.navigation.back')} onPress={() => { navigate('home'); }} />}
            <h2 ref={heading} tabIndex={-1} className="text-body font-semibold outline-none">{t(`menu.navigation.${page}`)}</h2>
          </div>
          {page === 'community' && (
            <section data-menu-group className="grid gap-2">
              <SectionTag>{t('menu.asteraHeading')}</SectionTag>
              <TileGrid>
                <MenuTile tile="announcements" glyph="banner" art={ATMOSPHERE.announcements.src} artAt={ATMOSPHERE.announcements.position}
                  label={t('menu.announcementsLabel')} hint={t('menu.announcementsHint')}
                  news={{ count: announcementWaiting, said: t('menu.announcementsWaiting', { count: announcementWaiting }) }}
                  onPress={() => { onOpen('announcements'); }} />
                <MenuTile tile="feedback" glyph="mail" art={ATMOSPHERE.feedback.src} artAt={ATMOSPHERE.feedback.position}
                  label={t('menu.feedbackLabel')} hint={t('menu.feedbackHint')} onPress={() => { onOpen('feedback'); }} />
                {isAdmin && <MenuTile tile="admin" glyph="lock" label={t('community.admin.menuLabel')} hint={t('community.admin.menuHint')}
                  onPress={() => { onOpen('admin'); }} />}
              </TileGrid>
            </section>
          )}
          {page === 'academy' && (
            <section data-menu-group className="grid gap-2">
              <SectionTag>{t('menu.helpHeading')}</SectionTag>
              <TileGrid>
                <MenuTile tile="wiki" glyph="help" art={ATMOSPHERE.intel.src} artAt={ATMOSPHERE.intel.position}
                  label={t('menu.guideLabel')} hint={t('menu.guideHint')} onPress={() => { onOpen('wiki'); }} />
                {/* Over the menu, not instead of it: closing the simulator lands back here. It opens with the yard's first fight. */}
                {gate.open('fleet') && <MenuTile tile="simulator" glyph="attack" art={ATMOSPHERE.simulator.src} artAt={ATMOSPHERE.simulator.position}
                  label={t('simulator.title')} hint={t('menu.simulatorHint')}
                  onPress={() => {
                    simulatorOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                    setSimulatorOpen(true);
                  }} />}
                {onGuideOn && <MenuTile tile="guide-on" glyph="refresh" art={ATMOSPHERE.academy.src} artAt={ATMOSPHERE.academy.position}
                  label={t('starter.tutorial.skip.again')} hint={t('starter.tutorial.skip.againHint')} onPress={onGuideOn} />}
                {onReplayAcademy && <MenuTile tile="replay" glyph="history" art={ATMOSPHERE.academy.src} artAt={ATMOSPHERE.academy.position}
                  label={t('academy.replay')} hint={t('academy.replayHint')} onPress={onReplayAcademy} />}
              </TileGrid>
              {simulatorOpen && <SimulatorHost onClose={() => { setSimulatorOpen(false); }} />}
            </section>
          )}
          {page === 'settings' && (
            /*
              THE SETTINGS ON THE KIT (G1-f, 2026-11-14). Every line is a kit control: the language
              a row of flags, each sound a switch you throw and a slider that says its level, the
              picture a choice of lit plates, the frame meter a switch, and privacy a line that
              says where it stands and opens the notice.
            */
            <section data-device-settings className="gk grid gap-2">
              <SectionTag>{t('menu.deviceHeading')}</SectionTag>
              <Plate className="grid gap-1.5 p-2">
                <p className="gk-label">{t('settings.sectionLabel')}</p>
                <LanguagePicker label={t('settings.sectionLabel')} value={currentLanguage()} onChange={(next) => { void setLanguage(next); }} />
              </Plate>
              <Plate className="grid gap-1 p-1.5">
                <SoundSetting />
                <NowPlaying />
              </Plate>
              <Plate className="grid gap-1 p-1.5"><EffectsSetting /></Plate>
              <Plate className="grid gap-1 p-1.5">
                <QualitySetting />
                <FpsSetting />
              </Plate>
              {/*
                THE WAY BACK TO A CHOICE ALREADY MADE. A consent answer is stored per DEVICE, like
                the language and the sound, and the line says the answer rather than only the door.
                `reopenGoogleCmp()` first: in the EEA, the UK and Switzerland the answer lives inside
                Google's certified message and only Google can reopen it; elsewhere the game's own
                notice comes up.
              */}
              {(analyticsAvailable() || platform.webAds || platform.webAnalytics) && (
                <Plate className="grid gap-1 p-1.5">
                  <AnalyticsSetting />
                  {(platform.webAds || platform.webAnalytics) && (
                    <span data-consent-settings="" className="block px-1.5">
                      <SettingLink label={t('consent.menuRowLabel')} name={t('consent.menuLabel')} value={t(consentHint)} onPress={() => { if (!reopenGoogleCmp()) openConsentNotice(); }} />
                    </span>
                  )}
                </Plate>
              )}
            </section>
          )}
        </>
      )}
      {centerOpen && <NotificationCenterSheet onClose={() => { setCenterOpen(false); }} />}
    </div>
  );
}

/** A kept mark: the rival's colour and name on a kit chip; a lost one clears itself. */
function RivalChip({ slot, face, name, lost = false, onClick }: {
  slot: number;
  face: string;
  name: string;
  lost?: boolean;
  onClick: () => void;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onClick(); });
  return (
    <button type="button" {...OWN_SOUND} data-rival-chip aria-label={name} className="gk-hit max-w-full" onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-chip gk-rival" {...(lost ? { 'data-lost': '' } : {})}>
        <span aria-hidden data-rival-dot={slot} className="gk-rival__dot" style={{ backgroundColor: rivalColour(slot) }} />
        <span aria-hidden className="min-w-0 truncate">{face}</span>
        {lost && <Glyph id="close" />}
      </span>
    </button>
  );
}

function EffectsSetting() {
  const { t } = useTranslation();
  const on = useEffectsEnabled();
  const percent = Math.round(useEffectsVolume() * 100);
  return (
    <>
      <Toggle checked={on} label={t('menu.effectsLabel')} onChange={(next) => { setEffectsEnabled(next); if (next) playSound('confirm'); }} />
      <div className="px-1.5">
        <Slider label={t('menu.effectsVolumeLabel')} value={percent} max={100} readout={t('menu.volumeValue', { volume: percent })}
          onChange={(next) => { setEffectsVolume(next / 100); }} />
      </div>
    </>
  );
}

function SoundSetting() {
  const { t } = useTranslation();
  const on = useMusicEnabled();
  const percent = Math.round(useMusicVolume() * 100);
  return (
    <>
      <Toggle checked={on} label={t('menu.soundLabel')} onChange={setMusicEnabled} />
      <div className="px-1.5">
        <Slider label={t('menu.volumeLabel')} value={percent} max={100} readout={t('menu.volumeValue', { volume: percent })}
          onChange={(next) => { setMusicVolume(next / 100); }} />
      </div>
    </>
  );
}

/** Which of the pieces is sounding, where in it, and the way to the next one. */
function NowPlaying() {
  const { t } = useTranslation();
  const on = useMusicEnabled();
  const { track, position, duration } = useMusicPlayback();
  const share = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <div data-now-playing="" className="gk-np">
      <RoundButton small glyph="back" label={t('menu.trackPrev')} onPress={prevTrack} />
      <div className="gk-np__piece" {...(on ? {} : { 'data-off': '' })}>
        <span className="gk-np__line">
          <span className="gk-np__name">{t('menu.trackLabel', { index: track + 1, total: MUSIC_TRACKS.length })}</span>
          <span data-testid="now-playing-clock" className="gk-sub gk-num">
            {t('menu.trackClock', { position: formatTrackTime(position), duration: formatTrackTime(duration, { blankAtZero: true }) })}
          </span>
        </span>
        {/* One second of linear ease, matching the tick that feeds it: the hand sweeps rather than jumps. */}
        <span data-testid="now-playing-bar" aria-hidden="true" className="gk-np__bar"><span className="gk-np__fill" style={{ width: `${String(share)}%` }} /></span>
      </div>
      <RoundButton small glyph="next" label={t('menu.trackNext')} onPress={nextTrack} />
    </div>
  );
}

function QualitySetting() {
  const { t } = useTranslation();
  const quality = useRenderQuality();
  return (
    <div className="grid gap-1.5 px-1.5 pb-1 pt-1.5">
      <p className="gk-label">{t('menu.qualityLabel')}</p>
      <Choices label={t('menu.qualityLabel')} options={RENDER_QUALITIES.map((id) => ({ id, label: t(`menu.quality.${id}`) }))} value={quality} onChange={setRenderQuality} />
      <p className="gk-sub">{t(`menu.qualityHint.${quality}`)}</p>
    </div>
  );
}

function FpsSetting() {
  const { t } = useTranslation();
  return <Toggle checked={useFpsMeterEnabled()} label={t('menu.fpsLabel')} sub={t('menu.fpsHint')} onChange={setFpsMeterEnabled} />;
}
