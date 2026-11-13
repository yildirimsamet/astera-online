import type { CSSProperties } from 'react';

/** Inline style with the kit's custom properties, typed without a cast. */
export type CssVars = CSSProperties & Partial<Record<`--${string}`, string | number>>;
