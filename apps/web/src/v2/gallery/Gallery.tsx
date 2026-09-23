import type { ReactNode } from 'react';
import type { BuildOrderView, PendingThread } from '../../api/schemas.js';
import { nowEntries } from '../../lib/nowLine.js';
import type { DockBadges } from '../../lib/dock.js';
import { BellSheet } from '../hud/BellSheet.js';
import { CollectBubble } from '../hud/CollectBubble.js';
import { ContextSlot, type ContextSlotProps } from '../hud/ContextSlot.js';
import { Dock } from '../hud/Dock.js';
import { NowLine } from '../hud/NowLine.js';
import { TopBar, type TopBarProps } from '../hud/TopBar.js';
import { ViewChip, ViewSheet } from '../hud/ViewSheet.js';
import { ClassEmblem } from '../kit/ClassEmblem.js';
import { ForceRuler } from '../kit/ForceRuler.js';
import { AgeStamp, AgedThumb, ClarityMark } from '../kit/Freshness.js';
import { HoldButton } from '../kit/HoldButton.js';
import { MatchupLine } from '../kit/MatchupLine.js';
import { QueueLane } from '../kit/QueueLane.js';
import { QueueSheet } from '../kit/QueueSheet.js';
import { ResourceMeter } from '../kit/ResourceMeter.js';
import { Segmented } from '../kit/Segmented.js';
import { Sheet } from '../kit/Sheet.js';

/**
 * THE v2 GALLERY — every kit and HUD piece with fixture data, for the camera.
 * Development only (`v2-gallery.html`); nothing here is imported by the game.
 */

const NOW = Date.now();
const MIN = 60_000;
const at = (minutes: number): Date => new Date(NOW + minutes * MIN);
const PLANET = '/assets/images/planets/planet_9.png';
const noop = (): void => undefined;

const thread = (kind: PendingThread['kind'], minutes: number, extra: Partial<PendingThread> = {}): PendingThread => ({
  kind,
  targetName: 'Kestrel',
  targetPlanetId: 'p-1',
  minutesRemaining: minutes,
  arriveAt: at(minutes),
  ...extra,
});

const cost = { alloy: 2_400, crystal: 600, deuterium: 0 };
const building = (id: string, subject: string, from: number, to: number): BuildOrderView => ({
  id, queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject, count: 1, startedAt: at(from), finishesAt: at(to), cost,
});
const hull = (id: string, subject: string, from: number, to: number, count: number): BuildOrderView => ({
  id, queue: 'YARD', slot: 0, kind: 'HULL', subject, count, startedAt: at(from), finishesAt: at(to), cost,
});

const construction = [building('c1', 'REFINERY', -30, 12), building('c2', 'VAULT', 12, 95)];
const yard = [hull('y1', 'DART', -4, 5, 12)];

const topBar: TopBarProps = {
  commander: 'Samet',
  shield: null,
  now: NOW,
  world: null,
  stock: {
    alloy: { value: 12_400, cap: 20_000 },
    crystal: { value: 3_105, cap: 8_000 },
    deuterium: { value: 860, cap: 4_000 },
  },
  bell: { unseen: 0, urgent: false },
  rewards: 0,
  boosted: false,
  onCommander: noop,
  onWorld: noop,
  onResource: noop,
  onBell: noop,
};

const slotBase: ContextSlotProps = {
  now: NOW,
  selected: false,
  threats: [],
  contacts: [],
  events: [],
  suggestion: null,
  onPrepare: noop,
  onLook: noop,
  onShowEvent: noop,
  onAct: noop,
  onClearSelection: noop,
};

const quiet: DockBadges = { base: false, fleet: { airborne: 0, progress: null }, intel: 0, clan: 0 };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-v2-mono text-micro uppercase tracking-wide text-v2-ink-3">{title}</h2>
      {children}
    </section>
  );
}

const reading = { low: 4_000, high: 9_000, source: 'Probe', ageMinutes: 132 };
const lines = { clears: { low: 20_000, high: 26_000 }, breaks: { low: 31_000, high: 38_000 } };

