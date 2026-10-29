// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertNativeArtifacts } from '../mobileBuildCli.js';
import { nativeHtml } from '../nativeBundlePlugin.js';
import { nativeStartupHtml } from '../nativeStartupPage.js';
import { NATIVE_STARTUP_PATH } from '../mobileBuild.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function artifact() {
  const root = mkdtempSync(join(tmpdir(), 'astera-native-artifact-')); roots.push(root);
  writeFileSync(join(root, 'index.html'), nativeHtml('<html><head><meta charset="UTF-8"></head><script type="module" src="/assets/app.js"></script></html>', 'https://api.example.test'));
  writeFileSync(join(root, 'native-build.json'), JSON.stringify({ target: 'native-staging', apiUrl: 'https://api.example.test', bundled: true, storeReady: false }));
  mkdirSync(join(root, 'assets')); writeFileSync(join(root, 'assets/app.js'), 'console.log("game");');
  writeFileSync(join(root, NATIVE_STARTUP_PATH), nativeStartupHtml());
  mkdirSync(join(root, '__ref/dist/v2'), { recursive: true }); writeFileSync(join(root, '__ref/dist/v2/manifest-lite.json'), '{}');
  return root;
}
const expected = { target: 'native-staging', apiUrl: 'https://api.example.test' };
describe('native artifact gate before Capacitor copies files', () => {
  it('accepts a bundled game with the expected target, API and script', () => {
    expect(() => { assertNativeArtifacts(artifact(), expected); }).not.toThrow();
  });
  it.each(['checkout.html', 'pricing.html', 'h5-ads.js', 'consent-bootstrap.js', 'v2-gallery.html', 'manifest.webmanifest', 'ads.txt'])('rejects a stale web/dev file: %s', name => {
    const root = artifact(); writeFileSync(join(root, name), 'stale');
    expect(() => { assertNativeArtifacts(root, expected); }).toThrow();
  });
  it('rejects an artifact for a different API even when the directory name is correct', () => {
    expect(() => { assertNativeArtifacts(artifact(), { ...expected, apiUrl: 'https://different.example.test' }); }).toThrow(/metadata|API/i);
  });
  it('rejects a missing script rather than producing a blank-screen APK', () => {
    const root = artifact(); rmSync(join(root, 'assets/app.js'));
    expect(() => { assertNativeArtifacts(root, expected); }).toThrow(/script/i);
  });
  it('rejects an HTML document that still needs the nginx nonce or loads a web ad', () => {
    const root = artifact();
    writeFileSync(join(root, 'index.html'), '<script nonce="__CSP_NONCE__" src="https://pagead2.googlesyndication.com/adsbygoogle.js"></script>');
    expect(() => { assertNativeArtifacts(root, expected); }).toThrow();
  });
});


it('refuses to export a native app without its independent startup help page', () => {
  const root = artifact(); rmSync(join(root, NATIVE_STARTUP_PATH));
  expect(() => { assertNativeArtifacts(root, expected); }).toThrow(/startup/i);
});


it('rejects a stale startup placeholder instead of exporting broken recovery', () => {
  const root = artifact(); writeFileSync(join(root, NATIVE_STARTUP_PATH), '<html>placeholder</html>');
  expect(() => { assertNativeArtifacts(root, expected); }).toThrow(/startup/i);
});

it('refuses to export an app without its arena reference pack', () => {
  const root = artifact(); rmSync(join(root, '__ref'), { recursive: true });
  expect(() => { assertNativeArtifacts(root, expected); }).toThrow(/reference pack/i);
});
