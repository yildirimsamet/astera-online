import { cosmeticById, type CosmeticId } from '@astera/rules';
import { PLANET_SKIN_CATALOG } from './skinCatalog.js';
const EFFECT_COPY = {
  'ring-aurora': { nameKey: 'skins.productring-aurora', storyKey: 'skins.storyauroraRING' },
  'ring-helios': { nameKey: 'skins.productring-helios', storyKey: 'skins.storyheliosRING' },
  'ring-singularity': { nameKey: 'skins.productring-singularity', storyKey: 'skins.storysingularityRING' },
  'engine-aurora': { nameKey: 'skins.productengine-aurora', storyKey: 'skins.storyauroraENGINE' },
  'engine-helios': { nameKey: 'skins.productengine-helios', storyKey: 'skins.storyheliosENGINE' },
  'engine-singularity': { nameKey: 'skins.productengine-singularity', storyKey: 'skins.storysingularityENGINE' },
  'engine-titan': { nameKey: 'skins.productengine-titan', storyKey: 'skins.storytitanENGINE' },
  'flag-aurora': { nameKey: 'skins.productflag-aurora', storyKey: 'skins.storyauroraFLAG' },
  'flag-helios': { nameKey: 'skins.productflag-helios', storyKey: 'skins.storyheliosFLAG' },
  'flag-singularity': { nameKey: 'skins.productflag-singularity', storyKey: 'skins.storysingularityFLAG' },
  'flag-vanguard': { nameKey: 'skins.productflag-vanguard', storyKey: 'skins.storyvanguardFLAG' },
  'flag-orbit': { nameKey: 'skins.productflag-orbit', storyKey: 'skins.storyorbitFLAG' },
  'flag-reaper': { nameKey: 'skins.productflag-reaper', storyKey: 'skins.storyreaperFLAG' },
  'flag-ravager': { nameKey: 'skins.productflag-ravager', storyKey: 'skins.storyravagerFLAG' },
  'flag-serpent': { nameKey: 'skins.productflag-serpent', storyKey: 'skins.storyserpentFLAG' },
  'flag-phoenix': { nameKey: 'skins.productflag-phoenix', storyKey: 'skins.storyphoenixFLAG' },
  'flag-ironfang': { nameKey: 'skins.productflag-ironfang', storyKey: 'skins.storyironfangFLAG' },
  'ring-saturn': { nameKey: 'skins.productring-saturn', storyKey: 'skins.storysaturnRING' },
  'ring-prism': { nameKey: 'skins.productring-prism', storyKey: 'skins.storyprismRING' },
  'ring-inferno': { nameKey: 'skins.productring-inferno', storyKey: 'skins.storyinfernoRING' },
  'ring-nebula': { nameKey: 'skins.productring-nebula', storyKey: 'skins.storynebulaRING' },
  'engine-tempest': { nameKey: 'skins.productengine-tempest', storyKey: 'skins.storytempestENGINE' },
  'engine-prism': { nameKey: 'skins.productengine-prism', storyKey: 'skins.storyprismENGINE' },
  'flag-bastion': { nameKey: 'skins.productflag-bastion', storyKey: 'skins.storybastionFLAG' },
  'flag-meridian': { nameKey: 'skins.productflag-meridian', storyKey: 'skins.storymeridianFLAG' },
  'flag-sovereign': { nameKey: 'skins.productflag-sovereign', storyKey: 'skins.storysovereignFLAG' },
  'flag-kraken': { nameKey: 'skins.productflag-kraken', storyKey: 'skins.storykrakenFLAG' },
  'flag-oni': { nameKey: 'skins.productflag-oni', storyKey: 'skins.storyoniFLAG' },
  'flag-voideye': { nameKey: 'skins.productflag-voideye', storyKey: 'skins.storyvoideyeFLAG' },
  'flag-valkyrie': { nameKey: 'skins.productflag-valkyrie', storyKey: 'skins.storyvalkyrieFLAG' },
  'flag-scarab': { nameKey: 'skins.productflag-scarab', storyKey: 'skins.storyscarabFLAG' },
  'flag-stag': { nameKey: 'skins.productflag-stag', storyKey: 'skins.storystagFLAG' },
  'flag-horizon': { nameKey: 'skins.productflag-horizon', storyKey: 'skins.storyhorizonFLAG' },
  'flag-tiger': { nameKey: 'skins.productflag-tiger', storyKey: 'skins.storytigerFLAG' },
  'flag-scorpion': { nameKey: 'skins.productflag-scorpion', storyKey: 'skins.storyscorpionFLAG' },
  'probe-ufo': { nameKey: 'skins.productprobe-ufo', storyKey: 'skins.storyufoPROBE' },
  'ship-red-dragon': { nameKey: 'skins.productship-red-dragon', storyKey: 'skins.storyRedDragonSHIP' },
  'ship-scorpion': { nameKey: 'skins.productship-scorpion', storyKey: 'skins.storyScorpionSHIP' },
  'ship-shark': { nameKey: 'skins.productship-shark', storyKey: 'skins.storySharkSHIP' },
  'ship-stingray': { nameKey: 'skins.productship-stingray', storyKey: 'skins.storyStingraySHIP' },
} as const;
const COPY = { ...PLANET_SKIN_CATALOG, ...EFFECT_COPY };
export const cosmeticCopy = (id: CosmeticId) => COPY[id];
export const cosmeticCard = (id: CosmeticId): string =>
  `/assets/images/cosmetics/${cosmeticById(id)?.category === 'SHIP' ? 'ships/' : ''}${id}.webp`;
export const COSMETIC_SCOPE = {
  PLANET: 'skins.intro', RING: 'skins.scopeRING', ENGINE: 'skins.scopeENGINE', FLAG: 'skins.scopeFLAG',
  PROBE: 'skins.scopePROBE', SHIP: 'skins.scopeSHIP', MINER: 'skins.scopeMINER',
} as const;
