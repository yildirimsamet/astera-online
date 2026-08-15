import type { ReactNode } from 'react';
import { PROBE, distance, satelliteEntries, travelMinutes } from '@blindspace/rules';
import { useProbe, useWatch } from '../api/queries.js';
import type { GalaxyPlanet, IntelView, PlanetView } from '../api/schemas.js';
import { compact, percent, range } from '../lib/format.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { reachMinutes, waspMinutes } from '../lib/navigation.js';
import { PROBE_ART, satelliteArt } from '../ui/assets.js';
import { ClarityBars } from '../ui/Clarity.js';
import { Sheet } from '../ui/Sheet.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * WHAT I KNOW · WHAT I DON'T · HOW I FIND OUT.
 *
 * The first version listed facts and then offered buttons underneath them, which
 * made ignorance invisible: a planet you had never scouted looked much like one
 * you had. Every gap is now a row of its own, and every gap carries the action
 * that closes it and what that action costs.
 *
 * This is the entry point to the entire information layer. If a player never
 * thinks "I don't know enough about this planet yet", the game is a worse OGame.
 */
export function TargetSheet({
  target,
  planet,
  intel,
  onClose,
  onAttack,
  onNavigate,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  intel: IntelView | undefined;
  onClose: () => void;
  onAttack: () => void;
  /** Takes the player to the part of their planet that closes this gap. */
  onNavigate?: (group: 'defend' | 'see' | 'reach' | 'grow') => void;
}) {
  const watch = useWatch();
  const probe = useProbe();
  const say = useToast();
  const now = useNow(30_000);

  const telescope = planet.satellites.TELESCOPE ?? 0;
  const owned = satelliteEntries(planet.satellites).length;
  const freeSlot = planet.satelliteSlots - owned > 0;
  const dist = distance(planet.planet.position, target.position);
  const reach = reachMinutes(planet.planet.position, target.position, planet.fleet);
  const probeMinutes = travelMinutes(dist, PROBE.speed);
  const report = intel?.probeReports.find((r) => r.targetPlanetId === target.id);
  const affordProbe =
    planet.planet.alloy >= PROBE.alloy && planet.planet.crystal >= PROBE.crystal;

  const watchedSlot = intel?.watching.find((w) => w.targetPlanetId === target.id);
  const away = target.fleet?.status === 'AWAY';

  return (
    <Sheet eyebrow={`Held by ${target.owner}`} title={target.name} onClose={onClose}>
      {away && (
        <div className="directive directive-opportunity mb-5">
          <span className="legend text-opportunity">Window open</span>
          <p className="mt-1 text-[16px] leading-tight text-bone">Their fleet is not home</p>
          <p className="mt-1 text-[12px] text-dim">
            {target.fleet?.etaMinutes === null
              ? 'You do not know when it comes back. That is the risk you are taking.'
              : `Back in about ${duration(target.fleet?.etaMinutes ?? 0)}, and you need ${
                  reach === null ? '—' : duration(reach)
                } to get there.`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Figure label="Development" value={`Tier ${String(target.coreTier)}`} />
        <Figure label="Distance" value={dist.toFixed(0)} />
        <Figure
          label="Your reach"
          value={
            reach === null
              ? `${duration(waspMinutes(planet.planet.position, target.position))}*`
              : duration(reach)
          }
        />
      </div>
      {reach === null && (
        <p className="mt-2 text-[11px] text-faint">
          * you have no ships at home — that is Wasp speed, if you had any.
        </p>
      )}

      {/* ── what you know ─────────────────────────────────── */}
      <h3 className="legend mt-7">What you know</h3>

      <Fact
        known
        label="Owner, position, development"
        value={`${target.owner} · tier ${String(target.coreTier)}`}
        note="Public. Free to everyone, all season."
      />

      {target.fleet ? (
        <Fact
          known
          label="Fleet status"
          value={
            <span className="flex items-center gap-2">
              <ClarityBars state={target.fleet.clarity} />
              <span className={away ? 'text-opportunity' : 'text-bone'}>
                {target.fleet.status === 'UNKNOWN' ? 'Unreadable' : `Fleet ${target.fleet.status.toLowerCase()}`}
              </span>
              <span className="text-faint">{staleness(target.fleet.staleMinutes)}</span>
            </span>
          }
          note={
            target.fleet.status === 'UNKNOWN'
              ? 'Their Veil is beating your Telescope. Raise it, or send a probe instead.'
              : 'Watching is silent — they are not told you are looking.'
          }
        />
      ) : (
        <Gap
          label="Fleet status"
          missing={telescope === 0 ? 'You have no Telescope' : 'No telescope slot points here'}
          why="The single most valuable fact in the game: a fleet that is away cannot defend its planet."
          art={satelliteArt('TELESCOPE', Math.max(1, telescope))}
          action={
            telescope === 0 ? (
              <button
                type="button"
                className="btn mt-2 w-full"
                onClick={() => {
                  onClose();
                  onNavigate?.('see');
                }}
              >
                Install a Telescope{freeSlot ? '' : ' · needs a slot first'}
              </button>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from({ length: telescope }, (_, slot) => {
                  const current = intel?.watching.find((w) => w.slot === slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      className="btn"
                      disabled={watch.isPending}
                      onClick={() => {
                        watch.mutate(
                          { targetPlanetId: target.id, slot },
                          {
                            onSuccess: () => {
                              say(`Watching ${target.name}`);
                            },
                            onError: (err) => {
                              say(describe(err), 'error');
                            },
                          },
                        );
                      }}
                    >
                      {current ? `Slot ${String(slot + 1)} · replace ${current.targetName}` : `Watch · slot ${String(slot + 1)}`}
                    </button>
                  );
                })}
              </div>
            )
          }
        />
      )}

      {report ? (
        <Fact
          known
          label="Stock and defence"
          value={
            <span className="num">
              {range(report.stock.low, report.stock.high)} held ·{' '}
              {range(report.defence.low, report.defence.high)} defence
            </span>
          }
          note={`${staleness((now - report.at.getTime()) / 60_000)} · ${percent(report.accuracy)} accuracy${
            report.detected ? ' · their radar caught the probe' : ''
          }`}
        />
      ) : (
        <Gap
          label="Stock and defence"
          missing="Nothing has ever looked closely"
          why="You are about to bet a fleet on what is down there. A probe turns that guess into a range."
          art={PROBE_ART}
          action={
            <button
              type="button"
              className="btn mt-2 w-full"
              disabled={!affordProbe || probe.isPending}
              onClick={() => {
                probe.mutate(target.id, {
                  onSuccess: (r) => {
                    say(`Probe away · reports back in ${duration(r.flightMinutes)}`);
                  },
                  onError: (err) => {
                    say(describe(err), 'error');
                  },
                });
              }}
            >
              {affordProbe
                ? `Send a probe · ${compact(PROBE.alloy)} alloy · ${duration(probeMinutes)}`
                : `Needs ${compact(PROBE.alloy)} alloy`}
            </button>
          }
          risk="Their radar may catch it, and then they know someone is interested."
        />
      )}

      {/* ── what you can do ───────────────────────────────── */}
      <h3 className="legend mt-7">What you can do about it</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-dim">
        {away
          ? 'Their fleet is out. Whatever is on that planet is being defended by whatever they left behind.'
          : report
            ? 'You have numbers. Bring enough combat hulls to beat the defence, and enough Haulers to carry the result.'
            : 'You would be attacking blind. That is allowed, and it is how most fleets are lost.'}
      </p>
      <button type="button" className="btn btn-commit mt-3 w-full" onClick={onAttack}>
        Plan an attack
      </button>

      {watchedSlot && (
        <p className="num mt-4 text-[11px] text-faint">
          Telescope slot {watchedSlot.slot + 1} is pointed here.
        </p>
      )}
    </Sheet>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="legend">{label}</p>
      <p className="num mt-0.5 text-[15px] text-bone">{value}</p>
    </div>
  );
}

/** Something you have. */
function Fact({
  label,
  value,
  note,
}: {
  known: true;
  label: string;
  value: ReactNode;
  note: string;
}) {
  return (
    <div className="mt-3 border-l-2 border-crystal/40 py-1 pl-3">
      <p className="legend">{label}</p>
      <div className="mt-1 text-[14px] text-bone">{value}</div>
      <p className="mt-1 text-[12px] leading-snug text-faint">{note}</p>
    </div>
  );
}

/**
 * Something you do not have — presented as a goal.
 *
 * Never greyed out and never merely absent: a gap is the most motivating object
 * in an information game, provided the player can see what would close it and
 * what that costs.
 */
function Gap({
  label,
  missing,
  why,
  art,
  action,
  risk,
}: {
  label: string;
  missing: string;
  why: string;
  art: string;
  action: ReactNode;
  risk?: string;
}) {
  return (
    <div className="mt-3 rounded border border-dashed border-line py-3 pl-3 pr-3">
      <div className="flex items-start gap-3">
        <div className="art-well flex size-11 shrink-0 items-center justify-center rounded">
          <img src={art} alt="" aria-hidden className="size-10 object-contain opacity-90" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="legend">{label}</p>
          <p className="mt-1 text-[14px] text-alloy">{missing}</p>
          <p className="mt-1 text-[12px] leading-snug text-dim">{why}</p>
        </div>
      </div>
      <div className="mt-2">{action}</div>
      {risk && <p className="mt-2 text-[11px] leading-snug text-faint">{risk}</p>}
    </div>
  );
}
