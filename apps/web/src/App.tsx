import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from './session/useSession.js';
import { useEventStream } from './session/useEventStream.js';
import { useLiveAlerts } from './session/useLiveAlerts.js';
import { LandingScreen } from './screens/LandingScreen.jsx';
import { Academy } from './onboarding/Academy.jsx';
import { ServersScreen } from './screens/ServersScreen.jsx';
import { GalaxyView, type Panel, type PanelStop } from './screens/GalaxyView.jsx';
import { LoadingScreen } from './shell/LoadingScreen.js';
import { useAmbientMusic } from './lib/music.js';
import { WorldProvider } from './api/world.js';
import { Button } from './ui/kit/index.js';
import { GameShell } from './v2/shell/GameShell.js';
import type { StripFocus } from './shell/PendingStrip.js';
import {
  nextPanelFocus,
  nextPanelStop,
  type PanelFocusRequest,
  type PanelStopRequest,
} from './shell/panelRoute.js';

/**
 * THREE SCREENS, ONE OF WHICH IS THE GAME.
 *
 * `landing` and `servers` exist to get a player to the third and are never seen
 * again inside a season (D21). The third is the whole product:
 *
 * The galaxy, framed by the Gözlemevi shell (`v2/shell/GameShell.tsx`): the top bar
 * and the Now line above it, five labelled tabs below it (K1). The galaxy never
 * closes — every tab but Galaxy opens a page over it, and the dock stays one press
 * from any page. What must be true at all times still is: what you are holding
 * (the meters), what is coming soonest (the Now line), and what is in the air
 * (the Fleet tab's ring) — Design Law #1, "every session must end with something
 * in flight", kept visible.
 *
 * THE RETURN OVERLAY IS GONE. D23.
 *
 * "While you were gone" was a full-screen modal on the way in, and on a phone it
 * fired far more often than the absence it described: backgrounding a browser tab
 * evicts the page, coming back remounts the app, and the app cold-started into the
 * overlay again — after ninety seconds away, over and over. An interruption that
 * frequent stops being news and becomes a door to close, which is worse than
 * nothing because it trains the player to dismiss the one surface the design
 * wanted them to read.
 *
 * The news itself did not go anywhere. Every line it carried is an event, and
 * events live in Signals, where the beacon pulses until they are read and they can
 * be read when the player chooses rather than before they are allowed in. What is
 * still in flight is on the Now line and the Fleet tab, permanently — a stronger reading
 * of Design Law #1 than a screen shown once and dismissed.
 */
