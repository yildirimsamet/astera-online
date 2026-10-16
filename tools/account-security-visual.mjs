import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real security components with a fixture API; never sends mail or touches player data. */
export async function verifyAccountSecurity(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 812 } }); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.waitForFunction(() => {
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        return [/\/react\.js\?/, /\/react-dom_client\.js\?/, /\/@tanstack_react-query\.js\?/].every(pattern => urls.some(url => pattern.test(url)));
      });
      const labels = await page.evaluate(async language => {
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => urls.findLast(url => new URL(url).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider }, { Api }, { ApiProvider }, { AccountSecurityEntry }, { PasswordResetSheet }, { default: i18n }] = await Promise.all([
          import(urls.find(url => /\/react\.js\?/.test(url))), import(urls.find(url => /\/react-dom_client\.js\?/.test(url))),
          import(urls.find(url => /\/@tanstack_react-query\.js\?/.test(url))), import(moduleUrl('/src/api/client.ts')),
          import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/screens/AccountSecuritySheet.tsx')),
          import(moduleUrl('/src/screens/PasswordResetSheet.tsx')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language); sessionStorage.removeItem('astera:password-reset');
        const api = new Api({ fetch: async url => {
          const path = String(url); const result = path.endsWith('/security')
            ? { enabled: true, loginMethod: 'username', email: null, maskedEmail: null, verifiedAt: null, pending: null }
            : { challengeId: '11111111-1111-4111-8111-111111111111', purpose: path.includes('/reset/') ? 'reset' : 'bind', expiresAt: new Date(Date.now() + 600000).toISOString(), resendAvailableAt: new Date(Date.now() + 60000).toISOString() };
          return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
        } });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const host = document.createElement('div'); document.body.replaceChildren(host); const root = createRoot(host);
        const wrap = child => h(QueryClientProvider, { client }, h(ApiProvider, { api }, h('main', { className: 'min-h-dvh bg-v2-void p-4 font-v2-ui text-v2-ink' }, h('div', { className: 'mx-auto max-w-md pt-8' }, h('h1', { className: 'mb-4 text-title' }, 'Astera Online'), child))));
        window.__securityReset = () => root.render(wrap(h(PasswordResetSheet, { onClose: () => undefined })));
        root.render(wrap(h(AccountSecurityEntry)));
        return Object.fromEntries(['add', 'email', 'currentPassword', 'send', 'code', 'newPassword', 'repeatPassword'].map(key => [key, i18n.t(`accountSecurity.${key}`)]));
      }, language);
      const capture = async state => {
        await page.waitForTimeout(150);
        const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
        assert(fits, `${language}/${width}/${state}: page overflow`);
        const dialog = page.getByRole('dialog').last();
        if (await dialog.count()) assert(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth), `${language}/${width}/${state}: dialog overflow`);
        assert.equal(errors.length, 0, errors.join('\n'));
        await page.screenshot({ path: join(output, `${language}-${width}-${state}.png`) }); results.push({ language, width, state, fits });
      };
      await page.getByRole('button', { name: new RegExp(labels.add) }).click(); await capture('email');
      await page.getByLabel(labels.email, { exact: true }).fill('pilot@example.com');
      await page.getByLabel(labels.currentPassword, { exact: true }).fill('a-correct-password');
      await page.getByRole('button', { name: labels.send, exact: true }).click();
      await page.getByLabel(labels.code, { exact: true }).fill('012345'); await capture('code');
      await page.evaluate(() => window.__securityReset());
      await page.getByLabel(labels.email, { exact: true }).fill('pilot@example.com');
      await page.getByRole('button', { name: labels.send, exact: true }).click();
      await page.getByLabel(labels.code, { exact: true }).fill('012345');
      await page.getByLabel(labels.newPassword, { exact: true }).fill('a-new-correct-password');
      await page.getByLabel(labels.repeatPassword, { exact: true }).fill('a-new-correct-password'); await capture('reset');
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Account security: ${results.length} visual states checked.`);
}
