import type { VesselModule } from '@astera/rules';
import i18n from '../i18n/index.js';
import { buildingName, instrumentLabel } from '../i18n/names.js';

const SHIP_ONLY = ['SURVEY', 'DRIVE_HULL', 'DRIVE_THRUST'] as const;
type ShipOnlyModule = (typeof SHIP_ONLY)[number];

/** On the queue's wire a subject is any string. These three have no building behind them. */
export const shipOnlyModule = (subject: string): ShipOnlyModule | undefined => SHIP_ONLY.find(module => module === subject);

export function moduleName(module: VesselModule): string {
  switch (module) {
    case 'REFINERY': case 'EXTRACTOR': case 'DEUTERIUM_PLANT': case 'VAULT': case 'SHIPYARD': case 'HANGAR':
      return buildingName(module);
    case 'TELESCOPE': case 'RADAR': case 'AEGIS':
      return instrumentLabel(module);
    case 'SURVEY': case 'DRIVE_HULL': case 'DRIVE_THRUST':
      return i18n.t(`starter.module.${module}`);
  }
}
