import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** First HTML and React use the same artwork, letterforms and critical styles. */
export function openingScreenPlugin(): Plugin {
  const read = (name: string) => readFileSync(fileURLToPath(new URL(`./src/brand/${name}`, import.meta.url)), 'utf8');
  return {
    name: 'astera-opening-screen',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes('/* ASTERA_OPENING_CSS */')) return html;
        return html.replace('/* ASTERA_OPENING_CSS */', read('opening.css'))
          .replace('<!-- ASTERA_OPENING_ART -->', read('opening-art.html'))
          .replace('<!-- ASTERA_WORDMARK -->', read('wordmark.svg'))
          .replace('<!-- ASTERA_SIGIL -->', read('sigil.svg'));
      },
    },
  };
}
