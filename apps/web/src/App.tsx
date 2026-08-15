import { useEffect, useRef, useState } from 'react';
import type { ReturnPayload } from './api/schemas.js';
import { useBootstrap } from './session/useBootstrap.js';
import { useEventStream } from './session/useEventStream.js';
import { useLiveAlerts } from './session/useLiveAlerts.js';
import { EntryScreen } from './screens/EntryScreen.js';
import { GalaxyScreen } from './screens/GalaxyScreen.js';
import { IntelScreen } from './screens/IntelScreen.js';
import { PlanetScreen } from './screens/PlanetScreen.js';
import { PendingStrip } from './shell/PendingStrip.js';
import { ReturnOverlay } from './shell/ReturnOverlay.js';
import { StatusBar } from './shell/StatusBar.js';
import { TabBar, type Tab } from './shell/TabBar.js';

export function App() {
  const { boot, takeAPlanet, retry } = useBootstrap();
  const ready = boot.phase === 'ready';

  useEventStream(ready);
  useLiveAlerts(ready);

  const [tab, setTab] = useState<Tab>('planet');
  const [arrivalSeen, setArrivalSeen] = useState(false);
  const scroller = useRef<HTMLElement>(null);

  // Switching tabs should land at the top of the new screen, not halfway down
  // wherever the last one happened to be.
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

  return (
    // A shell, not a document: the bar and the tabs are always where the thumb
    // left them, and only the middle scrolls. Sticky children would have let the
    // in-flight strip cover the last row of every list.
    <div className="relative z-10 flex h-dvh flex-col overflow-hidden">
      <StatusBar />

      <main ref={scroller} className="flex-1 overflow-y-auto overscroll-contain pb-8">
        {tab === 'planet' && <PlanetScreen />}
        {tab === 'galaxy' && <GalaxyScreen />}
        {tab === 'intel' && <IntelScreen />}
      </main>

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
