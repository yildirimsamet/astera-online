import { CLAN_PERK_LADDER } from '@astera/rules';
import { z } from 'zod';
import i18n from '../i18n/index.js';
import { clockTime } from './time.js';

/**
 * F2 E2 — A CLAN CHAT LINE NOBODY TYPED. The server posts what happened as a kind and its facts
 * (`clan_messages.event`); the words are the reader's, in the reader's language. A kind this
 * build does not know, or facts that do not parse, draw nothing rather than a broken line.
 */
export interface ClanChatEvent { kind: string; params: Record<string, unknown> }

const alarm = z.object({ hostName: z.string(), hostPlanetName: z.string(), arriveAt: z.coerce.date() });
const sent = z.object({
  senderName: z.string(), hostPlanetName: z.string(), ships: z.number().int().nonnegative(), answering: z.boolean(),
});
const defence = z.object({
  hostPlanetName: z.string(), grade: z.enum(['DECISIVE', 'PARTIAL', 'REPELLED']),
  supporters: z.number().int().nonnegative(), attackerLost: z.number().int().nonnegative(), heroName: z.string().nullable().optional(),
});
const levelUp = z.object({ level: z.number().int().min(1).max(CLAN_PERK_LADDER.length) });

export function describeClanEvent(event: ClanChatEvent): string | null {
  switch (event.kind) {
    case 'ALARM': {
      const parsed = alarm.safeParse(event.params);
      return parsed.success ? i18n.t('clanSupport.feedAlarm', {
        name: parsed.data.hostName, world: parsed.data.hostPlanetName, time: clockTime(parsed.data.arriveAt),
      }) : null;
    }
    case 'SUPPORT_SENT': {
      const parsed = sent.safeParse(event.params);
      if (!parsed.success) return null;
      const line = i18n.t('clanSupport.feedSent', { name: parsed.data.senderName, count: parsed.data.ships, world: parsed.data.hostPlanetName });
      return parsed.data.answering ? `${line} · ${i18n.t('clanSupport.feedAnswering')}` : line;
    }
    case 'DEFENCE': {
      const parsed = defence.safeParse(event.params);
      if (!parsed.success) return null;
      const { grade, hostPlanetName, supporters, attackerLost, heroName } = parsed.data;
      const parts = [
        i18n.t(`clanSupport.feedDefence.${grade}`, { world: hostPlanetName, count: supporters }),
        i18n.t('clanSupport.feedDestroyed', { count: attackerLost }),
        ...(grade === 'REPELLED' && heroName ? [i18n.t('clanSupport.feedHero', { name: heroName })] : []),
      ];
      return parts.join(' · ');
    }
    case 'LEVEL_UP': {
      const parsed = levelUp.safeParse(event.params);
      const rung = parsed.success ? CLAN_PERK_LADDER[parsed.data.level - 1] : undefined;
      if (!rung) return null;
      const values = { value: rung.value, pct: Math.round(rung.value * 100) };
      return i18n.t('clanSupport.feedLevelUp', { level: rung.level, perk: i18n.t(`clanWar.perk.${rung.perk}.title`, values) });
    }
    default:
      return null;
  }
}
