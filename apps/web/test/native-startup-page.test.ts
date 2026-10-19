// @vitest-environment node
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { nativeCompatibilityScript, nativeStartupHtml } from '../nativeStartupPage.js';
import { NATIVE_STARTUP_PATH } from '../mobileBuild.js';

it('keeps supported renderers on the shared game bootstrap', () => {
  const replace = vi.fn();
  runInNewContext(nativeCompatibilityScript, { CSS: { supports: () => true }, location: { replace } });
  expect(replace).not.toHaveBeenCalled();
});
it.each(['missing-css', 'missing-supports', 'old-css', 'broken-css', 'old-js', 'old-array'])('opens independent help for %s without relying on the native bridge', kind => {
  const replace = vi.fn();
  const CSS = kind === 'missing-css' ? undefined : { supports: kind === 'missing-supports' ? 'unavailable' : () => {
    if (kind === 'broken-css') throw new Error('Old CSS implementation');
    return kind !== 'old-css';
  } };
  const prelude = kind === 'old-js' ? 'Object.hasOwn=undefined;' : kind === 'old-array' ? 'Array.prototype.at=undefined;' : '';
  runInNewContext(prelude + nativeCompatibilityScript, { CSS, location: { replace } });
  expect(replace).toHaveBeenCalledOnce();
  expect(replace).toHaveBeenCalledWith(`/${NATIVE_STARTUP_PATH}`);
});
it('keeps recovery independent of app JS and hashes its only language script', () => {
  const html = nativeStartupHtml();
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(script).toBeTruthy();
  expect(html).toContain("script-src 'sha256-" + createHash('sha256').update(script ?? '').digest('base64') + "'");
  expect(html).toContain("default-src 'none'");
  expect(html).not.toContain('data-native-compatibility');
  expect(html).not.toContain('<script src=');
  expect(html).toContain('https://asteraonline.space/iletisim.html');
  expect(html).toContain('https://support.apple.com/en-us/118575');
});
it.each(['tr-TR', 'en-GB', 'de-DE'])('selects useful recovery copy for %s without a UI framework', language => {
  const script = /<script>([\s\S]*?)<\/script>/.exec(nativeStartupHtml())?.[1];
  if (!script) throw new Error('Missing startup language script');
  const nodes = ['tr', 'en'].map(value => ({ hidden: value !== 'en', getAttribute: () => value }));
  const document = { documentElement: { lang: 'en' }, querySelectorAll: () => nodes };
  runInNewContext(script, { document, navigator: { language } });
  const expected = language.startsWith('tr') ? 'tr' : 'en';
  expect(document.documentElement.lang).toBe(expected);
  expect(nodes.map(node => node.hidden)).toEqual(expected === 'tr' ? [false, true] : [true, false]);
});
