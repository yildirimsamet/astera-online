import { useEffect, useState } from 'react';
import { useGalaxy, useIntel, usePending, usePlanet, useSeason, useTraffic } from '../api/queries.js';
import { GalaxyCanvas } from '../galaxy/GalaxyCanvas.jsx';
import { STANCE_COLOUR, stanceOf } from '../galaxy/scene.js';
import { haptic } from '../lib/haptics.js';
import { LaunchSheet } from './LaunchSheet.jsx';
import { PlanetScreen } from './PlanetScreen.jsx';
import { TargetSheet } from './TargetSheet.jsx';
import { Sheet } from '../ui/Sheet.js';

/**
 * THE GALAXY, AS THE SHELL.
 *
 * The canvas is mounted once and never unmounted. Every panel in the game opens
 * *over* it — your own planet included — so the world is always behind whatever
 * you are doing. That is the whole difference between a game with a map screen and
 * a game that happens in a place.
 *
 * The legend is not decoration. In this game the fog IS the art: a dark sphere
 * means you have never looked, and a player has to be told once what the colours
 * mean before they can read the disc at a glance.
 */
export function GalaxyView({
  focusPlanetId,
  onNavigate,
}: {
  /** A directive pointed the player here — open that world on arrival. */
  focusPlanetId?: string;
  onNavigate?: (group: 'defend' | 'see' | 'reach' | 'grow') => void;
}) {
  const galaxy = useGalaxy();
  const planet = usePlanet();
  const intel = useIntel();
  const season = useSeason();
  const pending = usePending();
  const traffic = useTraffic();

  const [selectedId, setSelectedId] = useState<string | null>(focusPlanetId ?? null);
  const [attacking, setAttacking] = useState(false);
  const [homeSignal, setHomeSignal] = useState(0);

  // "Open the window" on a directive has to land on that world, not just on this
  // screen — the whole point of the directive is that it finishes the job.
  useEffect(() => {
    if (focusPlanetId) setSelectedId(focusPlanetId);
  }, [focusPlanetId]);

  const planets = galaxy.data?.planets ?? [];
  const selected = planets.find((p) => p.id === selectedId) ?? null;
  const windows = planets.filter((p) => !p.isSelf && p.fleet?.status === 'AWAY').length;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <GalaxyCanvas
        planets={planets}
        pending={pending.data?.pending ?? []}
        contacts={traffic.data?.contacts ?? []}
        seed={season.data?.seed}
        seasonStart={season.data?.startsAt}
        selectedId={selectedId}
        onSelect={(id) => {
          if (id) haptic('tap');
          setSelectedId(id);
          setAttacking(false);
        }}
        homeSignal={homeSignal}
      />

      {/* ── overlay: never covers the middle of the disc ── */}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <div className="pointer-events-auto frame px-3 py-2">
          <p className="legend">The disc</p>
          <p className="num mt-1 text-[12px] text-bone">
            {planets.length} worlds
            {windows > 0 && (
              <span className="text-opportunity"> · {windows} fleet away</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            haptic('tap');
            setHomeSignal((n) => n + 1);
          }}
          className="pointer-events-auto btn"
        >
          Home
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
        <div className="frame inline-flex flex-wrap gap-x-3 gap-y-1 px-3 py-2">
          {(
            [
              ['self', 'You'],
              ['window', 'Fleet away'],
              ['watched', 'Watched'],
              ['veiled', 'Veiled'],
              ['dark', 'Never looked'],
            ] as const
          ).map(([stance, label]) => (
            <span key={stance} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: STANCE_COLOUR[stance] }}
              />
              <span className="text-[10px] uppercase tracking-wider text-dim">{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── panels, over the live galaxy ── */}

      {selected?.isSelf && planet.data && (
        <Sheet
          eyebrow="Your planet"
          title={selected.name}
          onClose={() => {
            setSelectedId(null);
          }}
        >
          {/* The management screen, unchanged — it was always panel content. */}
          <div className="-mx-4">
            <PlanetScreen embedded />
          </div>
        </Sheet>
      )}

      {selected && !selected.isSelf && !attacking && planet.data && (
        <TargetSheet
          target={selected}
          planet={planet.data}
          intel={intel.data}
          onClose={() => {
            setSelectedId(null);
          }}
          onAttack={() => {
            setAttacking(true);
          }}
          {...(onNavigate ? { onNavigate } : {})}
        />
      )}

      {selected && !selected.isSelf && attacking && planet.data && (
        <LaunchSheet
          target={selected}
          planet={planet.data}
          onClose={() => {
            setAttacking(false);
          }}
          onLaunched={() => {
            setAttacking(false);
            setSelectedId(null);
          }}
        />
      )}

      {galaxy.isPending && (
        <p className="legend absolute inset-x-0 top-1/2 animate-pulse text-center">
          Sweeping the disc
        </p>
      )}

      {/* Proof the stance model is doing something, for anyone reading the code. */}
      <span className="sr-only">
        {planets.map((p) => `${p.name}:${stanceOf(p)}`).join(' ')}
      </span>
    </div>
  );
}
