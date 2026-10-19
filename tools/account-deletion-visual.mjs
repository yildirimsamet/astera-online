import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real account controls + translations, fixture transport only; no real accounts or API writes. */
export async function verifyAccountDeletion(output) {
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
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider }, { Api }, { ApiProvider }, { AccountDeletionEntry }, { AdminDeletionQueue }, { default: i18n }] = await Promise.all([
          import(urls.find(url => /\/react\.js\?/.test(url))), import(urls.find(url => /\/react-dom_client\.js\?/.test(url))),
          import(urls.find(url => /\/@tanstack_react-query\.js\?/.test(url))), import(moduleUrl('/src/api/client.ts')),
          import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/screens/AccountDeletionSheet.tsx')),
          import(moduleUrl('/src/screens/AdminDeletionQueue.tsx')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        const request = { requestId: '11111111-1111-4111-8111-111111111111', requestedAt: '2026-10-19T00:00:00.000Z', status: 'requested' };
        let submitted = false;
        const api = new Api({ fetch: async (url, init) => {
          let result;
          if (String(url).startsWith('/api/admin/')) result = { requests: [{ ...request, accountId: '22222222-2222-4222-8222-222222222222', username: 'policypilot', displayName: 'Policy Pilot' }], mediaPending: [{ requestId: '33333333-3333-4333-8333-333333333333', files: 1 }] };
          else { if (init?.method === 'POST') submitted = true; result = { request: submitted ? request : null }; }
          return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
        } });
        const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const host = document.createElement('div'); document.body.replaceChildren(host); const root = createRoot(host);
        const wrap = child => h(QueryClientProvider, { client: queries }, h(ApiProvider, { api }, h('main', { className: 'min-h-dvh bg-v2-void p-4 font-v2-ui text-v2-ink' }, h('div', { className: 'mx-auto max-w-xl pt-6' }, child))));
        window.__deletionAdmin = () => root.render(wrap(h(AdminDeletionQueue)));
        root.render(wrap(h(AccountDeletionEntry)));
        return { ...Object.fromEntries(['title', 'password', 'submit', 'received', 'close'].map(key => [key, i18n.t(`accountDeletion.${key}`)])), approve: i18n.t('accountDeletion.admin.approve'), supportTitle: i18n.t('accountDeletion.admin.supportTitle') };
      }, language);
      const capture = async state => {
        await page.waitForTimeout(100);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}/${width}/${state}: page overflow`);
        const dialog = page.getByRole('dialog').last();
        if (await dialog.count()) assert(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth), `${language}/${width}/${state}: dialog overflow`);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: join(output, `${language}-${width}-${state}.png`) }); results.push({ language, width, state, noHorizontalOverflow: true, errors });
      };
      await page.getByRole('button', { name: labels.title, exact: true }).click();
      await page.getByLabel(labels.password, { exact: true }).waitFor(); await capture('request');
      await page.getByLabel(labels.password, { exact: true }).fill('fixture-password-only');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: labels.submit, exact: true }).click();
      await page.getByRole('status').filter({ hasText: labels.received }).waitFor(); await capture('received');
      await page.getByRole('button', { name: labels.close, exact: true }).last().click();
      await page.evaluate(() => window.__deletionAdmin());
      await page.getByRole('button', { name: labels.approve, exact: true }).click(); await capture('admin-confirm');
      await page.getByText(labels.supportTitle, { exact: true }).click(); await capture('support-record');
      await page.close();
    }
    for (const language of ['tr', 'en']) for (const width of [350, 1280]) {
      const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width, height: 812 } });
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/${language === 'tr' ? 'hesap-silme.html' : 'account-deletion.html'}`);
      await page.locator('#request-deletion a[href^="mailto:"]').waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await page.locator('script,canvas,iframe').count(), 0);
      await page.screenshot({ path: join(output, `${language}-${width}-public-no-js.png`), fullPage: true });
      results.push({ language, width, state: 'public-no-js', noHorizontalOverflow: true }); await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Account deletion: ${results.length} browser states verified.`);
}
