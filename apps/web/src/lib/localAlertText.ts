import { BUILDING_IDS, RESEARCH_PROJECT_IDS, SATELLITE_IDS } from '@astera/rules';
import i18n from '../i18n/index.js';
import { buildingName, hullName, instrumentName, researchName, satelliteLabel } from '../i18n/names.js';
import type { LocalAlert } from './localAlerts.js';


/** A subject off the wire may be one this client does not know: then the line goes unnamed. */
function nameOf(alert: LocalAlert): string | null {
  const subject = alert.subject;
  if (subject === undefined) return null;
  if (alert.category === 'ships') return hullName(subject);
  if (alert.category === 'research') {
    const project = RESEARCH_PROJECT_IDS.find(id => id === subject);
    return project === undefined ? null : researchName(project);
  }
  const building = BUILDING_IDS.find(id => id === subject);
  if (building !== undefined) return buildingName(building);
  const satellite = SATELLITE_IDS.find(id => id === subject);
  return satellite === undefined ? instrumentName(subject) : satelliteLabel(satellite);
}

/** Worded at scheduling time, in the language the game is in then. */
export function localAlertText(alert: LocalAlert): { title: string; body: string } {
  const name = nameOf(alert);
  const world = alert.world ?? '';
  const title = i18n.t(`notificationCenter.local.title.${alert.category}`);
  if (alert.category === 'fleet') return { title, body: i18n.t('notificationCenter.local.body.fleet') };
  const body = name === null
    ? i18n.t('notificationCenter.local.body.unnamed', { world })
    : i18n.t(`notificationCenter.local.body.${alert.category}`, { name, world, count: alert.count ?? 1 });
  return { title, body };
}
