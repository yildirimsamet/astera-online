// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { nativeHtml } from '../nativeBundlePlugin.js';

describe('native CSP without the web server nonce', () => {
  it('hashes inline boot scripts and restricts network access to the pinned API', () => {
    const script = '\nwindow.boot = true;\n';
    const html = nativeHtml(`<html><head><meta charset="UTF-8"><meta property="csp-nonce" nonce="__CSP_NONCE__"><link rel="manifest" href="/manifest.webmanifest"><style nonce="__CSP_NONCE__">body{color:red}</style><script nonce="__CSP_NONCE__">${script}</script><script type="module" src="/assets/main.js" nonce="__CSP_NONCE__"></script></head><body></body></html>`, 'https://api.example.test');
    expect(html).toContain(`'sha256-${createHash('sha256').update(script).digest('base64')}'`);
    expect(html).toContain("connect-src 'self' blob: https://api.example.test");
    expect(html).toContain("object-src 'none'");
    expect(html).not.toContain('__CSP_NONCE__');
    expect(html).not.toContain('manifest.webmanifest');
    expect(html).not.toContain("script-src 'unsafe-inline'");
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'));
  });
  it('refuses to package an unexpected remote script', () => {
    expect(() => nativeHtml('<head><script src="https://example.test/tracker.js"></script></head>', 'https://api.example.test')).toThrow(/script/i);
  });
});
