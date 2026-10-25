/** Real-browser regressions for the simulator end-user review. No player APIs. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyBattleSimulatorReview(directory = 'out/battle-simulator-review-fixes') {
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const evidence = {}, errors = [], expectedRecoveryErrors = [];
  let requests = 0, recovering = false;
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, locale: 'tr-TR' });
  page.on('pageerror', error => { (recovering ? expectedRecoveryErrors : errors).push(error.message); });
  page.on('console', message => { if (message.type() === 'error') (recovering ? expectedRecoveryErrors : errors).push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests++; });
  const snap = () => page.evaluate(() => window.__battleSimulator.snapshot());
  const ready = async count => {
    await page.waitForFunction(expected => window.__battleSimulator && (!expected || window.__battleSimulator.snapshot().ships.length === expected), count, { timeout: 90000 });
    await page.locator('.sim-model-loading').waitFor({ state: 'hidden', timeout: 90000 });
    await page.locator('.sim-play:not([disabled])').waitFor({ timeout: 90000 });
    const pause = page.getByRole('button', { name: 'Duraklat', exact: true }); if (await pause.count()) await pause.click();
  };
  const seek = async at => {
    await page.getByLabel('Savaş zaman çizelgesi').evaluate((input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    }, at);
    await page.waitForFunction(value => Math.abs(window.__battleSimulator.snapshot().time - value) < .021, at);
  };
  const capture = async name => { await page.screenshot({ path: `${directory}/${name}.png` }); };
  const geometry = () => page.evaluate(() => ({
    width: innerWidth, pageWidth: document.documentElement.scrollWidth,
    stage: document.querySelector('.sim-stage-panel').getBoundingClientRect().toJSON(),
    transport: document.querySelector('.sim-transport').getBoundingClientRect().toJSON(),
    log: document.querySelector('.sim-log').getBoundingClientRect().toJSON(),
    card: document.querySelector('.sim-selected')?.getBoundingClientRect().toJSON(),
  }));
  try {
    await page.goto(`${process.env.ASTERA_WEB ?? 'http://localhost:5188'}/?simulator=1`, { waitUntil: 'domcontentloaded' });
    await ready();
    await page.getByLabel('Savaş zaman çizelgesi').focus(); await page.keyboard.press('End');
    await page.waitForFunction(() => window.__battleSimulator.snapshot().phase === 'FINISHED');
    assert.ok(await page.locator('.sim-result').count());
    await capture('desktop-keyboard-end');
    await page.getByRole('button', { name: 'Baştan izle', exact: true }).click();
    evidence.keyboardEnd = { finished: true, rewind: true };
    await page.locator('.sim-shot-list button').first().click();
    const first = await page.locator('.sim-shot-detail h3').innerText();
    await page.getByRole('button', { name: 'Sonraki atış', exact: true }).click();
    assert.notEqual(await page.locator('.sim-shot-detail h3').innerText(), first);
    await page.getByRole('button', { name: 'Baştan izle', exact: true }).click();
    assert.equal(await page.locator('.sim-shot-detail table').count(), 0);
    evidence.navigation = { passed: true };

    const forcePositions = () => page.locator('[data-unit-readout]').evaluateAll(nodes => {
      const y = prefix => {
        const group = nodes.filter(node => node.dataset.unitReadout.startsWith(prefix));
        return group.reduce((sum, node) => sum + node.getBoundingClientRect().y, 0) / group.length;
      };
      return { attackY: y('A'), defenceY: y('D'), correctMarkers: nodes.every(node => node.classList.contains(node.dataset.unitReadout.startsWith('A') ? 'is-self' : 'is-enemy')) };
    });
    const beforeOrbit = await forcePositions(), stage = await page.locator('.sim-stage-panel').boundingBox();
    await page.mouse.move(stage.x + stage.width * .5, stage.y + stage.height * .58); await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * .5 + stage.height * .5, stage.y + stage.height * .58, { steps: 24 }); await page.mouse.up();
    await page.waitForTimeout(1200);
    const afterOrbit = await forcePositions();
    assert.ok((beforeOrbit.attackY - beforeOrbit.defenceY) * (afterOrbit.attackY - afterOrbit.defenceY) < 0, 'test must actually turn the fleets around');
    assert.ok(afterOrbit.correctMarkers, 'world identity must survive a reversed camera');
    await capture('desktop-orbit');
    await page.getByRole('button', { name: 'Genel görünüm', exact: true }).click(); await page.waitForTimeout(1200);
    evidence.orbit = { beforeOrbit, afterOrbit, reset: true };

    // The wide editor already open becomes a blocking phone sheet.
    await page.getByRole('button', { name: 'Savaşı oynat', exact: true }).click();
    await page.setViewportSize({ width: 350, height: 812 });
    await page.locator('.sim-play[aria-label="Savaşı oynat"]').waitFor({ timeout: 10000 });
    assert.equal(await page.locator('.sim-play').getAttribute('aria-label'), 'Savaşı oynat');
    await page.locator('.sim-close-settings').click();
    const labels = await page.locator('.sim-hp-value').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none' && getComputedStyle(node.parentElement).opacity !== '0').length);
    assert.ok(labels < 22, 'phone overview must give ships priority over a wall of tiny numeric labels');
    await page.locator('.sim-camera-tools select').selectOption('A9');
    await page.getByRole('button', { name: 'Gemiye odaklan', exact: true }).click();
    await page.waitForTimeout(1300);
    const focus = await page.locator('[data-unit-readout="A9"]').boundingBox();
    const phone = await geometry();
    assert.ok(focus && phone.card && focus.y + focus.height / 2 < phone.card.y, 'focused ship must be visible above the inspector');
    assert.ok(phone.pageWidth <= 350, 'phone transport must not overflow');
    evidence.phoneFocus = { ...phone, unit: focus };
    await capture('phone-focus');
    await page.getByRole('button', { name: 'Gemi ayrıntısını kapat' }).click();
    await page.getByRole('button', { name: 'Genel görünüm', exact: true }).click();
    await page.locator('.sim-log-toggle[aria-controls]').click();
    await page.locator('.sim-shot-list button').first().click();
    const open = await geometry();
    assert.ok(open.log.y + open.log.height <= open.transport.y, 'log must leave transport usable');
    assert.ok(open.log.y > open.stage.y + open.stage.height * .3, 'log must leave part of the field visible');
    await page.locator('.sim-log-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
    await capture('phone-log-scrolled');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.sim-log-toggle[aria-controls]').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.sim-log-toggle[aria-controls]').evaluate(node => node === document.activeElement), true);
    evidence.phoneLog = { ...open, escaped: true };

    await page.getByRole('button', { name: 'Filoları düzenle', exact: true }).click();
    assert.equal(await page.locator('.sim-preset select').isVisible(), true);
    for (const side of ['Saldıran', 'Savunan']) {
      await page.getByRole('tab', { name: side, exact: true }).click();
      await page.getByRole('button', { name: 'Filoyu temizle', exact: true }).click();
      await page.getByLabel('Ok · Adet', { exact: true }).fill('18');
    }
    await page.getByLabel('Aegis seviyesi', { exact: true }).fill('0');
    await page.locator('.sim-seed input').fill('0');
    await page.getByRole('button', { name: 'Savaşı simüle et', exact: true }).click();
    await ready(36);
    const rounds = await page.locator('.sim-round-tabs button').count();
    let escapedFrame;
    for (let i = 0; i < rounds; i++) {
      await page.locator('.sim-round-tabs button').nth(i).click();
      await page.getByRole('button', { name: 'Tur sonuna git', exact: true }).click();
      escapedFrame = await snap();
      if (escapedFrame.ships.some(ship => ship.status === 'RETREATED')) break;
    }
    assert.ok(escapedFrame.ships.some(ship => ship.status === 'RETREATED'), 'deterministic sample must contain an escape');
    const escapeAt = escapedFrame.time;
    await seek(escapeAt + .65); await capture('phone-retreat-flight');
    await seek(escapeAt + 1.55);
    await page.getByRole('button', { name: 'Genel görünüm', exact: true }).click();
    await page.waitForTimeout(1200); await capture('phone-retreat-parked');
    const escapedShips = (await snap()).ships.filter(ship => ship.status === 'RETREATED');
    assert.ok(escapedShips.every(ship => ship.hp > 0));
    await page.locator('.sim-retreat-scroll button').first().click();
    assert.ok((await page.locator('.sim-selected').innerText()).includes('hayatta'));
    await capture('phone-retreat-inspected');
    await page.getByRole('button', { name: 'Baştan izle', exact: true }).click();
    assert.equal(await page.locator('.sim-retreat-roster').count(), 0);
    evidence.retreat = { escapeAt, ships: escapedShips, rewind: true };

    await page.setViewportSize({ width: 812, height: 350 });
    await page.getByRole('button', { name: 'Gemi ayrıntısını kapat' }).click();
    evidence.landscape = await geometry();
    assert.ok(evidence.landscape.stage.height >= 170, 'landscape must retain a usable battlefield');
    await capture('landscape');

    await page.setViewportSize({ width: 1600, height: 1000 });
    await seek(12.5);
    const beforeLoss = await snap(); recovering = true;
    const supported = await page.evaluate(() => {
      const extension = document.querySelector('canvas').getContext('webgl2')?.getExtension('WEBGL_lose_context');
      window.__simulatorGpuTest = extension; extension?.loseContext(); return !!extension;
    });
    assert.ok(supported, 'controlled GPU loss must be available');
    await page.waitForTimeout(700); await capture('gpu-lost');
    assert.equal(await page.locator('.sim-play').isDisabled(), true);
    await page.evaluate(() => { window.__simulatorGpuTest.restoreContext(); });
    await page.locator('.sim-play:not([disabled])').waitFor({ timeout: 45000 });
    const recovered = await snap();
    assert.equal(recovered.time, beforeLoss.time); assert.deepEqual(recovered.ships, beforeLoss.ships);
    assert.ok(recovered.finite && recovered.drawCalls > 0);
    recovering = false; await capture('gpu-restored');
    evidence.gpu = { sameTime: true, sameShips: true, expectedRecoveryErrors };

    assert.equal(requests, 0); assert.deepEqual(errors, []);
    evidence.requests = requests; evidence.errors = errors;
    console.log(JSON.stringify({ passed: Object.keys(evidence), expectedRecoveryErrors }));
  } finally {
    await writeFile(`${directory}/evidence.json`, JSON.stringify(evidence, null, 2));
    await browser.close();
  }
}

/** A retry must retry the failed asset promise, preserving the calculated battle. */
export async function verifyBattleAssetRetry(directory = 'out/battle-simulator-asset-retry') {
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 350, height: 812 }, locale: 'tr-TR' });
  let modelRequests = 0, workerRequests = 0;
  await page.route('**/assets/models/ships/nullifier.glb', async route => {
    modelRequests++;
    if (modelRequests === 1) await route.abort(); else await route.continue();
  });
  page.on('request', request => { if (/simulation.worker-[^/]+\.js/.test(request.url())) workerRequests++; });
  try {
    await page.goto(`${process.env.ASTERA_WEB ?? 'http://localhost:5188'}/?simulator=1`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '3B görünümü yeniden aç', exact: true }).waitFor({ timeout: 45000 });
    assert.equal(await page.locator('.sim-play').isDisabled(), true);
    await page.screenshot({ path: `${directory}/asset-unavailable.png` });
    await page.getByLabel('Savaş zaman çizelgesi').evaluate(input => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '12.5');
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.getByRole('button', { name: '3B görünümü yeniden aç', exact: true }).click();
    await page.locator('.sim-play:not([disabled])').waitFor({ timeout: 20000 });
    const snapshot = await page.evaluate(() => window.__battleSimulator.snapshot());
    assert.equal(snapshot.time, 12.5); assert.ok(snapshot.finite && snapshot.drawCalls > 0);
    assert.ok(modelRequests >= 2, 'retry must refetch the rejected model');
    assert.equal(workerRequests, 1, 'retrying graphics must not calculate another battle');
    await page.screenshot({ path: `${directory}/asset-recovered.png` });
    await writeFile(`${directory}/evidence.json`, JSON.stringify({ modelRequests, workerRequests, time: snapshot.time, finite: snapshot.finite }, null, 2));
    console.log(JSON.stringify({ assetRetry: 'passed', modelRequests, workerRequests, time: snapshot.time }));
  } finally { await browser.close(); }
}
