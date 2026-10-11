import { ASTEROID_MODELS, ISOTOPE_MODEL } from '../ui/assets.js';
import { asteroidVisualSeed } from './scene.js';

/** Private composition never participates in the visual choice. */
export function asteroidModelUrl(rock: { readonly id: string; readonly isotopeRich: boolean }): string {
  return rock.isotopeRich ? ISOTOPE_MODEL : ASTEROID_MODELS[asteroidVisualSeed(rock.id) % ASTEROID_MODELS.length]!;
}
