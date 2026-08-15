import { useMemo, useState } from 'react';
import { useGalaxy, useIntel, useLeaderboard, usePlanet } from '../api/queries.js';
import type { GalaxyPlanet } from '../api/schemas.js';
import { compact, signed } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { waspMinutes } from '../lib/navigation.js';
import { ClarityBars } from '../ui/Clarity.js';
import { Empty, Panel, Section } from '../ui/primitives.js';
import { Sheet } from '../ui/Sheet.js';
import { LaunchSheet } from './LaunchSheet.js';
import { TargetSheet } from './TargetSheet.js';

/**
 * The galaxy as a list, not a map.
 *
 * The 3D view is a later phase and is not what makes this decision work. What
 * makes it work is the split below: the planets you can actually reach, and the
 * ones you cannot. Every player has eight to fifteen neighbours inside twelve
 * minutes, and that set — not the other 190 — is their season.
 */
const REACH_MINUTES = 12;

export function GalaxyScreen() {
  const galaxy = useGalaxy();
  const planet = usePlanet();
  const intel = useIntel();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attacking, setAttacking] = useState(false);
  const [ladderOpen, setLadderOpen] = useState(false);

  const home = planet.data?.planet.position;

  const sorted = useMemo(() => {
    if (!galaxy.data || !home) return { near: [], far: [] };
    const others = galaxy.data.planets.filter((p) => !p.isSelf);
    const withTime = others
      .map((p) => ({ planet: p, minutes: waspMinutes(home, p.position) }))
      .sort((a, b) => a.minutes - b.minutes);
    return {
      near: withTime.filter((e) => e.minutes <= REACH_MINUTES),
      far: withTime.filter((e) => e.minutes > REACH_MINUTES),
    };
  }, [galaxy.data, home]);

  if (galaxy.isPending || planet.isPending || !galaxy.data || !planet.data) {
    return (
      <div className="px-4 pt-16 text-center">
        <p className="legend animate-pulse">Sweeping the disc</p>
      </div>
    );
  }

  const selected = galaxy.data.planets.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="px-4 pt-4">
      <Ladder
        onOpen={() => {
          setLadderOpen(true);
        }}
      />

      {sorted.near.length > 0 && (
        <Section label="Within reach" aside={`${String(sorted.near.length)} planets`}>
          <Panel className="py-1">
            {sorted.near.map(({ planet: p, minutes }) => (
              <PlanetRow
                key={p.id}
                planet={p}
                minutes={minutes}
                onOpen={() => {
                  setSelectedId(p.id);
                }}
              />
            ))}
          </Panel>
        </Section>
      )}

      {/* On a galaxy this empty, "beyond" would be a distinction without a
          difference — everyone is beyond. The split only earns its place once
          somebody is actually close. */}
      <Section
        label={sorted.near.length > 0 ? 'Beyond' : 'The galaxy'}
        aside={`${String(sorted.far.length)} planets`}
      >
        {sorted.far.length === 0 ? (
          <Empty>Nobody else is out there yet. This shard is still filling up.</Empty>
        ) : (
          <Panel className="py-1">
            {sorted.far.slice(0, 40).map(({ planet: p, minutes }) => (
              <PlanetRow
                key={p.id}
                planet={p}
                minutes={minutes}
                onOpen={() => {
                  setSelectedId(p.id);
                }}
              />
            ))}
          </Panel>
        )}
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
  planet,
  minutes,
  onOpen,
}: {
  planet: GalaxyPlanet;
  minutes: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-line-soft py-2.5 text-left last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[14px] text-bone">{planet.name}</span>
          <span className="truncate text-[12px] text-faint">{planet.owner}</span>
        </div>
        {/* Only a planet you are watching gets a second line. The rows you have
            intel on are physically larger and brighter than the rows you do not —
            which is the list telling you where you have already spent something. */}
        {planet.fleet && (
          <div className="mt-1 flex items-center gap-2">
            <ClarityBars state={planet.fleet.clarity} />
            <span className="num text-[11px] text-dim">
              fleet {planet.fleet.status.toLowerCase()}
              {planet.fleet.staleMinutes >= 1 && ` · ${duration(planet.fleet.staleMinutes)} ago`}
            </span>
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="num text-[13px] text-bone">{duration(minutes)}</div>
        <div className="num text-[10px] text-faint">tier {planet.coreTier}</div>
      </div>
    </button>
  );
}

/* ── Dominion ───────────────────────────────────────────────── */

function Ladder({ onOpen }: { onOpen: () => void }) {
  const { data } = useLeaderboard();
  if (!data) return null;
  const you = data.you;

  return (
    <button type="button" onClick={onOpen} className="panel mb-6 flex w-full items-center gap-4 px-3.5 py-3 text-left">
      <div>
        <p className="legend">Dominion</p>
        <p className="num mt-0.5 text-[20px] leading-none text-bone">
          {you ? signed(you.dominion) : '0'}
        </p>
      </div>
      <div className="flex-1 border-l border-line-soft pl-4">
        <p className="num text-[12px] text-dim">
          {you ? `Rank ${String(you.rank)} of ${String(data.ladder.length)}` : 'Unranked'}
        </p>
        <p className="num mt-0.5 text-[11px] text-faint">
          Leader {data.ladder[0]?.name ?? '—'} · {signed(data.ladder[0]?.dominion ?? 0)}
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
