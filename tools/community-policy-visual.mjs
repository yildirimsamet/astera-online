import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Actual registration and chat components; transport fixtures never modify a real account. */
export async function verifyCommunityPolicy(output) {
  await mkdir(output, { recursive: true });
  const results = [];
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 812 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.waitForFunction(() => {
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        return [/\/react\.js\?/, /\/react-dom_client\.js\?/, /\/@tanstack_react-query\.js\?/].every(pattern => urls.some(url => pattern.test(url)));
      });
      const labels = await page.evaluate(async language => {
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => urls.findLast(url => new URL(url).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider }, { Api }, { ApiProvider }, { ChatHost }, { ClaimDialog }, { keys }, { default: i18n }] = await Promise.all([
          import(urls.find(url => /\/react\.js\?/.test(url))), import(urls.find(url => /\/react-dom_client\.js\?/.test(url))),
          import(urls.find(url => /\/@tanstack_react-query\.js\?/.test(url))), import(moduleUrl('/src/api/client.ts')), import(moduleUrl('/src/api/context.tsx')),
          import(moduleUrl('/src/v2/shell/ChatHost.tsx')), import(moduleUrl('/src/onboarding/ClaimDialog.tsx')), import(moduleUrl('/src/api/keys.ts')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        const version = '2026-10-19'; const at = new Date();
        let mode = 'ready'; const requests = [];
        const api = new Api({ fetch: async (input, init) => {
          const path = String(input); const posting = path === '/api/community/policy' && init?.method === 'POST';
          if (posting) requests.push(JSON.parse(init.body));
          const failed = mode === 'outage' || mode === 'reject' && posting;
          const body = failed ? { error: 'UNAVAILABLE', message: 'Fixture only' } : path === '/api/community/policy' ? { version: mode === 'future' ? 'future' : version, acceptedAt: posting ? at : null } : { ok: true, readAt: at };
          return new Response(JSON.stringify(body), { status: failed ? 503 : 200 });
        } });
        const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        queries.setQueryData(keys.chatMessagesFor(language), { pages: [{ messages: [{ id: 'message', authorPlayerId: 'other', username: 'Scout', content: 'History remains readable before agreement.', self: false, language, createdAt: at }], nextBefore: null }], pageParams: [null] });
        queries.setQueryData(keys.chatUnreadFor(language), { count: 0 }); queries.setQueryData(keys.dmUnread, { count: 0 }); queries.setQueryData(keys.clanBadge, { available: true, membership: null, attentionCount: 0, clanChatUnread: 0 });
        const host = document.createElement('div'); document.body.replaceChildren(host); const root = createRoot(host);
        const wrap = child => h(QueryClientProvider, { client: queries }, h(ApiProvider, { api }, h('main', { className: 'h-dvh bg-v2-void font-v2-ui text-v2-ink [--v2-top-h:0px] [--v2-dock-h:0px]' }, child)));
        const chat = () => root.render(wrap(h(ChatHost, { accountId: 'fixture-account', channel: 'general', onClose: () => undefined, onFocusPlanet: () => undefined })));
        window.__policyMode = async next => { mode = next; await queries.resetQueries({ queryKey: keys.communityPolicy }); };
        window.__policyPosts = () => requests;
        window.__policyClaim = () => root.render(wrap(h(ClaimDialog, { planetName: 'Kestrel', onClaim: async () => undefined, onSignIn: () => undefined })));
        chat();
        return { agreement: i18n.t('moderation.policy.agreement'), accept: i18n.t('moderation.policy.accept'), retry: i18n.t('moderation.blocks.retry'), failed: i18n.t('moderation.policy.failed'), unavailable: i18n.t('moderation.policy.unavailable'), update: i18n.t('moderation.policy.update'), name: i18n.t('onboarding.claim.nameLabel'), password: i18n.t('onboarding.claim.passwordLabel'), next: i18n.t('onboarding.claim.next'), claim: i18n.t('onboarding.claim.submit') };
      }, language);
      const capture = async state => {
        await page.waitForTimeout(100);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}/${width}/${state}: page overflow`);
        for (const node of await page.locator('[data-sheet-panel], [role=log], form').all()) assert(await node.evaluate(element => element.scrollWidth <= element.clientWidth), `${language}/${width}/${state}: panel overflow`);
        assert.equal(await page.getByText(/moderation\.policy\./).count(), 0, 'Untranslated policy key');
        assert.deepEqual(errors, []);
        await page.screenshot({ path: join(output, `${language}-${width}-${state}.png`) });
        results.push({ language, width, state, noHorizontalOverflow: true, errors });
      };
      const agreement = page.getByRole('checkbox', { name: labels.agreement, exact: true });
      await agreement.waitFor(); assert.equal(await agreement.isChecked(), false);
      assert.equal(await page.getByRole('button', { name: labels.accept, exact: true }).isDisabled(), true);
      await capture('before-agreement');
      await page.evaluate(() => window.__policyMode('reject'));
      await agreement.check(); await page.getByRole('button', { name: labels.accept, exact: true }).click();
      await page.getByRole('alert').filter({ hasText: labels.failed }).waitFor(); await capture('agreement-error');
      assert.equal(await page.getByRole('textbox').count(), 0);
      await page.evaluate(() => window.__policyMode('ready'));
      await agreement.check(); await page.getByRole('button', { name: labels.accept, exact: true }).click();
      await page.getByRole('textbox').waitFor(); await capture('accepted');
      assert.deepEqual(await page.evaluate(() => window.__policyPosts()), [{ version: '2026-10-19', locale: language }, { version: '2026-10-19', locale: language }]);
      await page.evaluate(() => window.__policyMode('outage'));
      await page.getByRole('alert').filter({ hasText: labels.unavailable }).waitFor(); await capture('rules-outage');
      assert.equal(await page.getByRole('textbox').count(), 0);
      await page.evaluate(() => window.__policyMode('future'));
      await page.getByRole('alert').filter({ hasText: labels.update }).waitFor(); await capture('update-required');
      await page.evaluate(() => window.__policyClaim());
      await page.getByLabel(labels.name, { exact: true }).fill('PolicyCommander');
      await page.getByRole('button', { name: labels.next, exact: true }).click();
      await page.getByLabel(labels.password, { exact: true }).fill('fixture-password-only');
      assert.equal(await agreement.isChecked(), false);
      assert.equal(await page.getByRole('button', { name: labels.claim, exact: true }).isDisabled(), true);
      await capture('claim-unchecked');
      await agreement.check(); assert.equal(await page.getByRole('button', { name: labels.claim, exact: true }).isEnabled(), true);
      await capture('claim-ready'); await page.close();
    }
    for (const language of ['en', 'tr']) {
      const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 350, height: 812 } });
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/${language === 'tr' ? 'topluluk-kurallari.html' : 'community-guidelines.html'}`);
      assert.match(await page.locator('main').innerText(), /2026-10-19/);
      assert.equal(await page.locator('script,iframe,canvas').count(), 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: join(output, `${language}-350-public-no-js.png`), fullPage: true });
      results.push({ language, width: 350, state: 'public-no-js', noHorizontalOverflow: true }); await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Community policy: ${results.length} browser states verified.`);
}
