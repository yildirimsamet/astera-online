import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LANGUAGES, type Language } from './src/i18n/languages.js';
import { LANDING_COPY } from './src/landing/public/content.js';
import { PublicLanding, LANDING_HERO } from './src/landing/public/PublicLanding.js';
import { PUBLISHER_ORIGIN } from './src/lib/publisherPages.js';

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);

/** Build-time and dev publication share one document transform. No user-agent branching. */
export function renderLandingDocument(template: string, language: Language, path: string): string {
  const copy = LANDING_COPY[language];
  const canonical = `${PUBLISHER_ORIGIN}${path}`;
  const metadata = `<title>${escape(copy.title)}</title>
<meta name="description" content="${escape(copy.description)}">
<link rel="canonical" href="${canonical}">
${LANGUAGES.map(lang => `<link rel="alternate" hreflang="${lang}" href="${PUBLISHER_ORIGIN}/${lang}/">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${PUBLISHER_ORIGIN}/">
<meta property="og:type" content="website"><meta property="og:title" content="${escape(copy.title)}"><meta property="og:description" content="${escape(copy.description)}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${PUBLISHER_ORIGIN}/assets/images/general/og-image.png"><meta property="og:image:width" content="1733"><meta property="og:image:height" content="907"><meta property="og:image:alt" content="Astera Online">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(copy.title)}"><meta name="twitter:description" content="${escape(copy.description)}"><meta name="twitter:image" content="${PUBLISHER_ORIGIN}/assets/images/general/og-image.png">
<link rel="stylesheet" href="/landing/style.css">
<link rel="preload" as="image" href="${LANDING_HERO}" media="(min-width: 641px)"><link rel="preload" as="image" href="/assets/images/landing/orbit-hero-mobile-v1.webp" media="(max-width: 640px)">
<script type="application/ld+json" nonce="__CSP_NONCE__">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'VideoGame', name: 'Astera Online', url: canonical, description: copy.description, inLanguage: language, genre: ['Strategy', 'Space'], gamePlatform: 'Web browser', playMode: 'MultiPlayer', image: `${PUBLISHER_ORIGIN}/assets/images/general/og-image.png` }).replace(/</g, '\\u003c')}</script>`;
  const content = renderToStaticMarkup(createElement(PublicLanding, { language }));
  return template
    .replace(/<html\b[^>]*>/, `<html lang="${language}" data-public-surface>`)
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<meta\b[^>]*(?:name="(?:description|twitter:[^"]*)"|property="og:[^"]*")[^>]*>/g, '')
    .replace(/<link\b[^>]*rel="canonical"[^>]*>/g, '')
    .replace(/<link\b[^>]*rel="alternate"[^>]*>/g, '')
    .replace(/<link\b[^>]*href="\/(?:assets\/)?landing\/style(?:-[a-f0-9]+)?\.css"[^>]*>/g, '')
    .replace(/<link\b[^>]*rel="preload"[^>]*href="\/assets\/images\/landing\/[^>]*>/g, '')
    .replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<script\b[^>]*data-viewport-boot[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<noscript>[\s\S]*?<\/noscript>/, '')
    .replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<!-- ASTERA_PUBLIC_CONTENT_END -->)/, `<div id="root">${content}</div>\n`)
    .replace('</head>', `${metadata}\n</head>`);
}