function Views({ view }: { view: string }) {
  if (view === 'queue') {
    return <QueueSheet queues={{ CONSTRUCTION: construction, YARD: yard }} now={NOW} onCancel={noop} onClose={noop} />;
  }
  if (view === 'bell') {
    return (
      <BellSheet
        tab="signals"
        onTab={noop}
        onClose={noop}
        unseen={2}
        chatUnread={4}
        signals={<p className="text-caption text-v2-ink-2">Signal rows draw here (SignalsFeed).</p>}
        chronicle={null}
        chat={null}
      />
    );
  }
  if (view === 'view') {
    return (
      <ViewSheet
        shard="EU-1"
        online={6}
        onlineToday={41}
        counts={{ worlds: 212, fleetsAway: 3, rocks: 9, pirates: 2, wrecks: 1 }}
        telescope
        onToggleTelescope={noop}
        radar={false}
        onToggleRadar={noop}
        onOpenEvents={noop}
        onClose={noop}
      />
    );
  }
  if (view === 'peek') {
    return (
      <Sheet title="Kestrel" eyebrow="VEX · rival" onClose={noop} detents={['peek', 'half', 'full']}>
        <p className="text-caption text-v2-ink-2">The context card sits here at peek; the galaxy stays undimmed.</p>
      </Sheet>
    );
  }
  return null;
}

