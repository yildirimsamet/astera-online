import { useMemo, useState } from 'react';
import { distance } from '@blindspace/rules';
import { useGalaxy, useIntel, useLeaderboard, usePlanet } from '../api/queries.js';
import type { GalaxyPlanet, IntelView, PlanetView } from '../api/schemas.js';
import { compact, signed } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { waspMinutes } from '../lib/navigation.js';
import { ClarityBars } from '../ui/Clarity.js';
import { Section } from '../ui/primitives.js';
import { Sheet } from '../ui/Sheet.js';
import { LaunchSheet } from './LaunchSheet.js';
import { TargetSheet } from './TargetSheet.js';

/**
 * THE GALAXY — a list of people, not a list of coordinates.
 *
 * The first version showed name, owner, distance and tier: a phone book. Nothing
 * on it said which of these planets was an opportunity, which was a threat, and
 * which one the player knew nothing about — so there was no reason to tap any of
 * them, and the intel layer the whole game rests on had no entry point.
 *
 * Every row now states the player's KNOWLEDGE of that planet and what it would
 * take to improve it. Ignorance is presented as something to fix, which is the
 * only honest way to sell a scouting mechanic.
 */

type Stance = 'window' | 'watched' | 'veiled' | 'unseen';

interface Assessment {
  planet: GalaxyPlanet;
  minutes: number;
  stance: Stance;
  /** Sorting weight — what a player should look at first. */
  priority: number;
}

function assess(planet: GalaxyPlanet, minutes: number, probed: boolean): Assessment {
  if (!planet.fleet) {
    return { planet, minutes, stance: 'unseen', priority: probed ? 40 : 60 - minutes / 10 };
  }
  if (planet.fleet.status === 'AWAY') {
    return { planet, minutes, stance: 'window', priority: 1000 - minutes };
  }
  if (planet.fleet.status === 'UNKNOWN') {
    return { planet, minutes, stance: 'veiled', priority: 80 };
  }
  return { planet, minutes, stance: 'watched', priority: 70 };
}

