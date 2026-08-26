import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { fleetEntries, type Grade } from '@astera/rules';
import { useReports } from '../api/queries.js';
import type { BattleReport } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullLabel } from '../i18n/names.js';
import { compact, full, signed } from '../lib/format.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { EmptyState, Section, Unreachable } from '../ui/kit/index.js';
import { Sheet } from '../ui/kit/index.js';

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

/**
 * Who the other side was.
 *
 * A neutral world has no commander, so the server sends no name and the report
 * used to read "You raided someone" at "an unknown world" — about a world whose
 * name is printed on the disc. The world itself is named in the line below this
 * one; what belongs here is WHAT it was.
 */
const opponentOf = (report: BattleReport): string =>
  report.neutral ? i18n.t('reports.neutralHolder') : report.opponentName;

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
        <EmptyState title={t('reports.empty')} />
      ) : (
        <div className="plate plate-inset">
          {reports.map((report) => {
            const opponentClan = report.attacking ? report.defenderClan : report.attackerClan;
            return (
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
                <p className="truncate text-body text-bone">
                  {t(report.attacking ? 'reports.youRaided' : 'reports.raidedBy')}
                  {opponentClan ? (
                    <span className="mr-1 text-crystal" title={opponentClan.name}>[{opponentClan.tag}]</span>
                  ) : null}
                  <span className="text-dim">{opponentOf(report)}</span>
                </p>
                <p className="num mt-1 text-label text-faint">
                  {report.opponentPlanet} · {staleness((now - report.at.getTime()) / 60_000)} ·{' '}
                  {t('reports.rounds', { count: report.rounds.length })}
                </p>
              </div>
              {/*
                A SWING OF ZERO IS NOT A FIGURE. Every raid on a caretaker world
                moves nobody's score, and so does a raid repelled without losses —
                so the chip printed "0" on exactly the rows where the ladder had
                nothing to say. Shown when it moved; omitted when it did not.
              */}
              {report.dominion !== null && Math.round(report.dominion) !== 0 && (
                <span
                  className={`num text-body ${report.dominion >= 0 ? 'text-opportunity' : 'text-threat'}`}
                >
                  {signed(report.dominion)}
                </span>
              )}
              </button>
            );
          })}
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
  const looted = report.lootAlloy + report.lootCrystal + report.lootDeuterium;
  const yourClan = report.attacking ? report.attackerClan : report.defenderClan;
  const theirClan = report.attacking ? report.defenderClan : report.attackerClan;

  return (
    <Sheet
      eyebrow={t(report.attacking ? 'reports.sheetYouRaided' : 'reports.sheetTheyRaided', {
        opponent: opponentOf(report),
      })}
      title={gradeWord(report.grade)}
      onClose={onClose}
    >
      <BattleVerdict report={report} />

      {yourClan || theirClan ? (
        <div className="plate plate-inset mb-4 px-3 py-3">
          <p className="legend text-crystal">{t('reports.clansAtLaunch')}</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <ClanAtLaunch label={t('reports.yourClan')} clan={yourClan} />
            <ClanAtLaunch label={t('reports.theirClan')} clan={theirClan} />
          </div>
        </div>
      ) : null}

      {/*
        WHERE IT HAPPENED, IN ONE LINE, BEFORE ANYTHING ELSE.

        A commander may hold four worlds since D97, and "Raided by Sable" stopped
        saying WHICH of theirs was hit — the most actionable fact there is, absent
        from the record of it. Said as a route rather than as two facts, because a
        battle has two ends and the reader is always at one of them.
      */}
      {report.yourPlanet && (
        <p className="num mb-3 flex items-center gap-2 text-label text-faint">
          <span className="text-bone">{report.yourPlanet}</span>
          <span aria-hidden>{report.attacking ? '→' : '←'}</span>
          <span>{report.opponentPlanet}</span>
        </p>
      )}

      <p className="text-body leading-relaxed text-dim">
        {report.attacking
          ? t(report.grade === 'REPELLED' ? 'reports.heldAgainstYou' : 'reports.brokenByYou', {
              planet: report.opponentPlanet,
            })
          : t(report.grade === 'REPELLED' ? 'reports.youHeld' : 'reports.youFell')}
      </p>

      {/*
        WHY THIS WORD, AND NOT THE OTHER TWO.

        DECISIVE, PARTIAL and REPELLED are printed in caps at the top of every
        report and nothing in the game had ever said what separates them. A player
        who reads "PARTIAL" twice and cannot tell whether they were close has been
        given a stamp, not a report — and the grade is what sets the loot share and
        how long the works stay down, so it is the single most consequential word
        on the surface.
      */}
      <p className="mt-2 text-caption leading-relaxed text-faint">
        {t(
          `reports.why.${report.attacking ? 'attacking' : 'defending'}.${report.grade}` as
            'reports.why.attacking.DECISIVE',
        )}
      </p>

      {/*
        THE THREE NUMBERS A PLAYER ACTUALLY FEELS: what came away, what it cost,
        and what it moved on the ladder.

        `Rounds` used to lead this row, and it is the least consequential figure on
        the surface — a fixed three at most, decided by the combat model rather than
        by anything the player chose. It is still in the list row and it is the whole
        of "How it went" below. What belongs beside the haul is its PRICE, which was
        buried two sections down in a table.
      */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Figure
          label={t('reports.shipsLost')}
          value={full(fleetEntries(report.yourLosses).reduce((sum, [, n]) => sum + n, 0))}
          tone={
            fleetEntries(report.yourLosses).length > 0 ? 'text-threat-ink' : 'text-dim'
          }
        />
        <Figure
          label={t(looted >= 0 ? 'reports.taken' : 'reports.lost')}
          value={compact(Math.abs(looted))}
          tone={looted >= 0 ? 'text-alloy' : 'text-threat'}
        />
        {report.dominion !== null && Math.round(report.dominion) !== 0 && (
          <Figure
            label={t('reports.dominion')}
            value={signed(report.dominion)}
            tone={report.dominion >= 0 ? 'text-opportunity' : 'text-threat'}
          />
        )}
      </div>

      {looted !== 0 && (
        <p className="legend mt-4">{t(looted >= 0 ? 'reports.haul' : 'reports.haulLost')}</p>
      )}
      {looted !== 0 && (
        <p className="num mt-1 flex items-center gap-3 text-caption">
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
          {report.lootDeuterium !== 0 && (
            <span className="flex items-center gap-1 text-opportunity">
              <img
                src={RESOURCE_ART.deuterium}
                alt={t('vocabulary.resource.deuterium')}
                className="size-4 object-contain"
              />
              {signed(report.lootDeuterium)}
            </span>
          )}
        </p>
      )}

      <Consequences report={report} />

      {/*
        THE PART THAT FEEDS THE NEXT DECISION.

        What they fielded is the most accurate reading anyone in this game ever
        gets — no bands, no staleness, no clarity gradient. It is what makes the
        fight you just had worth something the next time you look at that planet.
      */}
      <h3 className="legend mt-8">{t('reports.theirLosses')}</h3>
      <Losses fleet={report.theirLosses} tone="text-bone" empty={t('reports.theirsEmpty')} />

      {/*
        AND THE PART THAT GIVES YOUR OWN LOSSES A DENOMINATOR.

        "You lost 12 Wasp" is a disaster out of fifteen and a rounding error out
        of eighty, and until D121 the report could not tell those two apart. The
        roster is the caller's own board, so it discloses nothing: this is the one
        force in the fight the reader already commanded.
      */}
      <h3 className="legend mt-6">
        {t(fleetEntries(report.yourFleet).length > 0 ? 'reports.yourForce' : 'reports.yours')}
      </h3>
      {fleetEntries(report.yourFleet).length > 0 ? (
        <YourForce report={report} />
      ) : (
        <Losses fleet={report.yourLosses} tone="text-threat-ink" empty={t('reports.yoursEmpty')} />
      )}

      <h3 className="legend mt-8">{t('reports.howItWent')}</h3>
      <div className="plate plate-inset mt-2">
        {report.rounds.map((round) => (
          <div key={round.round} className="border-b border-line-soft px-3 py-3 last:border-b-0">
            <div className="grid grid-cols-[24px_1fr_auto] items-center gap-3">
              <span className="num w-6 text-label text-faint">{round.round}</span>
              <RoundBalance
                dealt={report.attacking ? round.attackerDamage : round.defenderDamage}
                took={report.attacking ? round.defenderDamage : round.attackerDamage}
              />
              <span className="sr-only">
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
                <span className="flex flex-col items-end gap-1">
                  <span className="num text-label text-crystal">
                    {t('reports.shield', { amount: compact(round.shieldAbsorbed) })}
                  </span>
                  {round.breacherShieldDamage > 0 && (
                    <span className="num text-micro text-deuterium">
                      {t('reports.breacherShield', {
                        amount: compact(round.breacherShieldDamage),
                      })}
                    </span>
                  )}
                </span>
              )}
            </div>
            {/*
              WHO ACTUALLY DIED, AND IN WHICH ROUND.

              The payload has carried this since combat existed and the surface
              drew two damage bars over it. Damage is an abstraction; a hull
              coming off the board is the event — and WHEN it happened is the
              whole story of a fight that turned in round two.
            */}
            <RoundCasualties
              yours={report.attacking ? round.attackerLosses : round.defenderLosses}
              theirs={report.attacking ? round.defenderLosses : round.attackerLosses}
            />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/**
 * The consequences a battle had beyond the loot line, each stated only when true.
 *
 * Every one of these was already decided by the server and thrown away on the way
 * to the screen, which is what "the reports are not explanatory enough" turned out
 * to mean: a raider could not learn that their holds — not the defence — capped
 * the haul, and a defender could not learn that most of the guns they "lost" were
 * standing again by the time they read about it.
 */
function Consequences({ report }: { report: BattleReport }) {
  const { t } = useTranslation();
  const salvaged = fleetEntries(report.defenceSalvage).reduce((sum, [, n]) => sum + n, 0);
  const lines: { key: string; tone: string; text: string }[] = [];

  if (report.shieldAbsorbed >= 1) {
    lines.push({
      key: 'shield',
      tone: 'text-crystal',
      text: t(report.attacking ? 'reports.effects.shieldTheirs' : 'reports.effects.shieldYours', {
        amount: compact(report.shieldAbsorbed),
      }),
    });
  }
  if (report.cargoLimited) {
    lines.push({
      key: 'cargo',
      tone: 'text-alloy',
      text: t('reports.effects.cargoLimited'),
    });
  }
  if (salvaged > 0) {
    lines.push({
      key: 'salvage',
      tone: 'text-opportunity',
      text: t('reports.effects.salvaged', { count: salvaged }),
    });
  }
  if (report.disruptedMinutes >= 1) {
    lines.push({
      key: 'works',
      tone: report.attacking ? 'text-opportunity' : 'text-threat-ink',
      text: t(report.attacking ? 'reports.effects.worksTheirs' : 'reports.effects.worksYours', {
        duration: duration(report.disruptedMinutes),
      }),
    });
  }
  if (report.wreckValue >= 1) {
    /*
      THE WRECKAGE IS ALWAYS OVER THE WORLD THAT WAS ATTACKED, which is the
      OPPONENT's world only when the reader is the attacker. Said with
      `opponentPlanet` on both sides, a defender was told their own dead ships
      were drifting over the raider's homeworld — and sent to the wrong end of the
      disc to collect them.
    */
    lines.push({
      key: 'wreck',
      tone: 'text-alloy',
      text: report.attacking
        ? t('reports.effects.wreck', {
            amount: compact(report.wreckValue),
            planet: report.opponentPlanet,
          })
        : t('reports.effects.wreckYours', { amount: compact(report.wreckValue) }),
    });
  }

  if (lines.length === 0) return null;

  return (
    <div className="plate plate-inset mt-6 px-3 py-3">
      <p className="legend">{t('reports.effects.heading')}</p>
      <ul className="mt-2 grid gap-2">
        {lines.map((line) => (
          <li key={line.key} className={`text-caption leading-snug ${line.tone}`}>
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The caller's own board: what went in, what died, what was standing at the end.
 *
 * `left` adds the ground units that rebuilt themselves, because a defender who is
 * told they lost seven Bastions and finds four still there is being told two
 * different things by the same game.
 */
function YourForce({ report }: { report: BattleReport }) {
  const { t } = useTranslation();
  const entries = fleetEntries(report.yourFleet);
  const brought = entries.reduce((sum, [, n]) => sum + n, 0);
  const lost = fleetEntries(report.yourLosses).reduce((sum, [, n]) => sum + n, 0);
  const rebuilt = fleetEntries(report.defenceSalvage).reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="plate plate-inset mt-2">
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-line-soft px-3 py-2">
        <span className="legend">{t('reports.force.hull')}</span>
        <span className="legend w-12 text-right">
          {t(report.attacking ? 'reports.force.sent' : 'reports.force.held')}
        </span>
        <span className="legend w-12 text-right">{t('reports.force.lost')}</span>
        <span className="legend w-12 text-right">{t('reports.force.left')}</span>
      </div>
      {entries.map(([hull, count]) => {
        const died = report.yourLosses[hull] ?? 0;
        const back = report.defenceSalvage[hull] ?? 0;
        return (
          <div
            key={hull}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-line-soft px-3 py-2 last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-2">
              {HULL_ART[hull] ? (
                <img src={HULL_ART[hull]} alt="" aria-hidden className="size-6 object-contain" />
              ) : (
                <span aria-hidden className="legend w-6 text-center">GRD</span>
              )}
              <span className="truncate text-caption text-bone">{hullLabel(hull)}</span>
            </span>
            <span className="num w-12 text-right text-caption text-dim">{full(count)}</span>
            <span
              className={`num w-12 text-right text-caption ${died > 0 ? 'text-threat-ink' : 'text-faint'}`}
            >
              {died > 0 ? `−${full(died)}` : '—'}
            </span>
            <span className="num w-12 text-right text-caption text-bone">
              {full(Math.max(0, count - died + back))}
              {back > 0 && <span className="text-opportunity"> +{full(back)}</span>}
            </span>
          </div>
        );
      })}
      <p className="num px-3 py-2 text-label text-faint">
        {t('reports.force.summary', {
          brought: full(brought),
          lost: full(lost),
          left: full(Math.max(0, brought - lost + rebuilt)),
        })}
      </p>
    </div>
  );
}

/**
 * Hulls that came off the board this round, each side on its own labelled line.
 *
 * THE LABEL IS NOT DECORATION. Both sides fly Wasps, so a round in which each lost
 * some rendered as "−11 Wasp −3 Wasp" — two identical phrases separated by nothing
 * but a colour, which on a phone in daylight reads as a typo rather than as two
 * facts. Whose casualty it is has to be a WORD.
 */
function RoundCasualties({
  yours,
  theirs,
}: {
  yours: BattleReport['yourLosses'];
  theirs: BattleReport['yourLosses'];
}) {
  const { t } = useTranslation();
  const mine = fleetEntries(yours);
  const others = fleetEntries(theirs);
  if (mine.length === 0 && others.length === 0) {
    return <p className="mt-2 pl-9 text-label text-faint">{t('reports.roundNoLosses')}</p>;
  }

  const line = (label: string, entries: ReturnType<typeof fleetEntries>, tone: string) => (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="legend w-10 shrink-0">{label}</span>
      {entries.map(([hull, count]) => (
        <span key={hull} className={`num text-label ${tone}`}>
          −{full(count)} {hullLabel(hull)}
        </span>
      ))}
    </span>
  );

  return (
    <div className="mt-2 grid gap-1 pl-9">
      {others.length > 0 && line(t('reports.roundTheirs'), others, 'text-bone')}
      {mine.length > 0 && line(t('reports.roundYours'), mine, 'text-threat-ink')}
    </div>
  );
}

function ClanAtLaunch({
  label,
  clan,
}: {
  label: string;
  clan: BattleReport['attackerClan'];
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <p className="legend">{label}</p>
      {clan ? (
        <p className="mt-1 truncate text-caption text-bone" title={clan.name}>
          <span className="text-crystal">[{clan.tag}]</span> {clan.name}
        </p>
      ) : (
        <p className="mt-1 text-caption text-faint">{t('reports.noClan')}</p>
      )}
    </div>
  );
}

function BattleVerdict({ report }: { report: BattleReport }) {
  const won = report.attacking ? report.grade !== 'REPELLED' : report.grade === 'REPELLED';
  const yours = fleetEntries(report.yourLosses).reduce((sum, [, count]) => sum + count, 0);
  const theirs = fleetEntries(report.theirLosses).reduce((sum, [, count]) => sum + count, 0);
  const bars = report.grade === 'DECISIVE' ? 3 : report.grade === 'PARTIAL' ? 2 : 1;

  return (
    <div
      data-battle-verdict={report.grade}
      className={`plate mb-4 grid grid-cols-[1fr_92px_1fr] items-center gap-3 p-3 ${
        won ? 'plate-opportunity' : 'plate-threat'
      }`}
      role="img"
      aria-label={gradeWord(report.grade)}
    >
      <LossStack fleet={report.yourLosses} count={yours} align="left" />
      <div className="grid justify-items-center gap-2">
        <div className={`relative grid size-[72px] place-items-center rounded-full border ${
          won
            ? 'border-opportunity/55 bg-opportunity/10 text-opportunity'
            : 'border-threat/55 bg-threat/10 text-threat'
        }`}>
          <span className="absolute inset-2 rounded-full border border-current/20" />
          <span className="flex items-end gap-1" aria-hidden>
            {[1, 2, 3].map((bar) => (
              <i
                key={bar}
                className={`w-2 skew-x-[-12deg] border border-current ${bar <= bars ? 'bg-current/65' : 'bg-transparent opacity-25'}`}
                style={{ height: `${String(10 + bar * 7)}px` }}
              />
            ))}
          </span>
        </div>
        <span className="legend text-bone">
          {gradeWord(report.grade)}
        </span>
      </div>
      <LossStack fleet={report.theirLosses} count={theirs} align="right" />
    </div>
  );
}

function LossStack({
  fleet,
  count,
  align,
}: {
  fleet: BattleReport['yourLosses'];
  count: number;
  align: 'left' | 'right';
}) {
  const art = fleetEntries(fleet).flatMap(([hull, amount]) => {
    const source = HULL_ART[hull];
    return source ? Array.from({ length: Math.min(3, amount) }, () => source) : [];
  }).slice(0, 3);
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`} aria-hidden>
      <div className={`flex ${align === 'right' ? 'justify-end' : ''}`}>
        {art.length === 0 ? (
          <span className="block size-8 rounded-full border border-line-soft" />
        ) : art.map((src, index) => (
          <img
            key={`${src}-${String(index)}`}
            src={src}
            alt=""
            className={`size-10 object-contain opacity-75 grayscale ${index > 0 ? '-ml-4' : ''}`}
          />
        ))}
      </div>
      <p className={`num mt-1 text-title ${count > 0 ? 'text-threat' : 'text-dim'}`}>−{full(count)}</p>
    </div>
  );
}

function RoundBalance({ dealt, took }: { dealt: number; took: number }) {
  const top = Math.max(1, dealt, took);
  return (
    <span className="grid gap-2" aria-hidden>
      <span className="flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-cell bg-line-soft">
          <span className="block h-full bg-opportunity" style={{ width: `${String((dealt / top) * 100)}%` }} />
        </span>
        <span className="num w-10 text-right text-label text-bone">{compact(dealt)}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-cell bg-line-soft">
          <span className="block h-full bg-threat" style={{ width: `${String((took / top) * 100)}%` }} />
        </span>
        <span className="num w-10 text-right text-label text-bone">{compact(took)}</span>
      </span>
    </span>
  );
}

function Losses({ fleet, tone, empty }: { fleet: BattleReport['yourLosses']; tone: string; empty: string }) {
  const entries = fleetEntries(fleet);
  if (entries.length === 0) {
    return <p className="mt-2 text-body text-faint">{empty}</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {entries.map(([hull, count]) => (
        <div key={hull} className="plate plate-inset flex items-center gap-3 px-3 py-2">
          {HULL_ART[hull] ? (
            <img src={HULL_ART[hull]} alt="" aria-hidden className="size-8 object-contain" />
          ) : (
            <span className="legend">GRD</span>
          )}
          <div>
            <p className={`num text-title leading-none ${tone}`}>{full(count)}</p>
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
      <p className={`readout mt-1 text-title ${tone}`}>{value}</p>
    </div>
  );
}
