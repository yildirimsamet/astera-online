import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Language } from './src/i18n/languages.js';

const COPY: Record<Language, { loading: string; failed: string; slow: string; retry: string }> = {
  tr: { loading: 'Oyun hazırlanıyor', failed: 'Oyun yüklenemedi. Bağlantını kontrol edip yeniden dene.', slow: 'Yükleme beklenenden uzun sürdü. Bağlantını kontrol edip yeniden dene.', retry: 'Yeniden dene' },
  en: { loading: 'Preparing the game', failed: 'The game could not load. Check your connection and try again.', slow: 'Loading is taking longer than expected. Check your connection and try again.', retry: 'Try again' },
  fr: { loading: 'Préparation du jeu', failed: 'Le jeu n’a pas pu se charger. Vérifie ta connexion et réessaie.', slow: 'Le chargement prend plus de temps que prévu. Vérifie ta connexion et réessaie.', retry: 'Réessayer' },
  de: { loading: 'Spiel wird vorbereitet', failed: 'Das Spiel konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.', slow: 'Das Laden dauert länger als erwartet. Prüfe deine Verbindung und versuche es erneut.', retry: 'Erneut versuchen' },
  es: { loading: 'Preparando el juego', failed: 'No se pudo cargar el juego. Comprueba tu conexión e inténtalo de nuevo.', slow: 'La carga está tardando más de lo esperado. Comprueba tu conexión e inténtalo de nuevo.', retry: 'Reintentar' },
  ja: { loading: 'ゲームを準備しています', failed: 'ゲームを読み込めませんでした。接続を確認して、もう一度お試しください。', slow: '読み込みに時間がかかっています。接続を確認して、もう一度お試しください。', retry: '再試行' },
};

const readBrand = (file: string) => readFileSync(resolve(import.meta.dirname, 'src/brand', file), 'utf8');
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);

export function startupStyles(): string {
  return `${readBrand('opening.css')}
#web-startup [hidden]{display:none!important}
#web-startup{overflow-y:auto}
#web-startup .brand-loading-readout{min-height:52px}
#web-startup-retry{display:block;width:100%;min-height:44px;margin-top:20px;padding:12px 16px;border:1px solid #77e4d5;border-radius:8px;background:#b1e8df;color:#071613;font:600 14px/1.35 Arial,sans-serif;cursor:pointer}
#web-startup-retry:hover{background:#d2f4ed}
#web-startup-retry:focus-visible{outline:2px solid #e6eeed;outline-offset:4px}
@media(max-height:550px){#web-startup .brand-loading-address{bottom:max(12px,env(safe-area-inset-bottom))}}`;
}

/** Inline by design: recovery must work even when every application module fails. */
const recoveryScript = `(() => {
  const root = document.getElementById('root');
  const template = document.getElementById('web-startup-template');
  const original = root.firstElementChild;
  let done = false;
  const mount = () => {
    if (!document.getElementById('web-startup')) document.body.appendChild(template.content.firstElementChild.cloneNode(true));
    return document.getElementById('web-startup');
  };
  const fail = kind => {
    if (done) return;
    window.clearTimeout(timer);
    const frame = mount();
    document.documentElement.setAttribute('data-session-restoring', '');
    frame.setAttribute('role', 'alert');
    frame.setAttribute('aria-busy', 'false');
    document.getElementById('web-startup-message').textContent = frame.getAttribute(kind);
    frame.querySelector('[role="progressbar"]').hidden = true;
    const retry = document.getElementById('web-startup-retry');
    retry.hidden = false;
    retry.onclick = () => window.location.reload();
    retry.focus();
  };
  const onError = event => {
    if (event.target instanceof HTMLScriptElement && event.target.type === 'module') fail('data-failed');
    else if (event instanceof ErrorEvent && (event.filename.startsWith(window.location.origin + '/assets/') || event.filename.startsWith(window.location.origin + '/src/'))) fail('data-failed');
  };
  const timer = window.setTimeout(() => { fail('data-slow'); }, 20000);
  // createRoot replaces the static root in one commit, including when ErrorBoundary wins.
  const observer = new MutationObserver(() => {
    if (!root.firstElementChild || root.firstElementChild === original) return;
    done = true;
    window.clearTimeout(timer);
    window.removeEventListener('error', onError, true);
    observer.disconnect();
    document.getElementById('web-startup')?.remove();
    template.remove();
    document.documentElement.removeAttribute('data-session-restoring');
  });
  observer.observe(root, { childList: true });
  window.addEventListener('error', onError, true);
  if (document.documentElement.hasAttribute('data-session-restoring')) mount();
})();`;

export function startupBody(language: Language): string {
  const copy = COPY[language];
  return `<template id="web-startup-template"><section id="web-startup" data-loading-screen class="brand-loading" role="status" aria-live="polite" aria-label="Astera Online" aria-busy="true" lang="${language}" data-failed="${escape(copy.failed)}" data-slow="${escape(copy.slow)}">
<div class="brand-loading-composition">
<div class="brand-opening" aria-hidden="true">${readBrand('opening-art.html')}</div>
<div class="brand-loading-center"><div class="brand-loading-name" aria-label="Astera Online"><span class="brand-loading-wordmark" aria-hidden="true">${readBrand('wordmark.svg')}</span><span class="brand-loading-online" aria-hidden="true">ONLINE</span></div></div>
<div class="brand-loading-status"><div class="brand-loading-readout"><p id="web-startup-message" class="brand-loading-caption">${escape(copy.loading)}</p></div><div class="brand-loading-rail" role="progressbar" aria-label="${escape(copy.loading)}"><span class="brand-loading-sweep"></span></div><button id="web-startup-retry" type="button" hidden>${escape(copy.retry)}</button></div>
</div><p class="brand-loading-address">asteraonline<span>.space</span></p>
</section></template><script nonce="__CSP_NONCE__" data-startup-recovery>${recoveryScript}</script>`;
}