export function Gallery({ view }: { view: string | null }) {
  if (view) {
    return (
      <div className="min-h-dvh bg-v2-void">
        <TopBar {...topBar} />
        <Views view={view} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 bg-v2-void pb-10 text-v2-ink">
      <Section title="B1 · top bar">
        <TopBar {...topBar} />
        <TopBar
          {...topBar}
          shield={{ until: NOW + 7 * 60 * MIN, kind: 'RECOVERY' }}
          world={{ capital: false, name: 'Hollow' }}
          stock={{ ...topBar.stock, alloy: { value: 20_000, cap: 20_000 }, crystal: { value: 184_000, cap: 250_000 } }}
          bell={{ unseen: 12, urgent: true }}
          rewards={2}
          boosted
        />
      </Section>

      <Section title="B2 · now line">
        <NowLine entries={nowEntries({ now: NOW, threads: [thread('incoming', 4.2), thread('transfer', 9)], runs: [], builds: [], research: [], events: [], shieldUntil: null })} now={NOW} />
        <NowLine entries={nowEntries({ now: NOW, threads: [thread('fleet', 18, { leg: 'outbound', fleet: { DART: 12 } })], runs: [], builds: construction, research: [], events: [], shieldUntil: null })} now={NOW} />
      </Section>

      <div className="flex flex-col gap-5 px-3">
        <Section title="B12 · queue lanes">
          <QueueLane label="Construction" orders={construction} now={NOW} onOpen={noop} />
          <QueueLane label="Yard" orders={yard} now={NOW} onOpen={noop} />
        </Section>

        <Section title="B5 · force ruler + B6 matchup">
          <ForceRuler
            yours={30_000}
            theirs={reading}
            lines={lines}
            loss={{ low: 0.35, high: 0.6 }}
            escape={{ at: 10_000, verdict: 'RUN' }}
          >
            <MatchupLine wing={{ DART: 40 }} reading={{ kind: 'DOMINANT', cls: 'LANCE' }} />
          </ForceRuler>
          <ForceRuler yours={30_000} theirs={null} lines={lines} onProbe={noop} />
        </Section>

        <Section title="B6 · matchup readings">
          <MatchupLine wing={{}} reading={{ kind: 'SHARES', shares: { LANCE: 60, BULWARK: 30, SKIRMISHER: 10 } }} />
          <MatchupLine wing={{}} reading={{ kind: 'EVEN' }} />
          <MatchupLine wing={{}} reading={{ kind: 'UNREAD' }} />
        </Section>

        <Section title="B7 · clarity and age">
          <div className="flex flex-wrap gap-3">
            {(['FULL', 'CLEAR', 'INTERMITTENT', 'DEGRADED', 'BLIND'] as const).map((state) => (
              <ClarityMark key={state} state={state} />
            ))}
          </div>
          <div className="flex items-end gap-3">
            {[5, 120, 600, 3_000].map((minutes) => (
              <div key={minutes} className="flex flex-col items-center gap-1">
                <AgedThumb src={PLANET} alt="Kestrel" ageMinutes={minutes} className="size-14" />
                <AgeStamp minutes={minutes} />
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <AgedThumb src={PLANET} alt="Hollow" clarity="BLIND" className="size-14" />
              <ClarityMark state="BLIND" />
            </div>
          </div>
        </Section>

        <Section title="B8 · class emblems · B9 hold">
          <div className="flex items-center gap-3 text-v2-ink-2">
            {(['SKIRMISHER', 'BULWARK', 'LANCE', 'SUPPORT'] as const).map((cls) => (
              <ClassEmblem key={cls} cls={cls} className="size-5" />
            ))}
          </div>
          <HoldButton label="Launch 74 ships" onCommit={noop} />
          <HoldButton label="Fire the Death Star" onCommit={noop} tone="hostile" />
          <HoldButton label="Launch" onCommit={noop} disabledReason="Not enough Deuterium: 240 short" />
        </Section>

        <Section title="resource meter · B13 collect · segmented">
          <div className="grid grid-cols-3 gap-2">
            <ResourceMeter resource="alloy" value={12_400} cap={20_000} />
            <ResourceMeter resource="crystal" value={8_000} cap={8_000} />
            <ResourceMeter resource="deuterium" value={0} cap={0} />
          </div>
          <div className="flex flex-wrap gap-2">
            <CollectBubble state={{ waiting: 3_200, ripe: true, full: false, movable: 3_200, blocked: false }} pending={false} onCollect={noop} onOpenBase={noop} />
            <CollectBubble state={{ waiting: 9_800, ripe: true, full: true, movable: 9_800, blocked: false }} pending={false} onCollect={noop} onOpenBase={noop} />
            <CollectBubble state={{ waiting: 4_000, ripe: true, full: false, movable: 0, blocked: true }} pending={false} onCollect={noop} onOpenBase={noop} />
          </div>
          <Segmented
            label="Bell"
            value="signals"
            onChange={noop}
            options={[
              { id: 'signals', label: 'Signals' },
              { id: 'chronicle', label: 'Chronicle' },
              { id: 'chat', label: 'Chat', dot: true, dotLabel: '4 unread' },
            ]}
          />
        </Section>
      </div>

      <Section title="B3 · context slot">
        <div className="relative h-36">
          <ContextSlot {...slotBase} threats={[thread('incoming', 9)]} />
        </div>
        <div className="relative h-32">
          <ContextSlot
            {...slotBase}
            events={[{ id: 'e1', kind: 'ASTEROID_SHOWER', startsAt: at(-60), endsAt: at(30), asteroidSpawnMultiplier: 2 }]}
          />
        </div>
        <div className="relative h-36">
          <ContextSlot
            {...slotBase}
            suggestion={{
              id: 'undefended',
              kind: 'growth',
              title: 'Your shield ends in 3h 00m: build a ground defence',
              detail: '456 is exposed to raids. Build Thorns or Bastions for permanent defence.',
              action: { label: 'Build defence', screen: 'planet', group: 'defend' },
              weight: 820,
            }}
          />
        </div>
        <div className="relative h-12">
          <ContextSlot {...slotBase} selected threats={[thread('incoming', 9), thread('incoming', 20)]} />
        </div>
      </Section>

      <Section title="view chip">
        <div className="flex gap-2 px-3">
          <ViewChip layersOn onOpen={noop} />
          <ViewChip layersOn={false} onOpen={noop} />
        </div>
      </Section>

      <Section title="B4 · dock">
        <Dock active="galaxy" badges={quiet} onSelect={noop} />
        <Dock active="fleet" badges={{ base: true, fleet: { airborne: 3, progress: 0.4 }, intel: 2, clan: 12 }} onSelect={noop} />
      </Section>
    </div>
  );
}
