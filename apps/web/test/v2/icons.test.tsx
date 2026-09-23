import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon, isIconId } from '../../src/v2/icons.js';

/**
 * THE V2 ICON SET IS THE SPEC'S SPRITE, DRAWN ONCE. docs/ui-v2/icons.svg.
 *
 * The sprite is the design (spec "Şekil anlatır, renk sınıflandırır"); the component
 * is how screens use it. A path edited in one and not the other is a glyph that means
 * one thing in the spec and another on the phone, so every symbol is compared shape by
 * shape. Three families, told apart by prefix: `i-` line glyphs, `c-` class emblems
 * (filled), `m-` map markers — and none of them carries its own colour.
 */

const sprite = readFileSync('../../docs/ui-v2/icons.svg', 'utf8');
const symbols = [...sprite.matchAll(/<symbol id="([^"]+)" viewBox="0 0 24 24">(.*?)<\/symbol>/g)]
  .map((m) => ({ id: m[1] ?? '', inner: m[2] ?? '' }));

/** Every shape element as `tag attr=value …`, attributes sorted, so markup style cannot matter. */
const shapes = (markup: string): string[] =>
  [...markup.matchAll(/<(circle|path|rect)\b([^>]*?)\/?>/g)].map(([, tag, attrs]) => {
    const pairs = [...(attrs ?? '').matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => `${k ?? ''}=${v ?? ''}`);
    return `${tag ?? ''} ${pairs.sort().join(' ')}`;
  });

describe('the v2 icon set', () => {
  it('has every symbol the spec draws', () => {
    expect(symbols.length).toBe(40);
    for (const { id } of symbols) expect(isIconId(id), id).toBe(true);
  });

  it.each(symbols)('draws $id exactly as the sprite does', ({ id, inner }) => {
    if (!isIconId(id)) throw new Error(`${id} is not an icon`);
    const markup = renderToStaticMarkup(<Icon id={id} />);
    expect(shapes(markup)).toEqual(shapes(inner));
  });

  it('draws line glyphs as 1.75 strokes in the current colour', () => {
    const markup = renderToStaticMarkup(<Icon id="i-galaxy" />);
    expect(markup).toContain('fill="none"');
    expect(markup).toContain('stroke="currentColor"');
    expect(markup).toContain('stroke-width="1.75"');
  });

  it('fills class emblems with the current colour and no stroke', () => {
    const markup = renderToStaticMarkup(<Icon id="c-sk" />);
    expect(markup).toContain('fill="currentColor"');
    expect(markup).toContain('stroke="none"');
  });

  it('draws map markers at a 1.6 stroke', () => {
    expect(renderToStaticMarkup(<Icon id="m-rock" />)).toContain('stroke-width="1.6"');
  });

  it('stays decorative unless it is the only label', () => {
    expect(renderToStaticMarkup(<Icon id="i-bell" />)).toContain('aria-hidden="true"');
    const labelled = renderToStaticMarkup(<Icon id="i-bell" title="Signals" />);
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('<title>Signals</title>');
    expect(labelled).not.toContain('aria-hidden');
  });
});
