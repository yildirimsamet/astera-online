import type { ResearchProjectId } from '@astera/rules';
import { RESEARCH_ART } from './assets.js';

/** Decorative environments are distinct from gameplay objects and their tier contract. */
export interface AtmosphereArt {
  src: string;
  position?: string;
  /** Foreground craft retain their full silhouette in a dedicated image well. */
  fit?: 'contain';
}

const BASE = '/assets/images/atmosphere';
export const ATMOSPHERE = {
  inventory: { src: `${BASE}/inventory-v1.webp`, position: '50% 45%' },
  seasonAccount: { src: `${BASE}/season-account-v1.webp`, position: '50% 45%' },
  galaxyAccount: { src: `${BASE}/galaxy-account-v1.webp`, position: '50% 45%' },
  academy: { src: `${BASE}/academy-v1.webp`, position: '50% 45%' },
  donate: { src: `${BASE}/donate-v1.webp`, position: '50% 45%' },
  feedback: { src: `${BASE}/feedback-v1.webp`, position: '50% 45%' },
  commanderRoom: { src: `${BASE}/commander-room-v2.webp`, position: '50% 22%' },
  repair: { src: `${BASE}/repair-v2.webp`, position: '50% 72%' },
  interceptor: { src: `${BASE}/interceptor-v4.webp`, position: '50% 32%' },
  strategic: { src: `${BASE}/strategic-v2.webp`, position: '50% 45%' },
  commander: { src: `${BASE}/commander-v1.webp`, position: '65% 40%' },
  fleet: { src: `${BASE}/fleet-v1.webp`, position: '55% 48%' },
  intel: { src: `${BASE}/intel-v1.webp`, position: '55% 45%' },
  clan: { src: `${BASE}/clan-v1.webp`, position: '60% 56%' },
  announcements: { src: `${BASE}/announcements-v1.webp`, position: 'center' },
  rewards: { src: `${BASE}/rewards-v1.webp`, position: '65% 50%' },
  season: { src: `${BASE}/season-v1.webp`, position: '50% 70%' },
  research: { src: `${BASE}/research-v1.webp`, position: '65% 40%' },
} satisfies Record<string, AtmosphereArt>;


/** Research subjects are authored for the complete landscape selection card. */
export const RESEARCH_SCENES = {
  ISOTOPE_SPECTROMETRY: { src: `${BASE}/research-isotope-spectrometry-scene-v2.webp`, position: '60% 46%' },
  DENSE_FUEL_CELLS: { src: `${BASE}/research-dense-fuel-cells-scene-v2.webp`, position: '60% 46%' },
  GRAVITIC_CHARGES: { src: `${BASE}/research-gravitic-charges-scene-v2.webp`, position: '60% 46%' },
  DEUTERIUM_SYNTHESIS: { src: `${BASE}/research-deuterium-synthesis-scene-v2.webp`, position: '60% 46%' },
  YARD_AUTOMATION: { src: `${BASE}/research-yard-automation-scene-v1.webp`, position: '60% 46%' },
  AI_ROBOTS: { src: `${BASE}/research-ai-robots-scene-v1.webp`, position: '60% 46%' },
  PROSPECTOR_HOLDS: { src: `${BASE}/research-prospector-holds-scene-v1.webp`, position: '60% 46%' },
  CARGO_HOLDS: { src: `${BASE}/research-cargo-holds-scene-v1.webp`, position: '60% 46%' },
  STARSHIP_ENGINEERING: { src: `${BASE}/research-starship-engineering-scene-v1.webp`, position: '60% 46%' },
  SHIP_POWER: { src: `${BASE}/research-ship-power-scene-v1.webp`, position: '60% 46%' },
  SHIP_ARMOR: { src: `${BASE}/research-ship-armor-scene-v1.webp`, position: '60% 46%' },
  SHIP_SHIELDS: { src: RESEARCH_ART.SHIP_SHIELDS, position: '50% 50%', fit: 'contain' },
  SHIP_PROPULSION: { src: `${BASE}/research-ship-propulsion-scene-v1.webp`, position: '60% 46%' },
  EMPLACEMENT_DOCTRINE: { src: `${BASE}/research-emplacement-doctrine-scene-v1.webp`, position: '60% 46%' },
  INTERCEPTION_GRID: { src: `${BASE}/research-interception-grid-scene-v1.webp`, position: '60% 46%' },
  STRATEGIC_STOCKPILE: { src: `${BASE}/research-strategic-stockpile-scene-v1.webp`, position: '60% 46%' },
  INDUSTRIAL: { src: `${BASE}/research-industrial-scene-v1.webp`, position: '60% 46%' },
  RADIATION_SHIELDING: { src: RESEARCH_ART.RADIATION_SHIELDING, position: '50% 50%', fit: 'contain' },
} satisfies Record<ResearchProjectId, AtmosphereArt>;

