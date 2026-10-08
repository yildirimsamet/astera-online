import type { ResearchProjectId } from '@astera/rules';
import { research as en } from '../i18n/locales/en/research.js';
import { research as tr } from '../i18n/locales/tr/research.js';
import { localized as l, type Localized } from './model.js';

interface ProjectCopy { name: string; role: string; detail: string }
export const projectCopy: Readonly<Record<ResearchProjectId, Localized<ProjectCopy>>> = {
  ISOTOPE_SPECTROMETRY: l({ name: en.isotopeName, role: en.isotopeRole, detail: en.isotopeDetail }, { name: tr.isotopeName, role: tr.isotopeRole, detail: tr.isotopeDetail }),
  DENSE_FUEL_CELLS: l({ name: en.denseName, role: en.denseRole, detail: en.denseDetail }, { name: tr.denseName, role: tr.denseRole, detail: tr.denseDetail }),
  GRAVITIC_CHARGES: l({ name: en.graviticName, role: en.graviticRole, detail: en.graviticDetail }, { name: tr.graviticName, role: tr.graviticRole, detail: tr.graviticDetail }),
  DEUTERIUM_SYNTHESIS: l({ name: en.synthesisName, role: en.synthesisRole, detail: en.synthesisDetail }, { name: tr.synthesisName, role: tr.synthesisRole, detail: tr.synthesisDetail }),
  YARD_AUTOMATION: l({ name: en.yardName, role: en.yardRole, detail: en.yardDetail }, { name: tr.yardName, role: tr.yardRole, detail: tr.yardDetail }),
  AI_ROBOTS: l({ name: en.robotsName, role: en.robotsRole, detail: en.robotsDetail }, { name: tr.robotsName, role: tr.robotsRole, detail: tr.robotsDetail }),
  PROSPECTOR_HOLDS: l({ name: en.holdsName, role: en.holdsRole, detail: en.holdsDetail }, { name: tr.holdsName, role: tr.holdsRole, detail: tr.holdsDetail }),
  CARGO_HOLDS: l({ name: en.cargoName, role: en.cargoRole, detail: en.cargoDetail }, { name: tr.cargoName, role: tr.cargoRole, detail: tr.cargoDetail }),
  STARSHIP_ENGINEERING: l({ name: en.engineeringName, role: en.engineeringRole, detail: en.engineeringDetail }, { name: tr.engineeringName, role: tr.engineeringRole, detail: tr.engineeringDetail }),
  SHIP_POWER: l({ name: en.powerName, role: en.powerRole, detail: en.powerDetail }, { name: tr.powerName, role: tr.powerRole, detail: tr.powerDetail }),
  SHIP_ARMOR: l({ name: en.armorName, role: en.armorRole, detail: en.armorDetail }, { name: tr.armorName, role: tr.armorRole, detail: tr.armorDetail }),
  SHIP_PROPULSION: l({ name: en.propulsionName, role: en.propulsionRole, detail: en.propulsionDetail }, { name: tr.propulsionName, role: tr.propulsionRole, detail: tr.propulsionDetail }),
  EMPLACEMENT_DOCTRINE: l({ name: en.groundDoctrineName, role: en.doctrineRole, detail: en.groundDoctrineDetail }, { name: tr.groundDoctrineName, role: tr.doctrineRole, detail: tr.groundDoctrineDetail }),
  INTERCEPTION_GRID: l({ name: en.gridName, role: en.gridRole, detail: en.gridDetail }, { name: tr.gridName, role: tr.gridRole, detail: tr.gridDetail }),
  STRATEGIC_STOCKPILE: l({ name: en.stockpileName, role: en.stockpileRole, detail: en.stockpileDetail }, { name: tr.stockpileName, role: tr.stockpileRole, detail: tr.stockpileDetail }),
  INDUSTRIAL: l({ name: en.industrialName, role: en.industrialRole, detail: en.industrialDetail }, { name: tr.industrialName, role: tr.industrialRole, detail: tr.industrialDetail }),
};
