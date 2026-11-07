import { type HullId, type StepRequirement, fleetEntries } from '@astera/rules';
import i18n from '../i18n/index.js';
import { hullLabel } from '../i18n/names.js';
import { full } from '../lib/format.js';
import type { TabLock } from './gate.js';
import { moduleName, shipOnlyModule } from './moduleName.js';
import type { StepEffect } from './steps.js';

export { moduleName, shipOnlyModule };

export const tabLockLine = (lock: TabLock): string =>
  lock.kind === 'mainGalaxy' ? i18n.t('starter.tab.mainGalaxy') : i18n.t('starter.tab.repair', { module: moduleName(lock.module) });

/** A module the main game also has keeps the main game's name: what is learned here holds there. */

export function requirementLine(need: StepRequirement): string {
  switch (need.kind) {
    case 'MODULE': return need.stage > 1 ? `${moduleName(need.module)} ${String(need.stage)}` : moduleName(need.module);
    case 'FACT': return i18n.t(`starter.fact.${need.fact}`);
    case 'PARTS': return i18n.t('starter.partsNeeded', { count: need.count });
  }
}

export function effectLine(effect: StepEffect): string {
  switch (effect.kind) {
    case 'feature': return i18n.t(`starter.feature.${effect.feature}.gain`);
    case 'rate': return i18n.t(`starter.effect.rate.${effect.resource}`, { amount: full(effect.perHour) });
    case 'ships': return i18n.t('starter.effect.ships', {
      ships: fleetEntries(effect.fleet).map(([hull, count]: [HullId, number]) => `${String(count)} ${hullLabel(hull)}`).join(', '),
    });
    case 'deuterium': return i18n.t('starter.effect.deuterium', { amount: effect.amount });
    case 'room': return i18n.t('starter.effect.room', { room: effect.room });
    case 'storeCeiling': return i18n.t('starter.effect.storeCeiling', { from: full(effect.from), to: full(effect.to) });
    case 'reach': return i18n.t(`starter.effect.${effect.sensor}`, { distance: full(effect.distance) });
    case 'aegis': return i18n.t('starter.effect.aegis', { hp: effect.hp });
    case 'note': return i18n.t(`starter.effect.${effect.note}`);
  }
}

/** A Telescope can tell what is coming. Radar alone leaves the main game's words standing. */
export function incomingCopy(thread: { raider?: 'SCOUT' | 'PIRATE' | undefined }): { eyebrow: string; detail: string | null; prepare: boolean } | null {
  if (thread.raider === 'SCOUT') return { eyebrow: i18n.t('starter.contact.scout'), detail: i18n.t('starter.contact.scoutDetail'), prepare: false };
  if (thread.raider === 'PIRATE') return { eyebrow: i18n.t('starter.contact.raid'), detail: null, prepare: true };
  return null;
}