const CARD_SCENES: Readonly<Record<string, AtmosphereArt>> = {
  '/assets/images/general/command_core_1.png': { src: `${BASE}/core-t1-v1.webp` },
  '/assets/images/resources/alloy_refinery_1.png': { src: `${BASE}/refinery-t1-v1.webp` },
  '/assets/images/resources/crystal_extractor_1.png': { src: `${BASE}/extractor-t1-v1.webp` },
  '/assets/images/resources/deuterium_refinery_1.webp': { src: `${BASE}/deuterium-t1-v1.webp` },
  '/assets/images/general/shipyard_1.png': { src: `${BASE}/shipyard-t1-v1.webp` },
  '/assets/images/general/hangar_1.png': { src: `${BASE}/hangar-t1-v1.webp` },
  '/assets/images/general/vault_1.png': { src: `${BASE}/vault-t1-v2.webp` },
  '/assets/images/general/vault_2.png': { src: `${BASE}/vault-t2-v2.webp` },
  '/assets/images/general/vault_3.png': { src: `${BASE}/vault-t3-v2.webp` },
  '/assets/images/general/command_core_2.png': { src: `${BASE}/core-t2-v2.webp` },
  '/assets/images/general/command_core_3.png': { src: `${BASE}/core-t3-v2.webp` },
  '/assets/images/resources/alloy_refinery_2.png': { src: `${BASE}/refinery-t2-v2.webp` },
  '/assets/images/resources/alloy_refinery_3.png': { src: `${BASE}/refinery-t3-v2.webp` },
  '/assets/images/resources/crystal_extractor_2.png': { src: `${BASE}/extractor-t2-v2.webp` },
  '/assets/images/resources/crystal_extractor_3.png': { src: `${BASE}/extractor-t3-v2.webp` },
  '/assets/images/resources/deuterium_refinery_2.webp': { src: `${BASE}/deuterium-t2-v2.webp` },
  '/assets/images/resources/deuterium_refinery_3.webp': { src: `${BASE}/deuterium-t3-v2.webp` },
  '/assets/images/general/shipyard_2.png': { src: `${BASE}/shipyard-t2-v2.webp` },
  '/assets/images/general/shipyard_3.png': { src: `${BASE}/shipyard-t3-v2.webp` },
  '/assets/images/general/hangar_2.png': { src: `${BASE}/hangar-t2-v2.webp` },
  '/assets/images/general/hangar_3.png': { src: `${BASE}/hangar-t3-v2.webp` },
  '/assets/images/general/radar_1.png': { src: `${BASE}/radar-t1-v2.webp` },
  '/assets/images/general/radar_2.png': { src: `${BASE}/radar-t2-v2.webp` },
  '/assets/images/general/radar_3.png': { src: `${BASE}/radar-t3-v2.webp` },
  '/assets/images/general/telescope_1.png': { src: `${BASE}/scope-t1-v2.webp` },
  '/assets/images/general/telescope_2.png': { src: `${BASE}/scope-t2-v2.webp` },
  '/assets/images/general/telescope_3.png': { src: `${BASE}/scope-t3-v2.webp` },
  '/assets/images/general/shield_1.png': { src: `${BASE}/shield-t1-v2.webp` },
  '/assets/images/general/shield_2.png': { src: `${BASE}/shield-t2-v2.webp` },
  '/assets/images/general/shield_3.png': { src: `${BASE}/shield-t3-v2.webp` },
  '/assets/images/general/veil_1.png': { src: `${BASE}/veil-t1-v2.webp` },
  '/assets/images/general/veil_2.png': { src: `${BASE}/veil-t2-v2.webp` },
  '/assets/images/general/veil_3.png': { src: `${BASE}/veil-t3-v2.webp` },
  '/assets/images/general/harpoon_1.png': { src: `${BASE}/harpoon-t1-v2.webp` },
  '/assets/images/general/harpoon_2.png': { src: `${BASE}/harpoon-t2-v2.webp` },
  '/assets/images/general/harpoon_3.png': { src: `${BASE}/harpoon-t3-v2.webp` },
  '/assets/images/general/bastion_1.png': { src: `${BASE}/larger-battery-t1-v2.webp` },
  '/assets/images/general/bastion_2.png': { src: `${BASE}/larger-battery-t2-v2.webp` },
  '/assets/images/general/bastion_3.png': { src: `${BASE}/larger-battery-t3-v2.webp` },
  '/assets/images/general/thorn_1.png': { src: `${BASE}/close-battery-t1-v2.webp` },
  '/assets/images/general/thorn_2.png': { src: `${BASE}/close-battery-t2-v2.webp` },
  '/assets/images/general/thorn_3.png': { src: `${BASE}/close-battery-t3-v2.webp` },
  '/assets/images/sattelites/sattelite_type_1.png': { src: `${BASE}/foundry-v2.webp` },
  '/assets/images/sattelites/sattelite_type_2.png': { src: `${BASE}/beacon-v2.webp` },
  '/assets/images/sattelites/sattelite_type_3.png': { src: `${BASE}/derrick-v2.webp` },
  '/assets/images/sattelites/sattelite_type_4.png': { src: `${BASE}/uplink-v2.webp` },
  '/assets/images/general/repair_station_1.png': { src: `${BASE}/repair-v2.webp` },
  '/assets/images/general/anti-strategic-battery.png': { src: `${BASE}/interceptor-v4.webp` },
  '/assets/images/ships/death_star.png': { src: `${BASE}/strategic-v2.webp` },
  '/assets/images/ships/dart.webp': { src: `${BASE}/dart-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/pike.webp': { src: `${BASE}/pike-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/rampart.webp': { src: `${BASE}/rampart-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/warden.webp': { src: `${BASE}/warden-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/courier.webp': { src: `${BASE}/courier-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/viper.webp': { src: `${BASE}/viper-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/talon.webp': { src: `${BASE}/talon-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/stronghold.webp': { src: `${BASE}/stronghold-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/sentinel.webp': { src: `${BASE}/sentinel-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/wayfarer.webp': { src: `${BASE}/wayfarer-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/tempest.webp': { src: `${BASE}/tempest-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/ballista.webp': { src: `${BASE}/ballista-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/leviathan.webp': { src: `${BASE}/leviathan-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/praetorian.webp': { src: `${BASE}/praetorian-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/atlas.webp': { src: `${BASE}/atlas-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/nullifier.webp': { src: `${BASE}/nullifier-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/garbage-collector.webp': { src: `${BASE}/garbage-collector-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/cataclysm.webp': { src: `${BASE}/cataclysm-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/corsair.webp': { src: `${BASE}/corsair-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/citadel.webp': { src: `${BASE}/citadel-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/paladin.webp': { src: `${BASE}/paladin-scene-v1.webp`, fit: 'contain' },
  '/assets/images/ships/argosy.webp': { src: `${BASE}/argosy-scene-v1.webp`, fit: 'contain' },
  '/assets/images/drills/drill_1.png': { src: `${BASE}/prospector-scene-v1.webp`, fit: 'contain' },
};

/** Exact tier and subject mapping. Unknown objects retain their accurate original render. */
export function cardScene(src: string | null | undefined): AtmosphereArt | undefined {
  return src ? CARD_SCENES[src] : undefined;
}