export function GalaxyScreen({
  openPlanetId,
  onNavigate,
}: {
  openPlanetId?: string;
  onNavigate?: (group: 'defend' | 'see' | 'reach' | 'grow') => void;
}) {
  const galaxy = useGalaxy();
  const planet = usePlanet();
  const intel = useIntel();
  const [selectedId, setSelectedId] = useState<string | null>(openPlanetId ?? null);
  const [attacking, setAttacking] = useState(false);
  const [ladderOpen, setLadderOpen] = useState(false);

  const home = planet.data?.planet.position;

  const list = useMemo<Assessment[]>(() => {
    if (!galaxy.data || !home) return [];
    const probedIds = new Set((intel.data?.probeReports ?? []).map((r) => r.targetPlanetId));
    return galaxy.data.planets
      .filter((p) => !p.isSelf)
      .map((p) => assess(p, waspMinutes(home, p.position), probedIds.has(p.id)))
      .sort((a, b) => b.priority - a.priority);
  }, [galaxy.data, home, intel.data]);

  if (galaxy.isPending || planet.isPending || !galaxy.data || !planet.data) {
    return (
      <div className="px-4 pt-16 text-center">
        <p className="legend animate-pulse">Sweeping the disc</p>
      </div>
    );
  }

  const windows = list.filter((a) => a.stance === 'window').length;
  const unseen = list.filter((a) => a.stance === 'unseen').length;
  const selected = galaxy.data.planets.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="px-4 pt-4">
      <Ladder
        onOpen={() => {
          setLadderOpen(true);
        }}
      />

      {/* What the list amounts to, before the list. */}
      <p className="mb-4 text-[13px] leading-snug text-dim">
        {windows > 0 ? (
          <span className="text-opportunity">
            {windows} fleet{windows === 1 ? '' : 's'} away right now.{' '}
          </span>
        ) : null}
        You can see into {String(list.length - unseen)} of {String(list.length)} planets.
        {unseen > 0 && ` ${String(unseen)} are completely dark to you.`}
      </p>

      <Section label="Everyone else" aside={`${String(list.length)} planets`}>
        <div className="group">
          {list.map((entry) => (
            <PlanetRow
              key={entry.planet.id}
              entry={entry}
              intel={intel.data}
              markDark={unseen < list.length}
              onOpen={() => {
                setSelectedId(entry.planet.id);
              }}
            />
          ))}
        </div>
      </Section>

      {selected && !attacking && (
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

      {selected && attacking && (
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

      {ladderOpen && (
        <LadderSheet
          onClose={() => {
            setLadderOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PlanetRow({
  entry,
  intel,
  markDark,
  onOpen,
}: {
  entry: Assessment;
  intel: IntelView | undefined;
  /**
   * A badge that appears on every single row is not a signal, it is wallpaper.
   * When the whole galaxy is dark the sentence above the list has already said so,
   * and eleven identical chips only add noise to it.
   */
  markDark: boolean;
  onOpen: () => void;
}) {
  const { planet, stance, minutes } = entry;
  const report = intel?.probeReports.find((r) => r.targetPlanetId === planet.id);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start gap-3 border-b border-line-soft p-3 text-left last:border-b-0 ${
        stance === 'window' ? 'bg-opportunity/8' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[15px] uppercase tracking-wide text-bone">
            {planet.name}
          </span>
          {stance === 'window' && <span className="chip chip-opportunity">Window</span>}
          {stance === 'unseen' && !report && markDark && <span className="chip">Dark</span>}
          {stance === 'veiled' && <span className="chip">Veiled</span>}
        </div>
        <p className="num mt-0.5 text-[11px] text-faint">
          {planet.owner} · {duration(minutes)} away · tier {planet.coreTier}
        </p>

        {/*
          Only rows with something to say get a second line.

          Nine planets each repeating "Dark · you know nothing here · probe 220"
          is the same wall of undifferentiated rows the redesign set out to remove,
          wearing new words. The count is stated once, above the list; down here a
          chip carries it, and the rows that DO know something are the ones that
          grow.
        */}
        {stance !== 'unseen' && planet.fleet && (
          <div className="mt-1.5 flex items-center gap-2">
            <ClarityBars state={planet.fleet.clarity} />
            <span className="text-[12px] leading-snug">
              {stance === 'window' ? (
                <span className="text-opportunity">
                  Fleet away
                  {planet.fleet.staleMinutes >= 1
                    ? ` · seen ${duration(planet.fleet.staleMinutes)} ago`
                    : ' · live'}
                  {planet.fleet.etaMinutes != null &&
                    ` · back in ${duration(planet.fleet.etaMinutes)}`}
                </span>
              ) : stance === 'veiled' ? (
                <span className="text-dim">Their Veil beats your Telescope</span>
              ) : (
                <span className="text-dim">Fleet home</span>
              )}
            </span>
          </div>
        )}

        {report && stance === 'unseen' && (
          <p className="num mt-1.5 text-[11px] text-dim">
            Probed · held {compact(report.stock.low)}–{compact(report.stock.high)}
          </p>
        )}
      </div>

      <span aria-hidden className="self-center text-faint">
        →
      </span>
    </button>
  );
}

/* ── Dominion ───────────────────────────────────────────────── */

function Ladder({ onOpen }: { onOpen: () => void }) {
  const { data } = useLeaderboard();
  if (!data) return null;
  const you = data.you;
  const leader = data.ladder[0];
  const behind = you && leader ? leader.dominion - you.dominion : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="panel mb-4 flex w-full items-center gap-4 px-3.5 py-3 text-left"
    >
      <div>
        <p className="legend">Dominion</p>
        <p className="num mt-0.5 text-[22px] leading-none text-bone">
          {you ? signed(you.dominion) : '0'}
        </p>
      </div>
      <div className="flex-1 border-l border-line-soft pl-4">
        <p className="num text-[12px] text-dim">
          {you ? `Rank ${String(you.rank)} of ${String(data.ladder.length)}` : 'Unranked'}
        </p>
        <p className="num mt-0.5 text-[11px] text-faint">
          {behind > 0
            ? `${compact(behind)} behind ${leader?.name ?? 'the leader'}`
            : 'Only combat moves this number'}
        </p>
      </div>
    </button>
  );
}

function LadderSheet({ onClose }: { onClose: () => void }) {
  const { data } = useLeaderboard();

  return (
    <Sheet eyebrow="Season standing" title="Dominion" onClose={onClose}>
      <p className="text-[13px] leading-relaxed text-dim">
        Everything you have taken from other players, minus everything they have taken from you.
        It sums to zero across the galaxy, and only combat moves it — a player who never fights
        scores exactly nothing, however rich they get.
      </p>
      <div className="mt-5">
        {(data?.ladder ?? []).map((entry) => (
          <div
            key={entry.playerId}
            className={`flex items-center gap-3 border-b border-line-soft py-2 ${
              entry.playerId === data?.you?.playerId ? 'text-crystal' : ''
            }`}
          >
            <span className="num w-7 text-[12px] text-faint">{entry.rank}</span>
            <span className="flex-1 truncate text-[14px]">{entry.name}</span>
            <span className="num text-[11px] text-faint">{compact(entry.wealth)} held</span>
            <span className="num w-16 text-right text-[13px]">{signed(entry.dominion)}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/** Kept for the target sheet's distance readout. */
export const distanceTo = (a: PlanetView, b: GalaxyPlanet): number =>
  distance(a.planet.position, b.position);
