/** D172. Plays the Academy through real controls at 350px. No account is
 * created. A failed lesson leaves a photo.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

export async function verifyAcademy(out) {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 350, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    reducedMotion: 'reduce', // Owner: animations must also run with this OS setting.
    locale: process.env.ACADEMY_LANGUAGE === 'tr' ? 'tr-TR' : 'en-US' });
  page.setDefaultTimeout(15_000);
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (r.url().includes('/api/')) requests.push(r.url()); });
  try {
    if (process.env.ACADEMY_BUILD_ONLY === '1') {
      await page.goto(process.env.WEB ?? 'http://localhost:5173');
      for (const step of [26, 35]) {
        // Resume an authored local lesson, never fabricate account resources.
        await page.evaluate((step) => localStorage.setItem('astera.academy.v1', JSON.stringify({
          version: 2, step, startedAt: Date.now(), orderAt: null, flight: null, journeys: [], seenSignals: [],
        })), step);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /Check your planet|Gezegenini İncele|GEZEGENİNİ İNCELE/i }).click({ timeout: 60_000 });
        await page.locator('[data-academy]').waitFor();
        requests.length = 0;
        await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 60_000 });
        await page.locator('#row-DART').click();
        const sheet = page.locator('[data-build-sheet]');
        const offered = await sheet.getByRole('textbox', { name: /quantity|adedi/i }).inputValue();
        if (offered !== '2') throw new Error(`Lesson ${step + 1} did not offer two Darts`);
        await sheet.locator('[data-commit] button').click();
        await sheet.waitFor({ state: 'detached' });
        await page.waitForTimeout(700);
        if (await page.locator('[data-sheet-scroll]').evaluateAll((bodies) => bodies.some((body) => body.scrollTop > 1))) throw new Error('Build did not reveal the queue');
        if (await page.locator('[class*="--toast-lift"]').count()) throw new Error('Academy displayed a toast');
        await page.screenshot({ path: `${out}/academy-build-${step + 1}.png` });
        await page.waitForFunction((step) => JSON.parse(localStorage.getItem('astera.academy.v1')).step > step, step);
        if (requests.length || errors.length) throw new Error(JSON.stringify({ requests, errors }));
        console.log(`Lesson ${step + 1}: one Build press ordered two Darts, revealed the queue, and advanced`);
      }
      return;
    }
    await page.goto(process.env.WEB ?? 'http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Check your planet|Gezegenini İncele|GEZEGENİNİ İNCELE/i }).click({ timeout: 60_000 });
    await page.locator('[data-academy]').waitFor();
    requests.length = 0;
    let finished = false;
    for (let n = 0; n < 400; n++) {
      if (await page.getByLabel(/^(Commander name|Komutan adı)$/).count()) { finished = true; break; }
      const card = page.locator('[data-beat-card]');
      // Read one render atomically: a queue may complete between two tool calls.
      const { id, message } = await page.locator('[data-academy]').evaluate((root) => ({
        id: root.getAttribute('data-academy-step'),
        message: root.querySelector('[data-beat-card]')?.innerText ?? '',
      }));
      console.log(message.replaceAll('\n', ' | '));
      if (id === 'welcome') {
        await page.locator('[data-academy-home]').waitFor({ state: 'attached' });
        await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 60_000 });
        await page.waitForTimeout(2200);
        const motion = await page.locator('img[src$="tutorial-hand-icon.png"]').evaluate((hand) => ({
          name: getComputedStyle(hand).animationName,
          running: hand.getAnimations().some((animation) => animation.playState === 'running'),
          ripples: [...hand.parentElement.querySelectorAll('[data-tap-ripple]')].filter((ring) => getComputedStyle(ring).animationName === 'academy-ripple' && getComputedStyle(ring).display !== 'none').length,
        }));
        if (motion.name !== 'academy-tap' || !motion.running || motion.ripples !== 2) throw new Error(`The tap animation is disabled: ${JSON.stringify(motion)}`);
        await page.screenshot({ path: `${out}/academy-home.png` });
        const home = await page.locator('[data-academy-home]').boundingBox();
        if (!home) throw new Error('The opening hand has no planet target');
        // The mark has no hitbox: this goes through the real WebGL planet picker.
        await page.mouse.click(home.x + home.width / 2, home.y + home.height / 2);
        await page.locator('[data-academy-step="production"] [data-sheet-panel]').waitFor();
        continue;
      }
      const next = card.getByRole('button', { name: /^(Continue|Enter my galaxy|Devam|Galaksime geç)$/ });
      if (await next.count()) {
        if (/Introduction only|Şimdilik yalnızca/.test(message)) {
          if (await page.locator('img[src$="tutorial-hand-icon.png"]').count()) throw new Error('An introduction is asking for a tap');
          await page.screenshot({ path: `${out}/academy-intro-${message.match(/\d+\/40/)?.[0].replace('/', '-')}.png` });
        }
        // An infinite scale animation intentionally never passes Playwright's
        // "stable for two frames" check. Press its centre like a real finger.
        const box = await next.boundingBox();
        if (!box) throw new Error('Continue is not visible');
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(500); continue;
      }
      if (/underway|Siparişin işleniyor/.test(message)) {
        await page.waitForTimeout(700);
        const scrolling = await page.locator('[data-sheet-scroll]').evaluateAll((bodies) => bodies.some((body) => body.scrollTop > 1));
        if (scrolling) throw new Error('A pending build left the menu scrolled below its queue');
        continue;
      }
      const tab = { production: 'grow', intel: 'orbit', defend: 'defend', fleet: 'reach' }[id];
      if (tab) {
        await page.locator(`[data-tab="${tab}"]`).click();
      } else if (id === 'telescope' && await page.locator('[data-sensor-toggle="telescope"]').getAttribute('aria-pressed') !== 'true') {
        await page.locator('[data-sensor-toggle="telescope"]').click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${out}/academy-telescope.png` });
      } else if (id === 'telescope') {
        await page.waitForTimeout(1000);
      } else if (await card.getByRole('button', { name: /^(Show the target|Hedefi göster)$/ }).count()) {
        await card.getByRole('button', { name: /^(Show the target|Hedefi göster)$/ }).click();
        if (id === 'mine') {
          await page.locator('[data-academy-mining]').getByRole('button', { name: /send|gönder/i }).click();
        } else {
          const launch = page.locator('[data-academy-launch]');
          await launch.getByRole('textbox', { name: /^(Dart quantity|Ok adedi)$/i }).fill('2');
          if (id === 'raid') await launch.getByRole('textbox', { name: /^(Courier quantity|Kurye adedi)$/i }).fill('1');
          await launch.getByRole('button', { name: /^Send \d+ ships$|^\d+ gemi gönder$/ }).click();
          await page.screenshot({ path: `${out}/academy-${id}-launch.png` });
          await launch.getByRole('button', { name: /^Launch|^Gönder —/i }).click();
        }
      } else if (id === 'pirateReport' || id === 'raidReport') {
        await page.locator('[data-academy-signals] > button').click();
        await page.getByRole('button', { name: /Open related report|İlgili raporu aç/ }).first().click();
        await page.locator('[data-battle-verdict]').waitFor();
        if (id === 'raidReport') {
          const report = await page.locator('[data-sheet-panel]').innerText();
          if (!report.includes('Academy II') || /AC-01/.test(report)) throw new Error('The world-raid lesson opened the pirate report');
        }
        await page.screenshot({ path: `${out}/academy-${id}-report.png` });
        await page.locator('[data-sheet-panel]').getByRole('button', { name: /^(Close|Kapat)$/ }).click();
      } else if (id?.endsWith('Reward')) {
        await page.locator('[data-reward-claim] button').click();
      } else {
        const hull = { darts: 'DART', reinforcements: 'DART', prospector: 'PROSPECTOR', courier: 'COURIER' }[id];
        const action = {
          core: 'CORE', refinery: 'REFINERY', extractor: 'EXTRACTOR', vault: 'VAULT',
          aegis: 'AEGIS', shipyard: 'SHIPYARD',
        }[id];
        const rowId = hull ?? action;
        const row = rowId ? page.locator(`#row-${rowId}`) : page.locator('[id^="row-"]').filter({ visible: true }).last();
        if (await row.count()) {
          await row.click();
          const item = page.locator('[data-item-sheet]');
          if (!hull) await item.locator('[data-act] button').click();
          const sheet = page.locator('[data-build-sheet]');
          if (hull) {
            await sheet.waitFor({ state: 'attached' });
            const wanted = id === 'darts' || id === 'reinforcements' ? '2' : '1';
            const offered = await sheet.getByRole('textbox', { name: /quantity|adedi/i }).inputValue();
            if (offered !== wanted) throw new Error(`Lesson ${id} offered ${offered} ships instead of ${wanted}`);
            await sheet.locator('[data-commit] button').click();
          }
        } else throw new Error(`Unhandled Academy action: ${message}`);
      }
      await page.waitForTimeout(500);
    }
    if (!finished) throw new Error('Academy never reached the account boundary');
    if (requests.length) throw new Error(`Academy made real requests: ${requests.join(', ')}`);
    if (errors.length) throw new Error(errors.join('\n'));
    await page.screenshot({ path: `${out}/academy.png` });
  } catch (error) {
    await page.screenshot({ path: `${out}/academy-failure.png` });
    console.log((await page.locator('body').innerText()).slice(-7000));
    throw error;
  } finally { await browser.close(); }
}
