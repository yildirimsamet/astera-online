import type { LegacyFinish } from './presentation.js';

/** Four physical metals; gold is the legendary finish, without a colour-changing glow. */
export const FINISH: Record<LegacyFinish, { metal: string; glow: string; glowStrength: number }> = {
  iron: { metal: '#858e9a', glow: '#000000', glowStrength: 0 },
  bronze: { metal: '#c27b48', glow: '#000000', glowStrength: 0 },
  silver: { metal: '#d9e1ea', glow: '#000000', glowStrength: 0 },
  gold: { metal: '#f1c463', glow: '#000000', glowStrength: 0 },
};

/**
 * A rim of light at grazing angles only, for a finish that explicitly opts into glow. One fresnel term in the standard shader; no extra pass, no light.
 */
export const RIM_GLSL = `
{
  float legacyRim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.0);
  totalEmissiveRadiance += legacyGlow * legacyRim;
}`;
