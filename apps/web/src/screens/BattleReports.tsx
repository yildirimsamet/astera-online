import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { fleetEntries, type Grade } from '@astera/rules';
import { useReports } from '../api/queries.js';
import type { BattleReport } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullLabel } from '../i18n/names.js';
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
/**
 * DECISIVE, PARTIAL, REPELLED — the three outcomes, as keys.
 *
 * The grade is a stamp: it is printed in caps and it is the first thing a player
 * looks for, so it has to be a WORD in their language rather than the enum the
 * combat model happens to use.
 */
const GRADE = {
  DECISIVE: 'reports.gradeDecisive',
  PARTIAL: 'reports.gradePartial',
  REPELLED: 'reports.gradeRepelled',
} as const satisfies Record<Grade, string>;

const gradeWord = (grade: Grade): string => i18n.t(GRADE[grade]);

export function BattleReports() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useReports();
  const [open, setOpen] = useState<BattleReport | null>(null);
  const now = useNow(30_000);
  const reports = data?.reports ?? [];

  return (
    <Section
      label={t('reports.heading')}
      aside={reports.length > 0 ? t('reports.newest') : undefined}
    >
      {/*
        AN EMPTY LIST AND A FAILED ONE ARE NOT THE SAME SENTENCE.
        
        Both left `reports` empty, so a request that never arrived was reported as
        "nothing has been fought over yet" — the interface stating a fact about the
        season on the strength of a network error.
      */}
      {isError ? (
        <Unreachable
          what={t('surface.whatReports')}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : isPending ? null : reports.length === 0 ? (
        <Empty>{t('reports.empty')}</Empty>
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
                  {t(report.attacking ? 'reports.youRaided' : 'reports.raidedBy')}
                  <span className="text-dim">{report.opponentPlanet}</span>
                </p>
                <p className="num mt-0.5 text-[11px] text-faint">
                  {staleness((now - report.at.getTime()) / 60_000)} ·{' '}
                  {t('reports.rounds', { count: report.rounds.length })}
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
      title={gradeWord(report.grade)}
    >
      {gradeWord(report.grade)}
    </span>
  );
}

function ReportSheet({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const { t } = useTranslation();
  const looted = report.lootAlloy + report.lootCrystal;

  return (
    <Sheet
      eyebrow={t(report.attacking ? 'reports.sheetYouRaided' : 'reports.sheetTheyRaided', {
        opponent: report.opponentName,
      })}
      title={gradeWord(report.grade)}
      onClose={onClose}
    >
      <p className="text-[13px] leading-relaxed text-dim">
        {report.attacking
          ? t(report.grade === 'REPELLED' ? 'reports.heldAgainstYou' : 'reports.brokenByYou', {
              planet: report.opponentPlanet,
            })
          : t(report.grade === 'REPELLED' ? 'reports.youHeld' : 'reports.youFell')}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Figure label={t('reports.roundsLabel')} value={String(report.rounds.length)} />
        <Figure
          label={t(looted >= 0 ? 'reports.taken' : 'reports.lost')}
          value={compact(Math.abs(looted))}
          tone={looted >= 0 ? 'text-alloy' : 'text-threat'}
        />
        {report.dominion !== null && (
          <Figure
            label={t('reports.dominion')}
            value={signed(report.dominion)}
            tone={report.dominion >= 0 ? 'text-opportunity' : 'text-threat'}
          />
        )}
      </div>

      {looted !== 0 && (
        <p className="num mt-3 flex items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1 text-alloy">
            <img
              src={RESOURCE_ART.alloy}
              alt={t('vocabulary.resource.alloy')}
              className="size-4 object-contain"
            />
            {signed(report.lootAlloy)}
          </span>
          <span className="flex items-center gap-1 text-crystal">
            <img
              src={RESOURCE_ART.crystal}
              alt={t('vocabulary.resource.crystal')}
              className="size-4 object-contain"
            />
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
      <h3 className="legend mt-7">{t('reports.theirs')}</h3>
      <Losses fleet={report.theirLosses} tone="text-bone" empty={t('reports.theirsEmpty')} />

      <h3 className="legend mt-6">{t('reports.yours')}</h3>
      <Losses fleet={report.yourLosses} tone="text-[#ff9d8f]" empty={t('reports.yoursEmpty')} />

      <h3 className="legend mt-7">{t('reports.howItWent')}</h3>
      <div className="frame mt-2">
        {report.rounds.map((round) => (
          <div
            key={round.round}
            className="flex items-center gap-3 border-b border-line-soft px-3 py-2 last:border-b-0"
          >
            <span className="num w-6 text-[11px] text-faint">{round.round}</span>
            <span className="num flex-1 text-[12px] text-dim">
              {/* One sentence with two figures in it. Turkish puts both verbs at
                  the end, so the clauses cannot be spliced in JSX. */}
              <Trans
                i18nKey="reports.roundLine"
                values={{
                  dealt: compact(report.attacking ? round.attackerDamage : round.defenderDamage),
                  took: compact(report.attacking ? round.defenderDamage : round.attackerDamage),
                }}
                components={[
                  <span key="d" className="text-bone" />,
                  <span key="t" className="text-bone" />,
                ]}
              />
            </span>
            {round.shieldAbsorbed > 0 && (
              <span className="num text-[11px] text-crystal">
                {t('reports.shield', { amount: compact(round.shieldAbsorbed) })}
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
            <p className="legend mt-1">{hullLabel(hull)}</p>
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
