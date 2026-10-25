/** Actual mission settlement -> authorized API -> report -> real 3D replay. Uses the isolated preview fixture. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyRealBattleReplay(directory = 'out/real-battle-replay') {
  const web = process.env.ASTERA_WEB ?? 'http://localhost:5190';
  const api = process.env.ASTERA_REPLAY_API ?? 'http://127.0.0.1:5191';
  const fixture = JSON.parse(await readFile(process.env.ASTERA_REPLAY_FIXTURE ?? '/tmp/astera-real-replay-preview.json', 'utf8'));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const evidence = [], errors = [];
  const seek = (page, time) => page.getByLabel('Savaş zaman çizelgesi').evaluate((node, at) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, String(at));
    node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true }));
  }, time);
  await mkdir(directory, { recursive: true });
  try {
    for (const [viewer, width] of [[0, 1600], [1, 350]]) {
      const page = await browser.newPage({ viewport: { width, height: width === 350 ? 812 : 1000 }, locale: 'tr-TR' });
      page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
      page.on('console', message => { if (message.type() === 'error' && !message.text().includes('503')) errors.push(message.text()); });
      let replayRequests = 0, failNext = width === 350;
      const requestApi = path => fetch(`${api}${path}`, { headers: { authorization: `Bearer ${fixture.tokens[viewer]}` } });
      const replayResponse = await requestApi(`/api/reports/BATTLE/${fixture.reportId}/replay`);
      assert.equal(replayResponse.status, 200);
      const authoritative = await replayResponse.json();
      await page.route(url => url.pathname.startsWith('/api/'), async route => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/replay')) {
          replayRequests++;
          if (failNext) { failNext = false; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'PREVIEW_OFFLINE', message: 'Offline' }) }); return; }
        }
        await route.continue();
      });
      await page.goto(`${web}/real-battle-preview?viewer=${viewer === 1 ? 'defender' : 'attacker'}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.getByRole('button', { name: 'Savaşı izle', exact: true }).waitFor({ timeout: 30000 }).catch(async error => {
        console.error(error.message);
        if (!page.isClosed()) { await page.screenshot({ timeout: 15000, path: `${directory}/${width}-failure.png` }).catch(() => undefined); console.error(await page.locator('body').innerText().catch(() => 'Page closed')); }
        throw error;
      });
      assert.equal(replayRequests, 0, 'The report must not eagerly fetch the full enemy board');
      await page.screenshot({ timeout: 90000, path: `${directory}/${width}-report.png` });
      await page.getByRole('button', { name: 'Savaşı izle', exact: true }).click();
      if (width === 350) {
        await page.getByRole('alert').waitFor();
        await page.screenshot({ timeout: 90000, path: `${directory}/${width}-retry.png` });
        await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click();
      }
      await page.locator('.sim-model-loading').waitFor({ state: 'hidden', timeout: 90000 });
      await page.waitForFunction(() => window.__battleSimulator?.snapshot().drawCalls > 0, undefined, { timeout: 90000 });
      const pause = page.getByRole('button', { name: 'Duraklat', exact: true });
      if (await pause.count()) await pause.click();
      await seek(page, 0);
      const identity = await page.locator('[data-unit-readout]').evaluateAll((nodes, side) => {
        const meanY = list => list.reduce((sum, node) => sum + node.getBoundingClientRect().y, 0) / list.length;
        return { correctMarkers: nodes.every(node => node.classList.contains(node.dataset.unitReadout.startsWith(side) ? 'is-self' : 'is-enemy')),
          ownY: meanY(nodes.filter(node => node.dataset.unitReadout.startsWith(side))), enemyY: meanY(nodes.filter(node => !node.dataset.unitReadout.startsWith(side))) };
      }, viewer === 0 ? 'A' : 'D');
      assert.ok(identity.correctMarkers && identity.ownY > identity.enemyY, 'The real reader must own the lower fleet');
      console.log(JSON.stringify({ checkpoint: 'start', width, units: authoritative.replay.recording.ships.length }));
      await page.screenshot({ timeout: 90000, path: `${directory}/${width}-battle-start.png` });
      if (width === 1600) {
        const moments = await page.evaluate(async recording => {
          const { buildReplayTimeline } = await import('/src/battle-simulator/timeline.ts');
          const timeline = buildReplayTimeline(recording), opening = timeline.events.find(event => event.kind === 'AEGIS_STRIKE');
          const damage = timeline.events.find(event => event.kind === 'HIT' && event.hit.hullDamage > 0);
          return { beam: opening?.launchAt + .25, opening: opening?.at + .1, damage: damage?.at + .05 };
        }, authoritative.replay.recording);
        for (const [name, moment] of Object.entries(moments)) if (Number.isFinite(moment)) {
          await seek(page, moment);
          await page.waitForFunction(at => Math.abs(window.__battleSimulator.snapshot().time - at) < .01, moment);
          await page.screenshot({ timeout: 90000, path: `${directory}/${width}-${name}.png` });
        }
        await seek(page, 0);
      }
      const ground = authoritative.replay.recording.ships.find(ship => ship.ground);
      if (ground) {
        await page.locator('.sim-camera-tools select').selectOption(ground.id);
        await page.getByRole('button', { name: 'Gemiye odaklan', exact: true }).click();
        await page.waitForTimeout(1300);
        await page.screenshot({ timeout: 90000, path: `${directory}/${width}-ground-focus.png` });
        await page.getByRole('button', { name: 'Gemi ayrıntısını kapat', exact: true }).click();
        await page.getByRole('button', { name: 'Genel görünüm', exact: true }).click();
        await page.waitForTimeout(1300);
      }
      const maximum = Number(await page.getByLabel('Savaş zaman çizelgesi').getAttribute('max'));
      await seek(page, maximum);
      await page.waitForFunction(value => Math.abs(window.__battleSimulator.snapshot().time - value) < .01, maximum);
      const state = await page.evaluate(() => ({ ...window.__battleSimulator.snapshot(), width: innerWidth, pageWidth: document.documentElement.scrollWidth,
        stageHeight: document.querySelector('.sim-stage-panel').getBoundingClientRect().height }));
      const expected = authoritative.replay.recording.finalState ?? authoritative.replay.recording.rounds.at(-1)?.after;
      assert.deepEqual(state.ships, expected, 'Rendered final hull, shields and retreats must equal actual server settlement');
      assert.ok(state.finite && state.stageHeight > 260 && state.pageWidth <= state.width);
      assert.equal(await page.locator('body').innerText().then(text => text.includes('simulator.')), false);
      await page.screenshot({ timeout: 90000, path: `${directory}/${width}-battle-end.png` });
      if (width === 350) {
        await page.getByRole('button', { name: 'Atış dökümü', exact: true }).click();
        await page.keyboard.press('Escape');
        await page.getByRole('dialog', { name: 'Savaş tekrarı', exact: true }).waitFor();
      }
      await page.getByRole('button', { name: 'Rapora dön', exact: true }).click();
      assert.equal(await page.getByRole('dialog', { name: 'Savaş tekrarı', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Savaşı izle', exact: true }).waitFor();
      evidence.push({ viewer: authoritative.viewer, width, replayRequests, finalStateMatchesSettlement: true, identity, state });
      await writeFile(`${directory}/evidence.json`, JSON.stringify({ evidence, errors, complete: false }, null, 2));
      console.log(JSON.stringify({ checkpoint: 'viewer-passed', width, viewer: authoritative.viewer }));
      await page.close();
    }
    const modulePage = await browser.newPage({ viewport: { width: 350, height: 812 }, locale: 'tr-TR' });
    modulePage.on('pageerror', error => errors.push(error.message));
    let moduleFetches = 0;
    await modulePage.route(url => url.pathname.endsWith('/BattleReplayDialog.tsx'), async route => {
      moduleFetches++;
      if (moduleFetches === 1) await route.fulfill({ status: 503, headers: { 'Cache-Control': 'no-store' }, contentType: 'text/javascript', body: '' });
      else await route.continue();
    });
    await modulePage.goto(`${web}/real-battle-preview`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await modulePage.getByRole('button', { name: 'Savaşı izle', exact: true }).click();
    await modulePage.getByRole('alert').waitFor();
    await modulePage.screenshot({ timeout: 90000, path: `${directory}/350-view-download-failure.png` });
    await Promise.all([modulePage.waitForNavigation({ waitUntil: 'domcontentloaded' }), modulePage.getByRole('button', { name: 'Oyunu yenile', exact: true }).click()]);
    await modulePage.getByRole('button', { name: 'Savaşı izle', exact: true }).click();
    await modulePage.locator('.sim-model-loading').waitFor({ state: 'hidden', timeout: 90000 });
    await modulePage.waitForFunction(() => window.__battleSimulator?.snapshot().drawCalls > 0, undefined, { timeout: 90000 });
    assert.equal(moduleFetches, 2, 'Reload must really refetch a failed module, not reuse its rejected import');
    await modulePage.getByRole('button', { name: 'Rapora dön', exact: true }).click();
    evidence.push({ moduleDownloadRecovery: { passed: true, requests: moduleFetches, reportPreserved: true } });
    await modulePage.close();
    assert.deepEqual(errors, []);
    await writeFile(`${directory}/evidence.json`, JSON.stringify({ evidence, errors, complete: true }, null, 2));
    console.log(JSON.stringify({ passed: true, captures: 13, errors: 0, viewers: evidence.filter(row => row.viewer).map(row => row.viewer) }));
  } finally { await browser.close(); }
}