export function App() {
  /**
   * THE WHOLE TREE SUBSCRIBES TO THE LANGUAGE HERE, AND ONLY HERE.
   *
   * `useTranslation` re-renders its component when `languageChanged` fires, and
   * nothing below this is memoised — so one subscription at the root repaints
   * every screen at once. That is what lets `format.ts`, `time.ts` and the
   * `i18n/names.ts` lookups stay plain functions instead of hooks: they read the
   * live instance, and the render that reads them is already happening.
   */
  const { t } = useTranslation();
  const {
    session,
    authenticate,
    chooseServer,
    signOut,
    retry,
    rehearse,
    leaveRehearsal,
    signInInstead,
    claim,
    rollover,
  } = useSession();
  const ready = session.phase === 'ready';
  const [academyReplay, setAcademyReplay] = useState(false);

  /**
   * ABOVE EVERY EARLY RETURN IN THIS COMPONENT, and it has to be.
   *
   * The score runs for the whole session — the front door, the rehearsal and the
   * galaxy are one continuous piece of music, not three. Called from a branch it
   * would unmount and remount on every phase change, which restarts the track
   * from the top each time a player signs in.
   */
  useAmbientMusic();

  useEventStream(ready && !academyReplay, rollover);
  useLiveAlerts(ready && !academyReplay);

  const [panel, setPanel] = useState<Panel>(null);
  /**
   * WHICH SHELF THE PANEL OPENS ON, WHEN THE CALLER KNOWS. D121.
   *
   * Owned here rather than in `GalaxyView` because the request comes from the
   * header — `Signals` sits in `StatusBar`, outside the canvas — and this is the
   * lowest place both of them can see. The counter is what makes a second battle
   * notification land after the reader has already moved off the battles tab.
   */
  const [panelStop, setPanelStop] = useState<PanelStopRequest | null>(null);
  /**
   * WHICH WORLD, WHICH TAB, WHICH ROW — for a notification that names all three.
   *
   * Beside `panelStop` and owned here for the same reason: `Signals` lives in the header,
   * outside the canvas, and this is the lowest place both it and `GalaxyView` can see.
   */
  const [panelFocus, setPanelFocus] = useState<PanelFocusRequest | null>(null);
  const openPanel = (
    next: Panel,
    stop?: PanelStop,
    reportMissionId?: string,
    focus?: { planetId?: string; group?: string; itemId?: string },
  ): void => {
    setPanelStop((current) => nextPanelStop(current, stop, reportMissionId));
    setPanelFocus((current) => nextPanelFocus(current, focus));
    setPanel(next);
  };
  const [planetFocus, setPlanetFocus] = useState<{ planetId: string; request: number } | null>(null);
  const [craftFocus, setCraftFocus] = useState<{ focus: StripFocus; request: number } | null>(null);
  const focusPlanet = (planetId: string): void => {
    setPanel(null);
    setPlanetFocus((current) => ({ planetId, request: (current?.request ?? 0) + 1 }));
  };

  /**
   * D23. Every transition between screens shows the same frame.
   *
   * There is no measurable fraction here — the wait is a round trip to a server,
   * not a list of files — so the rail sweeps rather than fills. Saying "62%" of a
   * request nobody can decompose would be the exact dishonesty `LoadingScreen`
   * refuses.
   */
  if (session.phase === 'starting') {
    return <LoadingScreen caption={t('loading.contact')} />;
  }

  if (session.phase === 'landing') {
    return (
      <LandingScreen
        onAuthenticate={authenticate}
        onBegin={rehearse}
        {...(session.open === undefined ? {} : { open: session.open })}
        {...(session.error === undefined ? {} : { error: session.error })}
      />
    );
  }

  /**
   * THE REHEARSAL OWNS THE WHOLE SCREEN, INCLUDING ITS OWN API AND CACHE. D56.
   *
   * It is not wrapped in the app's providers on purpose: everything it holds
   * describes a planet that does not exist, and the session that follows must
   * never read a byte of it.
   */
  if (session.phase === 'rehearsing') {
    return (
      <Academy
        onClaim={claim}
        onSignIn={signInInstead}
        onLeave={leaveRehearsal}
      />
    );
  }

  if (session.phase === 'servers') {
    return (
      <ServersScreen
        displayName={session.me.displayName}
        latestResult={session.me.latestResult}
        onChoose={(code) => {
          void chooseServer(code);
        }}
        onSignOut={() => {
          void signOut();
        }}
        {...(session.error === undefined ? {} : { error: session.error })}
      />
    );
  }

  if (session.phase === 'blocked') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="legend">{t('app.blockedTitle')}</p>
        <p className="text-body text-dim">{session.message}</p>
        <Button onClick={retry}>{t('app.blockedRetry')}</Button>
      </main>
    );
  }

  if (academyReplay) return <Academy replay onClaim={() => Promise.reject(new Error('REPLAY_ONLY'))}
    onSignIn={() => { setAcademyReplay(false); }} onLeave={() => { setAcademyReplay(false); }} />;

  return (
    <WorldProvider>
      {/*
        THE GÖZLEMEVİ SHELL (docs/ui-v2/gozlemevi.md, F2): top bar and Now line above
        the galaxy, the dock below it, the bell and the Fleet page on top. It replaced
        `StatusBar` and `PendingStrip` here; the rehearsal still draws those until F2.6.
      */}
      <GameShell
        commander={session.me.displayName}
        panel={panel}
        onPanel={openPanel}
        onFocusPlanet={focusPlanet}
        onFocusCraft={(focus) => {
          setPanel(null);
          setCraftFocus((current) => ({ focus, request: (current?.request ?? 0) + 1 }));
        }}
        galaxy={({ homeRequest, worldsRequest, centerRequest, clearRequest, onPanel }) => (
          <GalaxyView
            panel={panel}
            onPanel={onPanel}
            panelStop={panelStop}
            panelFocus={panelFocus}
            focusRequest={planetFocus}
            craftFocusRequest={craftFocus}
            commander={session.me.displayName}
            isAdmin={session.me.isAdmin}
            pastResult={session.me.latestResult}
            onSignOut={() => {
              void signOut();
            }}
            onPlacementLost={rollover}
            onReplayAcademy={() => { setPanel(null); setAcademyReplay(true); }}
            homeRequest={homeRequest}
            worldsRequest={worldsRequest}
            centerRequest={centerRequest}
            clearRequest={clearRequest}
          />
        )}
      />
    </WorldProvider>
  );
}
