/** Standalone, freely configured battles. No real player state or server mutations. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyBattleSimulator(directory = 'out/battle-simulator') {
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const failures = [], captures = [];
  let playerRequests = 0;
  const ready = async page => {
    await page.getByRole('button', { name: 'Savaşı simüle et', exact: true }).waitFor({ timeout: 90000 });
    await page.locator('.sim-canvas canvas').waitFor({ timeout: 90000 });
    await page.locator('.sim-model-loading').waitFor({ state: 'hidden', timeout: 90000 });
    assert.equal(await page.evaluate(() => typeof window.__battleSimulator?.snapshot), 'function', 'render diagnostics must be available');
    const pause = page.getByRole('button', { name: 'Duraklat', exact: true });
    if (await pause.count()) await pause.click();
  };
  const seek = async (page, at) => {
    await page.getByLabel('Savaş zaman çizelgesi').evaluate((input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, at);
    await page.waitForFunction(value => Math.abs(window.__battleSimulator.snapshot().time - value) < .02, at);
  };
  const capture = async (page, name) => {
    const data = await page.evaluate(() => {
      const snapshot = window.__battleSimulator.snapshot();
      return { ...snapshot, viewportWidth: innerWidth, pageWidth: document.documentElement.scrollWidth,
        stage: document.querySelector('.sim-stage-panel').getBoundingClientRect().toJSON() };
    });
    assert.ok(data.finite, 'all instance matrices must remain finite');
    assert.ok(data.drawCalls > 0 && data.triangles > 0, 'the real models must draw');
    assert.ok(data.pageWidth <= data.viewportWidth, 'no horizontal overflow');
    assert.ok(data.stage.height > 260, 'the battlefield must retain usable portrait height');
    assert.equal(await page.locator('body').innerText().then(text => text.includes('simulator.')), false);
    await page.screenshot({ path: `${directory}/${name}.png` });
    captures.push({ name, ...data });
  };
  try {
    for (const viewport of [{ width: 1600, height: 1000 }, { width: 350, height: 812 }]) {
      const page = await browser.newPage({ viewport, locale: 'tr-TR' });
      page.on('pageerror', error => { failures.push(error.message); });
      page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
      page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) playerRequests++; });
      await page.goto(`${process.env.ASTERA_WEB ?? 'http://localhost:5184'}/?simulator=1`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await ready(page);
      await seek(page, 3.5);
      await capture(page, `${viewport.width}-fire`);
      await page.getByRole('button', { name: 'Bakış açısını değiştir' }).click();
      await capture(page, `${viewport.width}-defender`);
      const max = Number(await page.getByLabel('Savaş zaman çizelgesi').getAttribute('max'));
      await seek(page, max);
      assert.equal(await page.evaluate(() => {
        const probe = window.__battleSimulator, actual = probe.snapshot();
        return actual.ships.every(state => {
          const expected = probe.finalShips.find(ship => ship.id === state.id);
          return expected && expected.hp === state.hp && expected.shield === state.shield && expected.status === state.status;
        });
      }), true, 'rendered final health and status must equal the authoritative record');
      if (viewport.width < 700) {
        await page.getByRole('button', { name: 'Filoları düzenle' }).click();
        await page.getByRole('tab', { name: 'Savunan', exact: true }).click();
        await page.getByLabel('Aegis seviyesi', { exact: true }).fill('7');
        await capture(page, '350-settings');
        await page.getByLabel('Savaş alanı', { exact: true }).selectOption('MONUMENT');
        await page.getByRole('button', { name: 'Savaşı simüle et', exact: true }).click();
        await ready(page);
        assert.equal(await page.evaluate(() => window.__battleSimulator.initialAegis), 0);
        await capture(page, '350-space');
        await page.getByRole('button', { name: 'Atış dökümü', exact: true }).click();
      } else {
        await seek(page, 3.5);
      }
      await page.getByRole('button', { name: '1. atışı göster', exact: true }).first().click();
      await page.getByRole('table', { name: 'Hasar dağılımı' }).waitFor();
      await capture(page, `${viewport.width}-shot-detail`);
      await page.close();
    }
    assert.equal(playerRequests, 0, 'the simulator must not read real player APIs');
    assert.deepEqual(failures, [], 'no browser or shader errors');
    await writeFile(`${directory}/evidence.json`, JSON.stringify({ playerRequests, failures, captures }, null, 2));
    console.log(JSON.stringify({ screenshots: captures.map(c => c.name), playerRequests, failures }));
  } finally { await browser.close(); }
}
