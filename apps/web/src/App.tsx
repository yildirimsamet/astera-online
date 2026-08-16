import { useEffect, useMemo, useRef, useState } from 'react';
import { useGalaxy, useIntel, usePending, usePlanet } from './api/queries.js';
import type { ReturnPayload } from './api/schemas.js';
import { directives, primary, type Directive, type PlanetGroup } from './lib/directives.js';
import { useProjectedResources } from './lib/projection.js';
import { useBootstrap } from './session/useBootstrap.js';
import { useEventStream } from './session/useEventStream.js';
import { useLiveAlerts } from './session/useLiveAlerts.js';
import { EntryScreen } from './screens/EntryScreen.js';
import { GalaxyView } from './screens/GalaxyView.jsx';
import { IntelScreen } from './screens/IntelScreen.js';
import { PlanetScreen } from './screens/PlanetScreen.js';
import { PendingStrip } from './shell/PendingStrip.js';
import { ReturnOverlay } from './shell/ReturnOverlay.js';
import { StatusBar } from './shell/StatusBar.js';
import { TabBar, type Tab } from './shell/TabBar.js';
import { DirectiveCard, DirectiveStrip } from './ui/DirectiveCard.js';

export function App() {
  const { boot, takeAPlanet, retry } = useBootstrap();
  const ready = boot.phase === 'ready';

  useEventStream(ready);
  useLiveAlerts(ready);

  // The galaxy is the home surface, not a screen you visit. D1.
  const [tab, setTab] = useState<Tab>('galaxy');
  const [arrivalSeen, setArrivalSeen] = useState(false);
  const [openPlanetId, setOpenPlanetId] = useState<string | undefined>(undefined);
  const [focusGroup, setFocusGroup] = useState<PlanetGroup | undefined>(undefined);
  const scroller = useRef<HTMLElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);

  if (boot.phase === 'starting') {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="legend animate-pulse">Making contact</p>
      </main>
    );
  }

  if (boot.phase === 'entry') {
    return (
      <EntryScreen
        onBegin={() => {
          void takeAPlanet();
        }}
        busy={false}
        {...(boot.error === undefined ? {} : { error: boot.error })}
      />
    );
  }

  if (boot.phase === 'blocked') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="legend">Not right now</p>
        <p className="text-[15px] text-dim">{boot.message}</p>
        <button type="button" className="btn" onClick={retry}>
          Try again
        </button>
      </main>
    );
  }

  const act = (directive: Directive): void => {
    setTab(directive.action.screen);
    setOpenPlanetId(directive.action.planetId);
    setFocusGroup(directive.action.group);
  };

  return (
    <div className="relative z-10 flex h-dvh flex-col overflow-hidden">
      <StatusBar onNavigate={setTab} />

      {tab === 'galaxy' ? (
        // Full-bleed: the canvas owns the space between the bar and the tabs, and
        // everything else in the game opens on top of it.
        <main className="relative flex-1">
          <GalaxyView
            {...(openPlanetId ? { focusPlanetId: openPlanetId } : {})}
            onNavigate={(group) => {
              setTab('planet');
              setFocusGroup(group);
            }}
          />
        </main>
      ) : (
        <main ref={scroller} className="flex-1 overflow-y-auto overscroll-contain pb-8">
          {/*
            The situation, above everything.

            A player who has to work out what matters from sixteen equally-weighted
            rows will not do it — they will close the app. This is the one place the
            game says, in its own voice, what is happening and what it is worth
            doing about it.
          */}
          <Situation tab={tab} onAct={act} />

          {tab === 'planet' && <PlanetScreen {...(focusGroup ? { focusGroup } : {})} />}
          {tab === 'intel' && <IntelScreen />}
        </main>
      )}

      <div className="shrink-0">
        <PendingStrip />
        <TabBar active={tab} onSelect={setTab} />
      </div>

      {!arrivalSeen && worthReturning(boot.arrival) && (
        <ReturnOverlay
          arrival={boot.arrival}
          playerName={boot.placement.planetName}
          onDismiss={() => {
            setArrivalSeen(true);
          }}
        />
      )}
    </div>
  );
}

function Situation({ tab, onAct }: { tab: Tab; onAct: (directive: Directive) => void }) {
  const planet = usePlanet();
  const galaxy = useGalaxy();
  const intel = useIntel();
  const pending = usePending();
  const held = useProjectedResources(planet.data?.planet, planet.dataUpdatedAt, 5000);

  const top = useMemo(() => {
    if (!planet.data) return undefined;
    return primary(
      directives({
        planet: planet.data,
        galaxy: galaxy.data,
        intel: intel.data,
        pending: pending.data?.pending ?? [],
        held,
      }),
    );
  }, [planet.data, galaxy.data, intel.data, pending.data, held]);

  if (!top) return null;

  // The full card is a claim on the whole screen, and it has only earned that on
  // the screen where the action actually happens. Everywhere else it is one line —
  // still visible, still tappable, no longer pushing the content below the fold.
  const here = top.action.screen === tab;

  return (
    <div className="px-4 pt-4">
      {here ? (
        <DirectiveCard directive={top} onAct={onAct} />
      ) : (
        <DirectiveStrip directive={top} onAct={onAct} />
      )}
    </div>
  );
}

/**
 * Whether there is a return to report at all.
 *
 * A brand-new commander has never left, so greeting them with "0m — nothing
 * happened, the galaxy did not notice you were away" is the worst possible first
 * screen in a game about being watched. After a real absence the same line is
 * exactly right, so the test is whether time actually passed.
 */
const worthReturning = (arrival: ReturnPayload): boolean =>
  arrival.entries.length > 0 || arrival.pending.length > 0 || arrival.awayMinutes >= 20;
