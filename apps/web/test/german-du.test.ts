import { describe, expect, it } from 'vitest';
import { de } from '../src/i18n/locales/de/index.js';

/**
 * GERMAN SPEAKS TO THE PLAYER AS "DU" (corner unit after C10, 2026-11-14).
 *
 * The German copy addressed the player both ways: about 400 strings said "du", about 380
 * said "Sie" — sometimes inside one screen, and once so badly that "Your side" and "Their
 * side" of a battle report were the same words ("Ihre Seite"). `docs/ux-writing.md` sets
 * "sen" for Turkish and a natural "you" for English and is silent on German, so the
 * majority wins: "du", lower case, as German games and apps write it.
 *
 * A capital "Sie"/"Ihr…" in the middle of a sentence can only be the formal "you". At a
 * sentence's start it can also be "they", "their", "she" or "it" — those strings are
 * named below, each read against its English source.
 */
const THIRD_PERSON = new Set<string>([
  'academy.steps.thorn',
  'clan.aid.noRecipientHint',
  'clan.members.removeConfirmBody',
  'clan.members.transferConfirmBody',
  'clanSupport.bayHint',
  'clanSupport.noteSupport_one',
  'clanSupport.noteSupport_other',
  'clanSupport.supportNote',
  'clanWar.purposeHint',
  'counter.axisTheirs',
  'counter.escapeRule',
  'counter.escapeStand',
  'counter.escapeUnsure',
  'counter.ratioThem',
  'directives.scannedDetail',
  'directives.windowDetailEta',
  'dossier.doctrinesNoneNote',
  'dossier.doctrinesNote',
  'dossier.fleetAwayNote',
  'dossier.fleetLabel',
  'dossier.fleetVeiledNote',
  'dossier.shapeUnreadNote',
  'dossier.stockCaught',
  'dossier.unarmedNote',
  'errors.PROSPECTORS_RESTING',
  'focus.planet.haulerExplain',
  'focus.planet.rivalAhead',
  'focus.planet.rivalBehind',
  'focus.planet.rivalTheirRaids',
  'focus.planet.settlementAwayExplain',
  'focus.planet.windowOpen',
  'intel.known.legend',
  'intel.probes.cost',
  'intel.watching.away',
  'moderation.admin.media',
  'monument.reinforceRule',
  'notificationCenter.empty',
  'notificationCenter.local.blocked',
  'notificationCenter.ruleShort',
  'planet.abandon.ships',
  'planet.orbit.intelNote',
  'planet.reach.supportNote',
  'reports.calculation.theirShot',
  'reports.distributedRetreatRule',
  'reports.effects.fled',
  'reports.effects.salvageTheirs',
  'reports.effects.shieldTheirs',
  'reports.effects.worksTheirs',
  'reports.groundNote',
  'reports.roundTheirs',
  'reports.theirClan',
  'reports.why.defending.REPELLED',
  'simulator.pirateNoResearch',
  'starter.arrival.growLine',
  'starter.feature.attack.line',
  'starter.feature.research.line',
  'starter.jump.partsLater',
  'starter.jump.partsSeen',
  'starter.lab.premise',
  'starter.objective.underwayProbe',
  'starter.outlook.seasonClosed',
  'starter.plan.optional',
  'starter.tutorial.line.collectMine',
  'trade.fleetsave',
  'unknownSignal.resourceResult',
  'vocabulary.building.SHIPYARD.detail',
  'vocabulary.hull.BASTION.detail',
  'vocabulary.hull.HARPOON.detail',
  'vocabulary.hull.THORN.detail',
]);

const FORMAL = /\b(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/gu;

/** A sentence, a clause after a colon or a separator, or a quote starts right here. */
const startsHere = (text: string, index: number): boolean =>
  /(?:^|[.!?:;·–—]\s+|[„"«(\n]\s*)$/u.test(text.slice(0, index));

function strings(tree: unknown, prefix = '', into = new Map<string, string>()): Map<string, string> {
  if (typeof tree === 'string') into.set(prefix, tree);
  else if (tree && typeof tree === 'object') {
    for (const [key, value] of Object.entries(tree)) strings(value, prefix ? `${prefix}.${key}` : key, into);
  }
  return into;
}

const all = strings(de);

describe('German speaks to the player as du', () => {
  it('never uses the formal Sie to address the player', () => {
    const formal: string[] = [];
    for (const [key, text] of all) {
      for (const match of text.matchAll(FORMAL)) {
        const ambiguous = match[1] !== 'Ihnen' && startsHere(text, match.index);
        if (!ambiguous || !THIRD_PERSON.has(key)) {
          formal.push(`${key}: ${text}`);
          break;
        }
      }
    }
    expect(formal).toEqual([]);
  });

  it('keeps every named third-person string honest: it still opens on sie or ihr', () => {
    for (const key of THIRD_PERSON) {
      const text = all.get(key);
      expect(text, `${key} is not a German string`).toBeDefined();
      expect(text, key).toMatch(FORMAL);
    }
  });

  it('tells your side of a battle from theirs', () => {
    expect(all.get('reports.yourClan')).not.toBe(all.get('reports.theirClan'));
  });
});
