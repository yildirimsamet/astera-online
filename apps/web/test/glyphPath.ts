import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Glyph, type GlyphId } from '../src/game-ui/icons.js';

/** The path a kit glyph draws, to tell which glyph a screen put up (the svg carries no id). */
export const glyphPath = (id: GlyphId): string => /\sd="([^"]+)"/.exec(renderToStaticMarkup(createElement(Glyph, { id })))?.[1] ?? '';
