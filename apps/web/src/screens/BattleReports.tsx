import { useState } from 'react';
import { HULLS, fleetEntries } from '@astera/rules';
import { useReports } from '../api/queries.js';
import type { BattleReport } from '../api/schemas.js';
import { compact, full, signed } from '../lib/format.js';
import { staleness, useNow } from '../lib/time.js';
import { HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { Empty, Section } from '../ui/primitives.js';
import { Unreachable } from '../ui/kit/Surface.js';
import { Sheet } from '../ui/Sheet.js';

/**
 * THE CLOSING LINK OF THE LOOP.
 *
 * `game-design.md`: "the battle report is the most accurate intel in the game",
 * and step 9 feeds step 3 — every fight teaches you about someone you will fight
 * again. The server had been writing these since Phase 1 and showing nobody, so
 * combat resolved, a single line appeared in the return overlay, and nothing a
 * player learned survived into their next decision.
 *
 * The list is a verdict per row. The detail is the thing worth reading: what they
 * fielded, what it cost you, and what the fight moved on the ladder.
 */
export function BattleReports() {
  const { data, isPending, isError, refetch } = useReports();
  const [open, setOpen] = useState<BattleReport | null>(null);
  const now = useNow(30_000);
  const reports = data?.reports ?? [];

  return (
    <Section label="Battle reports" aside={reports.length > 0 ? 'newest first' : undefined}>
      {/*
        AN EMPTY LIST AND A FAILED ONE ARE NOT THE SAME SENTENCE.
        
        Both left `reports` empty, so a request that never arrived was reported as
        "nothing has been fought over yet" — the interface stating a fact about the
        season on the strength of a network error.
      */}
      {isError ? (
        <Unreachable
          what="your battle reports"
          onRetry={() => {
            void refetch();
          }}
        />
      ) : isPending ? null : reports.length === 0 ? (
        <Empty>
          Nothing has been fought over yet. A battle is the only intel in this game that is
          never a guess.
        </Empty>
      ) : (
        <div className="frame">
          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => {
                setOpen(report);
              }}
              className="flex w-full items-center gap-3 border-b border-line-soft p-3 text-left last:border-b-0"
            >
              <GradeMark report={report} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-bone">
                  {report.attacking ? 'You raided ' : 'Raided by '}
                  <span className="text-dim">{report.opponentPlanet}</span>
                </p>
                <p className="num mt-0.5 text-[11px] text-faint">
                  {staleness((now - report.at.getTime()) / 60_000)} · {report.rounds.length} rounds
                </p>
              </div>
              {report.dominion !== null && (
                <span
                  className={`num text-[13px] ${report.dominion >= 0 ? 'text-opportunity' : 'text-threat'}`}
                >
                  {signed(report.dominion)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && (
        <ReportSheet
          report={open}
          onClose={() => {
            setOpen(null);
          }}
        />
      )}
    </Section>
  );
}

/**
 * The grade, as a mark rather than a word.
 *
 * DECISIVE, PARTIAL and REPELLED are the three outcomes the whole combat model
 * produces, and which one you got is the first thing a player looks for.
 */
function GradeMark({ report }: { report: BattleReport }) {
  const won = report.attacking ? report.grade !== 'REPELLED' : report.grade === 'REPELLED';
  return (
    <span
      className={`chip shrink-0 ${won ? 'chip-opportunity' : 'chip-threat'}`}
      title={report.grade}
    >
      {report.grade}
    </span>
  );
}

function ReportSheet({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const looted = report.lootAlloy + report.lootCrystal;

  return (
    <Sheet
      eyebrow={report.attacking ? `You raided ${report.opponentName}` : `${report.opponentName} raided you`}
      title={report.grade}
      onClose={onClose}
    >
      <p className="text-[13px] leading-relaxed text-dim">
        {report.attacking
          ? report.grade === 'REPELLED'
            ? `${report.opponentPlanet} held. You now know what it takes to break it.`
            : `${report.opponentPlanet} did not hold.`
          : report.grade === 'REPELLED'
            ? 'You held. They now know how much you had waiting.'
            : 'You did not hold.'}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Figure label="Rounds" value={String(report.rounds.length)} />
        <Figure
          label={looted >= 0 ? 'Taken' : 'Lost'}
          value={compact(Math.abs(looted))}
          tone={looted >= 0 ? 'text-alloy' : 'text-threat'}
        />
        {report.dominion !== null && (
          <Figure
            label="Dominion"
            value={signed(report.dominion)}
            tone={report.dominion >= 0 ? 'text-opportunity' : 'text-threat'}
          />
        )}
      </div>

      {looted !== 0 && (
        <p className="num mt-3 flex items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1 text-alloy">
            <img src={RESOURCE_ART.alloy} alt="alloy" className="size-4 object-contain" />
            {signed(report.lootAlloy)}
          </span>
          <span className="flex items-center gap-1 text-crystal">
            <img src={RESOURCE_ART.crystal} alt="crystal" className="size-4 object-contain" />
            {signed(report.lootCrystal)}
          </span>
        </p>
      )}

      {/*
        THE PART THAT FEEDS THE NEXT DECISION.

        What they fielded is the most accurate reading anyone in this game ever
        gets — no bands, no staleness, no clarity gradient. It is what makes the
        fight you just had worth something the next time you look at that planet.
      */}
      <h3 className="legend mt-7">What they had</h3>
      <Losses fleet={report.theirLosses} tone="text-bone" empty="Nothing of theirs was destroyed." />

      <h3 className="legend mt-6">What it cost you</h3>
      <Losses fleet={report.yourLosses} tone="text-[#ff9d8f]" empty="You lost nothing." />

      <h3 className="legend mt-7">How it went</h3>
      <div className="frame mt-2">
        {report.rounds.map((round) => (
          <div
            key={round.round}
            className="flex items-center gap-3 border-b border-line-soft px-3 py-2 last:border-b-0"
          >
            <span className="num w-6 text-[11px] text-faint">{round.round}</span>
            <span className="num flex-1 text-[12px] text-dim">
              you dealt{' '}
              <span className="text-bone">
                {compact(report.attacking ? round.attackerDamage : round.defenderDamage)}
              </span>
              , took{' '}
              <span className="text-bone">
                {compact(report.attacking ? round.defenderDamage : round.attackerDamage)}
              </span>
            </span>
            {round.shieldAbsorbed > 0 && (
              <span className="num text-[11px] text-crystal">
                shield {compact(round.shieldAbsorbed)}
              </span>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function Losses({ fleet, tone, empty }: { fleet: BattleReport['yourLosses']; tone: string; empty: string }) {
  const entries = fleetEntries(fleet);
  if (entries.length === 0) {
    return <p className="mt-2 text-[13px] text-faint">{empty}</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {entries.map(([hull, count]) => (
        <div key={hull} className="frame flex items-center gap-2.5 px-3 py-2">
          {HULL_ART[hull] ? (
            <img src={HULL_ART[hull]} alt="" aria-hidden className="size-8 object-contain" />
          ) : (
            <span className="legend">GRD</span>
          )}
          <div>
            <p className={`num text-[16px] leading-none ${tone}`}>{full(count)}</p>
            <p className="legend mt-1">{HULLS[hull].name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Figure({ label, value, tone = 'text-bone' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="legend">{label}</p>
      <p className={`readout mt-1 text-[17px] ${tone}`}>{value}</p>
    </div>
  );
}
