import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import { renderLandingDocument } from '../landingPublication.js';

const template = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');

function start(returning = true) {
  const html = renderLandingDocument(template, 'tr', '/tr/');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const script = parsed.querySelector('script[data-startup-recovery]');
  expect(script).not.toBeNull();
  document.body.innerHTML = parsed.body.innerHTML;
  if (returning) document.documentElement.setAttribute('data-session-restoring', '');
  const reload = vi.fn();
  runInNewContext(script?.textContent ?? '', {
    document, MutationObserver, HTMLScriptElement, ErrorEvent,
    window: {
      setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
      addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window),
      location: { reload, origin: window.location.origin },
    },
  });
  return { reload, module: document.querySelector<HTMLScriptElement>('script[type="module"]') };
}

afterEach(async () => {
  document.getElementById('root')?.replaceChildren(document.createElement('main'));
  await Promise.resolve();
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-session-restoring');
  vi.useRealTimers();
});

it('provides a branded loading frame without downloading the application or any image/font', () => {
  start();
  const frame = document.getElementById('web-startup');
  expect(frame).not.toBeNull();
  expect(frame).toHaveAttribute('aria-busy', 'true');
  expect(frame?.querySelector('svg')).not.toBeNull();
  expect(frame?.querySelector('img,link,script,canvas')).toBeNull();
  expect(document.getElementById('web-startup-retry')).toHaveAttribute('hidden');
});

it.each([true, false])('offers retry when the entry module fails (returning=%s)', returning => {
  const { module, reload } = start(returning);
  module?.dispatchEvent(new Event('error'));
  expect(document.getElementById('web-startup')).toHaveAttribute('role', 'alert');
  expect(document.getElementById('web-startup')).toHaveAttribute('aria-busy', 'false');
  expect(document.getElementById('web-startup-message')).toHaveTextContent('Oyun yüklenemedi');
  const retry = document.getElementById('web-startup-retry');
  expect(retry).not.toHaveAttribute('hidden');
  retry?.click();
  expect(reload).toHaveBeenCalledOnce();
});

it('offers retry for a stalled download without reloading automatically', () => {
  vi.useFakeTimers();
  const { reload } = start();
  vi.advanceTimersByTime(19_999);
  expect(document.getElementById('web-startup-retry')).toHaveAttribute('hidden');
  vi.advanceTimersByTime(1);
  expect(document.getElementById('web-startup-retry')).not.toHaveAttribute('hidden');
  expect(document.getElementById('web-startup-message')).toHaveTextContent('Yükleme beklenenden uzun sürdü');
  expect(reload).not.toHaveBeenCalled();
});

it('keeps a definite module failure message instead of overwriting it with a later timeout', () => {
  vi.useFakeTimers();
  const { module } = start();
  module?.dispatchEvent(new Event('error'));
  vi.advanceTimersByTime(60_000);
  expect(document.getElementById('web-startup-message')).toHaveTextContent('Oyun yüklenemedi');
  expect(vi.getTimerCount()).toBe(0);
});

it('also recovers when an application module throws before React can start', () => {
  start();
  window.dispatchEvent(new ErrorEvent('error', { filename: `${window.location.origin}/assets/index-hash.js`, message: 'Module evaluation failed' }));
  expect(document.getElementById('web-startup-retry')).not.toHaveAttribute('hidden');
});

it('retains its recovery frame if the application clears the root without rendering a screen', async () => {
  start();
  document.getElementById('root')?.replaceChildren();
  await Promise.resolve();
  expect(document.getElementById('web-startup')).not.toBeNull();
});

it.each([false, true])('hands off to any committed React screen and cancels recovery (already failed=%s)', async failed => {
  vi.useFakeTimers();
  const { module } = start();
  if (failed) module?.dispatchEvent(new Event('error'));
  const crash = document.createElement('main');
  crash.setAttribute('role', 'alert');
  crash.textContent = 'React error recovery';
  document.getElementById('root')?.replaceChildren(crash);
  await Promise.resolve();
  expect(document.getElementById('web-startup')).toBeNull();
  expect(document.documentElement).not.toHaveAttribute('data-session-restoring');
  expect(crash).toBeInTheDocument();
  vi.advanceTimersByTime(60_000);
  module?.dispatchEvent(new Event('error'));
  expect(document.getElementById('web-startup')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps the public introduction for guests and ignores unrelated image failures', () => {
  start(false);
  expect(document.getElementById('web-startup')).toBeNull();
  document.querySelector('img')?.dispatchEvent(new Event('error'));
  expect(document.getElementById('web-startup')).toBeNull();
});

it('publishes only one recovery frame and script when localizing compiled HTML again', () => {
  const once = renderLandingDocument(template, 'tr', '/tr/');
  const twice = renderLandingDocument(once, 'en', '/en/');
  const doc = new DOMParser().parseFromString(twice, 'text/html');
  expect(doc.querySelectorAll('template#web-startup-template')).toHaveLength(1);
  expect(doc.querySelectorAll('script[data-startup-recovery]')).toHaveLength(1);
  expect(doc.querySelector('script[data-startup-recovery]')?.getAttribute('nonce')).toBe('__CSP_NONCE__');
  expect(doc.querySelector('[data-loading-screen]')).toBeNull();
  expect(doc.querySelectorAll('h1')).toHaveLength(1);
  expect(doc.querySelector<HTMLTemplateElement>('#web-startup-template')?.content.querySelector('#web-startup-retry')?.textContent).toBe('Try again');
});
