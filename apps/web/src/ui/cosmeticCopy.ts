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
