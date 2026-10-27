import type { RenderQuality } from '../../lib/quality.js';

/**
 * Whether the hangar bay draws its bloom and vignette pass (S22, 2026-10-26). The pass holds a
 * chain of full-screen targets beside a galaxy that is still alive behind the sheet; on a phone
 * below the top quality the bay draws without it, its light strips a little brighter instead.
 */
export const hangarPost = (quality: RenderQuality, coarse: boolean): boolean => quality === 'high' || !coarse;
